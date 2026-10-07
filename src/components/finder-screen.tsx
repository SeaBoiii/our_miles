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
  Info,
  ChevronDown,
  CreditCard,
} from "lucide-react";
import * as m from "motion/react-m";
import { recommend } from "@/lib/engine";
import type {
  Category,
  Channel,
  PaymentMethod,
  Purchase,
  Recommendation,
  RewardPartner,
} from "@/lib/domain";
import { formatMiles, formatMoney, makeId, today } from "@/lib/state";
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
export function FinderScreen({
  store,
  quickCategory,
  go,
  notify,
}: {
  store: Store;
  quickCategory: Category;
  go: (view: View) => void;
  notify: (message: string) => void;
}) {
  const [category, setCategory] = useState<Category>(quickCategory);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [channel, setChannel] = useState<Channel>(
    quickCategory === "online" || quickCategory === "travel"
      ? "online"
      : "contactless",
  );
  const [currency, setCurrency] = useState("SGD");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [mcc, setMcc] = useState("");
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
    setRecorded(false);
    setMcc("");
    setMccConfirmed(false);
  };
  const valid =
    Number(amount) > 0 &&
    Number(amount) <= 1000000 &&
    (!mcc || /^\d{4}$/.test(mcc));
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
            mccConfidence: mccConfirmed
              ? ("Confirmed" as const)
              : ("Unverified" as const),
          }
        : {}),
      excluded,
      processedOverseas,
      recurring,
      ...(partner ? {rewardPartner:partner} : {}),
    }),
    [
      amount,
      merchant,
      category,
      channel,
      method,
      currency,
      mcc,
      mccConfirmed,
      excluded,
      processedOverseas,
      recurring,
      partner,
    ],
  );
  const results = useMemo(
    () =>
      valid && store.state
        ? recommend(purchase, { ...store.state, preferredOwner: store.owner })
        : [],
    [valid, purchase, store.state, store.owner],
  );
  const winner = recorded && recordedResult ? recordedResult : results[0];
  const showResult = () => {
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
            <span className="muted small">
              {currency === "SGD"
                ? "Singapore dollars"
                : `Enter the SGD equivalent of your ${currency} purchase`}
            </span>
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
          <label className="form-label">
            Merchant <span className="optional">optional until you record</span>
            <input
              id="merchant"
              type="text"
              maxLength={160}
              placeholder="e.g. Insta360, FairPrice, a restaurant"
              value={merchant}
              onChange={(e) => {
                setMerchant(e.target.value);
                setFormError("");
                setRecorded(false);
              }}
            />
          </label>
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
              Currency, wallet & merchant details
              <ChevronDown size={16} />
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
                  {[
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
                  ].map((v) => (
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
              <label className="check-label"><input type="checkbox" checked={recurring} onChange={e=>{setRecurring(e.target.checked);setRecorded(false);}} />Recurring payment / subscription</label>
              <label className="form-label">Confirmed KrisFlyer UOB partner payment
                <select value={partner} onChange={e=>{setPartner(e.target.value as RewardPartner | "");setRecorded(false);}}>
                  <option value="">None / not confirmed</option><option value="singapore-airlines">Singapore Airlines directly</option><option value="scoot">Scoot directly</option><option value="krisshop">KrisShop</option><option value="krisplus">Kris+ app</option><option value="pelago">Pelago</option>
                </select><span className="muted small">Choose only when paying through the eligible partner path. A merchant name alone doesn’t confirm 3 mpd.</span>
              </label>
              <label className="form-label">
                Specific purchase category
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as Category);
                    setRecorded(false);
                    setMcc("");
                    setMccConfirmed(false);
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
                  <option value="government">Government payments</option>
                  <option value="financial">
                    Financial services / top-ups
                  </option>
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
                    setMcc(e.target.value.replace(/\D/g, ""));
                    setMccConfirmed(false);
                    setRecorded(false);
                  }}
                  placeholder="If you know it, e.g. 5812"
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
                  checked={excluded}
                  onChange={(e) => {
                    setExcluded(e.target.checked);
                    setRecorded(false);
                  }}
                />
                Excluded spend, such as a wallet top-up or cash advance
              </label>
              <p className="muted small">
                Merchant names don’t prove an MCC. Estimates use the category
                you select; exclusions still apply.
              </p>
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
        {winner ? (
          <>
            <m.div
              key={`${winner.card.id}-${winner.ruleId}`}
              initial={{ opacity: 0.6, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14 }}
            >
              <RecommendationResult result={winner} recorded={recorded} />
            </m.div>
            {!recorded ? (
              <button
                className="primary-button record-button"
                onClick={record}
                disabled={store.saving}
              >
                <Check size={17} />
                {store.saving ? "Saving purchase…" : "Record this purchase"}
                <ArrowRight size={17} />
              </button>
            ) : (
              <div className="recorded-state">
                <Check size={18} />
                <div>
                  <strong>Purchase recorded</strong>
                  <span>
                    Your next recommendation uses the updated capacity.
                  </span>
                </div>
                <button
                  className="text-action"
                  onClick={() => {
                    setAmount("");
                    setMerchant("");
                    setRecorded(false);
                  }}
                >
                  Next purchase
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            {!recorded && results.length > 1 && (
              <div className="alternatives">
                <span className="eyebrow">NEXT BEST</span>
                {results.slice(1, 4).map((r) => (
                  <details className="alternative-row" key={r.card.id}>
                    <summary>
                      <div>
                        <strong>{r.template.name}</strong>
                        <span>
                          {r.card.owner} · {r.confidence}
                        </span>
                      </div>
                      <div>
                        <strong>
                          {r.effectiveMpd > 0
                            ? `${r.effectiveMpd.toFixed(r.effectiveMpd % 1 ? 2 : 0)} mpd`
                            : `${formatMoney(r.cashbackSgd, 2)} cashback`}
                        </strong>
                        <span>{formatMoney(r.netValueSgd, 2)} net value</span>
                      </div>
                      <ChevronDown size={14} />
                    </summary>
                    <p>{r.reason}</p>
                    {r.warnings.map((warning) => (
                      <p className="muted small" key={warning}>
                        {warning}
                      </p>
                    ))}
                  </details>
                ))}
              </div>
            )}
            <p className="estimate-note">
              <Info size={14} />
              Estimates follow issuer rules and your tracked usage. The bank’s
              posted rewards are final.
            </p>
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
      </section>
    </div>
  );
}
function RecommendationResult({
  result: r,
  recorded,
}: {
  result: Recommendation;
  recorded: boolean;
}) {
  return (
    <div className="recommendation">
      <div className="recommendation-top">
        <span className="eyebrow">
          {recorded ? "PURCHASE RECORDED" : "BEST NEXT MOVE"}
        </span>
        <span className="confidence">
          <span />
          {r.confidence}
        </span>
      </div>
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
      <p className="winner-reason">{r.reason}</p>
      {r.confidence !== "Confirmed" && (
        <p className="winner-uncertainty">
          {r.confidence === "Likely"
            ? "Merchant MCC isn’t confirmed. Bonus eligibility is an estimate."
            : "Confirm the card’s usage and eligibility before relying on bonus rewards."}
        </p>
      )}
      {r.template.id === "hsbc-revolution" && (
        <p className="winner-uncertainty">
          Asia Miles equivalent. KrisFlyer conversion earns fewer miles.
        </p>
      )}
      {r.capacityRemainingSgd !== null && (
        <div className="winner-cap">
          <span>Bonus capacity before purchase</span>
          <strong>{formatMoney(r.capacityRemainingSgd)} left</strong>
        </div>
      )}
      {r.welcomeIncrementalMiles > 0 && (
        <div className="welcome-increment">
          <Check size={15} />
          This planned purchase makes {formatMiles(
            r.welcomeIncrementalMiles,
          )}{" "}
          extra welcome miles attainable, subject to the offer’s terms.
        </div>
      )}
      <details className="calculation-details">
        <summary>
          Why this card?
          <ChevronDown size={15} />
        </summary>
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
        <p>
          Rule {r.snapshot.ruleVersion} · checked{" "}
          {r.snapshot.lastVerifiedAt || "not verified"}
        </p>
        {r.snapshot.sourceUrl && (
          <a href={r.snapshot.sourceUrl} target="_blank" rel="noreferrer">
            Issuer source
            <ArrowUpRight size={13} />
          </a>
        )}
      </details>
    </div>
  );
}
