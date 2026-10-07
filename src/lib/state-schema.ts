import { z } from "zod";
import type { AppState } from "@/lib/state";

// Pages uses a strict script policy. Validate without runtime code generation.
z.config({ jitless: true });

const id = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(240);
const money = z.number().min(0).max(100_000_000);
const miles = z.number().min(0).max(10_000_000_000);
const moneyByGroup = z
  .record(id, money)
  .refine((value) => Object.keys(value).length <= 100, "Use at most 100 reward groups.");
const knownByGroup = z
  .record(id, z.boolean())
  .refine((value) => Object.keys(value).length <= 100, "Use at most 100 reward groups.");
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Use a valid calendar date.");
const timestamp = z
  .string()
  .max(40)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value)),
    "Use an ISO timestamp.",
  );
const purchaseDate = z.union([dateOnly, timestamp]);
const httpsUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return (
        parsed.protocol === "https:" && !parsed.username && !parsed.password
      );
    } catch {
      return false;
    }
  }, "Use an HTTPS source URL.");
const confidence = z.enum(["Confirmed", "Likely", "Unverified"]);
const category = z.enum([
  "dining",
  "online",
  "shopping",
  "travel",
  "transport",
  "fuel",
  "groceries",
  "other",
  "utilities",
  "insurance",
  "education",
  "government",
  "financial",
]);
const channel = z.enum(["online", "contactless", "in-store"]);
const method = z.enum(["card", "apple-pay", "google-pay", "samsung-pay", "mobile-wallet"]);
const mcc = z.number().int().min(0).max(9999);
const rewardCategory = z.enum([
  "beauty-wellness", "dining", "entertainment", "family", "fashion", "transport", "travel",
]);
const rewardPartner = z.enum(["singapore-airlines", "scoot", "krisshop", "krisplus", "pelago"]);
const conditions = z
  .object({
    categories: z.array(category).max(20).optional(),
    channels: z.array(channel).max(5).optional(),
    paymentMethods: z.array(method).max(6).optional(),
    currency: z.enum(["local", "foreign"]).optional(),
    mccs: z.array(mcc).max(200).optional(),
    mccRanges: z
      .array(z.tuple([mcc, mcc]))
      .max(100)
      .optional(),
    excludedMccs: z.array(mcc).max(200).optional(),
    excludedMccRanges: z
      .array(z.tuple([mcc, mcc]))
      .max(100)
      .optional(),
    excludedCategories: z.array(category).max(20).optional(),
    excludedPaymentMethods: z.array(method).max(6).optional(),
    merchantIncludes: z.array(text).max(100).optional(),
    excludedMerchantIncludes: z.array(text).max(100).optional(),
    excludedMerchantWords: z.array(text).max(100).optional(),
    excludeRecurring: z.boolean().optional(),
    rewardPartners: z.array(rewardPartner).max(5).optional(),
  })
  .strict();

const ownedCard = z
  .object({
    id,
    templateId: id,
    owner: z.enum(["Aleem", "Nurul"]),
    status: z.enum(["active", "inactive", "unconfirmed"]),
    statementDay: z.number().int().min(1).max(31).optional(),
    usageKnown: z.boolean(),
    openingSpendSgd: money.optional(),
    openingPeriodStart: dateOnly.optional(),
    openingQualifyingSpendSgd: money.optional(),
    openingLifetimeCashbackSgd: money.optional(),
    openingCapSpendSgd: moneyByGroup.optional(),
    capUsageKnown: knownByGroup.optional(),
    openingRewardSpendSgd: moneyByGroup.optional(),
    selectedRewardCategory: rewardCategory.optional(),
    selectedRewardCategoryPeriodStart: dateOnly.optional(),
    annualQualificationStart: dateOnly.optional(),
    annualQualificationEnd: dateOnly.optional(),
    openingAnnualQualifyingSpendSgd: money.optional(),
    annualUsageKnown: z.boolean().optional(),
    transferFeePerMileSgd: z.number().min(0).max(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const start = value.annualQualificationStart;
    const end = value.annualQualificationEnd;
    if (start && end && end <= start)
      context.addIssue({ code: "custom", path: ["annualQualificationEnd"], message: "The exclusive membership-year end must follow its start." });
    if (value.annualUsageKnown) {
      const anniversary = start ? new Date(`${start}T00:00:00Z`) : null;
      if (anniversary) anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
      const expectedEnd = anniversary && !Number.isNaN(anniversary.valueOf()) ? anniversary.toISOString().slice(0, 10) : null;
      if (!start || !end || !start.endsWith("-01") || expectedEnd !== end)
        context.addIssue({ code: "custom", path: ["annualQualificationEnd"], message: "Confirm the full 12-month membership year, starting on the first of its month." });
    }
  });

const reward = z
  .object({
    calculatedAt: purchaseDate,
    templateId: id,
    ruleId: id,
    ruleVersion: z.number().int().min(1).max(1_000_000),
    sourceUrl: httpsUrl,
    lastVerifiedAt: dateOnly,
    miles,
    cashbackSgd: money,
    fxFeeSgd: money,
    effectiveMpd: z.number().min(0).max(1000),
    confidence,
    minimumSpendIncrementalMiles: miles.optional(),
    bonusSpendSgd: money,
    bonusCapGroup: id.optional(),
    roundingGroup: id.optional(),
    bonusRoundingGroup: id.optional(),
    periodStart: dateOnly.optional(),
    periodEnd: dateOnly.optional(),
    qualifyingSpendSgd: money,
    welcomeOfferId: id.optional(),
    welcomeContributionSgd: money,
    welcomeIncrementalMiles: miles,
    reason: z.string().max(2000),
    warnings: z.array(z.string().max(1000)).max(30),
  })
  .strict();

const transaction = z
  .object({
    id,
    cardId: id,
    amountSgd: money,
    merchant: text,
    category,
    channel,
    paymentMethod: method,
    currency: z.string().regex(/^[A-Z]{3}$/),
    date: purchaseDate,
    mcc: mcc.optional(),
    mccConfidence: confidence.optional(),
    excluded: z.boolean().optional(),
    processedOverseas: z.boolean().optional(),
    recurring: z.boolean().optional(),
    rewardPartner: rewardPartner.optional(),
    postedDate: dateOnly.optional(),
    status: z.enum(["pending", "posted", "reversed"]).optional(),
    reward,
  })
  .strict();

const offer = z
  .object({
    id,
    cardId: id,
    name: text,
    startsOn: dateOnly,
    deadline: dateOnly,
    tiers: z
      .array(z.object({ spendSgd: money, miles }).strict())
      .min(1)
      .max(20),
    openingSpendSgd: money,
    plannedNaturalSpendSgd: money,
    sourceUrl: z.union([httpsUrl, z.literal("")]),
    verified: z.boolean(),
    eligibilityConfirmed: z.boolean(),
    conditions: conditions.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.deadline < value.startsOn)
      context.addIssue({
        code: "custom",
        path: ["deadline"],
        message: "The deadline must follow the start date.",
      });
    if (value.verified && !value.sourceUrl)
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "A verified offer needs a source.",
      });
    for (let index = 1; index < value.tiers.length; index++) {
      if (
        value.tiers[index].spendSgd <= value.tiers[index - 1].spendSgd ||
        value.tiers[index].miles < value.tiers[index - 1].miles
      ) {
        context.addIssue({
          code: "custom",
          path: ["tiers", index],
          message: "Offer tiers must increase.",
        });
      }
    }
  });

export const appStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    cards: z.array(ownedCard).max(100),
    transactions: z.array(transaction).max(5000),
    offers: z.array(offer).max(100),
    goals: z
      .array(
        z
          .object({
            id,
            name: text,
            destination: text,
            targetMiles: miles.min(1),
            targetDate: dateOnly.optional(),
          })
          .strict(),
      )
      .max(30),
    mileBalance: miles,
    mileValueSgd: z.number().min(0.001).max(1),
  })
  .strict()
  .superRefine((value, context) => {
    for (const collection of [
      "cards",
      "transactions",
      "offers",
      "goals",
    ] as const) {
      const seen = new Set<string>();
      value[collection].forEach((item, index) => {
        if (seen.has(item.id))
          context.addIssue({
            code: "custom",
            path: [collection, index, "id"],
            message: "Each record needs a unique ID.",
          });
        seen.add(item.id);
      });
    }
    const cardIds = new Set(value.cards.map((card) => card.id));
    for (const collection of ["transactions", "offers"] as const) {
      value[collection].forEach((item, index) => {
        if (!cardIds.has(item.cardId))
          context.addIssue({
            code: "custom",
            path: [collection, index, "cardId"],
            message: "The linked card is missing.",
          });
      });
    }
  });

export function parseAppState(input: unknown): AppState {
  return appStateSchema.parse(input);
}

export const stateUpdateSchema = z
  .object({
    version: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER - 1),
    state: appStateSchema,
  })
  .strict();

/** Posting/reversing is allowed; previously recorded calculation evidence is immutable. */
export function snapshotsPreserved(
  previous: AppState | null,
  next: AppState,
): boolean {
  if (!previous) return true;
  const existing = new Map(
    previous.transactions.map((entry) => [entry.id, entry]),
  );
  return next.transactions.every((entry) => {
    const old = existing.get(entry.id);
    if (!old) return true;
    const { postedDate: oldPosted, status: oldStatus, ...oldEvidence } = old;
    const { postedDate: newPosted, status: newStatus, ...newEvidence } = entry;
    void oldPosted;
    void oldStatus;
    void newPosted;
    void newStatus;
    return JSON.stringify(oldEvidence) === JSON.stringify(newEvidence);
  });
}
