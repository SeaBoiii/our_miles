/** Financial knowledge, personal state and immutable calculation evidence. */
export type Owner = "Aleem" | "Nurul";
export type Confidence = "Confirmed" | "Likely" | "Unverified";
export type Category =
  | "dining"
  | "online"
  | "shopping"
  | "travel"
  | "transport"
  | "fuel"
  | "groceries"
  | "other"
  | "utilities"
  | "insurance"
  | "education"
  | "government"
  | "financial";
export type Channel = "online" | "contactless" | "in-store";
export type PaymentMethod =
  | "card"
  | "apple-pay"
  | "google-pay"
  | "samsung-pay"
  | "mobile-wallet";
export type PeriodKind = "calendar-month" | "statement-month";
export type RewardCategory = "beauty-wellness" | "dining" | "entertainment" | "family" | "fashion" | "transport" | "travel";
export type RewardPartner = "singapore-airlines" | "scoot" | "krisshop" | "krisplus" | "pelago";

export interface RuleConditions {
  categories?: Category[];
  channels?: Channel[];
  paymentMethods?: PaymentMethod[];
  currency?: "local" | "foreign";
  mccs?: number[];
  mccRanges?: [number, number][];
  excludedMccs?: number[];
  excludedMccRanges?: [number, number][];
  excludedCategories?: Category[];
  excludedPaymentMethods?: PaymentMethod[];
  merchantIncludes?: string[];
  excludedMerchantIncludes?: string[];
  excludedMerchantWords?: string[];
  excludeRecurring?: boolean;
  rewardPartners?: RewardPartner[];
}

export interface CardRule {
  id: string;
  version: number;
  label: string;
  validFrom: string;
  validUntil?: string;
  sourceUrl: string;
  lastVerifiedAt: string;
  verification: Confidence;
  conditions: RuleConditions;
  milesPerDollar: number;
  cashbackRate: number;
  fxFeeRate: number | null;
  /** Incremental earn is capped; base earn continues after the cap. */
  cap?: {
    group: string;
    spendSgd: number;
    period: PeriodKind;
    lifetimeCashbackSgd?: number;
    /** Some issuers cap gross charged spend rather than bank-rounded earn blocks. */
    usageRounding?: "raw" | "earn";
    label?: string;
  };
  minimumSpend?: { amountSgd: number; period: PeriodKind; postingGraceDays?: number };
  rounding?: { blockSgd: number; scope: "transaction" | "period"; group?: string };
  /** Independently floored transaction components, e.g. DBS base and foreign points. */
  baseComponents?: { milesPerDollar: number; roundingUnitMiles: number }[];
  /** Floor bonus points after applying the multiplier, independently of base earn. */
  bonusRounding?: { unitMiles: number; scope: "transaction" | "period"; group?: string };
  selectedCategory?: RewardCategory;
  annualQualification?: { amountSgd: number; conditions: RuleConditions };
  /** DBS uses settlement transaction month; other cards default to posting date. */
  periodDate?: "transaction" | "posting";
  transferFeeSgd?: number;
  transferBlockMiles?: number;
  notes?: string[];
}

export interface CardTemplate {
  id: string;
  name: string;
  issuer: string;
  accent: string;
  role: string;
  rules: CardRule[];
  /** Complex benefits needing details beyond the current model stay outside ranking. */
  manualReview?: string;
}

export interface OwnedCard {
  id: string;
  templateId: string;
  owner: Owner;
  status: "active" | "inactive" | "unconfirmed";
  /** First day of a statement cycle, as confirmed from the bank statement. */
  statementDay?: number;
  usageKnown: boolean;
  /** Bonus-eligible spend before this app's records, for this exact period only. */
  openingSpendSgd?: number;
  openingPeriodStart?: string;
  /** Total qualifying opening spend for minimum-spend eligibility. */
  openingQualifyingSpendSgd?: number;
  /** User-confirmed transfer fee allocation. Undefined means no allocation assumed. */
  transferFeePerMileSgd?: number;
  openingLifetimeCashbackSgd?: number;
  /** Separate confirmed opening usage for independent bonus buckets. */
  openingCapSpendSgd?: Record<string, number>;
  capUsageKnown?: Record<string, boolean>;
  /** Gross opening spend for independently aggregated reward components. */
  openingRewardSpendSgd?: Record<string, number>;
  selectedRewardCategory?: RewardCategory;
  selectedRewardCategoryPeriodStart?: string;
  annualQualificationStart?: string;
  /** Exclusive first day of the next confirmed membership year. */
  annualQualificationEnd?: string;
  openingAnnualQualifyingSpendSgd?: number;
  annualUsageKnown?: boolean;
}

export interface Purchase {
  amountSgd: number;
  merchant: string;
  category: Category;
  channel: Channel;
  paymentMethod: PaymentMethod;
  currency: string;
  /** ISO date or timestamp; timestamps are converted to Asia/Singapore. */
  date: string;
  mcc?: number;
  mccConfidence?: Confidence;
  /** Explicit issuer-reward exclusion, e.g. wallet top-up or cash advance. */
  excluded?: boolean;
  /** The amount is an SGD equivalent, not a live foreign-exchange quote. */
  processedOverseas?: boolean;
  recurring?: boolean;
  /** Explicitly confirmed partner; merchant text is not proof of partner eligibility. */
  rewardPartner?: RewardPartner;
}

export interface RewardSnapshot {
  calculatedAt: string;
  templateId: string;
  ruleId: string;
  ruleVersion: number;
  sourceUrl: string;
  lastVerifiedAt: string;
  miles: number;
  cashbackSgd: number;
  fxFeeSgd: number;
  effectiveMpd: number;
  confidence: Confidence;
  /** Gross bonus-eligible spend reserved, before caps and bank rounding. */
  bonusSpendSgd: number;
  bonusCapGroup?: string;
  roundingGroup?: string;
  bonusRoundingGroup?: string;
  periodStart?: string;
  periodEnd?: string;
  qualifyingSpendSgd: number;
  welcomeOfferId?: string;
  welcomeContributionSgd: number;
  welcomeIncrementalMiles: number;
  minimumSpendIncrementalMiles?: number;
  reason: string;
  warnings: string[];
}

export interface Transaction extends Purchase {
  id: string;
  cardId: string;
  postedDate?: string;
  status?: "pending" | "posted" | "reversed";
  reward: RewardSnapshot;
}

export interface WelcomeOffer {
  id: string;
  cardId: string;
  name: string;
  startsOn: string;
  deadline: string;
  tiers: { spendSgd: number; miles: number }[];
  openingSpendSgd: number;
  /** Spend already planned independently of rewards, excluding the current purchase. */
  plannedNaturalSpendSgd: number;
  sourceUrl: string;
  verified: boolean;
  /** Conditions such as new-customer eligibility / application channel confirmed. */
  eligibilityConfirmed: boolean;
  conditions?: RuleConditions;
}

export interface RecommendationContext {
  cards: OwnedCard[];
  transactions: Transaction[];
  offers: WelcomeOffer[];
  mileValueSgd: number;
  preferredOwner?: Owner;
  /** Planned natural qualifying spend before the period closes. */
  naturalSpendByCard?: Record<string, number>;
  templates?: CardTemplate[];
}

export interface CardCapacity {
  group?: string;
  label?: string;
  remainingSgd: number | null;
  usedSgd: number;
  capSgd: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  period: PeriodKind | null;
  milesPerDollar: number;
  minimumSpendSgd: number | null;
  qualifyingSpendSgd: number;
  minimumSpendRemainingSgd: number;
}

export interface AnnualQualificationProgress {
  known: boolean;
  qualified: boolean;
  qualifyingSpendSgd: number;
  requiredSpendSgd: number;
  remainingSgd: number;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface Recommendation {
  card: OwnedCard;
  template: CardTemplate;
  miles: number;
  effectiveMpd: number;
  headlineMpd: number;
  cashbackSgd: number;
  fxFeeSgd: number;
  transferCostSgd: number;
  netValueSgd: number;
  confidence: Confidence;
  reason: string;
  warnings: string[];
  capacityRemainingSgd: number | null;
  welcomeIncrementalMiles: number;
  minimumSpendIncrementalMiles: number;
  ruleId: string;
  snapshot: RewardSnapshot;
}

export interface OfferProgress {
  spendSgd: number;
  nextTier: WelcomeOffer["tiers"][number] | null;
  remainingSgd: number;
  daysRemaining: number;
  status:
    | "not-started"
    | "on-track"
    | "not-worth-chasing"
    | "complete"
    | "expired"
    | "unverified";
  message: string;
}
