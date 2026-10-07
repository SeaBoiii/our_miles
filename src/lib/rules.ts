import type {
  CardRule,
  CardTemplate,
  Category,
  OwnedCard,
  RuleConditions,
} from "./domain";
import { ADDITIONAL_CARD_TEMPLATES } from "./additional-card-rules";

const VERIFIED = "2026-10-05";
const standardExcludedCategories: Category[] = [
  "utilities",
  "insurance",
  "education",
  "government",
  "financial",
];
const institutionalMccs = [
  4829, 4900, 5960, 6010, 6011, 6012, 6050, 6051, 6211, 6300, 6513, 6529, 6530,
  6534, 6540, 7349, 7511, 7995, 8211, 8220, 8241, 8244, 8249, 8299, 8398, 8651,
  8661, 9211, 9222, 9223, 9311, 9399, 9402, 9405, 9754,
];
const excludedDescriptions = [
  "wallet top-up",
  "wallet top up",
  "cash advance",
  "cardup",
  "ipaymy",
  "axs",
  "enet",
  "instalment",
];
const citiSource =
  "https://www.citibank.com.sg/credit-cards/rewards/citi-rewards-card/pdf/10x-rewards-promotion-terms-and-conditions-2020.pdf";
const hsbcSource =
  "https://www.hsbc.com.sg/content/dam/hsbc/sg/documents/credit-cards/revolution/offers/revolution-credit-card-reward-points-terms-and-conditions.pdf";
const maybankSource =
  "https://www.maybank2u.com.sg/iwov-resources/sg/pdf/cards/xl-privileges-tp-tnc.pdf";
const mariSource =
  "https://banking-aka-storage.maribank.com.sg/maribank/sg/website-content/Terms_and_Conditions_Governing_Cashback_for_Mari_Credit_Card_21092026.pdf";
const mariForeignSource =
  "https://banking-aka-storage.maribank.com.sg/maribank/sg/website-content/Spend_Overseas_with_Mari_Credit_Card_Promotion_Terms_%26_Conditions_07092026.pdf";

function rule(
  id: string,
  sourceUrl: string,
  validFrom: string,
  details: Partial<CardRule> & Pick<CardRule, "label">,
): CardRule {
  const result: CardRule = {
    id,
    version: 1,
    sourceUrl,
    validFrom,
    lastVerifiedAt: VERIFIED,
    verification: "Confirmed",
    conditions: {},
    milesPerDollar: 0,
    cashbackRate: 0,
    fxFeeRate: null,
    ...details,
  };
  if (id.startsWith("citi-")) {
    result.transferFeeSgd = 27.25;
    result.notes = [
      ...(result.notes ?? []),
      "Batch points transfers cost S$27.25; eligible instant transfers have a fee waiver. Confirm your transfer route.",
    ];
  }
  return result;
}

const citiConditions: RuleConditions = {
  excludedCategories: standardExcludedCategories,
  excludedMccs: [...institutionalMccs, 4111, 4112, 4784, 7523],
  excludedMerchantIncludes: [
    ...excludedDescriptions,
    "simplygo",
    "transitlink",
  ],
};
const citiTravelMccs = [
  4111, 4112, 4789, 4411, 4511, 4722, 4723, 5962, 7011, 7012, 7512,
];
const citiTravelRanges: [number, number][] = [[3000, 3999]];
const citiRetailMccs = [
  5311, 5611, 5621, 5631, 5641, 5651, 5655, 5661, 5691, 5699, 5948,
];

const hsbcConditions: RuleConditions = {
  excludedCategories: standardExcludedCategories,
  excludedMccs: [
    ...institutionalMccs,
    5199,
    6532,
    6533,
    6536,
    6537,
    6538,
    6555,
    7299,
    7399,
    7523,
    7801,
    8062,
    8999,
  ],
  excludedMerchantIncludes: [
    ...excludedDescriptions,
    "paypal",
    "smoovpay",
    "google ads",
    "facebook ads",
    "amazon web services",
  ],
};
const hsbcMccs = [
  4511, 7011, 4411, 4816, 5045, 5262, 5309, 5310, 5311, 5331, 5399, 5611, 5621,
  5631, 5641, 5651, 5655, 5661, 5691, 5699, 5732, 5733, 5734, 5735, 5912, 5942,
  5944, 5945, 5946, 5947, 5948, 5949, 5964, 5965, 5966, 5967, 5968, 5969, 5970,
  5992, 5999, 5441, 5462, 5811, 5812, 5813, 4121, 7997,
];
const hsbcNotes = [
  "HSBC estimate uses Asia Miles conversion. KrisFlyer earns fewer miles (30,000 points to 10,000 miles).",
  "No EGA deposit boost assumed; no bank balances are known.",
];

const maybankConditions: RuleConditions = {
  excludedCategories: ["utilities", "insurance", "government", "financial"],
  excludedMccs: institutionalMccs
    .filter((mcc) => ![8211, 8220, 8241, 8244, 8249, 8299].includes(mcc))
    .concat([6381, 6399]),
  excludedMerchantIncludes: [
    ...excludedDescriptions,
    "bagus",
    "cantine",
    "instarem",
    "razerpay",
    "sedap",
    "sgebiz",
    "simplygo",
    "singapore e-business",
    "singtel dash",
  ],
};
const maybankMccs = [
  5811, 5812, 5814, 5462, 5262, 5310, 5311, 5331, 5399, 5621, 5631, 5651, 5655,
  5661, 5691, 5699, 5941, 4511, 4722, 7011, 4899, 5813, 5815, 7832, 7993, 7994,
];

const trustConditions: RuleConditions = {
  excludedCategories: standardExcludedCategories,
  excludedMccs: [
    4900, 6513, 7349, 4829, 5960, 6010, 6011, 6012, 6051, 6211, 6300, 6540,
    7995, 8211, 8220, 8241, 8244, 8249, 8299, 8398, 8651, 8661, 9211, 9222,
    9223, 9311, 9399, 9402, 9405, 7299, 7399, 8999,
  ],
  excludedMerchantIncludes: [...excludedDescriptions, "sam kiosk"],
};
const mariConditions: RuleConditions = {
  excludedCategories: standardExcludedCategories,
  excludedMccs: [
    ...institutionalMccs,
    4784,
    5047,
    5199,
    7379,
    7523,
    8062,
    8699,
  ],
  excludedMerchantIncludes: [
    ...excludedDescriptions,
    "amaze",
    "sam kiosk",
    "cryptocurrency",
  ],
};

/** Append versions when terms change. Do not rewrite historic transaction snapshots. */
export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: "maybank-xl",
    name: "Maybank XL Rewards",
    issuer: "Maybank",
    accent: "#b79345",
    role: "4 mpd · selected categories",
    rules: [
      rule("maybank-xl-base-2025-12", maybankSource, "2025-12-01", {
        label: "Eligible retail base earn",
        conditions: maybankConditions,
        milesPerDollar: 0.4,
        fxFeeRate: 0.0325,
        rounding: { blockSgd: 5, scope: "transaction" },
      }),
      rule("maybank-xl-local-2025-12", maybankSource, "2025-12-01", {
        label: "Selected local categories",
        conditions: {
          ...maybankConditions,
          currency: "local",
          categories: ["dining", "shopping", "travel", "online"],
          mccs: maybankMccs,
          mccRanges: [[3000, 3308]],
        },
        milesPerDollar: 4,
        fxFeeRate: 0.0325,
        cap: {
          group: "maybank-xl-bonus",
          spendSgd: 1000,
          period: "calendar-month",
        },
        minimumSpend: { amountSgd: 500, period: "calendar-month" },
        rounding: { blockSgd: 5, scope: "transaction" },
        notes: [
          "Standard bonus cap used. Temporary new-card cap increases require approval-date verification.",
        ],
      }),
      rule("maybank-xl-foreign-2025-12", maybankSource, "2025-12-01", {
        label: "Foreign-currency retail",
        conditions: { ...maybankConditions, currency: "foreign" },
        milesPerDollar: 4,
        fxFeeRate: 0.0325,
        cap: {
          group: "maybank-xl-bonus",
          spendSgd: 1000,
          period: "calendar-month",
        },
        minimumSpend: { amountSgd: 500, period: "calendar-month" },
        rounding: { blockSgd: 5, scope: "transaction" },
        notes: [
          "Standard cap used. Foreign fee uses the published 2.25% bank fee plus up to 1% association fee.",
        ],
      }),
    ],
  },
  {
    id: "citi-rewards",
    name: "Citi Rewards",
    issuer: "Citi",
    accent: "#476581",
    role: "4 mpd · eligible online retail",
    rules: [
      rule("citi-base-2026-10", citiSource, "2026-10-05", {
        label: "Eligible retail base earn",
        conditions: citiConditions,
        milesPerDollar: 0.4,
        fxFeeRate: 0.0325,
        rounding: { blockSgd: 1, scope: "transaction" },
        notes: [
          "Foreign fee uses Citi's published maximum 3.25% administrative rate.",
        ],
      }),
      rule("citi-online-2026-10", citiSource, "2026-10-05", {
        label: "Online retail",
        conditions: {
          ...citiConditions,
          channels: ["online"],
          excludedCategories: [...standardExcludedCategories, "travel"],
          excludedPaymentMethods: ["mobile-wallet", "apple-pay", "google-pay"],
          excludedMccs: [...citiConditions.excludedMccs!, ...citiTravelMccs],
          excludedMccRanges: citiTravelRanges,
        },
        milesPerDollar: 4,
        fxFeeRate: 0.0325,
        cap: { group: "citi-10x", spendSgd: 1000, period: "statement-month" },
        rounding: { blockSgd: 1, scope: "transaction" },
      }),
      rule("citi-retail-2026-10", citiSource, "2026-10-05", {
        label: "Department stores, clothing and bags",
        conditions: {
          ...citiConditions,
          categories: ["shopping"],
          mccs: citiRetailMccs,
        },
        milesPerDollar: 4,
        fxFeeRate: 0.0325,
        cap: { group: "citi-10x", spendSgd: 1000, period: "statement-month" },
        rounding: { blockSgd: 1, scope: "transaction" },
      }),
    ],
  },
  {
    id: "hsbc-revolution",
    name: "HSBC Revolution",
    issuer: "HSBC",
    accent: "#8c5650",
    role: "Up to 4 mpd · Asia Miles",
    rules: [
      rule("hsbc-base-2026-04", hsbcSource, "2026-04-01", {
        label: "Eligible retail base earn",
        conditions: hsbcConditions,
        milesPerDollar: 0.4,
        fxFeeRate: 0.0325,
        rounding: { blockSgd: 1, scope: "period" },
        notes: hsbcNotes,
      }),
      rule("hsbc-bonus-2026-04", hsbcSource, "2026-04-01", {
        label: "Selected online and contactless",
        conditions: {
          ...hsbcConditions,
          categories: ["dining", "shopping", "online", "travel", "transport"],
          channels: ["online", "contactless"],
          mccs: hsbcMccs,
          mccRanges: [[3000, 3999]],
        },
        milesPerDollar: 4,
        fxFeeRate: 0.0325,
        cap: { group: "hsbc-10x", spendSgd: 1000, period: "calendar-month" },
        rounding: { blockSgd: 1, scope: "period" },
        notes: hsbcNotes,
      }),
    ],
  },
  {
    id: "trust-freedom",
    name: "Trust Freedom Miles",
    issuer: "Trust",
    accent: "#776fa0",
    role: "1.3 mpd · zero FX fee",
    rules: [
      rule(
        "trust-miles-2026-09",
        "https://trustbank.sg/freedom-credit-card/miles/",
        "2026-09-21",
        {
          label: "Freedom Miles retail earn",
          conditions: trustConditions,
          milesPerDollar: 1.3,
          fxFeeRate: 0,
          rounding: { blockSgd: 5, scope: "transaction" },
          transferFeeSgd: 27.25,
          notes: [
            "Miles must be the selected reward option.",
            "S$27.25 per miles redemption. Transfer fees need your planned transfer size to allocate.",
          ],
        },
      ),
    ],
  },
  {
    id: "dbs-esso",
    name: "DBS Esso",
    issuer: "DBS",
    accent: "#826e50",
    role: "Esso fuel · confirm pump discount",
    rules: [],
    manualReview:
      "Esso instant discounts use the pump price and fuel grade. Smiles points and the S$160 fuel rebate require separate confirmation; excluded from automated ranking.",
  },
  {
    id: "mari",
    name: "Mari Credit Card",
    issuer: "MariBank",
    accent: "#7a617e",
    role: "1.5% local cashback · zero FX fee",
    rules: [
      rule("mari-local-2026-10", mariSource, "2026-10-01", {
        label: "Eligible local cashback",
        conditions: { ...mariConditions, currency: "local" },
        cashbackRate: 0.015,
        fxFeeRate: 0,
      }),
      rule("mari-foreign-base-2026-01", mariForeignSource, "2026-01-01", {
        label: "Foreign spend after cashback cap",
        validUntil: "2027-12-31",
        conditions: { ...mariConditions, currency: "foreign" },
        fxFeeRate: 0,
        notes: [
          "Foreign-currency fee waived. SGD transactions processed overseas may still incur 1%.",
        ],
      }),
      rule("mari-foreign-bonus-2026-01", mariForeignSource, "2026-01-01", {
        label: "Eligible foreign cashback",
        validUntil: "2027-12-31",
        conditions: {
          ...mariConditions,
          currency: "foreign",
          excludedPaymentMethods: ["mobile-wallet"],
        },
        cashbackRate: 0.015,
        fxFeeRate: 0,
        cap: {
          group: "mari-foreign",
          spendSgd: 1500,
          period: "calendar-month",
          lifetimeCashbackSgd: 270,
        },
        notes: [
          "S$22.50 monthly and S$270 total promotion limit. Confirm cashback already earned before relying on remaining capacity.",
        ],
      }),
    ],
  },
  {
    id: "uob-one",
    name: "UOB One",
    issuer: "UOB",
    accent: "#6e7a80",
    role: "Legacy · quarterly cashback",
    rules: [],
    manualReview:
      "Quarterly cashback needs three statement months, tier spend and transaction counts. Excluded from automated ranking until those conditions can be represented accurately.",
  },
  ...ADDITIONAL_CARD_TEMPLATES,
];

// Corrected knowledge is appended; existing transaction evidence retains version 1.
const maybank = CARD_TEMPLATES.find((template) => template.id === "maybank-xl")!;
maybank.rules.push(...maybank.rules.map((existing) => ({
  ...existing,
  version: 2,
  validFrom: "2026-10-07",
  lastVerifiedAt: "2026-10-07",
  periodDate: "posting" as const,
  ...(existing.minimumSpend ? {minimumSpend: {...existing.minimumSpend, postingGraceDays: 10}} : {}),
  conditions: existing.id.includes("-local-")
    ? {...existing.conditions, categories: ["dining", "shopping", "travel", "other"] as Category[]}
    : existing.conditions,
  transferFeeSgd: 27.25,
  transferBlockMiles: 10000,
  notes: [...(existing.notes ?? []), "10,000 total 10X TREATS corresponds to S$1,000 rounded eligible spend. Local online purchases need an eligible MCC; online alone is insufficient. Etiqa insurance base points require a manual check and do not qualify for the monthly minimum."],
})));

export function getTemplate(
  id: string,
  templates: CardTemplate[] = CARD_TEMPLATES,
): CardTemplate | undefined {
  return templates.find((template) => template.id === id);
}

/** Templates are intentions to review, never claims that cards or balances are active. */
export function initialCards(): OwnedCard[] {
  const legacyIntentions = ["maybank-xl", "citi-rewards", "hsbc-revolution", "trust-freedom", "dbs-esso", "mari", "uob-one"];
  return CARD_TEMPLATES.filter((template) => legacyIntentions.includes(template.id)).map((template) => ({
    id: `aleem-${template.id}`,
    templateId: template.id,
    owner: "Aleem",
    status: template.id === "uob-one" ? "inactive" : "unconfirmed",
    usageKnown: false,
  }));
}
