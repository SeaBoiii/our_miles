import type {
  CardCapacity,
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
import { daysBetween, getPeriod, inPeriod, singaporeDate } from "./periods";
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
  if (conditions.channels && !conditions.channels.includes(purchase.channel))
    return { eligible: false, confidence: "Confirmed" };
  if (
    conditions.paymentMethods &&
    !conditions.paymentMethods.includes(purchase.paymentMethod)
  )
    return { eligible: false, confidence: "Confirmed" };
  if (conditions.excludedPaymentMethods?.includes(purchase.paymentMethod))
    return { eligible: false, confidence: "Confirmed" };
  if (
    conditions.currency &&
    (purchase.currency.toUpperCase() === "SGD" ? "local" : "foreign") !==
      conditions.currency
  )
    return { eligible: false, confidence: "Confirmed" };
  const merchant = purchase.merchant.toLowerCase();
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
      purchase.mcc < 1000 ||
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

function bankingDate(transaction: Transaction, card: OwnedCard): string {
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
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.cardId === card.id &&
      transaction.status !== "reversed" &&
      inPeriod(bankingDate(transaction, card), period),
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

function ruleUsage(
  card: OwnedCard,
  transactions: Transaction[],
  rule: CardRule,
  date: string,
) {
  const period = rule.cap
    ? getPeriod(date, rule.cap.period, card.statementDay)
    : rule.rounding?.scope === "period"
      ? getPeriod(date, "calendar-month")
      : null;
  const minPeriod = rule.minimumSpend
    ? getPeriod(date, rule.minimumSpend.period, card.statementDay)
    : period;
  const records = period ? periodTransactions(card, transactions, period) : [];
  const eligibleRecords = records.filter(
    (transaction) => transaction.reward.bonusCapGroup === rule.cap?.group,
  );
  const openingSpend = period ? opening(card, period) : 0;
  // Reserve eligible spending before the cap, so late posting into a new period
  // cannot inherit the old period's clipped bonus allocation and undercount usage.
  const used =
    rule.rounding?.scope === "period"
      ? roundedSpend(
          openingSpend +
            eligibleRecords.reduce(
              (total, transaction) => total + transaction.reward.bonusSpendSgd,
              0,
            ),
          { ...rule, rounding: { ...rule.rounding, scope: "transaction" } },
        )
      : openingSpend +
        eligibleRecords.reduce(
          (total, transaction) =>
            total + roundedSpend(transaction.reward.bonusSpendSgd, rule),
          0,
        );
  const qualifying = minPeriod
    ? opening(card, minPeriod, true) +
      periodTransactions(card, transactions, minPeriod)
        .filter((transaction) => transaction.status !== "pending")
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
      ? card.usageKnown && period
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
  const template = getTemplate(card.templateId, templates);
  const rules = template ? activeRules(template, date) : [];
  const capped = rules
    .filter((rule) => rule.cap)
    .sort(
      (a, b) =>
        b.milesPerDollar - a.milesPerDollar || b.cashbackRate - a.cashbackRate,
    )[0];
  const top =
    capped ??
    rules.sort(
      (a, b) =>
        b.milesPerDollar - a.milesPerDollar || b.cashbackRate - a.cashbackRate,
    )[0];
  const usage = capped ? ruleUsage(card, transactions, capped, date) : null;
  return {
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
  };
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

function offerSpend(offer: WelcomeOffer, transactions: Transaction[]): number {
  return money(
    positive(offer.openingSpendSgd) +
      transactions
        .filter(
          (transaction) =>
            transaction.cardId === offer.cardId &&
            transaction.status !== "reversed" &&
            transaction.status !== "pending" &&
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
      matchConditions(purchase, candidate.conditions ?? {}).eligible,
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
  const usage = ruleUsage(card, context.transactions, chosen, purchase.date);
  const qualifies = matchConditions(purchase, chosen.conditions).eligible;
  const baseMpd =
    base?.milesPerDollar ?? (chosen.cap ? 0 : chosen.milesPerDollar);
  const baseCashback =
    base?.cashbackRate ?? (chosen.cap ? 0 : chosen.cashbackRate);
  const priorSpend = usage.period
    ? opening(card, usage.period, true) +
      periodTransactions(card, context.transactions, usage.period).reduce(
        (sum, record) => sum + record.reward.qualifyingSpendSgd,
        0,
      )
    : 0;
  const priorBonusSpend =
    usage.period && chosen.cap
      ? opening(card, usage.period) +
        periodTransactions(card, context.transactions, usage.period)
          .filter((record) => record.reward.bonusCapGroup === chosen.cap?.group)
          .reduce((sum, record) => sum + record.reward.qualifyingSpendSgd, 0)
      : priorSpend;
  const earnedSpend = roundedSpend(purchase.amountSgd, chosen, priorBonusSpend);
  const baseSpend = roundedSpend(
    purchase.amountSgd,
    base ?? chosen,
    priorSpend,
  );
  let bonusSpend = chosen.cap
    ? Math.min(earnedSpend, usage.remaining ?? 0)
    : earnedSpend;
  const reservedBonusSpend = chosen.cap ? purchase.amountSgd : 0;
  let minimumSpendIncrementalMiles = 0;
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
    const after = usage.qualifying + purchase.amountSgd;
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
    confidence === "Unverified" &&
    purchase.mcc !== undefined &&
    purchase.mccConfidence !== "Confirmed" &&
    chosen.cap
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
  const miles = rewardNumber(
    baseSpend * baseMpd + bonusSpend * (chosen.milesPerDollar - baseMpd),
  );
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
        matchConditions(purchase, rule.conditions).eligible &&
        (purchase.currency.toUpperCase() === "SGD" || rule.fxFeeRate !== null),
    );
    const base = rules
      .filter((rule) => !rule.cap)
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
        rule.cap ? base : undefined,
        context,
      ),
    );
    candidates.sort(
      (a, b) => b.netValueSgd - a.netValueSgd || b.headlineMpd - a.headlineMpd,
    );
    if (candidates[0]) results.push(candidates[0]);
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
