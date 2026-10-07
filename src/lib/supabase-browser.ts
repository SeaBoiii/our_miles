import type { SupabaseClient } from "@supabase/supabase-js";
import type { Owner } from "./domain";
import { parseAppState } from "./state-schema";
import type { AppState } from "./state";

// Only these public values are bundled. A publishable key never grants wallet access.
export const usesSupabase =
  process.env.NEXT_PUBLIC_HOSTING_MODE === "pages" ||
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function publicSupabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  let origin: URL;
  try {
    origin = new URL(url);
  } catch {
    throw new Error("Set the Supabase project URL and publishable key, then rebuild the site.");
  }
  if (
    origin.protocol !== "https:" || origin.username || origin.password ||
    origin.pathname !== "/" || origin.search || origin.hash ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
  ) {
    throw new Error("Use an HTTPS Supabase project URL and its publishable key, then rebuild the site.");
  }
  return { url: origin.origin, key };
}

let clientPromise: Promise<SupabaseClient> | undefined;
let rememberDevice = false;
const temporaryAuth = new Map<string, string>();

function authStorage() {
  return {
    getItem(key: string) {
      try {
        const temporary = sessionStorage.getItem(key);
        if (temporary) { rememberDevice = false; return temporary; }
        const remembered = localStorage.getItem(key);
        if (remembered) { rememberDevice = true; return remembered; }
      } catch { /* A restricted browser can keep the session in memory. */ }
      return temporaryAuth.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      temporaryAuth.set(key, value);
      try {
        (rememberDevice ? sessionStorage : localStorage).removeItem(key);
        (rememberDevice ? localStorage : sessionStorage).setItem(key, value);
      } catch { /* No wallet data is stored here; only the sign-in session. */ }
    },
    removeItem(key: string) {
      temporaryAuth.delete(key);
      try { localStorage.removeItem(key); } catch { /* optional storage */ }
      try { sessionStorage.removeItem(key); } catch { /* optional storage */ }
    },
  };
}

export async function supabaseClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { url, key } = publicSupabaseConfiguration();
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(url, key, {
        auth: {
          storageKey: `our-miles-auth:${new URL(url).hostname}:${basePath || "/"}`,
          storage: authStorage(),
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
      });
    })();
    // Invalid configuration must be recoverable after a new deployment/reload.
    void clientPromise.catch(() => { clientPromise = undefined; });
  }
  return clientPromise;
}

export async function authenticatedOwner(): Promise<Owner | null> {
  const client = await supabaseClient();
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error("Your sign-in session could not be restored. Please sign in again.");
  if (!session.session) return null;
  // Verify the user with Auth; local storage alone is never proof of access.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    if (!navigator.onLine || error?.name === "AuthRetryableFetchError")
      throw new Error("Reconnect to verify your sign-in and open our wallet.");
    await client.auth.signOut({ scope: "local" });
    return null;
  }
  const membership = await client.from("our_miles_members")
    .select("owner").eq("user_id", data.user.id).maybeSingle();
  if (membership.error) throw new Error("Could not verify wallet access. Check the Supabase setup and reconnect.");
  if (membership.data?.owner !== "Aleem" && membership.data?.owner !== "Nurul") {
    await client.auth.signOut({ scope: "local" });
    throw new WalletAccessError("This account is not invited to our wallet.");
  }
  return membership.data.owner;
}

export class WalletAccessError extends Error {}
export class WalletConflictError extends Error {}
export class WalletSessionError extends Error {}
export type BrowserStoredState = { version: number; state: AppState | null };

function decodeWallet(input: unknown): BrowserStoredState {
  if (!input || typeof input !== "object") throw new Error("Could not read the shared wallet. Check the Supabase setup.");
  const value = input as Record<string, unknown>;
  if (typeof value.version !== "number" || !Number.isSafeInteger(value.version) || value.version < 0)
    throw new Error("Could not read the shared wallet version.");
  return { version: value.version, state: value.state === null ? null : parseAppState(value.state) };
}

export async function readSupabaseWallet(): Promise<BrowserStoredState> {
  const client = await supabaseClient();
  const { data, error } = await client.from("our_miles_state")
    .select("version,state").eq("id", true).maybeSingle();
  if (error || !data) throw new Error("Could not load our wallet. Check access and reconnect, then try again.");
  return decodeWallet(data);
}

export async function saveSupabaseWallet(version: number, state: AppState): Promise<BrowserStoredState> {
  const client = await supabaseClient();
  const { data, error } = await client.rpc("save_our_miles_state", {
    expected_version: version,
    next_state: parseAppState(state),
  });
  if (error) {
    if (error.code === "42501" || error.code === "PGRST301" || error.code === "PGRST303")
      throw new WalletSessionError("Your wallet access ended. Sign in again to continue.");
    if (error.code === "22023" || error.code === "23514")
      throw new Error("This change failed the wallet checks and was not saved.");
    throw new Error("This change was not saved. Reconnect and try again.");
  }
  if (!Array.isArray(data)) throw new Error("Could not confirm this save. Reload before trying again.");
  if (data.length === 0) throw new WalletConflictError();
  return decodeWallet(data[0]);
}

export async function signInSupabase(email: string, password: string, remember: boolean) {
  const client = await supabaseClient();
  rememberDevice = remember;
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.status === 429) throw new Error("Too many sign-in attempts. Wait a little and try again.");
    if (error.name === "AuthRetryableFetchError") throw new Error("Could not connect. Check your connection and try again.");
    throw new Error("Could not sign in. Check your email and password.");
  }
}

export async function signOutSupabase() {
  const client = await supabaseClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  // Clear this device even if the network cannot revoke its refresh token.
  const storageKey = `our-miles-auth:${new URL(publicSupabaseConfiguration().url).hostname}:${basePath || "/"}`;
  authStorage().removeItem(storageKey);
  return !error;
}
