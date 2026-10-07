"use client";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Utensils,
  ShoppingBag,
  Globe2,
  TrainFront,
  Fuel,
  ShoppingBasket,
  MoreHorizontal,
  ScanLine,
  Check,
  ChevronDown,
  CreditCard,
  Search,
} from "lucide-react";
import { assessCards, recommend } from "@/lib/engine";
import {
  getMerchant,
  merchantPurchaseHints,
  searchMerchants,
  MERCHANTS,
  MERCHANT_REFERENCE_COUNT,
  MERCHANT_LOOKUP_SOURCES,
} from "@/lib/merchants";
import {
  searchMccCodes,
  MCC_REFERENCE,
  MCC_REFERENCE_SOURCE,
} from "@/lib/mcc-reference";
import type {
  CardAssessment,
  Category,
  Channel,
  PaymentMethod,
  Purchase,
  Recommendation,
  RewardPartner,
} from "@/lib/domain";
import { formatMiles, formatMoney, makeId, today } from "@/lib/state";
import { CardArt } from "./card-art";
import type { Store, View } from "./miles-app";

export const categories: {
  id: Category;
  label: string;
  icon: typeof ScanLine;
}[] = [
  { id: "dining", label: "Dining", icon: Utensils },
  { id: "online", label: "Online", icon: ShoppingBag },
  { id: "shopping", label: "Shopping", icon: CreditCard },
  { id: "travel", label: "Travel", icon: Globe2 },
  { id: "transport", label: "Transport", icon: TrainFront },
  { id: "fuel", label: "Fuel", icon: Fuel },
  { id: "groceries", label: "Groceries", icon: ShoppingBasket },
  { id: "other", label: "Other", icon: MoreHorizontal },
];
const currencies = [
  "SGD",
  "USD",
  "NZD",
  "AUD",
  "EUR",
  "GBP",
  "MYR",
  "JPY",
  "THB",
  "IDR",
  "HKD",
  "KRW",
  "PHP",
  "VND",
  "CNY",
  "TWD",
  "CAD",
  "CHF",
  "INR",
  "AED",
];
const rate = (r: Recommendation) =>
  r.effectiveMpd > 0
    ? `${r.effectiveMpd.toFixed(r.effectiveMpd % 1 ? 2 : 0)} mpd`
    : `${formatMoney(r.cashbackSgd, 2)} cashback`;

export function FinderScreen({
  store,
  quickCategory,
  go,
  notify,
  onCardSetup,
}: {
  store: Store;
  quickCategory: Category;
  go: (view: View) => void;
  notify: (message: string) => void;
  onCardSetup: (cardId: string) => void;
}) {
  const [category, setCategory] = useState<Category>(quickCategory);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [merchantId, setMerchantId] = useState<string>();
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [codeSearch, setCodeSearch] = useState("");
  const [channel, setChannel] = useState<Channel>(
    quickCategory === "online" || quickCategory === "travel"
      ? "online"
      : "contactless",
  );
  const [currency, setCurrency] = useState("SGD");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [manualMcc, setManualMcc] = useState("");
  const [mccEdited, setMccEdited] = useState(false);
  const [mccConfirmed, setMccConfirmed] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const [processedOverseas, setProcessedOverseas] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [partner, setPartner] = useState<RewardPartner | "">("");
  const [recorded, setRecorded] = useState(false);
  const [recordedResult, setRecordedResult] = useState<Recommendation | null>(
    null,
  );
  const [formError, setFormError] = useState("");
  const selectCategory = (next: Category) => {
    setCategory(next);
    setChannel(
      next === "online" || next === "travel" ? "online" : "contactless",
    );
    setMerchantId(undefined);
    setManualMcc("");
    setMccEdited(false);
    setMccConfirmed(false);
    setRecorded(false);
  };
  const selectedMerchant = merchantId ? getMerchant(merchantId) : undefined;
  const hints = selectedMerchant
    ? merchantPurchaseHints(selectedMerchant, channel)
    : undefined;
  const mcc = mccEdited
    ? manualMcc
    : hints?.mcc === undefined
      ? ""
      : String(hints.mcc).padStart(4, "0");
  const suggestions = useMemo(() => searchMerchants(merchant), [merchant]);
  const suggestionsVisible =
    lookupOpen && suggestions.length > 0 && !selectedMerchant;
  const chooseMerchant = (id: string) => {
    const entry = getMerchant(id);
    if (!entry) return;
    setMerchant(entry.name);
    setMerchantId(id);
    setCategory(entry.category);
    setManualMcc("");
    setMccEdited(false);
    setMccConfirmed(false);
    setLookupOpen(false);
    setActiveSuggestion(-1);
    setExcluded(false);
    setPartner("");
    setFormError("");
    setRecorded(false);
  };
  const valid =
    Number(amount) > 0 &&
    Number(amount) <= 1000000 &&
    (!mcc || /^\d{4}$/.test(mcc));
  const purchaseMccConfidence = mccConfirmed
    ? ("Confirmed" as const)
    : !mccEdited && hints?.mcc !== undefined
      ? hints.mccConfidence
      : ("Unverified" as const);
  const purchaseExcluded = excluded || !!hints?.excluded;
  const purchase: Purchase = useMemo(
    () => ({
      amountSgd: Number(amount),
      merchant: merchant.trim(),
      category,
      channel,
      paymentMethod: method,
      currency,
      date: today(),
      ...(mcc
        ? {
            mcc: Number(mcc),
            mccConfidence: purchaseMccConfidence,
          }
        : {}),
      excluded: purchaseExcluded,
      processedOverseas,
      recurring,
      ...(partner ? { rewardPartner: partner } : {}),
    }),
    [
      amount,
      merchant,
      category,
      channel,
      method,
      currency,
      mcc,
      purchaseMccConfidence,
      purchaseExcluded,
      processedOverseas,
      recurring,
      partner,
    ],
  );
  const assessments = useMemo(
    () =>
      valid && store.state
        ? assessCards(purchase, { ...store.state, preferredOwner: store.owner })
        : [],
    [valid, purchase, store.state, store.owner],
  );
  const results = useMemo(
    () =>
      valid && store.state
        ? recommend(purchase, { ...store.state, preferredOwner: store.owner })
        : [],
    [valid, purchase, store.state, store.owner],
  );
  const winner = recorded && recordedResult ? recordedResult : results[0];
  const setupCandidates = assessments
    .filter(
      (a) =>
        a.status === "setup-needed" &&
        a.potential &&
        (!winner || a.potential.netValueSgd > winner.netValueSgd + 0.01),
    )
    .sort((a, b) => b.potential!.netValueSgd - a.potential!.netValueSgd);
  const showResult = () => {
    setLookupOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
    const result = document.getElementById("recommendation-result");
    result?.scrollIntoView({ behavior: "instant", block: "start" });
    result?.focus({ preventScroll: true });
  };
  const record = async () => {
    if (!winner || recorded) return;
    if (!merchant.trim()) {
      setFormError("Add a merchant name before recording this purchase.");
      document.getElementById("merchant")?.focus();
      return;
    }
    const saved = await store.update((s) => ({
      ...s,
      transactions: [
        {
          ...purchase,
          id: makeId(),
          cardId: winner.card.id,
          status: "pending",
          reward: winner.snapshot,
        },
        ...s.transactions,
      ],
    }));
    if (saved) {
      setRecordedResult(winner);
      setRecorded(true);
      setFormError("");
      notify("Purchase recorded · capacity updated");
    }
  };
  return (
    <div className="finder-layout">
      <section className="finder-form-section">
        <div className="page-intro">
          <span className="eyebrow">THE BEST NEXT MOVE</span>
          <h1>What card?</h1>
          <p>
            A purchase you’re making.
            <br className="mobile-only" /> A little more from every dollar.
          </p>
        </div>
        <div className="finder-form">
          <fieldset className="category-field">
            <legend>What are you buying?</legend>
            <div className="category-grid">
              {categories.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={
                    category === id ||
                    (id === "other" &&
                      !categories.some((c) => c.id === category))
                      ? "selected"
                      : ""
                  }
                  aria-pressed={
                    category === id ||
                    (id === "other" &&
                      !categories.some((c) => c.id === category))
                  }
                  onClick={() => selectCategory(id)}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="amount-field">
            <label htmlFor="amount">How much?</label>
            <div>
              <span>S$</span>
              <input
                id="amount"
                aria-label="Purchase amount in Singapore dollars"
                inputMode="decimal"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setRecorded(false);
                }}
              />
            </div>
            {currency !== "SGD" && (
              <span className="muted small">
                Enter the SGD equivalent of your {currency} purchase.
              </span>
            )}
          </div>
          <div className="mobile-result-action">
            <button
              className="primary-button wide"
              onClick={showResult}
              disabled={!valid}
            >
              See our best card
              <ArrowRight size={18} />
            </button>
            <span>
              {channel === "online"
                ? "Online"
                : channel === "contactless"
                  ? "Contactless"
                  : "Insert / swipe"}{" "}
              · {currency} ·{" "}
              {method === "card"
                ? "Card directly"
                : method === "apple-pay"
                  ? "Apple Pay"
                  : method === "google-pay"
                    ? "Google Pay"
                    : "Mobile wallet"}
            </span>
          </div>
          <div
            className="merchant-lookup"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget))
                setLookupOpen(false);
            }}
          >
            <label className="form-label" htmlFor="merchant">
              Merchant{" "}
              <span className="optional">optional until you record</span>
            </label>
            <div className="search-input">
              <Search size={18} aria-hidden="true" />
              <input
                id="merchant"
                type="text"
                role="combobox"
                aria-label="Merchant"
                aria-autocomplete="list"
                aria-expanded={suggestionsVisible}
                aria-controls={
                  suggestionsVisible ? "merchant-suggestions" : undefined
                }
                aria-activedescendant={
                  suggestionsVisible && activeSuggestion >= 0
                    ? `merchant-option-${activeSuggestion}`
                    : undefined
                }
                maxLength={160}
                autoComplete="off"
                placeholder="Search a shop, airline or hotel"
                value={merchant}
                onFocus={(e) => {
                  setLookupOpen(true);
                  const lookup = e.currentTarget.closest(".merchant-lookup");
                  const viewportHeight =
                    window.visualViewport?.height ?? window.innerHeight;
                  if (
                    window.innerWidth <= 767 &&
                    lookup &&
                    lookup.getBoundingClientRect().bottom + 300 >
                      viewportHeight - 90
                  ) {
                    lookup.scrollIntoView({
                      block: "start",
                      behavior: "instant",
                    });
                  }
                }}
                onChange={(e) => {
                  setMerchant(e.target.value);
                  setMerchantId(undefined);
                  setMccEdited(false);
                  setManualMcc("");
                  setMccConfirmed(false);
                  setActiveSuggestion(-1);
                  setLookupOpen(true);
                  setFormError("");
                  setRecorded(false);
                  setPartner("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setLookupOpen(false);
                    setActiveSuggestion(-1);
                  }
                  if (!suggestionsVisible) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSuggestion((i) => (i + 1) % suggestions.length);
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestion(
                      (i) => (i - 1 + suggestions.length) % suggestions.length,
                    );
                  }
                  if (e.key === "Enter" && activeSuggestion >= 0) {
                    e.preventDefault();
                    chooseMerchant(suggestions[activeSuggestion].id);
                  }
                }}
              />
            </div>
            {suggestionsVisible && (
              <ul
                id="merchant-suggestions"
                className="merchant-suggestions"
                role="listbox"
                aria-label="Merchant matches"
              >
                {suggestions.map((entry, i) => (
                  <li
                    key={entry.id}
                    id={`merchant-option-${i}`}
                    role="option"
                    aria-selected={i === activeSuggestion}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chooseMerchant(entry.id)}
                    className={i === activeSuggestion ? "selected" : ""}
                  >
                    <span>{entry.name}</span>
                    <small>
                      {entry.mccs.length === 1
                        ? `${entry.mccConfidence ?? "Likely"} MCC ${String(entry.mccs[0]).padStart(4, "0")}`
                        : "Check payment route"}
                    </small>
                  </li>
                ))}
              </ul>
            )}
            {hints && (
              <details className="merchant-evidence">
                <summary>
                  {hints.mcc === undefined
                    ? "MCC varies · review source"
                    : `${hints.mccConfidence} MCC ${String(hints.mcc).padStart(4, "0")}`}
                  <ChevronDown size={14} />
                </summary>
                <p>{hints.note}</p>
                <a href={hints.sourceUrl} target="_blank" rel="noreferrer">
                  Merchant source <ArrowUpRight size={13} />
                </a>
                <span className="muted small">
                  Checked {hints.lastVerifiedAt}
                </span>
              </details>
            )}
          </div>
          <fieldset className="channel-field">
            <legend>How are you paying?</legend>
            <div className="segmented">
              {(
                [
                  { id: "online", label: "Online" },
                  { id: "contactless", label: "Contactless" },
                  { id: "in-store", label: "Insert / swipe" },
                ] as { id: Channel; label: string }[]
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={channel === id}
                  className={channel === id ? "selected" : ""}
                  onClick={() => {
                    setChannel(id);
                    setMccConfirmed(false);
                    setRecorded(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <details className="purchase-details">
            <summary>
              Currency, wallet & merchant details <ChevronDown size={16} />
            </summary>
            <div className="advanced-form">
              <label className="form-label">
                Purchase currency
                <select
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    setRecorded(false);
                  }}
                >
                  {currencies.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {currency === "SGD" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={processedOverseas}
                    onChange={(e) => {
                      setProcessedOverseas(e.target.checked);
                      setRecorded(false);
                    }}
                  />
                  SGD payment processed outside Singapore
                </label>
              )}
              <label className="form-label">
                Payment method
                <select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value as PaymentMethod);
                    setMccConfirmed(false);
                    setRecorded(false);
                  }}
                >
                  <option value="card">Card directly</option>
                  <option value="apple-pay">Apple Pay</option>
                  <option value="google-pay">Google Pay</option>
                  <option value="samsung-pay">Samsung Pay</option>
                  <option value="mobile-wallet">Other mobile wallet</option>
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => {
                    setRecurring(e.target.checked);
                    setRecorded(false);
                  }}
                />
                Recurring payment / subscription
              </label>
              <label className="form-label">
                Confirmed KrisFlyer UOB partner payment
                <select
                  value={partner}
                  onChange={(e) => {
                    setPartner(e.target.value as RewardPartner | "");
                    setRecorded(false);
                  }}
                >
                  <option value="">None / not confirmed</option>
                  <option value="singapore-airlines">
                    Singapore Airlines directly
                  </option>
                  <option value="scoot">Scoot directly</option>
                  <option value="krisshop">KrisShop</option>
                  <option value="krisplus">Kris+ app</option>
                  <option value="pelago">Pelago</option>
                </select>
                <span className="muted small">
                  Confirm the eligible direct payment path. A merchant lookup
                  alone does not qualify a partner payment.
                </span>
              </label>
              <label className="form-label">
                Specific purchase category
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as Category);
                    setMerchantId(undefined);
                    setMccEdited(false);
                    setMccConfirmed(false);
                    setRecorded(false);
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                  <option value="utilities">Utilities</option>
                  <option value="insurance">Insurance</option>
                  <option value="education">Education</option>
                  <option value="government">Government</option>
                  <option value="financial">Financial / top-ups</option>
                </select>
              </label>
              <label className="form-label">
                Merchant category code (MCC)
                <input
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={mcc}
                  onChange={(e) => {
                    setManualMcc(e.target.value.replace(/\D/g, ""));
                    setMccEdited(true);
                    setMccConfirmed(false);
                    setRecorded(false);
                  }}
                  placeholder="e.g. 5812"
                />
              </label>
              {mcc && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={mccConfirmed}
                    onChange={(e) => {
                      setMccConfirmed(e.target.checked);
                      setRecorded(false);
                    }}
                  />
                  Confirmed from the issuer or a posted transaction
                </label>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={excluded || !!hints?.excluded}
                  disabled={!!hints?.excluded}
                  onChange={(e) => {
                    setExcluded(e.target.checked);
                    setRecorded(false);
                  }}
                />
                Excluded spend, such as a wallet top-up or cash advance
              </label>
              <p className="muted small">
                {MERCHANTS.length} sourced merchant entries. Outlet and payment
                route can change the MCC. Your bank&apos;s posted code takes
                priority.
              </p>
            </div>
          </details>
          <details className="purchase-details merchant-directory">
            <summary>
              Merchant & MCC database <ChevronDown size={16} />
            </summary>
            <div className="advanced-form">
              <p className="muted small">
                Search above across {formatMiles(MERCHANT_REFERENCE_COUNT)}{" "}
                merchant references, including {MERCHANTS.length} curated
                entries. Global references are unverified for Singapore. No
                directory covers every outlet or payment route.
              </p>
              <label className="form-label">
                Find an MCC code
                <input
                  type="search"
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  placeholder="e.g. 5411, airlines, hotels"
                />
              </label>
              {codeSearch.trim() && (
                <div className="mcc-code-results">
                  {searchMccCodes(codeSearch, 8).map((code) => (
                    <button
                      type="button"
                      key={code.code}
                      onClick={() => {
                        setManualMcc(code.code);
                        setMccEdited(true);
                        setMccConfirmed(false);
                        setRecorded(false);
                      }}
                    >
                      <strong>{code.code}</strong>
                      <span>{code.description}</span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                  {!searchMccCodes(codeSearch, 1).length && (
                    <p className="muted small">
                      No code matches. Try a category or four-digit code.
                    </p>
                  )}
                </div>
              )}
              <p className="muted small">
                {MCC_REFERENCE.length} code labels. A code description does not
                prove a merchant’s MCC.{" "}
                <a
                  href={MCC_REFERENCE_SOURCE.manualUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Current Visa manual <ArrowUpRight size={12} />
                </a>
              </p>
              <h3>More merchant directories</h3>
              <div className="directory-links">
                {MERCHANT_LOOKUP_SOURCES.map((source) => (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    key={source.id}
                  >
                    <span>
                      <strong>{source.name}</strong>
                      <small>{source.note}</small>
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                ))}
              </div>
            </div>
          </details>
          {amount && Number(amount) > 1000000 && (
            <p className="form-error">Use an amount up to S$1,000,000.</p>
          )}
          {mcc && mcc.length !== 4 && (
            <p className="form-error">An MCC has four digits.</p>
          )}
        </div>
      </section>
      <section
        id="recommendation-result"
        tabIndex={-1}
        className="finder-result-section"
        aria-label="Card recommendation"
        aria-live="polite"
        aria-atomic="false"
      >
        {!recorded && setupCandidates.length > 0 && (
          <div
            className="setup-candidates"
            role="region"
            aria-label="Higher rewards need setup"
          >
            <h2>Higher rewards need setup</h2>
            <p className="muted small">
              These could earn more if the conditions below are met.
            </p>
            {setupCandidates.slice(0, 2).map((a) => (
              <div className="setup-candidate" key={a.card.id}>
                <div className="comparison-heading">
                  <CardArt
                    templateId={a.template.id}
                    className="card-thumbnail"
                    decorative
                  />
                  <div>
                    <strong>{a.template.name}</strong>
                    <span>
                      {a.card.owner} · up to {rate(a.potential!)}
                    </span>
                  </div>
                </div>
                <details>
                  <summary>
                    Conditions to check <ChevronDown size={14} />
                  </summary>
                  <ul>
                    {a.blockers.map((b) => (
                      <li key={`${b.id}-${b.label}`}>{b.label}</li>
                    ))}
                  </ul>
                </details>
                <button
                  className="text-action"
                  onClick={() => onCardSetup(a.card.id)}
                >
                  Check {a.template.name} setup <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        {winner ? (
          <>
            <RecommendationResult
              result={winner}
              recorded={recorded}
              setupPending={!recorded && setupCandidates.length > 0}
            />
            {!recorded ? (
              <button
                className="primary-button record-button wide"
                onClick={record}
                disabled={store.saving}
              >
                <Check size={17} />
                {store.saving ? "Saving purchase…" : "Record this purchase"}
              </button>
            ) : (
              <div className="recorded-state">
                <Check size={18} />
                <div>
                  <strong>Purchase recorded</strong>
                  <span>Capacity updated for your next purchase.</span>
                </div>
                <button
                  className="text-action"
                  onClick={() => {
                    setAmount("");
                    setMerchant("");
                    setMerchantId(undefined);
                    setManualMcc("");
                    setMccEdited(false);
                    setMccConfirmed(false);
                    setPartner("");
                    setExcluded(false);
                    setRecorded(false);
                  }}
                >
                  Next purchase <ArrowRight size={14} />
                </button>
              </div>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
          </>
        ) : (
          <div className="finder-empty">
            <div className="route-drawing">
              <svg viewBox="0 0 160 90" fill="none" aria-hidden="true">
                <path
                  d="M15 75c42 0 21-60 68-60s35 55 63 55"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />
                <circle cx="15" cy="75" r="4" fill="currentColor" />
                <circle
                  cx="145"
                  cy="70"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <span className="eyebrow">A SMARTER WAY TO PAY</span>
            <h2>
              {valid
                ? store.state!.cards.some((card) => card.status === "active")
                  ? "No verified rule fits."
                  : "Let’s set up our wallet."
                : "Every dollar has a destination."}
            </h2>
            <p>
              {valid
                ? store.state!.cards.some((card) => card.status === "active")
                  ? "This purchase may be excluded or need a manual benefit check. Review the merchant details and issuer terms before paying."
                  : "Confirm your active cards and current bonus usage to compare them."
                : "Choose a category and enter an amount. We’ll compare our cards, remaining caps and reward costs."}
            </p>
            {valid && (
              <button className="primary-button" onClick={() => go("wallet")}>
                Review our cards
                <ArrowRight size={18} />
              </button>
            )}
            <div className="finder-principles">
              <span>
                <Check size={14} />
                Both wallets, together
              </span>
              <span>
                <Check size={14} />
                Bonus capacity included
              </span>
              <span>
                <Check size={14} />
                FX costs considered
              </span>
            </div>
          </div>
        )}
        {!recorded && assessments.length > 0 && (
          <details className="card-comparison alternatives">
            <summary>
              All cards compared <span>{assessments.length}</span>
              <ChevronDown size={16} />
            </summary>
            <div>
              {assessments.map((a) => (
                <AssessmentRow
                  key={a.card.id}
                  assessment={a}
                  onSetup={() => onCardSetup(a.card.id)}
                />
              ))}
            </div>
          </details>
        )}
        {winner && (
          <p className="estimate-note">
            Estimates use issuer rules and tracked usage. Posted bank rewards
            are final.
          </p>
        )}
      </section>
    </div>
  );
}

function AssessmentRow({
  assessment: a,
  onSetup,
}: {
  assessment: CardAssessment;
  onSetup: () => void;
}) {
  const labels = {
    ready: "Eligible",
    "setup-needed": "Setup needed",
    ineligible: "Doesn’t qualify",
    "manual-review": "Manual review",
    inactive:
      a.card.status === "unconfirmed" ? "Ownership unconfirmed" : "Inactive",
  };
  return (
    <details className="comparison-row">
      <summary>
        <CardArt
          templateId={a.template.id}
          className="card-thumbnail"
          decorative
        />
        <div className="comparison-copy">
          <strong>{a.template.name}</strong>
          <span>
            {a.card.owner} · {labels[a.status]}
          </span>
        </div>
        <span className="comparison-rate">
          {a.recommendation ? rate(a.recommendation) : "—"}
        </span>
        <ChevronDown size={14} />
      </summary>
      <div className="comparison-detail">
        <p>{a.explanation}</p>
        {a.recommendation && (
          <p>
            {a.recommendation.reason} ·{" "}
            {formatMoney(a.recommendation.netValueSgd, 2)} after tracked costs
          </p>
        )}
        {a.blockers.length > 0 && (
          <ul>
            {a.blockers.map((b) => (
              <li key={`${b.id}-${b.label}`}>{b.label}</li>
            ))}
          </ul>
        )}
        {a.status === "setup-needed" || a.card.status === "unconfirmed" ? (
          <button className="text-action" onClick={onSetup}>
            Check {a.template.name} setup <ArrowRight size={14} />
          </button>
        ) : null}
      </div>
    </details>
  );
}

function RecommendationResult({
  result: r,
  recorded,
  setupPending,
}: {
  result: Recommendation;
  recorded: boolean;
  setupPending: boolean;
}) {
  return (
    <div className="recommendation">
      <div className="recommendation-top">
        <span className="eyebrow">
          {recorded
            ? "PURCHASE RECORDED"
            : setupPending
              ? "AVAILABLE WITH CURRENT SETUP"
              : "BEST NEXT MOVE"}
        </span>
        <span className="confidence">
          <span />
          {r.confidence}
        </span>
      </div>
      <CardArt
        templateId={r.template.id}
        className="winner-card-art"
        priority
      />
      <p className="winner-owner">
        {recorded ? "Recorded with" : "Use"} {r.card.owner}’s
      </p>
      <h2>{r.template.name}</h2>
      <div className="reward-display">
        <strong>
          {r.effectiveMpd > 0
            ? r.effectiveMpd.toFixed(r.effectiveMpd % 1 ? 2 : 0)
            : formatMoney(r.cashbackSgd, 2)}
        </strong>
        <span>{r.effectiveMpd > 0 ? "mpd" : "cashback"}</span>
        <span className="reward-miles">
          {r.miles > 0
            ? `≈ ${formatMiles(r.miles)} miles`
            : "Estimated cash reward"}
        </span>
      </div>
      <p className="winner-reason">{r.eligibilitySummary ?? r.reason}</p>
      {r.capacityRemainingSgd !== null && (
        <div className="winner-cap">
          <span>Bonus capacity before purchase</span>
          <strong>{formatMoney(r.capacityRemainingSgd)} left</strong>
        </div>
      )}
      {r.confidence !== "Confirmed" && (
        <p className="winner-uncertainty">
          {r.confidence === "Likely"
            ? "MCC and bonus eligibility are estimates."
            : "Some usage or eligibility details still need confirmation."}
        </p>
      )}
      {r.template.id === "hsbc-revolution" && (
        <p className="winner-uncertainty">
          Asia Miles equivalent. KrisFlyer conversion earns fewer miles.
        </p>
      )}
      {r.welcomeIncrementalMiles > 0 && (
        <p className="welcome-increment">
          This planned purchase makes {formatMiles(r.welcomeIncrementalMiles)}{" "}
          extra welcome miles attainable, subject to the offer terms.
        </p>
      )}
      <details className="calculation-details">
        <summary>
          Why this card? <ChevronDown size={15} />
        </summary>
        <p>{r.reason}</p>
        {r.capacityRemainingSgd !== null && (
          <p>
            {formatMoney(r.capacityRemainingSgd)} bonus capacity before this
            purchase.
          </p>
        )}
        <dl>
          <div>
            <dt>Estimated reward value</dt>
            <dd>
              {formatMoney(r.netValueSgd + r.fxFeeSgd + r.transferCostSgd, 2)}
            </dd>
          </div>
          <div>
            <dt>FX fee</dt>
            <dd>{formatMoney(r.fxFeeSgd, 2)}</dd>
          </div>
          <div>
            <dt>Transfer cost allocation</dt>
            <dd>{formatMoney(r.transferCostSgd, 2)}</dd>
          </div>
          <div>
            <dt>Value after tracked costs</dt>
            <dd>{formatMoney(r.netValueSgd, 2)}</dd>
          </div>
        </dl>
        {r.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
        <p className="small muted">
          Rule {r.snapshot.ruleVersion} · checked{" "}
          {r.snapshot.lastVerifiedAt || "not verified"}
        </p>
        {r.snapshot.sourceUrl && (
          <a href={r.snapshot.sourceUrl} target="_blank" rel="noreferrer">
            Issuer source <ArrowUpRight size={13} />
          </a>
        )}
      </details>
    </div>
  );
}
