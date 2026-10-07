import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSession, getAuthConfiguration, LoginLimiter, pinMatches, verifySession } from "@/lib/server/auth";
import { readJson, sameOrigin } from "@/lib/server/http";
import { FileStateStore, SupabaseStateStore, VersionConflict } from "@/lib/server/storage";
import { parseAppState, snapshotsPreserved } from "@/lib/server/state-schema";
import type { AppState } from "@/lib/state";

const secret = "test-only-session-secret-with-at-least-32-characters";
const directories: string[] = [];
const minimalState = (): AppState => ({ schemaVersion: 1, cards: [], transactions: [], offers: [], goals: [], mileBalance: 0, mileValueSgd: 0.015 });

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) {
    // Remove only the exact unique temporary directories this test created.
    if (!path.resolve(directory).startsWith(path.join(path.resolve(tmpdir()), "our-miles-test-"))) throw new Error("Invalid test directory.");
    await rm(directory, { recursive: true, force: true });
  }
});

describe("private access", () => {
  it("keeps an unconfigured demo separate and fails closed on partial or weak private configuration", () => {
    expect(getAuthConfiguration({})).toEqual({ mode: "demo" });
    expect(getAuthConfiguration({ OUR_MILES_PIN: "527194" })).toEqual({ mode: "configuration-error" });
    expect(getAuthConfiguration({ OUR_MILES_PIN: "1234", OUR_MILES_SESSION_SECRET: secret })).toEqual({ mode: "configuration-error" });
    expect(getAuthConfiguration({ OUR_MILES_PIN: "527194", OUR_MILES_SESSION_SECRET: "weak" })).toEqual({ mode: "configuration-error" });
    expect(getAuthConfiguration({ OUR_MILES_PIN: "527194", OUR_MILES_SESSION_SECRET: secret }).mode).toBe("private");
  });

  it("rejects tampered, expired and differently signed sessions", () => {
    const now = Date.UTC(2026, 9, 5);
    const { token } = createSession("nurul", false, secret, now);
    expect(verifySession(token, secret, now)?.owner).toBe("nurul");
    expect(verifySession(`${token.slice(0, -4)}AAAA`, secret, now)).toBeNull();
    expect(verifySession(token, `${secret}-rotated`, now)).toBeNull();
    expect(verifySession(token, secret, now + 8 * 3600 * 1000)).toBeNull();
    expect(verifySession(undefined, secret, now)).toBeNull();
  });

  it("expires a remembered device after thirty days and uses unique session tokens", () => {
    const now = Date.UTC(2026, 9, 5);
    const first = createSession("aleem", true, secret, now);
    const second = createSession("aleem", true, secret, now);
    expect(first.token).not.toBe(second.token);
    expect(verifySession(first.token, secret, now + 29 * 86400 * 1000)).not.toBeNull();
    expect(verifySession(first.token, secret, now + 30 * 86400 * 1000)).toBeNull();
    expect(pinMatches("527194", "527194")).toBe(true);
    expect(pinMatches("527195", "527194")).toBe(false);
    expect(pinMatches("1", "527194")).toBe(false);
  });

  it("blocks repeated attempts until their window expires", () => {
    const limiter = new LoginLimiter(15000, 2);
    expect(limiter.consume("device", 0).allowed).toBe(true);
    expect(limiter.consume("device", 1000).allowed).toBe(true);
    expect(limiter.consume("device", 2000)).toEqual({ allowed: false, retryAfter: 13 });
    expect(limiter.consume("device", 15000).allowed).toBe(true);
  });

  it("rejects cross-origin mutations and oversized bodies even without Content-Length", async () => {
    vi.stubEnv("OUR_MILES_PUBLIC_ORIGIN", "https://miles.example.com");
    expect(sameOrigin(new Request("https://miles.example.com/api/state", { headers: { origin: "https://other.example.com" } }))).toBe(false);
    expect(sameOrigin(new Request("https://miles.example.com/api/state"))).toBe(false);
    expect(sameOrigin(new Request("https://miles.example.com/api/state", { headers: { origin: "https://miles.example.com" } }))).toBe(true);
    const request = new Request("https://miles.example.com/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ huge: "x".repeat(500) }) });
    await expect(readJson(request, 100)).rejects.toMatchObject({ status: 413 });
  });
});

describe("durable private state", () => {
  it("persists across store instances and prevents concurrent lost updates", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "our-miles-test-"));
    directories.push(directory);
    const first = new FileStateStore(parseAppState, directory);
    const second = new FileStateStore(parseAppState, directory);
    expect(await first.read()).toEqual({ version: 0, state: null });
    const outcomes = await Promise.allSettled([
      first.write(0, { ...minimalState(), mileBalance: 100 }),
      second.write(0, { ...minimalState(), mileBalance: 200 }),
    ]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((item) => item.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(VersionConflict);
    expect((await new FileStateStore(parseAppState, directory).read()).version).toBe(1);
    expect(await readdir(directory)).toEqual(["state.json"]);
  });

  it("preserves a corrupt file rather than silently replacing it", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "our-miles-test-"));
    directories.push(directory);
    await writeFile(path.join(directory, "state.json"), "corrupt data", "utf8");
    const store = new FileStateStore(parseAppState, directory);
    await expect(store.write(0, minimalState())).rejects.toThrow();
    expect(await readFile(path.join(directory, "state.json"), "utf8")).toBe("corrupt data");
    expect(() => new FileStateStore(parseAppState, "public/private-data")).toThrow();
  });

  it("rejects unrecognized credential fields, broken links and invalid dates", () => {
    expect(() => parseAppState({ ...minimalState(), cardNumber: "not-allowed" })).toThrow();
    expect(() => parseAppState({ ...minimalState(), cards: [{ id: "card", templateId: "citi-rewards", owner: "Aleem", status: "active", usageKnown: true, cvv: "not-allowed" }] })).toThrow();
    expect(() => parseAppState({ ...minimalState(), goals: [{ id: "trip", name: "Trip", destination: "New Zealand", targetMiles: 10000, targetDate: "2026-02-30" }] })).toThrow();
    expect(parseAppState(minimalState())).toEqual(minimalState());
  });

  it("accepts database atomic writes and treats empty RPC results as version conflicts", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ version: 1, state: minimalState() }]), { status: 200 }));
    const store = new SupabaseStateStore(parseAppState, "https://private-project.supabase.co", "sb_secret_test_only");
    expect((await store.write(0, minimalState())).version).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://private-project.supabase.co/rest/v1/rpc/save_our_miles_state");
    fetchMock.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    await expect(store.write(0, minimalState())).rejects.toBeInstanceOf(VersionConflict);
  });

  it("preserves recorded calculation evidence when a transaction is reversed", () => {
    const state = minimalState();
    state.cards = [{ id: "card", templateId: "citi-rewards", owner: "Aleem", status: "active", usageKnown: true }];
    state.transactions = [{
      id: "transaction", cardId: "card", amountSgd: 100, merchant: "FairPrice", category: "online", channel: "online", paymentMethod: "card", currency: "SGD", date: "2026-10-05", status: "pending",
      reward: { calculatedAt: "2026-10-05T12:00:00.000Z", templateId: "citi-rewards", ruleId: "citi-online-2026-10", ruleVersion: 1, sourceUrl: "https://bank.example.com/terms", lastVerifiedAt: "2026-10-05", miles: 400, cashbackSgd: 0, fxFeeSgd: 0, effectiveMpd: 4, confidence: "Likely", bonusSpendSgd: 100, qualifyingSpendSgd: 100, welcomeContributionSgd: 0, welcomeIncrementalMiles: 0, reason: "Online retail", warnings: [] },
    }];
    const reversed = structuredClone(state);
    reversed.transactions[0].status = "reversed";
    expect(snapshotsPreserved(parseAppState(state), parseAppState(reversed))).toBe(true);
    reversed.transactions[0].reward.miles = 99999;
    expect(snapshotsPreserved(parseAppState(state), parseAppState(reversed))).toBe(false);
  });
});
