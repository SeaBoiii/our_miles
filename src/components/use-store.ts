"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Owner } from "@/lib/domain";
import { demoState, emptyState, isOwner, type AppState } from "@/lib/state";
import {
  authenticatedOwner, basePath, readSupabaseWallet, saveSupabaseWallet,
  signInSupabase, signOutSupabase, supabaseClient, usesSupabase,
  WalletAccessError, WalletConflictError, WalletSessionError,
} from "@/lib/supabase-browser";

type Session = {
  mode: "demo" | "private";
  authenticated: boolean;
  owner: string | null;
};
export function useMilesStore() {
  const [state, setState] = useState<AppState | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [owner, setOwner] = useState<Owner>("Aleem");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(true);
  const version = useRef(0);
  const pending = useRef(false);
  const currentState = useRef<AppState | null>(null);
  const generation = useRef(0);
  const initialize = useCallback(async () => {
    if (pending.current) return false;
    const request = ++generation.current;
    try {
      let s: Session;
      if (usesSupabase) {
        const member = await authenticatedOwner();
        s = { mode: "private", authenticated: member !== null, owner: member?.toLowerCase() ?? null };
      } else {
        const response = await fetch(`${basePath}/api/session`, { cache: "no-store" });
        if (!response.ok) throw new Error("Private access is not configured. Check the server settings.");
        s = await response.json();
      }
      if (request !== generation.current) return false;
      setSession(s);
      setOnline(navigator.onLine);
      try {
        const preferred = localStorage.getItem("our-miles-owner");
        if (isOwner(preferred)) setOwner(preferred);
        else if (s.owner === "nurul" || s.owner === "aleem")
          setOwner(s.owner === "nurul" ? "Nurul" : "Aleem");
      } catch {
        if (s.owner === "nurul") setOwner("Nurul");
      }
      if (s.mode === "demo") {
        let data = demoState();
        try {
          const saved = localStorage.getItem("our-miles-demo");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (
              parsed.schemaVersion === 1 &&
              Array.isArray(parsed.cards) &&
              Array.isArray(parsed.transactions) &&
              Array.isArray(parsed.offers) &&
              Array.isArray(parsed.goals)
            )
              data = parsed;
          }
        } catch {
          /* recover malformed demo state */
        }
        currentState.current = data;
        setState(data);
      } else if (s.authenticated) {
        let data;
        if (usesSupabase) data = await readSupabaseWallet();
        else {
          const res = await fetch(`${basePath}/api/state`, { cache: "no-store" });
          if (!res.ok) throw new Error("Could not load your wallet. Reconnect and try again.");
          data = await res.json();
        }
        if (request !== generation.current || pending.current || data.version < version.current) return false;
        version.current = data.version;
        currentState.current = data.state ?? emptyState();
        setState(currentState.current);
      } else {
        currentState.current = null;
        setState(null);
      }
      setError("");
      return true;
    } catch (err) {
      if (request !== generation.current && !(err instanceof WalletAccessError)) return false;
      if (err instanceof WalletAccessError) {
        currentState.current = null;
        setState(null);
        setSession({ mode: "private", authenticated: false, owner: null });
      }
      if (!navigator.onLine) {
        setOnline(false);
        try {
          const saved = localStorage.getItem("our-miles-demo");
          // Only an explicitly remembered demo mode may reopen a local sample wallet offline.
          if (!usesSupabase && localStorage.getItem("our-miles-mode") === "demo") {
            try {
              const data = saved ? JSON.parse(saved) : demoState();
              currentState.current = data;
              setState(data);
              setSession({ mode: "demo", authenticated: false, owner: null });
              setError("");
              return true;
            } catch {
              /* fall through */
            }
          }
        } catch {
          /* restricted device storage requires reconnection */
        }
      }
      setError(
        !navigator.onLine
          ? "You’re offline. Reconnect to open our shared wallet."
          : err instanceof Error
            ? err.message
            : "Could not open your wallet.",
      );
      return false;
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(initialize);
    const connected = () => {
      setOnline(true);
      void initialize();
    };
    const disconnected = () => setOnline(false);
    const foreground = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void initialize();
    };
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    window.addEventListener("focus", foreground);
    document.addEventListener("visibilitychange", foreground);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: `${basePath}/` }).catch(() => {});
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    if (usesSupabase) void supabaseClient().then((client) => {
      if (disposed) return;
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          generation.current++;
          version.current = 0;
          currentState.current = null;
          setState(null);
          setSession({ mode: "private", authenticated: false, owner: null });
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => {});
    return () => {
      disposed = true;
      unsubscribe?.();
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
      window.removeEventListener("focus", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [initialize]);
  useEffect(() => {
    if (session) {
      try {
        localStorage.setItem("our-miles-mode", session.mode);
      } catch {
        /* persistence optional for preferences */
      }
    }
  }, [session]);
  const update = useCallback(
    async (transform: (state: AppState) => AppState): Promise<boolean> => {
      if (!currentState.current || pending.current) return false;
      const next = transform(currentState.current);
      if (session?.mode === "demo") {
        try {
          localStorage.setItem("our-miles-demo", JSON.stringify(next));
          currentState.current = next;
          setState(next);
          setError("");
          return true;
        } catch {
          setError("Device storage is full. Your last saved wallet is safe.");
          return false;
        }
      }
      pending.current = true;
      const request = generation.current;
      setSaving(true);
      try {
        let data;
        if (usesSupabase) data = await saveSupabaseWallet(version.current, next);
        else {
          const res = await fetch(`${basePath}/api/state`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: version.current, state: next }),
          });
          if (res.status === 409) throw new WalletConflictError();
          if (res.status === 401) throw new WalletSessionError("Your session ended. Unlock your wallet to continue.");
          if (!res.ok) throw new Error("This change was not saved. Your saved wallet is safe; reconnect and try again.");
          data = await res.json();
        }
        if (request !== generation.current) return false;
        version.current = data.version;
        currentState.current = data.state;
        setState(data.state);
        setError("");
        return true;
      } catch (err) {
        if (err instanceof WalletConflictError || err instanceof WalletSessionError) {
          pending.current = false;
          await initialize();
        }
        setError(
          err instanceof WalletConflictError
            ? "The other device updated your wallet. We refreshed it; please try your change again."
            : err instanceof Error ? err.message : "Could not save this change.",
        );
        return false;
      } finally {
        pending.current = false;
        setSaving(false);
      }
    },
    [session, initialize],
  );
  const switchOwner = (next: Owner) => {
    setOwner(next);
    try {
      localStorage.setItem("our-miles-owner", next);
    } catch {
      /* keep the in-memory profile */
    }
  };
  const login = async (secret: string, nextOwner: Owner, remember: boolean, email = "") => {
    setSaving(true);
    try {
      if (usesSupabase) {
        await signInSupabase(email, secret, remember);
        // A new account starts with its allowlisted owner, then can switch profiles.
        try { localStorage.removeItem("our-miles-owner"); } catch { /* optional preference */ }
      } else {
        const res = await fetch(`${basePath}/api/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: secret, owner: nextOwner.toLowerCase(), remember }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not unlock.");
        switchOwner(nextOwner);
      }
      return await initialize();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock.");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const logout = async () => {
    if (usesSupabase) {
      // Lock the visible wallet immediately, including while offline.
      generation.current++;
      currentState.current = null;
      version.current = 0;
      setState(null);
      setSession({ mode: "private", authenticated: false, owner: null });
      setError("");
      try {
        const revoked = await signOutSupabase();
        if (!revoked) setError("This device is locked. Reconnect before signing in again; the server session could not be revoked.");
      } catch { setError("This device is locked. Reconnect before signing in again."); }
      return;
    }
    try {
      const res = await fetch(`${basePath}/api/session`, { method: "DELETE" });
      if (res.ok) {
        currentState.current = null;
        setState(null);
        await initialize();
      } else setError("Could not lock your wallet. Try again.");
    } catch {
      setError(
        "Reconnect to lock the server session. Your saved wallet is safe.",
      );
    }
  };
  return {
    state,
    session,
    owner,
    switchOwner,
    update,
    error,
    setError,
    saving,
    online,
    login,
    logout,
    authMethod: usesSupabase ? "supabase" as const : "pin" as const,
    reload: initialize,
  };
}
