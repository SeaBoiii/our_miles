import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const SESSION_COOKIE = "our_miles_session";
export const SESSION_HOURS = 8;
export const REMEMBER_DAYS = 30;
export type SessionOwner = "aleem" | "nurul";

type PrivateConfiguration = { mode: "private"; pin: string; secret: string };
export type AuthConfiguration =
  | PrivateConfiguration
  | { mode: "demo" }
  | { mode: "configuration-error" };

/** An incomplete private configuration fails closed; it must never enable demo writes. */
export function getAuthConfiguration(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AuthConfiguration {
  const pin = env.OUR_MILES_PIN;
  const secret = env.OUR_MILES_SESSION_SECRET;
  if (!pin && !secret) return { mode: "demo" };
  if (!pin || !/^\d{6,12}$/.test(pin) || !secret || secret.length < 32) {
    return { mode: "configuration-error" };
  }
  return { mode: "private", pin, secret };
}

export function pinMatches(candidate: string, configuredPin: string): boolean {
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(candidate), hash(configuredPin));
}

export type Session = {
  v: 1;
  owner: SessionOwner;
  iat: number;
  exp: number;
  nonce: string;
};

export function createSession(
  owner: SessionOwner,
  remember: boolean,
  secret: string,
  now = Date.now(),
) {
  const maxAge = remember ? REMEMBER_DAYS * 86400 : SESSION_HOURS * 3600;
  const session: Session = {
    v: 1,
    owner,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + maxAge,
    nonce: randomBytes(16).toString("hex"),
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return { token: `${payload}.${signature}`, maxAge, session };
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Session | null {
  if (!token || token.length > 1024) return null;
  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    !parts.every((part) => /^[a-zA-Z0-9_-]+$/.test(part))
  )
    return null;
  const [payload, signature] = parts;
  const supplied = Buffer.from(signature, "base64url");
  const expected = createHmac("sha256", secret).update(payload).digest();
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<Session>;
    const timestamp = Math.floor(now / 1000);
    if (
      session.v !== 1 ||
      (session.owner !== "aleem" && session.owner !== "nurul") ||
      typeof session.iat !== "number" ||
      !Number.isSafeInteger(session.iat) ||
      typeof session.exp !== "number" ||
      !Number.isSafeInteger(session.exp) ||
      session.iat > timestamp + 60 ||
      session.exp <= timestamp ||
      session.exp <= session.iat ||
      session.exp - session.iat > REMEMBER_DAYS * 86400 ||
      typeof session.nonce !== "string" ||
      !/^[a-f0-9]{32}$/.test(session.nonce)
    )
      return null;
    return session as Session;
  } catch {
    return null;
  }
}

type AttemptBucket = { attempts: number; expiresAt: number };

/** Single-server protection. A shared external limiter is required for multiple replicas. */
export class LoginLimiter {
  private readonly buckets = new Map<string, AttemptBucket>();
  constructor(
    private readonly windowMs = 15 * 60 * 1000,
    private readonly maximum = 8,
  ) {}

  consume(
    key: string,
    now = Date.now(),
  ): { allowed: boolean; retryAfter: number } {
    for (const [id, bucket] of this.buckets)
      if (bucket.expiresAt <= now) this.buckets.delete(id);
    const bucket = this.buckets.get(key) ?? {
      attempts: 0,
      expiresAt: now + this.windowMs,
    };
    if (bucket.attempts >= this.maximum) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
      };
    }
    bucket.attempts += 1;
    this.buckets.set(key, bucket);
    return { allowed: true, retryAfter: 0 };
  }
}

const limiterState = globalThis as typeof globalThis & {
  ourMilesLoginLimiters?: { individual: LoginLimiter; total: LoginLimiter };
};
export const loginLimiters = (limiterState.ourMilesLoginLimiters ??= {
  individual: new LoginLimiter(),
  total: new LoginLimiter(15 * 60 * 1000, 60),
});

export function loginIdentity(request: Request): string {
  // Forwarded IPs are user-controlled unless the deployment strips them at its trusted proxy.
  const forwarded =
    process.env.OUR_MILES_TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      : undefined;
  return forwarded
    ? createHash("sha256").update(forwarded.slice(0, 200)).digest("hex")
    : "shared-private-household";
}
