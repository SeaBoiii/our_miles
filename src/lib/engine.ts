import type {
  CardCapacity,
  CardAssessment,
  AssessmentBlocker,
  AnnualQualificationProgress,
  CardRule,
  CardTemplate,
  Confidence,
  OfferProgress,
  OwnedCard,
  Purchase,
  Recommendation,
  RecommendationContext,
  RuleConditions,
  Transaction,
  WelcomeOffer,
} from "./domain";
import { daysBetween, getAnnualPeriod, getCalendarQuarter, getPeriod, inPeriod, singaporeDate } from "./periods";
import { CARD_TEMPLATES, getTemplate } from "./rules";

const confidenceOrder: Record<Confidence, number> = {
  Confirmed: 2,
  Likely: 1,
  Unverified: 0,
};
const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const rewardNumber = (value: number) =>
  Math.round((value + Number.EPSILON) * 10000) / 10000;
const positive = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, value!) : 0;

function lesserConfidence(a: Confidence, b: Confidence): Confidence {
  return confidenceOrder[a] <= confidenceOrder[b] ? a : b;
}

function matchesMcc(
  mcc: number,
  codes?: number[],
  ranges?: [number, number][],
): boolean {
  return (
    !!codes?.includes(mcc) ||
    !!ranges?.some(([start, end]) => mcc >= start && mcc <= end)
  );
}

/** Categories are hints; an explicitly supplied MCC wins over a category guess. */
export function matchConditions(
  purchase: Purchase,
  conditions: RuleConditions,
): { eligible: boolean; confidence: Confidence } {
  if (purchase.excluded) return { eligible: false, confidence: "Confirmed" };
  if (conditions.excludeRecurring && purchase.recurring) return { eligible: false, confidence: "Confirmed" };
  if (conditions.rewardPartners && (!purchase.rewardPartner || !conditions.rewardPartners.includes(purchase.rewardPartner))) return { eligible: false, confidence: purchase.rewardPartner ? "Confirmed" : "Unverified" };
  if (conditions.channels && !conditions.channels.includes(purchase.channel))
    return { eligible: false, confidence: "Confirmed" };
  if (
    conditions.paymentMethods &&
    !conditions.paymentMethods.includes(purchase.paymentMethod)
  )
    return { eligible: false, confidence: "Confirmed" };
  if (conditions.excludedPaymentMethods?.includes(purchase.paymentMethod) || (purchase.paymentMethod === "samsung-pay" && conditions.excludedPaymentMethods?.includes("mobile-wallet")))
    return { eligible: false, confidence: "Confirmed" };
  if (
    conditions.currency &&
    (purchase.currency.toUpperCase() === "SGD" ? "local" : "foreign") !==
      conditions.currency
  )
    return { eligible: false, confidence: "Confirmed" };
  const merchant = purchase.merchant.toLowerCase();
  if (conditions.excludedMerchantWords?.some((word) => merchant.split(/[^\p{L}\p{N}]+/u).includes(word.toLowerCase()))) return { eligible: false, confidence: "Confirmed" };
  if (
    conditions.merchantIncludes &&
    !conditions.merchantIncludes.some((part) =>
      merchant.includes(part.toLowerCase()),
    )
  )
    return { eligible: false, confidence: "Confirmed" };
  if (
    conditions.excludedMerchantIncludes?.some((part) =>
      merchant.includes(part.toLowerCase()),
    )
  )
    return { eligible: false, confidence: "Confirmed" };
  if (conditions.excludedCategories?.includes(purchase.category))
    return { eligible: false, confidence: "Confirmed" };
  if (purchase.mcc !== undefined) {
    if (
      !Number.isInteger(purchase.mcc) ||
      purchase.mcc < 0 ||
      purchase.mcc > 9999
    )
      return { eligible: false, confidence: "Unverified" };
    if (
      matchesMcc(
        purchase.mcc,
        conditions.excludedMccs,
        conditions.excludedMccRanges,
      )
    )
      return {
        eligible: false,
        confidence: purchase.mccConfidence ?? "Unverified",
      };
    if (
      (conditions.mccs || conditions.mccRanges) &&
      !matchesMcc(purchase.mcc, conditions.mccs, conditions.mccRanges)
    )
      return {
        eligible: false,
        confidence: purchase.mccConfidence ?? "Unverified",
      };
    return {
      eligible: true,
      confidence: purchase.mccConfidence ?? "Unverified",
    };
  }
  if (
    conditions.categories &&
    !conditions.categories.includes(purchase.category)
  )
    return { eligible: false, confidence: "Likely" };
  // An MCC-dependent blacklist is still uncertain when the MCC is not supplied.
  const mccDependent =
    conditions.mccs ||
    conditions.mccRanges ||
    conditions.excludedMccs ||
    conditions.excludedMccRanges;
  return { eligible: true, confidence: mccDependent ? "Likely" : "Confirmed" };
}

export function activeRules(template: CardTemplate, date: string): CardRule[] {
  const day = singaporeDate(date);
  // At most one current version of a rule ID; newer versions win only when active.
  const byId = new Map<string, CardRule>();
  for (const rule of template.rules) {
    if (rule.validFrom > day || (rule.validUntil && rule.validUntil < day))
      continue;
    const existing = byId.get(rule.id);
    if (!existing || existing.version < rule.version) byId.set(rule.id, rule);
  }
  return [...byId.values()];
}

function bankingDate(transaction: Transaction, card: OwnedCard, rule?: CardRule, minimum = false): string {
  if (minimum && rule?.minimumSpend?.postingGraceDays && transaction.postedDate) {
    const spent = singaporeDate(transaction.date);
    const nextMonth = getPeriod(spent, "calendar-month")!.end;
    const graceDeadline = `${nextMonth.slice(0, 7)}-${String(rule.minimumSpend.postingGraceDays).padStart(2, "0")}`;
    return singaporeDate(transaction.postedDate) <= graceDeadline ? spent : transaction.postedDate;
  }
  if (rule?.periodDate === "transaction") return transaction.date;
  if (rule?.periodDate === "posting") return transaction.postedDate ?? transaction.date;
  if (card.templateId === "maybank-xl" && transaction.postedDate) {
    const spent = singaporeDate(transaction.date);
    const nextMonth = getPeriod(spent, "calendar-month")!.end;
    const graceDeadline = `${nextMonth.slice(0, 7)}-10`;
    return singaporeDate(transaction.postedDate) <= graceDeadline
      ? spent
      : nextMonth;
  }
  return transaction.postedDate ?? transaction.date;
}

function periodTransactions(
  card: OwnedCard,
  transactions: Transaction[],
  period: { start: string; end: string },
  rule?: CardRule,
  minimum = false,
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.cardId === card.id &&
      transaction.status !== "reversed" &&
      inPeriod(bankingDate(transaction, card, rule, minimum), period),
  );
}

function opening(
  card: OwnedCard,
  period: { start: string; end: string },
  qualifying = false,
): number {
  if (card.openingPeriodStart !== period.start) return 0;
  return positive(
    qualifying
      ? (card.openingQualifyingSpendSgd ?? card.openingSpendSgd)
      : card.openingSpendSgd,
  );
}

function selectedCategoryMatches(card: OwnedCard, rule: CardRule, date: string): boolean {
  return !rule.selectedCategory || (card.selectedRewardCategory === rule.selectedCategory && card.selectedRewardCategoryPeriodStart === getCalendarQuarter(date).start);
}

function capGroups(template: CardTemplate | undefined, date: string): number {
  return new Set(template ? activeRules(template, date).flatMap((rule) => rule.cap ? [rule.cap.group] : []) : []).size;
}

function openingCap(card: OwnedCard, period: { start: string; end: string }, rule: CardRule, multipleGroups: boolean): number {
  if (card.openingPeriodStart !== period.start) return 0;
  if (rule.cap && card.openingCapSpendSgd?.[rule.cap.group] !== undefined) return positive(card.openingCapSpendSgd[rule.cap.group]);
  return multipleGroups ? 0 : positive(card.openingSpendSgd);
}

function capKnown(card: OwnedCard, rule: CardRule, multipleGroups: boolean): boolean {
  return rule.cap ? (card.capUsageKnown?.[rule.cap.group] ?? (!multipleGroups && card.usageKnown)) : card.usageKnown;
}

function reservedUsage(records: Transaction[], rule: CardRule, template?: CardTemplate): number {
  if (rule.cap?.usageRounding === "raw") return records.reduce((sum, record) => sum + record.reward.bonusSpendSgd, 0);
  let total = 0;
  const aggregated = new Map<string, { amount: number; rule: CardRule }>();
  for (const record of records) {
    const historical = template?.rules.find((candidate) => candidate.id === record.reward.ruleId && candidate.version === record.reward.ruleVersion) ?? rule;
    if (historical.rounding?.scope === "period") {
      const key = record.reward.roundingGroup ?? historical.rounding.group ?? historical.cap?.group ?? historical.id;
      const bucket = aggregated.get(key) ?? { amount: 0, rule: historical };
      bucket.amount += record.reward.bonusSpendSgd;
      aggregated.set(key, bucket);
    } else total += roundedSpend(record.reward.bonusSpendSgd, historical);
  }
  return total + [...aggregated.values()].reduce((sum, bucket) => sum + roundedSpend(bucket.amount, { ...bucket.rule, rounding: { ...bucket.rule.rounding!, scope: "transaction" } }), 0);
}

function ruleUsage(
  card: OwnedCard,
  transactions: Transaction[],
  rule: CardRule,
  date: string,
  template?: CardTemplate,
) {
  const multipleGroups = capGroups(template, date) > 1;
  const period = rule.cap
    ? getPeriod(date, rule.cap.period, card.statementDay)
    : rule.rounding?.scope === "period"
      ? getPeriod(date, "calendar-month")
      : null;
  const minPeriod = rule.minimumSpend
    ? getPeriod(date, rule.minimumSpend.period, card.statementDay)
    : period;
  const records = period ? periodTransactions(card, transactions, period, rule) : [];
  const eligibleRecords = records.filter(
    (transaction) => transaction.reward.bonusCapGroup === rule.cap?.group,
  );
  const openingSpend = period ? openingCap(card, period, rule, multipleGroups) : 0;
  // Reserve eligible spending before the cap, so late posting into a new period
  // cannot inherit the old period's clipped bonus allocation and undercount usage.
  const used =
    rule.cap?.usageRounding !== "raw" && rule.rounding?.scope === "period" && !rule.rounding.group
      ? roundedSpend(
          openingSpend +
            eligibleRecords.reduce(
              (total, transaction) => total + transaction.reward.bonusSpendSgd,
              0,
            ),
          { ...rule, rounding: { ...rule.rounding, scope: "transaction" } },
        )
      : openingSpend + reservedUsage(eligibleRecords, rule, template);
  const qualifying = minPeriod
    ? opening(card, minPeriod, true) +
      periodTransactions(card, transactions, minPeriod, rule, true)
        .filter((transaction) => {
          if (transaction.status === "pending") return false;
          const historical = template?.rules.find(candidate => candidate.id === transaction.reward.ruleId && candidate.version === transaction.reward.ruleVersion) ?? rule;
          const eligibility = matchConditions(transaction, historical.conditions);
          return eligibility.eligible && eligibility.confidence !== "Unverified";
        })
        .reduce(
          (total, transaction) => total + transaction.reward.qualifyingSpendSgd,
          0,
        )
    : 0;
  return {
    period,
    used: money(used),
    qualifying: money(qualifying),
    remaining: rule.cap
      ? capKnown(card, rule, multipleGroups) && period
        ? money(Math.max(0, rule.cap.spendSgd - used))
        : null
      : null,
  };
}

export function getCardCapacity(
  card: OwnedCard,
  transactions: Transaction[],
  date: string,
  templates: CardTemplate[] = CARD_TEMPLATES,
): CardCapacity {
  const capacities = getCardCapacities(card, transactions, date, templates);
  if (capacities[0]) return capacities[0];
  const template = getTemplate(card.templateId, templates);
  const rules = template ? activeRules(template, date) : [];
  const top = rules.sort((a, b) => b.milesPerDollar - a.milesPerDollar || b.cashbackRate - a.cashbackRate)[0];
  return { remainingSgd: null, usedSgd: 0, capSgd: null, periodStart: null, periodEnd: null, period: null, milesPerDollar: top?.milesPerDollar ?? 0, minimumSpendSgd: null, qualifyingSpendSgd: 0, minimumSpendRemainingSgd: 0 };
}

/** Each independent bucket is shown once; channels sharing a group share capacity. */
export function getCardCapacities(card: OwnedCard, transactions: Transaction[], date: string, templates: CardTemplate[] = CARD_TEMPLATES): CardCapacity[] {
  const template = getTemplate(card.templateId, templates);
  const rules = template ? activeRules(template, date) : [];
  const capped = rules
    .filter((rule) => rule.cap)
    .sort(
      (a, b) =>
        b.milesPerDollar - a.milesPerDollar || b.cashbackRate - a.cashbackRate,
    );
  const groups = new Map<string, CardRule>();
  for (const rule of capped) if (!groups.has(rule.cap!.group) || selectedCategoryMatches(card, rule, date)) {
    const existing = groups.get(rule.cap!.group);
    if (!existing || (!selectedCategoryMatches(card, existing, date) && selectedCategoryMatches(card, rule, date))) groups.set(rule.cap!.group, rule);
  }
  return [...groups.values()].map((capped) => {
    const usage = ruleUsage(card, transactions, capped, date, template);
    const top = selectedCategoryMatches(card, capped, date) ? capped : rules.filter((rule) => !rule.cap).sort((a, b) => b.milesPerDollar - a.milesPerDollar)[0];
    return {
    group: capped.cap!.group,
    label: capped.cap!.label ?? capped.label,
    remainingSgd: usage?.remaining ?? null,
    usedSgd: usage?.used ?? 0,
    capSgd: capped?.cap?.spendSgd ?? null,
    periodStart: usage?.period?.start ?? null,
    periodEnd: usage?.period?.end ?? null,
    period: capped?.cap?.period ?? null,
    milesPerDollar: top?.milesPerDollar ?? 0,
    minimumSpendSgd: capped?.minimumSpend?.amountSgd ?? null,
    qualifyingSpendSgd: usage?.qualifying ?? 0,
    minimumSpendRemainingSgd: Math.max(
      0,
      (capped?.minimumSpend?.amountSgd ?? 0) - (usage?.qualifying ?? 0),
    ),
  }; });
}

export function getAnnualQualificationProgress(card: OwnedCard, transactions: Transaction[], date: string, templates: CardTemplate[] = CARD_TEMPLATES): AnnualQualificationProgress | null {
  const template = getTemplate(card.templateId, templates);
  const qualification = template ? activeRules(template, date).find((rule) => rule.annualQualification)?.annualQualification : undefined;
  if (!qualification) return null;
  const period = getAnnualPeriod(date, card.annualQualificationStart, card.annualQualificationEnd);
  const known = !!period && !!card.annualUsageKnown;
  const qualifyingSpendSgd = known ? money(positive(card.openingAnnualQualifyingSpendSgd) + transactions.filter((record) => record.cardId === card.id && record.status !== "pending" && record.status !== "reversed" && inPeriod(record.postedDate ?? record.date, period!) && matchConditions(record, qualification.conditions).eligible && matchConditions(record, qualification.conditions).confidence !== "Unverified").reduce((sum, record) => sum + record.amountSgd, 0)) : 0;
  return { known, qualified: known && qualifyingSpendSgd >= qualification.amountSgd, qualifyingSpendSgd, requiredSpendSgd: qualification.amountSgd, remainingSgd: Math.max(0, qualification.amountSgd - qualifyingSpendSgd), periodStart: period?.start ?? null, periodEnd: period?.end ?? null };
}

function roundedSpend(
  amount: number,
  rule: CardRule,
  previousQualifying = 0,
): number {
  const block = rule.rounding?.blockSgd;
  if (!block) return amount;
  if (rule.rounding?.scope === "period")
    return money(
      Math.floor((previousQualifying + amount + 1e-9) / block) * block -
        Math.floor((previousQualifying + 1e-9) / block) * block,
    );
  return money(Math.floor((amount + 1e-9) / block) * block);
}

function roundedMiles(amount: number, milesPerDollar: number, unitMiles: number, previousAmount = 0): number {
  return rewardNumber((Math.floor(((previousAmount + amount) * milesPerDollar + 1e-9) / unitMiles) - Math.floor((previousAmount * milesPerDollar + 1e-9) / unitMiles)) * unitMiles);
}

function rewardGroupPrior(card: OwnedCard, transactions: Transaction[], rule: CardRule, period: { start: string; end: string } | null, template: CardTemplate, group: string, component = false): { amount: number; known: boolean; confidence: Confidence } {
  if (!period) return { amount: 0, known: false, confidence: "Unverified" };
  const capOpening = openingCap(card, period, rule, capGroups(template, period.start) > 1);
  const explicitOpening = card.openingPeriodStart === period.start ? card.openingRewardSpendSgd?.[group] ?? (component && group === rule.cap?.group ? capOpening : undefined) : undefined;
  const records = periodTransactions(card, transactions, period, rule).filter((record) => component ? record.reward.bonusRoundingGroup === group : record.reward.roundingGroup === group);
  const confidence = records.reduce((result, record) => lesserConfidence(result, matchConditions(record, rule.conditions).confidence), "Confirmed" as Confidence);
  return { amount: positive(explicitOpening) + records.reduce((sum, record) => sum + (component ? record.reward.bonusSpendSgd : record.amountSgd), 0), known: (capOpening === 0 || explicitOpening !== undefined) && confidence !== "Unverified", confidence };
}

function offerSpend(offer: WelcomeOffer, transactions: Transaction[]): number {
  return money(
    positive(offer.openingSpendSgd) +
      transactions
        .filter(
          (transaction) =>
            transaction.cardId === offer.cardId &&
            transaction.status !== "reversed" &&
            transaction.status !== "pending" &&
            matchConditions(transaction, offer.conditions ?? {}).eligible &&
            matchConditions(transaction, offer.conditions ?? {}).confidence !== "Unverified" &&
            singaporeDate(transaction.postedDate ?? transaction.date) >=
              offer.startsOn &&
            singaporeDate(transaction.postedDate ?? transaction.date) <=
              offer.deadline &&
            transaction.reward.welcomeOfferId === offer.id,
        )
        .reduce(
          (total, transaction) =>
            total + transaction.reward.welcomeContributionSgd,
          0,
        ),
  );
}

function tierMiles(offer: WelcomeOffer, spend: number): number {
  return offer.tiers.reduce(
    (highest, tier) =>
      spend >= tier.spendSgd ? Math.max(highest, tier.miles) : highest,
    0,
  );
}

export function getOfferProgress(
  offer: WelcomeOffer,
  transactions: Transaction[],
  date: string,
): OfferProgress {
  const day = singaporeDate(date);
  const spendSgd = offerSpend(offer, transactions);
  const nextTier =
    [...offer.tiers]
      .sort((a, b) => a.spendSgd - b.spendSgd)
      .find((tier) => tier.spendSgd > spendSgd) ?? null;
  const remainingSgd = nextTier
    ? money(Math.max(0, nextTier.spendSgd - spendSgd))
    : 0;
  const daysRemaining = Math.max(0, daysBetween(day, offer.deadline));
  let status: OfferProgress["status"];
  let message: string;
  if (!offer.verified || !offer.eligibilityConfirmed) {
    status = "unverified";
    message = "Confirm your offer in the bank app";
  } else if (day < offer.startsOn) {
    status = "not-started";
    message = "Offer has not started";
  } else if (!nextTier) {
    status = "complete";
    message = "Spend target reached";
  } else if (day > offer.deadline) {
    status = "expired";
    message = "Offer period ended";
  } else if (remainingSgd > positive(offer.plannedNaturalSpendSgd)) {
    status = "not-worth-chasing";
    message = "Not worth chasing";
  } else {
    status = "on-track";
    message = "Your planned spending can reach this tier";
  }
  return { spendSgd, nextTier, remainingSgd, daysRemaining, status, message };
}

function welcomeValue(
  purchase: Purchase,
  card: OwnedCard,
  context: RecommendationContext,
  qualifying: boolean,
) {
  const day = singaporeDate(purchase.date);
  const offer = context.offers.find(
    (candidate) =>
      candidate.cardId === card.id &&
      candidate.startsOn <= day &&
      candidate.deadline >= day &&
      candidate.verified &&
      candidate.eligibilityConfirmed &&
      matchConditions(purchase, candidate.conditions ?? {}).eligible &&
      matchConditions(purchase, candidate.conditions ?? {}).confidence !== "Unverified",
  );
  if (!offer || !qualifying)
    return { offer: undefined, contribution: 0, miles: 0 };
  const progress = offerSpend(offer, context.transactions);
  const naturalSpend = positive(offer.plannedNaturalSpendSgd);
  // Only reward unlocked by this intended purchase counts. Already-achievable tiers
  // are not credited again, and unaffordable future tiers never boost the score.
  const before = tierMiles(offer, progress + naturalSpend);
  const after = tierMiles(offer, progress + naturalSpend + purchase.amountSgd);
  return {
    offer,
    contribution: purchase.amountSgd,
    miles: Math.max(0, after - before),
  };
}

function calculate(
  purchase: Purchase,
  card: OwnedCard,
  template: CardTemplate,
  chosen: CardRule,
  base: CardRule | undefined,
  context: RecommendationContext,
): Recommendation {
  const warnings = [...(chosen.notes ?? [])];
  let confidence = lesserConfidence(
    chosen.verification,
    matchConditions(purchase, chosen.conditions).confidence,
  );
  const usage = ruleUsage(card, context.transactions, chosen, purchase.date, template);
  const purchaseEligibility = matchConditions(purchase, chosen.conditions);
  const qualifies = purchaseEligibility.eligible && purchaseEligibility.confidence !== "Unverified";
  const baseMpd =
    base?.milesPerDollar ?? (chosen.cap || chosen.annualQualification ? 0 : chosen.milesPerDollar);
  const baseCashback =
    base?.cashbackRate ?? (chosen.cap || chosen.annualQualification ? 0 : chosen.cashbackRate);
  const priorSpend = usage.period
    ? opening(card, usage.period, true) +
      periodTransactions(card, context.transactions, usage.period, chosen).reduce(
        (sum, record) => sum + record.reward.qualifyingSpendSgd,
        0,
      )
    : 0;
  let priorBonusSpend =
    usage.period && chosen.cap
      ? openingCap(card, usage.period, chosen, capGroups(template, purchase.date) > 1) +
        periodTransactions(card, context.transactions, usage.period, chosen)
          .filter((record) => record.reward.bonusCapGroup === chosen.cap?.group)
          .reduce((sum, record) => sum + record.reward.qualifyingSpendSgd, 0)
      : priorSpend;
  const aggregatePrior = chosen.rounding?.group ? rewardGroupPrior(card, context.transactions, chosen, usage.period, template, chosen.rounding.group) : undefined;
  if (aggregatePrior) priorBonusSpend = aggregatePrior.amount;
  const componentPrior = chosen.bonusRounding?.scope === "period" && chosen.bonusRounding.group ? rewardGroupPrior(card, context.transactions, chosen, usage.period, template, chosen.bonusRounding.group, true) : undefined;
  if (aggregatePrior) confidence = lesserConfidence(confidence, aggregatePrior.confidence);
  if (componentPrior) confidence = lesserConfidence(confidence, componentPrior.confidence);
  const earnedSpend = chosen.bonusRounding ? purchase.amountSgd : roundedSpend(purchase.amountSgd, chosen, priorBonusSpend);
  const baseGroupPrior = base?.rounding?.group ? rewardGroupPrior(card, context.transactions, base, usage.period, template, base.rounding.group) : undefined;
  const baseSpend = roundedSpend(
    purchase.amountSgd,
    base ?? chosen,
    baseGroupPrior?.amount ?? (chosen.rounding?.group ? aggregatePrior?.amount ?? 0 : priorSpend),
  );
  let bonusSpend = chosen.cap
    ? Math.min(earnedSpend, usage.remaining ?? 0)
    : earnedSpend;
  const reservedBonusSpend = chosen.cap ? purchase.amountSgd : 0;
  let minimumSpendIncrementalMiles = 0;
  if (aggregatePrior?.known === false || componentPrior?.known === false) {
    bonusSpend = 0;
    confidence = "Unverified";
    warnings.push("Confirm opening spend for this reward component. Bonus point carry is unknown; only base rewards are estimated.");
  }
  if (chosen.annualQualification) {
    const qualification = getAnnualQualificationProgress(card, context.transactions, purchase.date, context.templates ?? CARD_TEMPLATES);
    if (!qualification?.qualified) {
      bonusSpend = 0;
      if (!qualification?.known) confidence = "Unverified";
      warnings.push(qualification?.known ? `S$${money(qualification.remainingSgd)} more posted eligible airline-group spend is required this membership year. Only base miles are estimated.` : "Confirm your membership year and posted eligible airline-group spend. Only base miles are estimated.");
    } else warnings.push("The accelerated portion is deferred until the bank awards it after this membership year ends; this is an earned-mile estimate, not an immediate credit.");
  }
  if (chosen.cap && usage.remaining === null) {
    confidence = "Unverified";
    warnings.push(
      chosen.cap.period === "statement-month" && !card.statementDay
        ? "Confirm the first day of your statement cycle before using bonus capacity."
        : "Confirm current-period usage. Bonus capacity is unknown; only base rewards are estimated.",
    );
  }
  if (chosen.minimumSpend) {
    const minimum = chosen.minimumSpend.amountSgd;
    const after = usage.qualifying + (qualifies ? purchase.amountSgd : 0);
    const planned = positive(context.naturalSpendByCard?.[card.id]);
    if (after < minimum) {
      if (after + planned < minimum) {
        bonusSpend = 0;
        warnings.push(
          `S$${money(minimum - after)} more qualifying spend required this period. Bonus earn is not assumed.`,
        );
      } else {
        confidence = lesserConfidence(confidence, "Likely");
        warnings.push(
          "Bonus estimate depends on your planned natural spend reaching the minimum before the period ends.",
        );
      }
    }
    if (
      card.usageKnown &&
      qualifies &&
      usage.period &&
      usage.qualifying + planned < minimum &&
      after + planned >= minimum &&
      chosen.milesPerDollar > baseMpd
    ) {
      const priorBonusSpend =
        Math.min(
          chosen.cap?.spendSgd ?? Infinity,
          opening(card, usage.period),
        ) +
        periodTransactions(card, context.transactions, usage.period)
          .filter(
            (transaction) =>
              transaction.status !== "pending" &&
              transaction.reward.qualifyingSpendSgd > 0 &&
              matchConditions(transaction, template.rules.find(rule => rule.id === transaction.reward.ruleId && rule.version === transaction.reward.ruleVersion)?.conditions ?? chosen.conditions).confidence !== "Unverified" &&
              transaction.reward.bonusCapGroup === chosen.cap?.group,
          )
          .reduce((sum, transaction) => {
            const earnedBonusMiles = Math.max(
              0,
              transaction.reward.miles -
                roundedSpend(transaction.amountSgd, base ?? chosen) * baseMpd,
            );
            return (
              sum +
              Math.max(
                0,
                roundedSpend(transaction.reward.bonusSpendSgd, chosen) -
                  earnedBonusMiles / (chosen.milesPerDollar - baseMpd),
              )
            );
          }, 0);
      minimumSpendIncrementalMiles = rewardNumber(
        Math.min(chosen.cap?.spendSgd ?? Infinity, priorBonusSpend) *
          (chosen.milesPerDollar - baseMpd),
      );
      if (minimumSpendIncrementalMiles)
        warnings.push(
          `Reaching the minimum can add about ${minimumSpendIncrementalMiles.toLocaleString("en-SG")} bonus miles to earlier qualifying spend. Earlier snapshots remain as recorded estimates.`,
        );
    }
  }
  if (
    purchase.mcc !== undefined &&
    purchase.mccConfidence !== "Confirmed" && purchase.mccConfidence !== "Likely" &&
    (chosen.cap || chosen.annualQualification)
  ) {
    bonusSpend = 0;
    warnings.push(
      "MCC is unverified. Only base rewards are estimated until eligibility is confirmed.",
    );
  } else if (confidence === "Likely") {
    warnings.push(
      "Merchant MCC is not confirmed. This is an estimate; the bank's posted classification decides eligibility.",
    );
  }
  if (chosen.cap?.lifetimeCashbackSgd) {
    if (card.openingLifetimeCashbackSgd === undefined) {
      bonusSpend = 0;
      confidence = "Unverified";
      warnings.push(
        "Confirm foreign cashback already earned during the promotion; the S$270 total limit may be used.",
      );
    } else {
      const prior =
        positive(card.openingLifetimeCashbackSgd) +
        context.transactions
          .filter(
            (record) =>
              record.cardId === card.id &&
              record.status !== "reversed" &&
              record.reward.bonusCapGroup === chosen.cap?.group &&
              singaporeDate(record.postedDate ?? record.date) >=
                chosen.validFrom,
          )
          .reduce((sum, record) => sum + record.reward.cashbackSgd, 0);
      bonusSpend = Math.min(
        bonusSpend,
        Math.max(0, chosen.cap.lifetimeCashbackSgd - prior) /
          Math.max(chosen.cashbackRate - baseCashback, 0.000001),
      );
    }
  }
  if (daysBetween(chosen.lastVerifiedAt, purchase.date) > 180) {
    confidence = lesserConfidence(confidence, "Likely");
    warnings.push(
      "These terms were last checked over six months ago. Recheck the source before relying on them.",
    );
  }
  const baseComponents = chosen.baseComponents ?? base?.baseComponents;
  const baseMiles = baseComponents ? baseComponents.reduce((sum, component) => sum + roundedMiles(purchase.amountSgd, component.milesPerDollar, component.roundingUnitMiles), 0) : baseSpend * baseMpd;
  const bonusMiles = chosen.bonusRounding ? roundedMiles(bonusSpend, chosen.milesPerDollar - baseMpd, chosen.bonusRounding.unitMiles, chosen.bonusRounding.scope === "period" ? componentPrior?.amount ?? priorBonusSpend : 0) : bonusSpend * (chosen.milesPerDollar - baseMpd);
  const miles = rewardNumber(baseMiles + bonusMiles);
  const cashbackSgd = money(
    purchase.amountSgd * baseCashback +
      bonusSpend * (chosen.cashbackRate - baseCashback),
  );
  const foreign = purchase.currency.toUpperCase() !== "SGD";
  const fxFeeSgd = money(
    foreign ? purchase.amountSgd * (chosen.fxFeeRate ?? 0) : 0,
  );
  const transferCostSgd = money(miles * positive(card.transferFeePerMileSgd));
  if (chosen.transferFeeSgd && card.transferFeePerMileSgd === undefined)
    warnings.push(
      `Net value is before the S$${chosen.transferFeeSgd.toFixed(2)} batch transfer fee; set an allocation in your card preferences.`,
    );
  if (!foreign && purchase.processedOverseas) {
    confidence = "Unverified";
    warnings.push(
      "SGD processed overseas can attract separate fees. Compare in the merchant's local currency.",
    );
  }
  const welcome = welcomeValue(purchase, card, context, qualifies);
  if (welcome.offer)
    warnings.push(
      "Welcome spend must post by the deadline. Only spending you already intend to make is considered.",
    );
  const effectiveMpd = rewardNumber(miles / purchase.amountSgd);
  let reason =
    chosen.cap && bonusSpend > 0
      ? `${chosen.label} earns ${chosen.milesPerDollar} mpd. S$${money(usage.remaining ?? 0)} of bonus capacity remains this ${chosen.cap.period === "statement-month" ? "statement cycle" : "calendar month"}.`
      : chosen.cashbackRate > 0
        ? `${chosen.label} gives ${money(chosen.cashbackRate * 100)}% cashback on eligible spend.`
        : `${chosen.label} earns ${effectiveMpd} mpd on this purchase.`;
  if (chosen.cap && bonusSpend > 0 && bonusSpend < earnedSpend)
    reason = `S$${money(bonusSpend)} earns the bonus rate; the rest earns base rewards. ${effectiveMpd.toFixed(2)} mpd across this purchase.`;
  if (welcome.miles > 0)
    reason = `This intended purchase makes the next welcome tier achievable with your planned spending: ${welcome.miles.toLocaleString("en-SG")} extra miles.`;
  let eligibilitySummary = chosen.label;
  if (chosen.cap && usage.remaining === null)
    eligibilitySummary = "Bonus conditions need confirmation; base rewards only.";
  else if (chosen.cap && usage.remaining === 0)
    eligibilitySummary = "Bonus cap reached; this purchase earns base rewards.";
  else if (chosen.minimumSpend && usage.qualifying + (qualifies ? purchase.amountSgd : 0) + positive(context.naturalSpendByCard?.[card.id]) < chosen.minimumSpend.amountSgd)
    eligibilitySummary = "Minimum spend is not met; base rewards only.";
  else if (purchaseEligibility.confidence === "Unverified" && (chosen.cap || chosen.annualQualification))
    eligibilitySummary = "Merchant eligibility needs confirmation; bonus is withheld.";
  else if (aggregatePrior?.known === false || componentPrior?.known === false)
    eligibilitySummary = "Monthly reward spend needs confirmation; base rewards only.";
  else if (chosen.annualQualification && bonusSpend === 0)
    eligibilitySummary = "Base miles until the annual airline-group condition is confirmed.";
  else if (chosen.cap?.lifetimeCashbackSgd && card.openingLifetimeCashbackSgd === undefined)
    eligibilitySummary = "Promotion balance needs confirmation; cashback is withheld.";
  else if (chosen.cap && bonusSpend > 0 && bonusSpend < earnedSpend)
    eligibilitySummary = "Part of this purchase earns base rewards.";
  if (minimumSpendIncrementalMiles > 0)
    eligibilitySummary = "Meeting the minimum also unlocks earlier bonus miles.";
  if (welcome.miles > 0)
    eligibilitySummary = "This purchase can unlock the next welcome tier.";
  const uniqueWarnings = [...new Set(warnings)];
  return {
    card,
    template,
    miles,
    effectiveMpd,
    headlineMpd: chosen.milesPerDollar,
    cashbackSgd,
    fxFeeSgd,
    transferCostSgd,
    netValueSgd: money(
      (miles + welcome.miles + minimumSpendIncrementalMiles) *
        context.mileValueSgd +
        cashbackSgd -
        fxFeeSgd -
        transferCostSgd,
    ),
    confidence,
    reason,
    eligibilitySummary,
    warnings: uniqueWarnings,
    capacityRemainingSgd: usage.remaining,
    welcomeIncrementalMiles: welcome.miles,
    minimumSpendIncrementalMiles,
    ruleId: chosen.id,
    snapshot: {
      calculatedAt: singaporeDate(purchase.date),
      templateId: template.id,
      ruleId: chosen.id,
      ruleVersion: chosen.version,
      sourceUrl: chosen.sourceUrl,
      lastVerifiedAt: chosen.lastVerifiedAt,
      miles,
      cashbackSgd,
      fxFeeSgd,
      effectiveMpd,
      confidence,
      bonusSpendSgd: chosen.cap ? reservedBonusSpend : 0,
      bonusCapGroup: chosen.cap?.group,
      roundingGroup: chosen.rounding?.group,
      bonusRoundingGroup: chosen.bonusRounding?.group,
      periodStart: usage.period?.start,
      periodEnd: usage.period?.end,
      qualifyingSpendSgd: qualifies ? purchase.amountSgd : 0,
      welcomeOfferId: welcome.offer?.id,
      welcomeContributionSgd: welcome.contribution,
      welcomeIncrementalMiles: welcome.miles,
      minimumSpendIncrementalMiles,
      reason,
      warnings: uniqueWarnings,
    },
  };
}

/** Pure ranking. No rules or balances are inferred from ownership or device profile. */
export function recommend(
  purchase: Purchase,
  context: RecommendationContext,
): Recommendation[] {
  if (
    !Number.isFinite(purchase.amountSgd) ||
    purchase.amountSgd <= 0 ||
    purchase.amountSgd > 10_000_000 ||
    !Number.isFinite(context.mileValueSgd) ||
    context.mileValueSgd < 0
  )
    return [];
  try {
    singaporeDate(purchase.date);
  } catch {
    return [];
  }
  const templates = context.templates ?? CARD_TEMPLATES;
  const results: Recommendation[] = [];
  for (const card of context.cards) {
    if (card.status !== "active") continue;
    const template = getTemplate(card.templateId, templates);
    if (!template || template.manualReview) continue;
    const rules = activeRules(template, purchase.date).filter(
      (rule) =>
        rule.verification !== "Unverified" &&
        selectedCategoryMatches(card, rule, purchase.date) &&
        matchConditions(purchase, rule.conditions).eligible &&
        (purchase.currency.toUpperCase() === "SGD" || rule.fxFeeRate !== null),
    );
    const base = rules
      .filter((rule) => !rule.cap && !rule.annualQualification)
      .sort(
        (a, b) =>
          b.milesPerDollar - a.milesPerDollar ||
          b.cashbackRate - a.cashbackRate,
      )[0];
    const candidates = rules.map((rule) =>
      calculate(
        purchase,
        card,
        template,
        rule,
        rule.cap || rule.annualQualification ? (rule.rounding?.group ? rules.filter((candidate) => !candidate.cap && !candidate.annualQualification && candidate.rounding?.group === rule.rounding?.group).sort((a, b) => b.milesPerDollar - a.milesPerDollar)[0] ?? base : base) : undefined,
        context,
      ),
    );
    candidates.sort(
      (a, b) => b.netValueSgd - a.netValueSgd || b.headlineMpd - a.headlineMpd,
    );
    if (candidates[0]) {
      const result = candidates[0];
      if (activeRules(template, purchase.date).some((rule) => rule.selectedCategory) && (!card.selectedRewardCategory || card.selectedRewardCategoryPeriodStart !== getCalendarQuarter(purchase.date).start)) {
        const warning = "Confirm the rewards category registered with the bank for this calendar quarter. Only base rewards are estimated.";
        result.warnings.push(warning);
      }
      if (activeRules(template, purchase.date).some((rule) => rule.conditions.rewardPartners) && !purchase.rewardPartner && purchase.category === "travel") {
        const warning = "Select the confirmed booking partner to check airline-group rewards. A merchant name alone does not confirm eligibility.";
        result.warnings.push(warning);
      }
      results.push(result);
    }
  }
  return results.sort((a, b) => {
    const net = b.netValueSgd - a.netValueSgd;
    if (Math.abs(net) >= 0.01) return net;
    const confidence =
      confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    if (confidence) return confidence;
    if (context.preferredOwner && a.card.owner !== b.card.owner)
      return a.card.owner === context.preferredOwner ? -1 : 1;
    // Spend a narrower specialist first when value is equal, conserving flexible earn.
    const aRule = a.template.rules.find((rule) => rule.id === a.ruleId);
    const bRule = b.template.rules.find((rule) => rule.id === b.ruleId);
    const flexibility = (rule: CardRule | undefined) =>
      rule?.conditions.mccs?.length ?? (rule?.conditions.channels ? 100 : 1000);
    const flexibilityDifference = flexibility(aRule) - flexibility(bRule);
    if (flexibilityDifference) return flexibilityDifference;
    // If both purchases fit, use the smaller usable bucket, preserving a larger one.
    const capacityDifference =
      (a.capacityRemainingSgd ?? Infinity) -
      (b.capacityRemainingSgd ?? Infinity);
    if (Number.isFinite(capacityDifference) && capacityDifference !== 0)
      return capacityDifference;
    return a.card.id.localeCompare(b.card.id);
  });
}

/**
 * Explain what each card can earn now and which setup gaps hide a better option.
 * Conditional estimates never enter recommend(), personal state or recorded rewards.
 */
export function assessCards(purchase: Purchase, context: RecommendationContext): CardAssessment[] {
  const current = recommend(purchase, context);
  if (!Number.isFinite(purchase.amountSgd) || purchase.amountSgd <= 0 || purchase.amountSgd > 10_000_000 || !Number.isFinite(context.mileValueSgd) || context.mileValueSgd < 0) return [];
  try { singaporeDate(purchase.date); } catch { return []; }
  const templates = context.templates ?? CARD_TEMPLATES;
  const assessments: CardAssessment[] = [];
  for (const card of context.cards) {
    const template = getTemplate(card.templateId, templates);
    if (!template) continue;
    const recommendation = current.find(result => result.card.id === card.id);
    if (card.status !== "active") {
      assessments.push({card, template, status:"inactive", blockers:[], explanation: card.status === "unconfirmed" ? "Confirm that you own this card and activate it to compare." : "This card is inactive."});
      continue;
    }
    if (template.manualReview) {
      assessments.push({card, template, status:"manual-review", blockers:[], explanation:template.manualReview});
      continue;
    }
    const rules = activeRules(template, purchase.date);
    const blockers: AssessmentBlocker[] = [];
    const add = (id: AssessmentBlocker["id"], label: string) => {
      if (!blockers.some(blocker => blocker.id === id && blocker.label === label)) blockers.push({id, cardId:card.id, label});
    };
    let potential: Recommendation | undefined;
    const multipleGroups = capGroups(template, purchase.date) > 1;
    let setupNeeded = false;
    if (purchase.mcc !== undefined && purchase.mccConfidence !== "Confirmed" && purchase.mccConfidence !== "Likely") {
      add("mcc", "Confirm this merchant's posted MCC or choose a sourced Singapore merchant estimate.");
      setupNeeded = true;
    }
    for (const chosen of rules) {
      const eligibility = matchConditions(purchase, chosen.conditions);
      if (chosen.verification === "Unverified" || (!chosen.cap && !chosen.annualQualification && !chosen.selectedCategory) || !eligibility.eligible || (purchase.currency.toUpperCase() !== "SGD" && chosen.fxFeeRate === null)) continue;
      const unknownCategory = !!chosen.selectedCategory && (!card.selectedRewardCategory || card.selectedRewardCategoryPeriodStart !== getCalendarQuarter(purchase.date).start);
      if (chosen.selectedCategory && !unknownCategory && !selectedCategoryMatches(card, chosen, purchase.date)) continue;
      const usage = ruleUsage(card, context.transactions, chosen, purchase.date, template);
      const assumed = {...card, openingCapSpendSgd:{...card.openingCapSpendSgd}, capUsageKnown:{...card.capUsageKnown}, openingRewardSpendSgd:{...card.openingRewardSpendSgd}};
      const assumptions: string[] = [];
      let canCompare = true;
      if (unknownCategory && chosen.selectedCategory) {
        add("category", "Confirm the matching category already registered with UOB for this quarter.");
        setupNeeded = true;
        // A conditional scenario, not a claim that changing the app enrolls with UOB.
        assumed.selectedRewardCategory = chosen.selectedCategory;
        assumed.selectedRewardCategoryPeriodStart = getCalendarQuarter(purchase.date).start;
        assumptions.push(`UOB has already registered the ${chosen.selectedCategory.replaceAll("-", " ")} category`);
      }
      if (chosen.cap && usage.remaining === null) {
        setupNeeded = true;
        if (!usage.period) {
          add("statement", "Confirm the first day of the statement cycle.");
          // Never invent a statement day to manufacture a reward estimate.
          canCompare = false;
        } else {
          add("usage", `Confirm remaining ${chosen.cap.label ?? "bonus"} capacity for this period.`);
          assumed.openingPeriodStart = usage.period.start;
          assumed.usageKnown = true;
          assumed.capUsageKnown[chosen.cap.group] = true;
          assumed.openingCapSpendSgd[chosen.cap.group] = 0;
          if (!multipleGroups) assumed.openingSpendSgd = 0;
          assumptions.push(`no opening ${chosen.cap.label ?? "bonus"} spend; recorded usage still counts`);
        }
      }
      const componentGroup = chosen.bonusRounding?.scope === "period" ? chosen.bonusRounding.group : chosen.rounding?.scope === "period" ? chosen.rounding.group : undefined;
      if (componentGroup && usage.period) {
        const prior = rewardGroupPrior(card, context.transactions, chosen, usage.period, template, componentGroup, !!chosen.bonusRounding);
        if (!prior.known) {
          add("reward-component", "Confirm opening spend for this monthly reward component.");
          setupNeeded = true;
          assumed.openingRewardSpendSgd[componentGroup] = 0;
          assumptions.push("zero opening spend for the monthly reward component");
        }
      }
      const qualifyingAmount = eligibility.confidence !== "Unverified" ? purchase.amountSgd : 0;
      if (chosen.minimumSpend && usage.qualifying + qualifyingAmount + positive(context.naturalSpendByCard?.[card.id]) < chosen.minimumSpend.amountSgd) {
        const minimum = chosen.minimumSpend.amountSgd;
        if (!capKnown(card, chosen, multipleGroups)) {
          add("minimum", `Confirm at least S$${minimum} qualifying spend this period; do not spend extra just for rewards.`);
          assumed.openingQualifyingSpendSgd = minimum;
          assumptions.push(`the S$${minimum} qualifying minimum is already met`);
          setupNeeded = true;
        } else {
          add("minimum", `S$${money(minimum - usage.qualifying - qualifyingAmount)} still needed after this purchase; bonus is withheld.`);
          // A known unmet minimum is not missing setup and never an invitation to chase it.
          canCompare = false;
        }
      }
      if (chosen.annualQualification) {
        const annual = getAnnualQualificationProgress(card, context.transactions, purchase.date, templates);
        if (!annual?.qualified) {
          add("annual", annual?.known ? `Annual airline-group condition is not met; S$${money(annual.remainingSgd)} remains.` : "Confirm the membership year and posted airline-group qualifying spend.");
          setupNeeded ||= !annual?.known;
          // Never invent annual spend or make a purchase appear to satisfy it early.
          canCompare = false;
        }
      }
      if (chosen.cap?.lifetimeCashbackSgd && card.openingLifetimeCashbackSgd === undefined) {
        add("lifetime", "Confirm cashback already earned during this promotion.");
        setupNeeded = true;
        canCompare = false;
      }
      if (purchase.mcc !== undefined && purchase.mccConfidence !== "Confirmed" && purchase.mccConfidence !== "Likely") {
        canCompare = false;
      }
      if (canCompare && assumptions.length) {
        const result = recommend(purchase, {...context, cards:[assumed]})[0];
        if (result && (!potential || result.netValueSgd > potential.netValueSgd)) {
          const reason = `Conditional estimate only: assumes ${assumptions.join("; ")}. Confirm with the bank before relying on this bonus.`;
          const warnings = [...result.warnings, "This setup scenario is not a confirmed recommendation and must not be recorded."];
          potential = {...result, confidence:"Unverified", reason, warnings, snapshot:{...result.snapshot,confidence:"Unverified",reason,warnings}};
        }
      }
    }
    if (rules.some(rule => rule.conditions.rewardPartners) && purchase.category === "travel" && !purchase.rewardPartner) {
      add("partner", "Confirm the booking partner and eligible payment route to check partner rewards.");
      setupNeeded = true;
    }
    if (potential && recommendation && potential.netValueSgd <= recommendation.netValueSgd) potential = undefined;
    const status = !recommendation ? "ineligible" : setupNeeded ? "setup-needed" : "ready";
    assessments.push({card, template, recommendation, potential, status, blockers, explanation: !recommendation ? setupNeeded ? "The merchant classification or card setup needs confirmation; no matching estimate is available yet." : "No verified reward rule matches this purchase, payment route and currency." : setupNeeded ? "Bonus eligibility needs confirmation. The current estimate includes only rewards supported by the entered setup." : blockers.length ? blockers.map(blocker => blocker.label).join(" ") : recommendation.reason});
  }
  return assessments;
}
