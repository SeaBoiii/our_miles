import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type StoredState<T> = { version: number; state: T | null };
type Parser<T> = (input: unknown) => T;

export class VersionConflict extends Error {
  constructor() {
    super(
      "The shared wallet changed on another device. Reload it and try again.",
    );
  }
}

export interface StateStore<T> {
  read(): Promise<StoredState<T>>;
  write(version: number, state: T): Promise<StoredState<T>>;
}

const queueState = globalThis as typeof globalThis & {
  ourMilesWriteQueues?: Map<string, Promise<unknown>>;
};
const queues = (queueState.ourMilesWriteQueues ??= new Map<
  string,
  Promise<unknown>
>());

function serialise<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => undefined);
  return next;
}

function inside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export class FileStateStore<T> implements StateStore<T> {
  private readonly directory: string;
  private readonly filename: string;

  constructor(
    private readonly parse: Parser<T>,
    directory = process.env.OUR_MILES_DATA_DIR || ".our-miles",
  ) {
    this.directory = path.resolve(directory);
    if (
      inside(path.resolve("public"), this.directory) ||
      inside(path.resolve(".next"), this.directory)
    ) {
      throw new Error(
        "Private storage must be outside public and generated build directories.",
      );
    }
    this.filename = path.join(this.directory, "state.json");
  }

  async read(): Promise<StoredState<T>> {
    let contents: string;
    try {
      contents = await readFile(this.filename, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { version: 0, state: null };
      throw error;
    }
    const stored = JSON.parse(contents) as Record<string, unknown>;
    if (
      stored.format !== 1 ||
      typeof stored.version !== "number" ||
      !Number.isSafeInteger(stored.version) ||
      stored.version < 1
    ) {
      throw new Error("The stored wallet format could not be read.");
    }
    return { version: stored.version, state: this.parse(stored.state) };
  }

  async write(version: number, state: T): Promise<StoredState<T>> {
    const validated = this.parse(state);
    return serialise(this.filename, async () => {
      const current = await this.read();
      if (version !== current.version) throw new VersionConflict();
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = path.join(this.directory, `.state-${randomUUID()}.tmp`);
      const next = { version: version + 1, state: validated };
      try {
        const handle = await open(temporary, "wx", 0o600);
        try {
          await handle.writeFile(
            JSON.stringify({
              format: 1,
              ...next,
              updatedAt: new Date().toISOString(),
            }),
            "utf8",
          );
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporary, this.filename);
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
      }
      return next;
    });
  }
}

export class SupabaseStateStore<T> implements StateStore<T> {
  private readonly origin: string;
  constructor(
    private readonly parse: Parser<T>,
    url: string,
    private readonly secret: string,
  ) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/"
    ) {
      throw new Error("Use the HTTPS Supabase project origin.");
    }
    this.origin = parsed.origin;
  }

  private async call(endpoint: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(`${this.origin}/rest/v1/${endpoint}`, {
      ...init,
      headers: { apikey: this.secret, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error("The shared database could not be reached.");
    return response.json();
  }

  private decode(input: unknown): StoredState<T> {
    if (!input || typeof input !== "object")
      throw new Error("Invalid shared wallet response.");
    const record = input as Record<string, unknown>;
    if (
      typeof record.version !== "number" ||
      !Number.isSafeInteger(record.version) ||
      record.version < 0
    ) {
      throw new Error("Invalid shared wallet version.");
    }
    return {
      version: record.version,
      state: record.state === null ? null : this.parse(record.state),
    };
  }

  async read(): Promise<StoredState<T>> {
    const records = await this.call(
      "our_miles_state?id=eq.true&select=version,state",
    );
    if (!Array.isArray(records) || records.length !== 1)
      throw new Error("Apply the Our Miles database migration first.");
    return this.decode(records[0]);
  }

  async write(version: number, state: T): Promise<StoredState<T>> {
    const validated = this.parse(state);
    const records = await this.call("rpc/save_our_miles_state", {
      method: "POST",
      body: JSON.stringify({
        expected_version: version,
        next_state: validated,
      }),
    });
    if (!Array.isArray(records))
      throw new Error("Invalid shared wallet response.");
    if (records.length === 0) throw new VersionConflict();
    if (records.length !== 1)
      throw new Error("Invalid shared wallet response.");
    return this.decode(records[0]);
  }
}

export function createStateStore<T>(parse: Parser<T>): StateStore<T> {
  const url = process.env.OUR_MILES_SUPABASE_URL;
  const key = process.env.OUR_MILES_SUPABASE_SECRET_KEY;
  if (!url && !key) {
    // A serverless /tmp or deployment directory silently loses data. Require an explicit volume.
    if (
      (process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NETLIFY) &&
      !process.env.OUR_MILES_DATA_DIR
    ) {
      throw new Error(
        "Configure Supabase or an explicit persistent data volume before private use.",
      );
    }
    return new FileStateStore(parse);
  }
  if (!url || !key)
    throw new Error(
      "Both Supabase project URL and server secret key are required.",
    );
  if (!key.startsWith("sb_secret_"))
    throw new Error("Use a Supabase server secret key.");
  return new SupabaseStateStore(parse, url, key);
}
