"use client";
import { useEffect, useState } from "react";
import {
  Home,
  ScanLine,
  Wallet,
  List,
  ArrowRight,
  ArrowUpRight,
  Settings,
  WifiOff,
  LockKeyhole,
  Check,
  Compass,
} from "lucide-react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { useMilesStore } from "./use-store";
import { Mark, Sheet } from "./primitives";
import {
  HomeScreen,
  GoalsScreen,
  BonusesScreen,
  ActivityScreen,
} from "./supporting-screens";
import { FinderScreen } from "./finder-screen";
import { WalletScreen } from "./wallet-screen";
import { demoState, emptyState, formatMiles } from "@/lib/state";
import type { Category, Owner } from "@/lib/domain";

export type Store = ReturnType<typeof useMilesStore>;
export type View =
  | "home"
  | "what-card"
  | "wallet"
  | "activity"
  | "goals"
  | "bonuses";
const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "what-card", label: "What Card?", icon: ScanLine },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "activity", label: "Activity", icon: List },
] as const;
export function MilesApp() {
  const store = useMilesStore();
  const [view, setView] = useState<View>("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickCategory, setQuickCategory] = useState<Category>("online");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [toast, setToast] = useState("");
  const go = (next: View, category?: Category) => {
    if (category) setQuickCategory(category);
    setView(next);
    window.history.pushState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.slice(1) as View;
      if (
        [
          "home",
          "what-card",
          "wallet",
          "activity",
          "goals",
          "bonuses",
        ].includes(next)
      )
        setView(next);
      else setView("home");
    };
    const resize = () =>
      setKeyboardOpen(
        (window.visualViewport?.height ?? window.innerHeight) <
          window.innerHeight * 0.75,
      );
    onHash();
    window.addEventListener("popstate", onHash);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("popstate", onHash);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!store.session || (store.session.authenticated && !store.state))
    return (
      <div className="opening">
        <Mark />
        <p>{store.error ? store.error : "Opening our wallet…"}</p>
        {store.error && (
          <button className="primary-button" onClick={store.reload}>
            Try again
          </button>
        )}
        {store.error && store.session?.authenticated && (
          <button className="text-action" onClick={store.logout}>
            Sign out
          </button>
        )}
      </div>
    );
  if (store.session.mode === "private" && !store.session.authenticated)
    return <Unlock store={store} />;
  if (!store.state)
    return (
      <div className="opening">
        <p>Could not load your wallet.</p>
        <button onClick={store.reload}>Try again</button>
      </div>
    );
  const screenProps = { store, go, notify: setToast };
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="app-shell">
          <aside className="desktop-sidebar">
            <a
              href="#home"
              className="brand"
              onClick={(e) => {
                e.preventDefault();
                go("home");
              }}
            >
              <Mark />
              <span>
                our<span className="brand-divider">_</span>miles
              </span>
            </a>
            <p className="sidebar-caption">A little closer, together.</p>
            <nav aria-label="Desktop navigation">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  aria-current={view === id ? "page" : undefined}
                  onClick={() => go(id)}
                >
                  <Icon size={19} />
                  {label}
                  {id === "what-card" && <ArrowUpRight size={16} />}
                </button>
              ))}
              <div className="nav-divider" />
              <button
                aria-current={view === "goals" ? "page" : undefined}
                onClick={() => go("goals")}
              >
                <Compass size={19} />
                Where we’re going
              </button>
              <button
                aria-current={view === "bonuses" ? "page" : undefined}
                onClick={() => go("bonuses")}
              >
                <Check size={19} />
                Welcome bonuses
              </button>
            </nav>
            <div className="sidebar-bottom">
              <span className="eyebrow">MADE FOR TWO</span>
              <p>Aleem & Nurul</p>
              <button
                className="text-action"
                onClick={() => setProfileOpen(true)}
              >
                <Settings size={15} />
                Preferences
              </button>
            </div>
          </aside>
          <div className="app-body">
            <header className="app-header">
              <a
                className="brand"
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  go("home");
                }}
              >
                <Mark />
                <span>
                  our<span className="brand-divider">_</span>miles
                </span>
              </a>
              <span className="desktop-header-copy">
                Every day, a little closer.
              </span>
              <button
                className="profile-button"
                onClick={() => setProfileOpen(true)}
                aria-label={`Profile and settings, current person ${store.owner}`}
              >
                <span className="avatar">{store.owner[0]}</span>
                <span>{store.owner}</span>
                <span className="profile-caret">⌄</span>
              </button>
            </header>
            {store.session.mode === "demo" && (
              <div className="demo-banner">
                <span>Sample wallet · your real data starts fresh</span>
                <button
                  onClick={() => setProfileOpen(true)}
                  aria-label="Demo wallet options"
                >
                  Options
                  <ArrowUpRight size={12} />
                </button>
              </div>
            )}
            {!store.online && (
              <div className="connection-banner">
                <WifiOff size={14} />
                {store.session.mode === "demo"
                  ? "Offline · changes saved on this device"
                  : "Offline · reconnect to save changes"}
              </div>
            )}
            {store.error && (
              <div className="error-banner" role="alert">
                <span>{store.error}</span>
                <button
                  onClick={() => store.setError("")}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}
            <main id="main-content" className={`main-content view-${view}`}>
              {view === "home" && <HomeScreen {...screenProps} />}
              <div hidden={view !== "what-card"}>
                <FinderScreen
                  key={quickCategory}
                  {...screenProps}
                  quickCategory={quickCategory}
                />
              </div>
              {view === "wallet" && <WalletScreen {...screenProps} />}
              {view === "activity" && <ActivityScreen {...screenProps} />}
              {view === "goals" && <GoalsScreen {...screenProps} />}
              {view === "bonuses" && <BonusesScreen {...screenProps} />}
            </main>
            <footer className="app-footer">
              <Mark />
              <span>Our everyday, taking us somewhere.</span>
              <span className="footer-status">
                <span />
                {store.session.mode === "demo"
                  ? "Saved on this device"
                  : "Private shared wallet"}
              </span>
            </footer>
          </div>
          <nav
            className={`bottom-nav ${keyboardOpen ? "keyboard-hidden" : ""}`}
            aria-label="Main navigation"
          >
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => go(id)}
                className={view === id ? "selected" : ""}
                aria-current={view === id ? "page" : undefined}
              >
                <Icon size={21} />
                <span>{label}</span>
                {view === id && <span className="nav-indicator" />}
              </button>
            ))}
          </nav>
        </div>
        {profileOpen && (
          <ProfileSheet
            store={store}
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            notify={setToast}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={17} />
            {toast}
          </div>
        )}
      </MotionConfig>
    </LazyMotion>
  );
}
function Unlock({ store }: { store: Store }) {
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [person, setPerson] = useState<Owner>("Aleem");
  const accountSignIn = store.authMethod === "supabase";
  const [remember, setRemember] = useState(!accountSignIn);
  return (
    <main className="unlock">
      <div className="unlock-brand brand">
        <Mark />
        <span>our_miles</span>
      </div>
      <span className="eyebrow">ALEEM & NURUL’S PRIVATE WALLET</span>
      <h1>
        A little closer,
        <br />
        <em>together.</em>
      </h1>
      <p>Your everyday purchases. Our next adventure.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void store.login(pin, person, remember, email);
        }}
      >
        {!accountSignIn && <fieldset className="person-field">
          <legend>Who’s here?</legend>
          {(["Aleem", "Nurul"] as Owner[]).map((name) => (
            <label key={name} className={person === name ? "selected" : ""}>
              <input
                type="radio"
                name="person"
                checked={person === name}
                onChange={() => setPerson(name)}
              />
              {name}
            </label>
          ))}
        </fieldset>}
        {accountSignIn && <label className="form-label">
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Your invited email"
          />
        </label>}
        <label className="form-label">
          {accountSignIn ? "Password" : "Our private PIN"}
          <input
            inputMode={accountSignIn ? undefined : "numeric"}
            type="password"
            name="password"
            autoComplete="current-password"
            pattern={accountSignIn ? undefined : "[0-9]{6,12}"}
            minLength={accountSignIn ? undefined : 6}
            maxLength={accountSignIn ? 256 : 12}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            placeholder={accountSignIn ? "Your password" : "Enter PIN"}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember this trusted device
        </label>
        {store.error && (
          <p className="form-error" role="alert">
            {store.error}
          </p>
        )}
        <button
          className="primary-button"
          type="submit"
          disabled={store.saving}
        >
          <LockKeyhole size={17} />
          {store.saving ? "Unlocking…" : "Open our wallet"}
          <ArrowRight size={18} />
        </button>
      </form>
    </main>
  );
}
function ProfileSheet({
  store,
  open,
  onClose,
  notify,
}: {
  store: Store;
  open: boolean;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [balance, setBalance] = useState(String(store.state?.mileBalance ?? 0));
  const [value, setValue] = useState(
    String((store.state?.mileValueSgd ?? 0.015) * 100),
  );
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Our wallet, our way"
      description="Profile and preferences for this device."
    >
      {store.error && (
        <p className="form-error" role="alert">
          {store.error}
        </p>
      )}
      <span className="eyebrow">WHO’S HERE?</span>
      <div className="segmented">
        {(["Aleem", "Nurul"] as Owner[]).map((person) => (
          <button
            key={person}
            aria-pressed={store.owner === person}
            className={store.owner === person ? "selected" : ""}
            onClick={() => store.switchOwner(person)}
          >
            {person}
            {store.owner === person && <Check size={15} />}
          </button>
        ))}
      </div>
      <p className="muted small">
        Recommendations compare both wallets. This profile breaks ties and
        labels your records.
      </p>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const saved = await store.update((s) => ({
            ...s,
            mileBalance: Number(balance),
            mileValueSgd: Number(value) / 100,
          }));
          if (saved) {
            notify("Preferences saved");
            onClose();
          }
        }}
      >
        <label className="form-label">
          Opening miles balance
          <input
            type="number"
            min="0"
            max="1000000000"
            step="1"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            required
          />
        </label>
        <label className="form-label">
          Your value per mile (SG cents)
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </label>
        <p className="muted small">
          A personal estimate for comparing miles with cashback and FX costs. It
          isn’t a cash balance.
        </p>
        <button className="primary-button" disabled={store.saving}>
          Save preferences
          <Check size={17} />
        </button>
      </form>
      <div className="sheet-section">
        <h3>On your home screen</h3>
        <p className="muted small">
          iPhone: Share → Add to Home Screen. Android: browser menu → Install
          app. Serve over HTTPS for installation.
        </p>
      </div>
      {store.session?.mode === "demo" && (
        <div className="sheet-section">
          <h3>Sample wallet</h3>
          <p className="muted small">
            The {formatMiles(152430)} miles, card ownership, usage and welcome
            offer are examples. Sample changes stay on this device.
          </p>
          <div className="button-row">
            <button
              className="secondary-button"
              onClick={async () => {
                if (await store.update(() => demoState())) {
                  notify("Sample wallet restored");
                  onClose();
                }
              }}
            >
              Restore sample
            </button>
            <button
              className="secondary-button"
              onClick={() => setConfirmReset(true)}
            >
              Start fresh
            </button>
          </div>
          {confirmReset && (
            <div className="confirmation">
              <p>
                Clear this device’s sample wallet and start with unconfirmed
                card templates?
              </p>
              <button
                className="primary-button"
                onClick={async () => {
                  if (await store.update(() => emptyState())) {
                    notify("Fresh wallet ready · confirm your cards");
                    onClose();
                  }
                }}
              >
                Clear sample wallet
              </button>
            </div>
          )}
          <p className="muted small">
            Set the server PIN and session secret to enable private shared
            storage. Setup instructions are in the project README.
          </p>
        </div>
      )}
      {store.session?.mode === "private" && (
        <button
          className="secondary-button wide"
          onClick={async () => {
            await store.logout();
            onClose();
          }}
        >
          <LockKeyhole size={16} />
          Lock wallet
        </button>
      )}
    </Sheet>
  );
}
