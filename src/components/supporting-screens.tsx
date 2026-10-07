"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  ChevronDown,
  ChevronLeft,
  Check,
  Target,
  Search,
} from "lucide-react";
import { getCardCapacity, getOfferProgress } from "@/lib/engine";
import { getTemplate } from "@/lib/rules";
import { daysBetween } from "@/lib/periods";
import type {
  Category,
  Channel,
  Owner,
  Transaction,
  WelcomeOffer,
} from "@/lib/domain";
import {
  formatDate,
  formatMiles,
  formatMoney,
  makeId,
  today,
  type Goal,
} from "@/lib/state";
import { categories } from "./finder-screen";
import { Landscape, Progress, SectionHeading, Sheet } from "./primitives";
import type { Store, View } from "./miles-app";

type Props = {
  store: Store;
  go: (view: View, category?: import("@/lib/domain").Category) => void;
  notify: (message: string) => void;
};
export const currentMiles = (store: Store) =>
  store.state!.mileBalance +
  store
    .state!.transactions.filter((t) => t.status !== "reversed")
    .reduce((sum, t) => sum + t.reward.miles, 0);
export function HomeScreen({ store, go }: Props) {
  const state = store.state!;
  const total = currentMiles(store);
  const thisMonth = state.transactions
    .filter(
      (t) =>
        t.status !== "reversed" && t.date.slice(0, 7) === today().slice(0, 7),
    )
    .reduce((sum, t) => sum + t.reward.miles, 0);
  const goal = state.goals[0];
  const bonus = state.offers
    .map((offer) => ({
      offer,
      progress: getOfferProgress(offer, state.transactions, today()),
    }))
    .find(({ progress }) => progress.status === "on-track");
  const cards = state.cards
    .filter((c) => c.status === "active")
    .map((card) => ({
      card,
      capacity: getCardCapacity(card, state.transactions, today()),
    }))
    .filter(
      ({ capacity }) =>
        capacity.remainingSgd !== null && capacity.capSgd !== null,
    )
    .sort(
      (a, b) => (b.capacity.remainingSgd ?? 0) - (a.capacity.remainingSgd ?? 0),
    );
  const dateLabel = new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Singapore",
  }).format(new Date());
  return (
    <div className="home-layout">
      <div className="home-primary">
        <div className="home-greeting">
          <span className="eyebrow">OUR EVERYDAY, GOING PLACES</span>
          <span className="home-date">{dateLabel}</span>
        </div>
        <section
          className="balance-section"
          aria-label="Shared estimated miles"
        >
          <p className="balance-label">Our miles, together.</p>
          <div className="balance-number">
            {formatMiles(total)}
            <span>miles</span>
          </div>
          <div className="balance-meta">
            <span className="positive">
              <ArrowUpRight size={14} />
              {thisMonth > 0
                ? `+${formatMiles(thisMonth)} estimated this month`
                : "Everyday spending. Future adventures."}
            </span>
            <span className="balance-hint">
              {total
                ? "Opening balance + tracked estimates"
                : "Add an opening balance in preferences"}
            </span>
          </div>
        </section>
        <section className="home-finder">
          <div>
            <span className="eyebrow">BEFORE YOU PAY</span>
            <h1>
              Make the everyday
              <br />
              <em>go a little further.</em>
            </h1>
            <p>
              Find the best card in our wallet,
              <br />
              for the purchase in front of you.
            </p>
          </div>
          <button className="primary-button" onClick={() => go("what-card")}>
            <span>What card should I use?</span>
            <ArrowRight size={19} />
          </button>
          <div
            className="quick-purchases"
            aria-label="Quick purchase categories"
          >
            {categories.slice(0, 4).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => go("what-card", id)}>
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </section>
        {bonus ? (
          <button className="next-move" onClick={() => go("bonuses")}>
            <div className="next-move-marker">
              <Check size={17} />
            </div>
            <div>
              <span className="eyebrow">BEST NEXT MOVE</span>
              <p>
                <strong>
                  {formatMoney(bonus.progress.remainingSgd)} more by{" "}
                  {formatDate(bonus.offer.deadline)}
                </strong>
                <br />
                {
                  getTemplate(
                    state.cards.find((c) => c.id === bonus.offer.cardId)
                      ?.templateId ?? "",
                  )?.name
                }{" "}
                · {formatMiles(bonus.progress.nextTier?.miles ?? 0)} welcome
                miles
              </p>
              <span className="muted small">
                Use spending you’ve already planned.
              </span>
            </div>
            <ArrowUpRight size={18} />
          </button>
        ) : state.cards.every((c) => c.status !== "active") ? (
          <button className="next-move" onClick={() => go("wallet")}>
            <Target size={20} />
            <div>
              <span className="eyebrow">BEST NEXT MOVE</span>
              <p>
                <strong>Confirm the cards we own.</strong>
                <br />
                Add current usage for useful recommendations.
              </p>
            </div>
            <ArrowUpRight size={18} />
          </button>
        ) : (
          <div className="quiet-note">
            <span className="eyebrow">OUR APPROACH</span>
            <p>
              A better card for spending we already intended.
              <br />
              Never another reason to buy more.
            </p>
          </div>
        )}
      </div>
      <div className="home-secondary">
        {goal && (
          <section className="home-goal">
            <SectionHeading
              title="Where we’re going"
              action="Our goals"
              onAction={() => go("goals")}
            />
            <button className="goal-preview" onClick={() => go("goals")}>
              <div className="goal-preview-art">
                <Landscape />
                <span className="destination-code">
                  SIN <span>—</span> NZ
                </span>
              </div>
              <div className="goal-preview-content">
                <span className="eyebrow">THE NEXT CHAPTER</span>
                <h2>{goal.name}</h2>
                <div className="goal-preview-numbers">
                  <span>
                    <strong>
                      {Math.min(
                        100,
                        Math.round((total / goal.targetMiles) * 100),
                      )}
                      %
                    </strong>{" "}
                    of the way
                  </span>
                  <span>{formatMiles(goal.targetMiles)} mile target</span>
                </div>
                <Progress
                  value={(total / goal.targetMiles) * 100}
                  label={goal.name}
                />
              </div>
            </button>
          </section>
        )}
        <section className="home-capacities">
          <SectionHeading
            title="Room in our wallet"
            action="See wallet"
            onAction={() => go("wallet")}
          />
          {cards.length ? (
            cards.slice(0, 3).map(({ card, capacity }) => (
              <button
                className="capacity-preview"
                key={card.id}
                onClick={() => go("wallet")}
              >
                <span className="capacity-owner">{card.owner[0]}</span>
                <div>
                  <strong>{getTemplate(card.templateId)?.name}</strong>
                  <span>
                    {card.owner} · resets{" "}
                    {capacity.periodEnd
                      ? formatDate(capacity.periodEnd)
                      : "after this cycle"}
                  </span>
                </div>
                <div className="capacity-preview-value">
                  <strong>{formatMoney(capacity.remainingSgd!)}</strong>
                  <span>
                    left at{" "}
                    {capacity.milesPerDollar % 1
                      ? capacity.milesPerDollar.toFixed(2)
                      : capacity.milesPerDollar}{" "}
                    mpd
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="muted small">
              Confirmed card usage will appear here.
            </p>
          )}
        </section>
        <section className="home-recent">
          <SectionHeading
            title="The everyday adds up"
            action="Activity"
            onAction={() => go("activity")}
          />
          {state.transactions.length ? (
            state.transactions
              .slice(0, 2)
              .map((t) => (
                <ActivityRow key={t.id} transaction={t} store={store} />
              ))
          ) : (
            <p className="muted small">
              Record a purchase after choosing a card.
              <br />
              We’ll track its estimated rewards here.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
export function GoalsScreen({ store, go, notify }: Props) {
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const miles = currentMiles(store);
  return (
    <>
      <button className="back-link" onClick={() => go("home")}>
        <ChevronLeft size={16} />
        Home
      </button>
      <div className="page-intro">
        <span className="eyebrow">BEYOND THE BALANCE</span>
        <div className="title-with-action">
          <h1>Where we’re going.</h1>
          <button
            className="icon-button outlined"
            onClick={() => setEditing("new")}
            aria-label="Add a goal"
          >
            <Plus size={21} />
          </button>
        </div>
        <p>Every everyday purchase, a little closer.</p>
      </div>
      <div className="goals-list">
        {store.state!.goals.map((goal, index) => (
          <section className="goal-detail" key={goal.id}>
            {index === 0 && <Landscape className="goal-landscape" />}
            <div className="goal-detail-body">
              <span className="eyebrow">{goal.destination}</span>
              <h2>{goal.name}</h2>
              <div className="goal-progress-number">
                <strong>{formatMiles(miles)}</strong>
                <span> / {formatMiles(goal.targetMiles)} miles</span>
              </div>
              <Progress
                value={(miles / goal.targetMiles) * 100}
                label={goal.name}
              />
              <div className="goal-status">
                <strong>
                  {miles >= goal.targetMiles
                    ? "Our target is within reach."
                    : `${formatMiles(goal.targetMiles - miles)} miles to go`}
                </strong>
                {goal.targetDate && (
                  <span>By {formatDate(goal.targetDate)}</span>
                )}
              </div>
              <p className="muted small">
                A personal planning target. Award pricing and seat availability
                vary; tracked miles may span different programmes and aren’t
                automatically pooled or transferable.
              </p>
              <button className="text-action" onClick={() => setEditing(goal)}>
                Edit goal
                <ArrowUpRight size={15} />
              </button>
            </div>
          </section>
        ))}
        {!store.state!.goals.length && (
          <div className="empty-state">
            <h2>Somewhere worth going.</h2>
            <p>Add a destination and a personal miles target.</p>
            <button
              className="primary-button"
              onClick={() => setEditing("new")}
            >
              Add our first goal
              <Plus size={17} />
            </button>
          </div>
        )}
      </div>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Our next destination" : "Edit our goal"}
        description="Set a personal target, rather than an unverified award price."
      >
        {editing && (
          <GoalForm
            key={editing === "new" ? "new" : editing.id}
            goal={editing === "new" ? undefined : editing}
            store={store}
            onSaved={() => {
              setEditing(null);
              notify("Goal saved");
            }}
          />
        )}
      </Sheet>
    </>
  );
}
function GoalForm({
  goal,
  store,
  onSaved,
}: {
  goal?: Goal;
  store: Store;
  onSaved: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [destination, setDestination] = useState(goal?.destination ?? "");
  const [target, setTarget] = useState(String(goal?.targetMiles ?? ""));
  const [date, setDate] = useState(goal?.targetDate ?? "");
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const next = {
          id: goal?.id ?? makeId(),
          name: name.trim(),
          destination: destination.trim(),
          targetMiles: Number(target),
          ...(date ? { targetDate: date } : {}),
        };
        if (
          await store.update((s) => ({
            ...s,
            goals: goal
              ? s.goals.map((g) => (g.id === goal.id ? next : g))
              : [...s.goals, next],
          }))
        )
          onSaved();
      }}
    >
      {store.error && (
        <p className="form-error" role="alert">
          {store.error}
        </p>
      )}
      <label className="form-label">
        Goal name
        <input
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. New Zealand Honeymoon"
          required
        />
      </label>
      <label className="form-label">
        Destination
        <input
          maxLength={120}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="e.g. New Zealand"
          required
        />
      </label>
      <label className="form-label">
        Miles target
        <input
          type="number"
          min="1"
          max="1000000000"
          step="1"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          required
        />
      </label>
      <label className="form-label">
        Target date <span className="optional">optional</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <button className="primary-button" disabled={store.saving}>
        Save goal
        <Check size={17} />
      </button>
      {goal && (
        <button
          type="button"
          className="secondary-button"
          onClick={async () => {
            if (
              await store.update((s) => ({
                ...s,
                goals: s.goals.filter((g) => g.id !== goal.id),
              }))
            )
              onSaved();
          }}
        >
          Remove goal
        </button>
      )}
    </form>
  );
}
export function BonusesScreen({ store, go, notify }: Props) {
  const [editing, setEditing] = useState<WelcomeOffer | "new" | null>(null);
  return (
    <>
      <button className="back-link" onClick={() => go("wallet")}>
        <ChevronLeft size={16} />
        Wallet
      </button>
      <div className="page-intro">
        <span className="eyebrow">GOOD TIMING. NATURAL SPENDING.</span>
        <div className="title-with-action">
          <h1>A welcome boost.</h1>
          <button
            className="icon-button outlined"
            aria-label="Add a welcome offer"
            onClick={() => setEditing("new")}
          >
            <Plus size={21} />
          </button>
        </div>
        <p>A clear path to what’s worth earning.</p>
      </div>
      <div className="bonuses-list">
        {store.state!.offers.map((offer) => {
          const card = store.state!.cards.find((c) => c.id === offer.cardId);
          const progress = getOfferProgress(
            offer,
            store.state!.transactions,
            today(),
          );
          const tier = progress.nextTier ?? offer.tiers.at(-1)!;
          return (
            <section className="bonus-detail" key={offer.id}>
              <div className="bonus-heading">
                <span className="eyebrow">
                  {card?.owner} · {getTemplate(card?.templateId ?? "")?.name}
                </span>
                <span className="status-label">
                  {progress.status === "expired"
                    ? "Expired"
                    : progress.status === "complete"
                      ? "Target reached"
                      : progress.status === "unverified"
                        ? "Unverified"
                        : `${Math.max(0, progress.daysRemaining)} days left`}
                </span>
              </div>
              <h2>{offer.name}</h2>
              <div className="bonus-spend">
                <strong>{formatMoney(progress.spendSgd)}</strong>
                <span> / {formatMoney(tier.spendSgd)}</span>
              </div>
              <Progress
                value={(progress.spendSgd / tier.spendSgd) * 100}
                label={`${offer.name} qualifying spend`}
              />
              <div className="bonus-next">
                <strong>
                  {progress.status === "complete"
                    ? "Spend target reached"
                    : progress.status === "expired"
                      ? "Offer window closed"
                      : `${formatMoney(progress.remainingSgd)} more by ${formatDate(offer.deadline)}`}
                </strong>
                <span>{formatMiles(tier.miles)} welcome miles</span>
              </div>
              <div
                className={`bonus-guidance ${progress.status === "not-worth-chasing" ? "attention" : ""}`}
              >
                <strong>
                  {progress.status === "not-worth-chasing"
                    ? "Not worth chasing"
                    : progress.status === "on-track"
                      ? "Fits our planned spending"
                      : progress.status === "complete"
                        ? "Check reward fulfilment with the issuer"
                        : progress.status === "unverified"
                          ? "Confirm the terms before relying on this"
                          : "Keep spending intentional"}
                </strong>
                <p>{progress.message}</p>
                <span>
                  Planned qualifying spend:{" "}
                  {formatMoney(offer.plannedNaturalSpendSgd)}
                </span>
              </div>
              {offer.tiers.length > 1 && (
                <details className="purchase-details">
                  <summary>
                    Other promotional tiers
                    <ChevronDown size={15} />
                  </summary>
                  {offer.tiers.map((t) => (
                    <p key={t.spendSgd}>
                      {formatMoney(t.spendSgd)} total spend →{" "}
                      {formatMiles(t.miles)} miles
                      {progress.spendSgd + offer.plannedNaturalSpendSgd <
                      t.spendSgd
                        ? " · Not worth chasing"
                        : ""}
                    </p>
                  ))}
                </details>
              )}
              <button className="text-action" onClick={() => setEditing(offer)}>
                Edit offer & planned spend
                <ArrowUpRight size={15} />
              </button>
            </section>
          );
        })}
        {!store.state!.offers.length && (
          <div className="empty-state">
            <h2>A good welcome, when it fits.</h2>
            <p>
              Add the offer you received, its deadline and the spending you’ve
              already planned.
            </p>
            <button
              className="primary-button"
              onClick={() => setEditing("new")}
            >
              Add an offer
              <Plus size={17} />
            </button>
          </div>
        )}
      </div>
      <p className="estimate-note">
        Welcome rewards remain subject to the bank’s eligibility, exclusions and
        fulfilment. Reaching a tracked target does not mean the reward has
        posted.
      </p>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing === "new" ? "Track a welcome offer" : "Edit welcome offer"
        }
        description="Use the terms of your own offer. Only planned spending should influence the recommendation."
      >
        {editing && (
          <OfferForm
            key={editing === "new" ? "new" : editing.id}
            offer={editing === "new" ? undefined : editing}
            store={store}
            onSaved={() => {
              setEditing(null);
              notify("Welcome offer saved");
            }}
          />
        )}
      </Sheet>
    </>
  );
}
function OfferForm({
  offer,
  store,
  onSaved,
}: {
  offer?: WelcomeOffer;
  store: Store;
  onSaved: () => void;
}) {
  const active = store.state!.cards.filter((c) => c.status === "active");
  const [cardId, setCardId] = useState(offer?.cardId ?? active[0]?.id ?? "");
  const [name, setName] = useState(offer?.name ?? "");
  const [start, setStart] = useState(offer?.startsOn ?? today());
  const [deadline, setDeadline] = useState(offer?.deadline ?? "");
  const [spend, setSpend] = useState(String(offer?.openingSpendSgd ?? 0));
  const [planned, setPlanned] = useState(
    String(offer?.plannedNaturalSpendSgd ?? 0),
  );
  const [target, setTarget] = useState(String(offer?.tiers[0].spendSgd ?? ""));
  const [reward, setReward] = useState(String(offer?.tiers[0].miles ?? ""));
  const [source, setSource] = useState(offer?.sourceUrl ?? "");
  const [verified, setVerified] = useState(offer?.verified ?? false);
  const [eligible, setEligible] = useState(
    offer?.eligibilityConfirmed ?? false,
  );
  const [qualifyingChannel, setQualifyingChannel] = useState<Channel | "any">(
    offer?.conditions?.channels?.length === 1
      ? offer.conditions.channels[0]
      : "any",
  );
  const [qualifyingCategory, setQualifyingCategory] = useState<
    Category | "any"
  >(
    offer?.conditions?.categories?.length === 1
      ? offer.conditions.categories[0]
      : "any",
  );
  const [qualifiersChanged, setQualifiersChanged] = useState(false);
  if (!active.length) return <p>Add and activate a card in Wallet first.</p>;
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const next: WelcomeOffer = {
          id: offer?.id ?? makeId(),
          cardId,
          name: name.trim(),
          startsOn: start,
          deadline,
          openingSpendSgd: Number(spend),
          plannedNaturalSpendSgd: Number(planned),
          tiers: [
            { spendSgd: Number(target), miles: Number(reward) },
            ...(offer?.tiers.slice(1) ?? []),
          ].sort((a, b) => a.spendSgd - b.spendSgd),
          sourceUrl: source,
          verified: verified && !!source,
          eligibilityConfirmed: eligible,
          ...(offer?.conditions || qualifiersChanged
            ? {
                conditions: {
                  ...offer?.conditions,
                  ...(qualifiersChanged
                    ? {
                        channels:
                          qualifyingChannel === "any"
                            ? undefined
                            : [qualifyingChannel],
                        categories:
                          qualifyingCategory === "any"
                            ? undefined
                            : [qualifyingCategory],
                      }
                    : {}),
                },
              }
            : {}),
        };
        if (
          await store.update((s) => ({
            ...s,
            offers: offer
              ? s.offers.map((o) => (o.id === offer.id ? next : o))
              : [...s.offers, next],
          }))
        )
          onSaved();
      }}
    >
      {store.error && (
        <p className="form-error" role="alert">
          {store.error}
        </p>
      )}
      <label className="form-label">
        Card
        <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
          {active.map((c) => (
            <option key={c.id} value={c.id}>
              {c.owner} · {getTemplate(c.templateId)?.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-label">
        Offer name
        <input
          maxLength={160}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Your bank’s offer"
        />
      </label>
      <div className="field-pair">
        <label className="form-label">
          Starts
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            max={deadline || undefined}
            required
          />
        </label>
        <label className="form-label">
          Deadline
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            min={start}
            required
          />
        </label>
      </div>
      <div className="field-pair">
        <label className="form-label">
          Spend target (S$)
          <input
            type="number"
            min="1"
            max="1000000"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </label>
        <label className="form-label">
          Reward miles
          <input
            type="number"
            min="1"
            max="10000000"
            step="1"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="form-label">
        Eligible spend before our records (S$)
        <input
          type="number"
          min="0"
          max="1000000"
          step="0.01"
          value={spend}
          onChange={(e) => setSpend(e.target.value)}
          required
        />
      </label>
      <label className="form-label">
        Already planned qualifying spend (S$)
        <input
          type="number"
          min="0"
          max="1000000"
          step="0.01"
          value={planned}
          onChange={(e) => setPlanned(e.target.value)}
          required
        />
      </label>
      <p className="muted small">
        Only enter purchases you intended to make anyway. This amount excludes
        the current purchase in What Card?
      </p>
      <details className="purchase-details">
        <summary>
          Which purchases qualify?
          <ChevronDown size={15} />
        </summary>
        <div className="advanced-form">
          <label className="form-label">
            Qualifying payment channel
            <select
              value={qualifyingChannel}
              onChange={(e) => {
                setQualifyingChannel(e.target.value as Channel | "any");
                setQualifiersChanged(true);
              }}
            >
              <option value="any">All eligible channels</option>
              <option value="online">Online only</option>
              <option value="contactless">Contactless only</option>
              <option value="in-store">Insert / swipe only</option>
            </select>
          </label>
          <label className="form-label">
            Qualifying purchase category
            <select
              value={qualifyingCategory}
              onChange={(e) => {
                setQualifyingCategory(e.target.value as Category | "any");
                setQualifiersChanged(true);
              }}
            >
              <option value="any">All eligible categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">
            Use the exact restrictions in your offer. Issuer reward exclusions
            still apply. More complex eligibility should remain unverified until
            you can confirm it.
          </p>
        </div>
      </details>
      <label className="form-label">
        Offer terms URL
        <input
          type="url"
          maxLength={2000}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="https://…"
          required={verified}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={verified}
          onChange={(e) => setVerified(e.target.checked)}
        />
        I checked the bank’s offer terms
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={eligible}
          onChange={(e) => setEligible(e.target.checked)}
        />
        Our card meets the offer’s eligibility conditions
      </label>
      <button className="primary-button" disabled={store.saving}>
        Save offer
        <Check size={17} />
      </button>
      {offer && (
        <button
          type="button"
          className="secondary-button"
          onClick={async () => {
            if (
              await store.update((s) => ({
                ...s,
                offers: s.offers.filter((o) => o.id !== offer.id),
              }))
            )
              onSaved();
          }}
        >
          Remove offer
        </button>
      )}
    </form>
  );
}
export function ActivityScreen({ store, go, notify }: Props) {
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState<"Both" | Owner>("Both");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const items = store.state!.transactions.filter(
    (t) =>
      t.merchant.toLowerCase().includes(search.toLowerCase()) &&
      (owner === "Both" ||
        store.state!.cards.find((c) => c.id === t.cardId)?.owner === owner),
  );
  const estimate = items
    .filter((t) => t.status !== "reversed")
    .reduce((sum, t) => sum + t.reward.miles, 0);
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">THE EVERYDAY ADDS UP</span>
        <h1>Our activity.</h1>
        <p>
          {items.length
            ? `${formatMiles(estimate)} estimated miles across ${items.filter((t) => t.status !== "reversed").length} purchases.`
            : "A little record of every step forward."}
        </p>
      </div>
      <div className="activity-toolbar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Search merchants"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a purchase"
          />
        </label>
        <div className="segmented owner-filter">
          {(["Both", "Aleem", "Nurul"] as const).map((person) => (
            <button
              key={person}
              className={owner === person ? "selected" : ""}
              aria-pressed={owner === person}
              onClick={() => setOwner(person)}
            >
              {person}
            </button>
          ))}
        </div>
      </div>
      {items.length ? (
        <section className="activity-list" aria-label="Recorded transactions">
          {items.map((t, index) => (
            <div key={t.id}>
              {(index === 0 ||
                items[index - 1].date.slice(0, 10) !== t.date.slice(0, 10)) && (
                <h2 className="activity-day">
                  {t.date.slice(0, 10) === today()
                    ? "Today"
                    : daysBetween(t.date, today()) === 1
                      ? "Yesterday"
                      : formatDate(t.date)}
                </h2>
              )}
              <button
                className="activity-row-button"
                onClick={() => setSelected(t)}
              >
                <ActivityRow transaction={t} store={store} />
              </button>
            </div>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <h2>
            {search ? "No matching purchases." : "Our next step starts here."}
          </h2>
          <p>
            {search
              ? "Try another merchant or switch the person filter."
              : "Find the best card, then record a purchase. Its estimated rewards and cap usage will appear here."}
          </p>
          {!search && (
            <button className="primary-button" onClick={() => go("what-card")}>
              Find a card for our first purchase
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      )}
      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.merchant ?? "Purchase details"}
        description="The original calculation stays attached to this transaction."
      >
        {selected && (
          <TransactionDetail
            transaction={selected}
            store={store}
            onPosted={async (date) => {
              if (
                await store.update((s) => ({
                  ...s,
                  transactions: s.transactions.map((t) =>
                    t.id === selected.id
                      ? { ...t, status: "posted", postedDate: date }
                      : t,
                  ),
                }))
              ) {
                setSelected(null);
                notify("Posting confirmed · qualifying spend updated");
              }
            }}
            onReverse={async () => {
              if (
                await store.update((s) => ({
                  ...s,
                  transactions: s.transactions.map((t) =>
                    t.id === selected.id ? { ...t, status: "reversed" } : t,
                  ),
                }))
              ) {
                setSelected(null);
                notify("Record reversed · capacity restored");
              }
            }}
          />
        )}
      </Sheet>
    </>
  );
}
function ActivityRow({
  transaction: t,
  store,
}: {
  transaction: Transaction;
  store: Store;
}) {
  const card = store.state!.cards.find((c) => c.id === t.cardId);
  const Icon = categories.find((c) => c.id === t.category)?.icon ?? Target;
  return (
    <div
      className={`activity-row ${t.status === "reversed" ? "reversed" : ""}`}
    >
      <span className="transaction-icon">
        <Icon size={18} />
      </span>
      <div className="transaction-description">
        <strong>{t.merchant || "Purchase"}</strong>
        <span>
          {card?.owner} · {getTemplate(card?.templateId ?? "")?.name}
        </span>
      </div>
      <div className="transaction-value">
        <strong>{formatMoney(t.amountSgd, 2)}</strong>
        <span>
          {t.status === "reversed"
            ? "Reversed"
            : t.reward.miles > 0
              ? `+${formatMiles(t.reward.miles)} miles`
              : `${formatMoney(t.reward.cashbackSgd, 2)} cashback`}
        </span>
      </div>
    </div>
  );
}
function TransactionDetail({
  transaction: t,
  store,
  onReverse,
  onPosted,
}: {
  transaction: Transaction;
  store: Store;
  onReverse: () => void;
  onPosted: (date: string) => void;
}) {
  const card = store.state!.cards.find((c) => c.id === t.cardId);
  const [postedDate, setPostedDate] = useState(today());
  return (
    <div className="transaction-detail">
      <div className="transaction-detail-amount">
        {formatMoney(t.amountSgd, 2)}
      </div>
      <span className="status-label">
        {t.status === "reversed"
          ? "Reversed"
          : t.status === "posted"
            ? "Posted · estimated rewards"
            : "Pending · estimated rewards"}{" "}
        · {t.reward.confidence}
      </span>
      <dl className="detail-list">
        <div>
          <dt>Paid with</dt>
          <dd>
            {card?.owner}’s {getTemplate(t.reward.templateId)?.name}
          </dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDate(t.date)}</dd>
        </div>
        <div>
          <dt>Estimated miles</dt>
          <dd>{formatMiles(t.reward.miles)}</dd>
        </div>
        <div>
          <dt>Effective earn</dt>
          <dd>{t.reward.effectiveMpd.toFixed(2)} mpd</dd>
        </div>
        <div>
          <dt>Bonus spend counted</dt>
          <dd>{formatMoney(t.reward.bonusSpendSgd, 2)}</dd>
        </div>
        <div>
          <dt>FX fee estimate</dt>
          <dd>{formatMoney(t.reward.fxFeeSgd, 2)}</dd>
        </div>
        <div>
          <dt>Currency / payment</dt>
          <dd>
            {t.currency} · {t.channel}
          </dd>
        </div>
        <div>
          <dt>MCC</dt>
          <dd>{t.mcc ?? "Unverified"}</dd>
        </div>
        <div>
          <dt>Welcome offer contribution</dt>
          <dd>{formatMoney(t.reward.welcomeContributionSgd, 2)}</dd>
        </div>
      </dl>
      <p>{t.reward.reason}</p>
      {t.reward.warnings.map((w) => (
        <p className="muted small" key={w}>
          {w}
        </p>
      ))}
      <p className="muted small">
        Original rule {t.reward.ruleId} · version {t.reward.ruleVersion}.
        Recorded calculations stay unchanged when rules are updated.
      </p>
      {t.reward.sourceUrl && (
        <a
          className="text-action"
          href={t.reward.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Issuer source
          <ArrowUpRight size={14} />
        </a>
      )}
      {t.status !== "reversed" && t.status !== "posted" && (
        <form
          className="posted-form"
          onSubmit={(e) => {
            e.preventDefault();
            onPosted(postedDate);
          }}
        >
          <label className="form-label">
            Bank posting date
            <input
              type="date"
              min={t.date.slice(0, 10)}
              max={today()}
              value={postedDate}
              onChange={(e) => setPostedDate(e.target.value)}
              required
            />
          </label>
          <p className="muted small">
            Pending purchases reserve capacity. Only confirm posting after
            checking your bank; welcome and minimum spend count posted
            purchases.
          </p>
          <button className="primary-button wide" disabled={store.saving}>
            Confirm bank posting
            <Check size={16} />
          </button>
        </form>
      )}
      {t.status !== "reversed" && (
        <button
          className="secondary-button wide"
          disabled={store.saving}
          onClick={onReverse}
        >
          Reverse this record
        </button>
      )}
      <p className="muted small">
        Reversing restores tracked capacity; it does not change or cancel a bank
        transaction.
      </p>
    </div>
  );
}
