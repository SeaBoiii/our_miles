"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  ChevronRight,
  Check,
  Info,
} from "lucide-react";
import type { OwnedCard, Owner, RewardCategory } from "@/lib/domain";
import { CARD_TEMPLATES, getTemplate } from "@/lib/rules";
import { getCardCapacity, getCardCapacities, getAnnualQualificationProgress } from "@/lib/engine";
import { getPeriod, getCalendarQuarter } from "@/lib/periods";
import { REWARD_CATEGORIES } from "@/lib/additional-card-rules";
import { getCardBenefits } from "@/lib/card-benefits";
import { formatDate, formatMoney, makeId, today } from "@/lib/state";
import { Sheet, Progress, SectionHeading } from "./primitives";
import type { Store, View } from "./miles-app";

export function WalletScreen({
  store,
  go,
  notify,
}: {
  store: Store;
  go: (view: View) => void;
  notify: (message: string) => void;
}) {
  const [filter, setFilter] = useState<"Both" | Owner>("Both");
  const [edit, setEdit] = useState<OwnedCard | null>(null);
  const [add, setAdd] = useState(false);
  const cards = store.state!.cards.filter(
    (c) => filter === "Both" || c.owner === filter,
  );
  const active = cards.filter((c) => c.status === "active");
  const inactive = cards.filter((c) => c.status !== "active");
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">TWO PEOPLE. ONE STRATEGY.</span>
        <div className="title-with-action">
          <h1>Our wallet.</h1>
          <button
            className="icon-button outlined"
            aria-label="Add a card"
            onClick={() => setAdd(true)}
          >
            <Plus size={21} />
          </button>
        </div>
        <p>The useful number? How much is left.</p>
      </div>
      <div className="wallet-toolbar">
        <div
          className="segmented owner-filter"
          aria-label="Filter cards by owner"
        >
          {(["Both", "Aleem", "Nurul"] as const).map((name) => (
            <button
              key={name}
              aria-pressed={filter === name}
              className={filter === name ? "selected" : ""}
              onClick={() => setFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <span className="muted small">{active.length} active</span>
      </div>
      <section className="wallet-list" aria-label="Active cards">
        {active.length ? (
          active.map((card) => (
            <WalletRow
              key={card.id}
              card={card}
              store={store}
              onEdit={() => setEdit(card)}
            />
          ))
        ) : (
          <div className="empty-state">
            <h2>
              {filter === "Nurul"
                ? "Nurul’s wallet starts here."
                : "Let’s confirm our cards."}
            </h2>
            <p>
              Only active cards enter recommendations. Add an owned card or
              confirm a template below.
            </p>
            <button className="primary-button" onClick={() => setAdd(true)}>
              Add a card
              <Plus size={17} />
            </button>
          </div>
        )}
      </section>
      {inactive.length > 0 && (
        <section className="inactive-section">
          <SectionHeading title="Not in the rotation" />
          <p className="muted small">
            Templates stay out of recommendations until you confirm ownership
            and activate them.
          </p>
          {inactive.map((card) => (
            <button
              className="inactive-row"
              key={card.id}
              onClick={() => setEdit(card)}
            >
              <span
                className="issuer-mark"
                style={{ color: getTemplate(card.templateId)?.accent }}
              >
                {getTemplate(card.templateId)?.issuer.slice(0, 1)}
              </span>
              <span>
                <strong>{getTemplate(card.templateId)?.name}</strong>
                <span>
                  {card.owner} ·{" "}
                  {card.status === "unconfirmed"
                    ? "Ownership unconfirmed"
                    : "Inactive"}
                </span>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
        </section>
      )}
      <button className="welcome-link" onClick={() => go("bonuses")}>
        <div>
          <span className="eyebrow">ALSO IN OUR WALLET</span>
          <h2>Welcome bonuses</h2>
          <p>Progress, deadlines & what’s worth chasing.</p>
        </div>
        <ArrowUpRight size={22} />
      </button>
      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? (getTemplate(edit.templateId)?.name ?? "Card") : "Card"}
        description="Confirm ownership, status and current period usage."
      >
        {edit && (
          <CardEditor
            key={edit.id}
            card={edit}
            store={store}
            onSaved={() => {
              setEdit(null);
              notify("Card updated");
            }}
          />
        )}
      </Sheet>
      <Sheet
        open={add}
        onClose={() => setAdd(false)}
        title="Add to our wallet"
        description="Choose an owned card. We never need a card number."
      >
        <AddCard
          store={store}
          onSaved={() => {
            setAdd(false);
            notify("Card added · set its current usage");
          }}
        />
      </Sheet>
    </>
  );
}
function WalletRow({
  card,
  store,
  onEdit,
}: {
  card: OwnedCard;
  store: Store;
  onEdit: () => void;
}) {
  const template = getTemplate(card.templateId)!;
  const cap = getCardCapacity(card, store.state!.transactions, today());
  const caps = getCardCapacities(card, store.state!.transactions, today());
  const annual = getAnnualQualificationProgress(card, store.state!.transactions, today());
  const needsCategory = template.rules.some(r=>r.selectedCategory) && (!card.selectedRewardCategory || card.selectedRewardCategoryPeriodStart !== getCalendarQuarter(today()).start);
  const rewardLabel =
    cap.milesPerDollar > 0
      ? `at ${cap.milesPerDollar % 1 ? cap.milesPerDollar.toFixed(2) : cap.milesPerDollar} mpd`
      : "bonus cashback";
  const remaining = cap.remainingSgd;
  const status =
    remaining === null
      ? "Usage needs confirming"
      : remaining <= 0
        ? "Bonus cap reached"
        : remaining < 150
          ? "Nearly at the cap"
          : "Room for the everyday";
  return (
    <button
      className="wallet-row"
      onClick={onEdit}
      aria-label={`${card.owner}'s ${template.name}, ${remaining === null ? "usage unknown" : formatMoney(remaining) + " bonus capacity left"}`}
    >
      <div className="wallet-row-top">
        <div className="wallet-card-title">
          <span className="issuer-mark" style={{ color: template.accent }}>
            {template.issuer.slice(0, 1)}
          </span>
          <div>
            <h2>{template.name}</h2>
            <span>
              {card.owner} <span className="dot-separator">·</span>{" "}
              {template.role}
            </span>
          </div>
        </div>
        <ChevronRight size={17} />
      </div>
      {caps.length > 1 ? <div className="wallet-buckets">{caps.map(bucket => <div key={bucket.group}>
        <span>{bucket.label}</span><strong>{bucket.remainingSgd === null ? "Confirm usage" : `${formatMoney(bucket.remainingSgd)} left at ${bucket.milesPerDollar} mpd`}</strong>
        <Progress value={bucket.remainingSgd === null ? 0 : bucket.usedSgd / bucket.capSgd! * 100} label={`${bucket.label} bonus spend used`} />
      </div>)}</div> : <div className="wallet-capacity">
        <strong>
          {needsCategory ? "Choose bonus category" : cap.capSgd !== null
            ? remaining === null
              ? "Confirm usage"
              : `${formatMoney(remaining)} left`
            : template.manualReview
              ? "Check issuer terms"
              : annual ? "3 mpd with partners" : "Everyday rewards"}
        </strong>
        <span>
          {needsCategory ? "0.4 mpd until confirmed" : cap.capSgd !== null
            ? remaining === null ? "Usage not confirmed" : rewardLabel
            : template.manualReview
              ? "Manual review"
              : annual ? annual.qualified ? "2.4 mpd eligible categories" : "1.2 mpd elsewhere" : "No tracked bonus cap"}
        </span>
      </div>}
      {caps.length <= 1 && cap.capSgd !== null && !needsCategory && (
        <Progress
          value={remaining === null ? 0 : (cap.usedSgd / cap.capSgd) * 100}
          label={`${template.name} bonus spend used`}
          className={
            remaining !== null && remaining < 150 ? "attention-progress" : ""
          }
        />
      )}
      <div className="wallet-row-footer">
        <span>
          {needsCategory ? "Select with UOB first" : cap.minimumSpendRemainingSgd > 0 && remaining !== null
            ? `${formatMoney(cap.minimumSpendRemainingSgd)} to minimum spend`
            : cap.capSgd !== null
              ? status
              : annual ? annual.qualified ? "Accelerator miles deferred" : annual.known ? `${formatMoney(annual.qualifyingSpendSgd)} of S$1,000 annual qualifier` : "Annual qualification needs checking" : "Active"}
        </span>
        <span>
          {cap.periodEnd
            ? `Resets ${formatDate(cap.periodEnd)}`
            : card.statementDay
              ? "Statement cycle"
              : "No monthly cap"}
        </span>
      </div>
    </button>
  );
}
function CardEditor({
  card,
  store,
  onSaved,
}: {
  card: OwnedCard;
  store: Store;
  onSaved: () => void;
}) {
  const template = getTemplate(card.templateId)!;
  const capacity = getCardCapacity(card, store.state!.transactions, today());
  const capacities = getCardCapacities(card, store.state!.transactions, today());
  const benefits = getCardBenefits(card.templateId, today());
  const currentOpeningPeriod = getPeriod(today(), capacity.period ?? "calendar-month", card.statementDay);
  const openingIsCurrent = card.openingPeriodStart === currentOpeningPeriod?.start;
  const [owner, setOwner] = useState(card.owner);
  const [status, setStatus] = useState(card.status);
  const [day, setDay] = useState(
    card.statementDay ? String(card.statementDay) : "",
  );
  const [known, setKnown] = useState(card.usageKnown);
  const [spend, setSpend] = useState(String(openingIsCurrent ? card.openingSpendSgd ?? 0 : 0));
  const [qualifying, setQualifying] = useState(
    String(openingIsCurrent ? card.openingQualifyingSpendSgd ?? 0 : 0),
  );
  const [bucketSpend, setBucketSpend] = useState<Record<string, number>>(openingIsCurrent ? card.openingCapSpendSgd ?? {} : {});
  const [bucketKnown, setBucketKnown] = useState<Record<string, boolean>>(card.capUsageKnown ?? {});
  const [rewardSpend, setRewardSpend] = useState<Record<string, number>>(openingIsCurrent ? card.openingRewardSpendSgd ?? {} : {});
  const [rewardCategory, setRewardCategory] = useState<RewardCategory | "">(card.selectedRewardCategory ?? "");
  const quarter = getCalendarQuarter(today());
  const [categoryConfirmed, setCategoryConfirmed] = useState(!!card.selectedRewardCategory && card.selectedRewardCategoryPeriodStart === quarter.start);
  const [annualStart, setAnnualStart] = useState(card.annualQualificationStart?.slice(0,7) ?? "");
  const [annualSpend, setAnnualSpend] = useState(String(card.openingAnnualQualifyingSpendSgd ?? 0));
  const [annualKnown, setAnnualKnown] = useState(card.annualUsageKnown ?? false);
  const hasSelectedCategory = template.rules.some(r=>r.selectedCategory);
  const hasAnnual = template.rules.some(r=>r.annualQualification);
  const rewardGroups = [...new Set(template.rules.map(r=>r.bonusRounding?.group).filter((group): group is string=>!!group))];
  const splitRewards = rewardGroups.length > 1;
  const [transfer, setTransfer] = useState(
    String((card.transferFeePerMileSgd ?? 0) * 1000),
  );
  const [lifetime, setLifetime] = useState(
    card.openingLifetimeCashbackSgd === undefined
      ? ""
      : String(card.openingLifetimeCashbackSgd),
  );
  const lifetimeLimit = template.rules.find(
    (rule) => rule.cap?.lifetimeCashbackSgd !== undefined,
  )?.cap?.lifetimeCashbackSgd;
  const periodKind =
    template.rules.find((r) => r.cap)?.cap?.period ??
    template.rules.find((r) => r.minimumSpend)?.minimumSpend?.period;
  const period = periodKind
    ? getPeriod(today(), periodKind, Number(day))
    : null;
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const next = {
          ...card,
          owner,
          status,
          statementDay: day ? Number(day) : undefined,
          usageKnown: known,
          openingSpendSgd: known ? Number(spend) : 0,
          openingQualifyingSpendSgd: known ? Number(qualifying) : 0,
          openingLifetimeCashbackSgd: lifetime ? Number(lifetime) : undefined,
          openingPeriodStart: period?.start,
          transferFeePerMileSgd: Number(transfer) / 1000,
          ...(capacities.length > 1 ? {openingCapSpendSgd: bucketSpend, capUsageKnown: bucketKnown} : {}),
          ...(splitRewards ? {openingRewardSpendSgd: rewardSpend, openingSpendSgd: Object.values(rewardSpend).reduce((a,b)=>a+b,0)} : {}),
          ...(hasSelectedCategory ? {selectedRewardCategory: rewardCategory || undefined, selectedRewardCategoryPeriodStart: categoryConfirmed && rewardCategory ? quarter.start : undefined} : {}),
          ...(hasAnnual ? {annualQualificationStart: annualStart ? `${annualStart}-01` : undefined, annualQualificationEnd: annualStart ? `${Number(annualStart.slice(0,4))+1}${annualStart.slice(4)}-01` : undefined, openingAnnualQualifyingSpendSgd: Number(annualSpend), annualUsageKnown: annualKnown} : {}),
        };
        if (
          await store.update((s) => ({
            ...s,
            cards: s.cards.map((c) => (c.id === card.id ? next : c)),
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
      <div className="field-pair">
        <label className="form-label">
          Owner
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as Owner)}
          >
            <option>Aleem</option>
            <option>Nurul</option>
          </select>
        </label>
        <label className="form-label">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OwnedCard["status"])}
          >
            <option value="unconfirmed">Unconfirmed</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      {hasSelectedCategory && <section className="setup-section">
        <h3>Your bonus category</h3>
        <label className="form-label">Category registered with UOB
          <select value={rewardCategory} onChange={e=>{setRewardCategory(e.target.value as RewardCategory | "");setCategoryConfirmed(false);}}>
            <option value="">Choose when ready</option>{REWARD_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        {rewardCategory && <label className="check-label"><input type="checkbox" checked={categoryConfirmed} onChange={e=>setCategoryConfirmed(e.target.checked)} />UOB confirms this category for {formatDate(quarter.start)} to {formatDate(quarter.end)} (end excluded)</label>}
        <p className="muted small">Select and register with <a href="https://www.uob.com.sg/ladys-enrol" target="_blank" rel="noreferrer">UOB</a> first. Later changes take effect next calendar quarter. Until confirmed here, recommendations use 0.4 mpd.</p>
      </section>}
      {hasAnnual && <details className="purchase-details"><summary>Annual airline qualification<ChevronRight size={15} /></summary>
        <div className="advanced-form">
          <label className="form-label">Current membership year starts<input type="month" value={annualStart} onChange={e=>{setAnnualStart(e.target.value);setAnnualKnown(false);}} required={annualKnown} /><span className="muted small">Use the approval month. The year ends before the same month next year.</span></label>
          <label className="form-label">Airline-group spend before our records (S$)<input type="number" min="0" max="1000000" step="0.01" value={annualSpend} onChange={e=>setAnnualSpend(e.target.value)} required={annualKnown} /></label>
          <label className="check-label"><input type="checkbox" checked={annualKnown} onChange={e=>setAnnualKnown(e.target.checked)} />I have checked this membership year and its qualifying spend</label>
          <p className="muted small">S$1,000 with Singapore Airlines, Scoot or KrisShop qualifies the 2.4 mpd accelerator. Kris+ and Pelago do not count. Extra miles are deferred until after the year ends; don’t spend just to qualify.</p>
        </div>
      </details>}
      {periodKind === "statement-month" && (
        <label className="form-label">
          Statement cycle starts on day
          <input
            type="number"
            min="1"
            max="31"
            step="1"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required={status === "active"}
          />
          <span className="muted small">
            Use the first day of the rewards cycle shown on your statement, not
            the payment due date.
          </span>
        </label>
      )}
      {capacities.length <= 1 && <label className="check-label">
        <input
          type="checkbox"
          checked={known}
          onChange={(e) => setKnown(e.target.checked)}
        />
        I have checked this period’s usage
      </label>}
      {capacities.length > 1 && <section className="setup-section"><h3>This month’s bonus usage</h3><p className="muted small">Each S$600 bucket is independent. Enter spend before our app records.</p>{capacities.map(bucket=><div className="bucket-field" key={bucket.group}>
        <label className="check-label"><input type="checkbox" checked={bucketKnown[bucket.group!] ?? false} onChange={e=>setBucketKnown({...bucketKnown,[bucket.group!]:e.target.checked})} />{bucket.label} usage checked</label>
        {bucketKnown[bucket.group!] && <label className="form-label">{bucket.label} opening spend (S$)<input type="number" min="0" max="1000000" step="0.01" value={bucketSpend[bucket.group!] ?? 0} onChange={e=>setBucketSpend({...bucketSpend,[bucket.group!]:Number(e.target.value)})} required /></label>}
      </div>)}</section>}
      {lifetimeLimit !== undefined && (
        <label className="form-label">
          Promotion cashback earned before our records (S$)
          <input
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            value={lifetime}
            onChange={(e) => setLifetime(e.target.value)}
            placeholder="Leave blank if unconfirmed"
          />
          <span className="muted small">
            Check the issuer’s total promotion balance. The promotion has a{" "}
            {formatMoney(lifetimeLimit)} lifetime cashback limit.
          </span>
        </label>
      )}
      {known && periodKind && capacities.length <= 1 && (
        <>
          {splitRewards ? <div className="setup-section"><p className="muted small">Split prior online spend by currency so DBS’s monthly bonus rounding stays accurate. Both share the S$1,000 cap.</p>{rewardGroups.map(group=><label className="form-label" key={group}>{group.endsWith("local") ? "SGD" : "Foreign-currency"} online spend before our records (S$)<input type="number" min="0" max="1000000" step="0.01" value={rewardSpend[group] ?? 0} onChange={e=>setRewardSpend({...rewardSpend,[group]:Number(e.target.value)})} required /></label>)}</div> : <label className="form-label">
            Bonus-eligible spend before our app records
            <input
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              value={spend}
              onChange={(e) => setSpend(e.target.value)}
              required
            />
            <span className="muted small">
              {period
                ? `${formatDate(period.start)} to ${formatDate(period.end)} (end excluded). `
                : "Confirm the cycle date first. "}
              Purchases you record here are added automatically.
            </span>
          </label>}
          {capacity.minimumSpendSgd !== null && (
            <label className="form-label">
              Total qualifying spend before our records
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={qualifying}
                onChange={(e) => setQualifying(e.target.value)}
                required
              />
            </label>
          )}
        </>
      )}
      {benefits && <details className="purchase-details card-benefits"><summary>Benefits & things to know<ChevronRight size={15} /></summary>
        <p className="muted small">Checked {formatDate(benefits.verifiedAt)} · {benefits.summary}</p>
        {benefits.sections.map(section=><details className="benefit-section" key={section.id}><summary>{section.title}<ChevronRight size={15} /></summary>{section.items.map(item=><div className="benefit-item" key={item.title}><strong>{item.title}</strong>{item.status !== "Confirmed" && <span className="benefit-status">{item.status}</span>}<p>{item.detail}</p>{item.validUntil && <p className="muted small">Valid through {formatDate(item.validUntil)}</p>}<div className="benefit-sources">{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowUpRight size={12} /></a>)}</div></div>)}</details>)}
        {benefits.caveats.map(note=><p className="muted small" key={note}>{note}</p>)}
      </details>}
      <details className="purchase-details">
        <summary>
          Transfer cost allocation
          <ChevronRight size={15} />
        </summary>
        <label className="form-label">
          S$ cost per 1,000 miles
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={transfer}
            onChange={(e) => setTransfer(e.target.value)}
            required
          />
        </label>
        <p className="muted small">
          Use your expected transfer size to allocate flat fees. Zero means you
          haven’t allocated a fee; the recommendation will say so.
        </p>
      </details>
      {template.manualReview && (
        <div className="form-notice">
          <Info size={16} />
          <p>{template.manualReview}</p>
        </div>
      )}
      <details className="purchase-details">
        <summary>
          Card rule sources
          <ChevronRight size={15} />
        </summary>
        {template.rules.map((r) => (
          <div className="rule-source" key={r.id}>
            <strong>{r.label}</strong>
            <span>
              {r.verification} · {r.lastVerifiedAt || "Needs verification"}
            </span>
            {r.sourceUrl && (
              <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                Bank terms
                <ArrowUpRight size={13} />
              </a>
            )}
            {r.notes?.map((note) => (
              <p className="muted small" key={note}>
                {note}
              </p>
            ))}
          </div>
        ))}
      </details>
      <button className="primary-button" disabled={store.saving}>
        Save card
        <Check size={17} />
      </button>
    </form>
  );
}
function AddCard({ store, onSaved }: { store: Store; onSaved: () => void }) {
  const [templateId, setTemplateId] = useState("citi-rewards");
  const [owner, setOwner] = useState<Owner>(store.owner);
  const duplicate = store.state!.cards.some(
    (c) => c.templateId === templateId && c.owner === owner,
  );
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (duplicate) return;
        if (
          await store.update((s) => ({
            ...s,
            cards: [
              ...s.cards,
              {
                id: makeId(),
                templateId,
                owner,
                status: "active",
                usageKnown: false,
              },
            ],
          }))
        )
          onSaved();
      }}
    >
      <label className="form-label">
        Whose card?
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value as Owner)}
        >
          <option>Aleem</option>
          <option>Nurul</option>
        </select>
      </label>
      <label className="form-label">
        Card
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {CARD_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">
        We’ll mark usage unknown until you confirm the current cycle. Never add
        card numbers or security details.
      </p>
      {duplicate && (
        <p className="form-notice">
          This card is already in {owner}’s wallet. Edit it in the list.
        </p>
      )}
      <button className="primary-button" disabled={duplicate || store.saving}>
        Add card
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
