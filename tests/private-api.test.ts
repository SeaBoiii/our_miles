import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET as getSession, POST as signIn, DELETE as signOut } from "@/app/api/session/route";
import { GET as getState, PUT as putState } from "@/app/api/state/route";
import { createSession, SESSION_COOKIE } from "@/lib/server/auth";
import { recommend } from "@/lib/engine";
import type { AppState } from "@/lib/state";
import type { Purchase } from "@/lib/domain";

const secret = "test-only-private-api-secret-with-more-than-32-characters";
const origin = "https://our-miles.example.com";
const empty = { schemaVersion: 1, cards: [], transactions: [], offers: [], goals: [], mileBalance: 0, mileValueSgd: 0.015 };
const directories: string[] = [];

function privateEnvironment() {
  vi.stubEnv("OUR_MILES_PIN", "527194");
  vi.stubEnv("OUR_MILES_SESSION_SECRET", secret);
  vi.stubEnv("OUR_MILES_PUBLIC_ORIGIN", origin);
  vi.stubEnv("OUR_MILES_SUPABASE_URL", "");
  vi.stubEnv("OUR_MILES_SUPABASE_SECRET_KEY", "");
  vi.stubEnv("OUR_MILES_TRUST_PROXY", "false");
}

function request(route: string, method = "GET", body?: unknown, cookie?: string, requestOrigin = origin) {
  return new NextRequest(`${origin}${route}`, {
    method,
    headers: { origin: requestOrigin, "content-type": "application/json", ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    if (!path.resolve(directory).startsWith(path.join(path.resolve(tmpdir()), "our-miles-api-test-"))) throw new Error("Invalid test directory.");
    await rm(directory, { force: true, recursive: true });
  }
});

describe("private API boundary", () => {
  it("disables the private wallet entirely in demo mode", async () => {
    vi.stubEnv("OUR_MILES_PIN", "");
    vi.stubEnv("OUR_MILES_SESSION_SECRET", "");
    expect(await (await getSession(request("/api/session"))).json()).toEqual({ mode: "demo", authenticated: false, owner: null });
    expect((await getState(request("/api/state"))).status).toBe(403);
    expect((await putState(request("/api/state", "PUT", { version: 0, state: empty }))).status).toBe(403);
  });

  it("protects reads and writes even when the client bypasses the sign-in screen", async () => {
    privateEnvironment();
    expect((await getState(request("/api/state"))).status).toBe(401);
    expect((await putState(request("/api/state", "PUT", { version: 0, state: empty }, "forged"))).status).toBe(401);
    const token = createSession("aleem", false, secret).token;
    expect((await putState(request("/api/state", "PUT", { version: 0, state: empty }, token, "https://elsewhere.example.com"))).status).toBe(403);
    expect((await signIn(request("/api/session", "POST", { pin: "527194", owner: "aleem", remember: true }, undefined, "https://elsewhere.example.com"))).status).toBe(403);
  });

  it("issues only an HttpOnly session cookie and clears it on sign-out", async () => {
    privateEnvironment();
    const wrong = await signIn(request("/api/session", "POST", { pin: "527195", owner: "nurul", remember: false }));
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("set-cookie")).toBeNull();
    const signedIn = await signIn(request("/api/session", "POST", { pin: "527194", owner: "nurul", remember: true }));
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get("set-cookie")).toContain("HttpOnly");
    expect(signedIn.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(signedIn.headers.get("set-cookie")).toContain("Max-Age=2592000");
    expect(signedIn.headers.get("cache-control")).toContain("no-store");
    const token = signedIn.cookies.get(SESSION_COOKIE)?.value;
    expect(await (await getSession(request("/api/session", "GET", undefined, token))).json()).toEqual({ mode: "private", authenticated: true, owner: "nurul" });
    const signedOut = await signOut(request("/api/session", "DELETE", undefined, token));
    expect(signedOut.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await getSession(request("/api/session"))).status).toBe(200);
  });

  it("durably saves validated state, rejects stale writes and blocks credential fields", async () => {
    privateEnvironment();
    const directory = await mkdtemp(path.join(tmpdir(), "our-miles-api-test-"));
    directories.push(directory);
    vi.stubEnv("OUR_MILES_DATA_DIR", directory);
    const token = createSession("aleem", false, secret).token;
    expect(await (await getState(request("/api/state", "GET", undefined, token))).json()).toEqual({ version: 0, state: null });
    const first = await putState(request("/api/state", "PUT", { version: 0, state: empty }, token));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ version: 1, state: empty });
    expect(first.headers.get("cache-control")).toContain("no-store");
    const stale = await putState(request("/api/state", "PUT", { version: 0, state: { ...empty, mileBalance: 99 } }, token));
    expect(stale.status).toBe(409);
    expect((await putState(request("/api/state", "PUT", { version: 1, state: { ...empty, cvv: "not-allowed" } }, token))).status).toBe(422);
    expect(await (await getState(request("/api/state", "GET", undefined, token))).json()).toEqual({ version: 1, state: empty });
    expect(await readdir(directory)).toEqual(["state.json"]);
  });

  it("persists real engine snapshots and permits reversal while retaining their evidence", async () => {
    privateEnvironment();
    const directory = await mkdtemp(path.join(tmpdir(), "our-miles-api-test-"));
    directories.push(directory);
    vi.stubEnv("OUR_MILES_DATA_DIR", directory);
    const token = createSession("aleem", false, secret).token;
    const state: AppState = { ...empty, schemaVersion: 1, cards: [{ id: "aleem-citi", templateId: "citi-rewards", owner: "Aleem", status: "active", usageKnown: true, statementDay: 1, openingPeriodStart: "2026-10-01", openingSpendSgd: 0 }] };
    const purchase: Purchase = { amountSgd: 512, merchant: "Insta360", category: "online", channel: "online", paymentMethod: "card", currency: "SGD", date: "2026-10-05", mcc: 5732, mccConfidence: "Confirmed" };
    const result = recommend(purchase, state)[0];
    expect(result.miles).toBe(2048);
    state.transactions = [{ ...purchase, id: "recorded-purchase", cardId: result.card.id, status: "pending", reward: result.snapshot }];
    expect((await putState(request("/api/state", "PUT", { version: 0, state }, token))).status).toBe(200);
    const reversed = structuredClone(state);
    reversed.transactions[0].status = "reversed";
    expect((await putState(request("/api/state", "PUT", { version: 1, state: reversed }, token))).status).toBe(200);
    reversed.transactions[0].reward.miles = 99999;
    expect((await putState(request("/api/state", "PUT", { version: 2, state: reversed }, token))).status).toBe(422);
    const saved = await (await getState(request("/api/state", "GET", undefined, token))).json();
    expect(saved.state.transactions[0].status).toBe("reversed");
    expect(saved.state.transactions[0].reward.miles).toBe(2048);
  });
});
