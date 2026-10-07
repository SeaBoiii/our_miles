import { describe, expect, it } from "vitest";
import type { CardTemplate, OwnedCard, Purchase, RecommendationContext, Transaction, WelcomeOffer } from "../src/lib/domain";
import { getAnnualQualificationProgress, getCardCapacities, getCardCapacity, getOfferProgress, matchConditions, recommend } from "../src/lib/engine";
import { getAnnualPeriod, getCalendarQuarter, getPeriod, singaporeDate } from "../src/lib/periods";
import { CARD_TEMPLATES, initialCards } from "../src/lib/rules";

const TODAY = "2026-10-05";
const purchase = (override: Partial<Purchase> = {}): Purchase => ({ amountSgd: 300, merchant: "Insta360", category: "online", channel: "online", paymentMethod: "card", currency: "SGD", date: TODAY, mcc: 5732, mccConfidence: "Confirmed", ...override });
const card = (templateId = "citi-rewards", override: Partial<OwnedCard> = {}): OwnedCard => ({ id: `aleem-${templateId}`, templateId, owner: "Aleem", status: "active", statementDay: 1, usageKnown: true, openingPeriodStart: "2026-10-01", openingSpendSgd: 0, ...override });
const context = (cards: OwnedCard[], override: Partial<RecommendationContext> = {}): RecommendationContext => ({ cards, transactions: [], offers: [], mileValueSgd: 0.015, preferredOwner: "Aleem", ...override });
const record = (request: Purchase, selected: OwnedCard, ctx: RecommendationContext, id = "transaction-1"): Transaction => {
  const result = recommend(request, context([selected], ctx))[0];
  if (!result) throw new Error("Fixture has no recommendation");
  return { ...request, id, cardId: selected.id, status: "posted", reward: result.snapshot };
};
const offer = (override: Partial<WelcomeOffer> = {}): WelcomeOffer => ({ id: "trust-demo", cardId: "aleem-trust-freedom", name: "Freedom Miles", startsOn: "2026-10-01", deadline: "2026-10-31", tiers: [{ spendSgd: 1000, miles: 20000 }, { spendSgd: 5000, miles: 50000 }, { spendSgd: 15000, miles: 100000 }], openingSpendSgd: 760, plannedNaturalSpendSgd: 0, sourceUrl: "https://trustbank.sg/freedom-credit-card/miles/", verified: true, eligibilityConfirmed: true, ...override });

describe("Singapore banking periods", () => {
  it("uses Singapore midnight instead of the machine timezone", () => {
    expect(singaporeDate("2026-09-30T16:00:00Z")).toBe("2026-10-01");
    expect(getPeriod("2026-09-30T15:59:59Z", "calendar-month")).toEqual({ start: "2026-09-01", end: "2026-10-01" });
  });
  it("resets on the confirmed statement start day", () => {
    expect(getPeriod("2026-10-09", "statement-month", 10)).toEqual({ start: "2026-09-10", end: "2026-10-10" });
    expect(getPeriod("2026-10-10", "statement-month", 10)).toEqual({ start: "2026-10-10", end: "2026-11-10" });
  });
  it("handles December, leap years and statement days beyond month length", () => {
    expect(getPeriod("2026-12-31", "calendar-month")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
    expect(getPeriod("2028-02-29", "statement-month", 31)).toEqual({ start: "2028-02-29", end: "2028-03-31" });
    expect(getPeriod("2026-03-30", "statement-month", 31)).toEqual({ start: "2026-02-28", end: "2026-03-31" });
    expect(getPeriod(TODAY, "statement-month")).toBeNull();
    expect(() => singaporeDate("2026-02-30")).toThrow();
    expect(() => singaporeDate("2026-10-05T00:00:00")).toThrow();
  });
});

describe("independent buckets and card-specific reward calculations", () => {
  const ppv = (override: Partial<OwnedCard> = {}) => card("uob-ppv", { openingCapSpendSgd: { "uob-ppv-online": 0, "uob-ppv-mobile": 0 }, capUsageKnown: { "uob-ppv-online": true, "uob-ppv-mobile": true }, ...override });
  const mobile = (override: Partial<Purchase> = {}) => purchase({ category: "dining", channel: "contactless", paymentMethod: "apple-pay", mcc: 5812, amountSgd: 100, ...override });
  const simplyGo = (override: Partial<Purchase> = {}) => mobile({ amountSgd: 2.5, merchant: "BUS/MRT SimplyGo", category: "transport", mcc: 4111, ...override });

  it("uses Singapore quarter boundaries and validates exclusive membership years", () => {
    expect(getCalendarQuarter("2026-12-31T16:00:00Z")).toEqual({ start: "2027-01-01", end: "2027-04-01" });
    expect(getAnnualPeriod("2027-04-30", "2026-05-01", "2027-05-01")).toEqual({ start: "2026-05-01", end: "2027-05-01" });
    expect(getAnnualPeriod("2027-05-01", "2026-05-01", "2027-05-01")).toBeNull();
    expect(getAnnualPeriod(TODAY, "2026-05-02", "2027-05-02")).toBeNull();
    expect(getAnnualPeriod(TODAY, "2026-05-01", "2027-06-01")).toBeNull();
  });
  it("keeps PPV online and mobile opening usage and transactions independent", () => {
    const selected = ppv({ openingCapSpendSgd: { "uob-ppv-online": 590, "uob-ppv-mobile": 100 } });
    const online = record(purchase({ amountSgd: 30 }), selected, context([selected]));
    expect(online.reward.miles).toBe(48);
    const buckets = getCardCapacities(selected, [online], TODAY);
    expect(buckets).toHaveLength(2);
    expect(buckets.find((bucket) => bucket.group === "uob-ppv-online")?.remainingSgd).toBe(0);
    expect(buckets.find((bucket) => bucket.group === "uob-ppv-mobile")?.remainingSgd).toBe(500);
    expect(recommend(mobile(), context([selected], { transactions: [online] }))[0].miles).toBe(400);
  });
  it("does not reuse legacy scalar opening usage for multiple unknown buckets", () => {
    const selected = card("uob-ppv", { usageKnown: true, openingSpendSgd: 500 });
    expect(getCardCapacities(selected, [], TODAY).every((bucket) => bucket.remainingSgd === null)).toBe(true);
    expect(recommend(purchase({ amountSgd: 100 }), context([selected]))[0].miles).toBe(40);
    const partial = ppv({ capUsageKnown: { "uob-ppv-online": false, "uob-ppv-mobile": true } });
    expect(recommend(purchase({ amountSgd: 100 }), context([partial]))[0].miles).toBe(40);
    expect(recommend(mobile(), context([partial]))[0].miles).toBe(400);
  });
  it("requires an approved mobile tap and excludes recurring online bonus", () => {
    const ctx = context([ppv()]);
    expect(recommend(mobile({ paymentMethod: "card" }), ctx)[0].miles).toBe(40);
    expect(recommend(mobile({ paymentMethod: "samsung-pay" }), ctx)[0].miles).toBe(400);
    expect(recommend(mobile({ paymentMethod: "mobile-wallet" }), ctx)[0].miles).toBe(40);
    expect(recommend(purchase({ amountSgd: 100, recurring: true }), ctx)[0].miles).toBe(40);
    expect(recommend(purchase({ amountSgd: 100, paymentMethod: "apple-pay" }), ctx)[0].miles).toBe(400);
    expect(recommend(purchase({ amountSgd: 100, paymentMethod: "samsung-pay" }), context([card()]))[0].miles).toBe(40);
  });
  it("accumulates SimplyGo monthly without pooling other mobile fractional spend", () => {
    const selected = ppv();
    const ordinary = record(mobile({ amountSgd: 4.99 }), selected, context([selected]), "ordinary");
    const first = record(simplyGo(), selected, context([selected], { transactions: [ordinary] }), "ride-1");
    expect(first.reward.miles).toBe(0);
    const second = recommend(simplyGo(), context([selected], { transactions: [ordinary, first] }))[0];
    expect(second.miles).toBe(20);
    expect(second.snapshot.roundingGroup).toBe("uob-ppv-simplygo");
    const third = { ...simplyGo(), id: "ride-2", cardId: selected.id, status: "posted" as const, reward: second.snapshot };
    expect(getCardCapacities(selected, [ordinary, first, third], TODAY).find((bucket) => bucket.group === "uob-ppv-mobile")?.usedSgd).toBe(5);
    const uncertain = recommend(simplyGo({ mcc: undefined, mccConfidence: undefined }), context([selected], { transactions: [first] }))[0];
    expect(uncertain.miles).toBe(20);
    expect(uncertain.confidence).toBe("Likely");
    const physicalFirst = record(simplyGo({ paymentMethod: "card" }), selected, context([selected]), "physical-1");
    expect(physicalFirst.reward.miles).toBe(0);
    expect(recommend(simplyGo({ paymentMethod: "card" }), context([selected], { transactions: [physicalFirst] }))[0].miles).toBe(2);
    expect(recommend(purchase({ amountSgd: 100, category: "shopping", channel: "in-store", mcc: undefined, mccConfidence: undefined }), context([selected]))[0].miles).toBe(40);
  });
  it("requires Lady's current registered category and aggregates its monthly bonus", () => {
    const unknown = card("uob-ladys");
    const request = purchase({ category: "dining", mcc: 5812, amountSgd: 518 });
    expect(recommend(request, context([unknown]))[0].miles).toBe(206);
    const selected = card("uob-ladys", { selectedRewardCategory: "dining", selectedRewardCategoryPeriodStart: "2026-10-01" });
    const first = record(request, selected, context([selected]), "dining-1");
    const second = record(purchase({ category: "dining", mcc: 5812, amountSgd: 182 }), selected, context([selected], { transactions: [first] }), "dining-2");
    const third = record(purchase({ category: "dining", mcc: 5812, amountSgd: 100 }), selected, context([selected], { transactions: [first, second] }), "dining-3");
    expect(first.reward.miles + second.reward.miles + third.reward.miles).toBe(3198);
    expect(recommend(request, context([{ ...selected, selectedRewardCategory: "fashion" }]))[0].miles).toBe(206);
    expect(recommend(request, context([{ ...selected, selectedRewardCategoryPeriodStart: "2026-07-01" }]))[0].miles).toBe(206);
  });
  it("floors DBS base, foreign and monthly bonus components independently", () => {
    const selected = card("dbs-wwmc");
    expect(recommend(purchase({ amountSgd: 512 }), context([selected]))[0].miles).toBe(2046);
    expect(recommend(purchase({ amountSgd: 512, currency: "USD" }), context([selected]))[0].miles).toBe(2044);
    const first = record(purchase({ amountSgd: 2.5 }), selected, context([selected]));
    expect(first.reward.miles).toBe(8);
    expect(first.reward.miles + recommend(purchase({ amountSgd: 2.5 }), context([selected], { transactions: [first] }))[0].miles).toBe(18);
    expect(recommend(purchase({ amountSgd: 2.5, currency: "USD" }), context([selected], { transactions: [first] }))[0].miles).toBe(8);
  });
  it("uses DBS gross shared cap with separate local/foreign opening point carry", () => {
    const selected = card("dbs-wwmc", { openingSpendSgd: 999.7, openingRewardSpendSgd: { "dbs-wwmc-online-local": 999.7, "dbs-wwmc-online-foreign": 0 } });
    expect(getCardCapacity(selected, [], TODAY).remainingSgd).toBe(0.3);
    expect(recommend(purchase({ amountSgd: 10 }), context([selected]))[0].miles).toBe(6);
    const unknownCarry = recommend(purchase({ amountSgd: 10 }), context([{ ...selected, openingRewardSpendSgd: undefined }]))[0];
    expect(unknownCarry.miles).toBe(4);
    expect(unknownCarry.confidence).toBe("Unverified");
    expect(unknownCarry.warnings.join(" ")).toContain("component");
    const fresh = card("dbs-wwmc");
    const uncertain = record(purchase({ amountSgd: 2.5, mccConfidence: "Unverified" }), fresh, context([fresh]));
    const following = recommend(purchase({ amountSgd: 2.5 }), context([fresh], { transactions: [uncertain] }))[0];
    expect(following.miles).toBe(0);
    expect(following.confidence).toBe("Unverified");
  });
  it("keeps DBS settlement transaction month when posting occurs in the next month", () => {
    const selected = card("dbs-wwmc", { openingPeriodStart: "2026-09-01" });
    const transaction = record(purchase({ date: "2026-09-30", amountSgd: 100 }), selected, context([selected]));
    const posted = { ...transaction, postedDate: "2026-10-01" };
    expect(getCardCapacity(selected, [posted], "2026-09-30").usedSgd).toBe(100);
    expect(getCardCapacity(selected, [posted], TODAY).usedSgd).toBe(0);
    expect(posted.reward).toEqual(transaction.reward);
  });
  it("accepts leading-zero MCCs while applying DBS bonus-only exclusions", () => {
    const result = recommend(purchase({ amountSgd: 100, mcc: 763, category: "other" }), context([card("dbs-wwmc")]))[0];
    expect(result.miles).toBe(40);
    expect(result.confidence).toBe("Confirmed");
  });
  it("matches excluded merchant brand words without unrelated substring matches", () => {
    for (const templateId of ["uob-ppv", "uob-krisflyer"]) {
      const selected = templateId === "uob-ppv" ? ppv() : card(templateId);
      for (const merchant of ["SPC", "SPC@Bedok"]) expect(recommend(mobile({ merchant, mcc: 5541, category: "fuel" }), context([selected])).length).toBe(0);
      for (const merchant of ["ASPC Consultancy", "Seashell Shop"]) expect(recommend(mobile({ merchant }), context([selected]))).toHaveLength(1);
    }
    for (const merchant of ["SPC", "Shell Service Station"]) expect(matchConditions(mobile({ merchant }), { excludedMerchantWords: ["spc", "shell"] }).eligible).toBe(false);
    for (const merchant of ["ASPC Consultancy", "Seashell Shop"]) expect(matchConditions(mobile({ merchant }), { excludedMerchantWords: ["spc", "shell"] }).eligible).toBe(true);
  });
  it("keeps both owners' calendar caps separate from statement-cycle dates", () => {
    const aleem = ppv({ statementDay: 10, openingCapSpendSgd: { "uob-ppv-online": 590, "uob-ppv-mobile": 0 } });
    const nurul = ppv({ id: "nurul-ppv", owner: "Nurul", statementDay: 20 });
    expect(recommend(purchase(), context([aleem, nurul]))[0].card.owner).toBe("Nurul");
    const spending = record(purchase({ amountSgd: 500 }), nurul, context([aleem, nurul]));
    expect(getCardCapacities(aleem, [spending], TODAY).find((bucket) => bucket.group === "uob-ppv-online")?.remainingSgd).toBe(10);
    expect(getCardCapacities(nurul, [spending], TODAY).find((bucket) => bucket.group === "uob-ppv-online")?.remainingSgd).toBe(100);
    const september = record(purchase({ amountSgd: 500, date: "2026-09-30" }), nurul, context([nurul]), "september");
    expect(getCardCapacities(nurul, [september], "2026-10-09").find((bucket) => bucket.group === "uob-ppv-online")?.remainingSgd).toBe(600);
  });
  it("preserves Maybankv1 evidence and applies v2 grace only to its minimum", () => {
    const selected = card("maybank-xl");
    const historic = record(purchase({ date: "2026-10-06", category: "dining", mcc: 5812, amountSgd: 500 }), selected, context([selected]));
    expect(historic.reward.ruleVersion).toBe(1);
    const original = JSON.stringify(historic.reward);
    const current = record(purchase({ date: "2026-10-31", category: "dining", mcc: 5812, amountSgd: 300 }), selected, context([selected]));
    expect(current.reward.ruleVersion).toBe(2);
    const withinGrace = { ...current, postedDate: "2026-11-10" };
    expect(getCardCapacity(selected, [withinGrace], "2026-10-31").usedSgd).toBe(0);
    expect(getCardCapacity(selected, [withinGrace], "2026-10-31").qualifyingSpendSgd).toBe(300);
    expect(getCardCapacity(selected, [withinGrace], "2026-11-01").usedSgd).toBe(300);
    expect(getCardCapacity(selected, [withinGrace], "2026-11-01").qualifyingSpendSgd).toBe(0);
    const afterGrace = { ...current, postedDate: "2026-11-11" };
    expect(getCardCapacity(selected, [afterGrace], "2026-10-31").qualifyingSpendSgd).toBe(0);
    expect(getCardCapacity(selected, [afterGrace], "2026-11-01").qualifyingSpendSgd).toBe(300);
    expect(JSON.stringify(historic.reward)).toBe(original);
  });
  it("uses current KrisFlyer total2.4 accelerator only after actual annual qualification", () => {
    const selected = card("uob-krisflyer", { annualQualificationStart: "2026-05-01", annualQualificationEnd: "2027-05-01", annualUsageKnown: true, openingAnnualQualifyingSpendSgd: 999 });
    const request = purchase({ category: "dining", mcc: 5812, amountSgd: 100 });
    expect(recommend(request, context([selected]))[0].miles).toBe(120);
    const airline = record(purchase({ category: "travel", mcc: 4511, rewardPartner: "singapore-airlines", amountSgd: 1 }), selected, context([selected]), "airline-qualifier");
    expect(recommend(request, context([selected], { transactions: [{ ...airline, status: "pending" }] }))[0].miles).toBe(120);
    const achieved = recommend(request, context([selected], { transactions: [airline] }))[0];
    expect(achieved.miles).toBe(240);
    expect(achieved.minimumSpendIncrementalMiles).toBe(0);
    expect(achieved.warnings.join(" ")).toContain("deferred");
    expect(getAnnualQualificationProgress(selected, [airline], TODAY)?.qualifyingSpendSgd).toBe(1000);
  });
  it("separates KrisFlyer's always3 partners from its qualifying airline subset", () => {
    const selected = card("uob-krisflyer", { annualQualificationStart: "2026-05-01", annualQualificationEnd: "2027-05-01", annualUsageKnown: true, openingAnnualQualifyingSpendSgd: 0 });
    const request = purchase({ category: "travel", mcc: 4511, amountSgd: 1000, merchant: "Singapore Airlines" });
    expect(recommend(request, context([selected]))[0].miles).toBe(1200);
    for (const rewardPartner of ["singapore-airlines", "scoot", "krisshop", "krisplus", "pelago"] as const) {
      const transaction = record({ ...request, rewardPartner }, selected, context([selected]), rewardPartner);
      expect(transaction.reward.miles).toBe(3000);
      expect(getAnnualQualificationProgress(selected, [transaction], TODAY)?.qualified).toBe(["singapore-airlines", "scoot", "krisshop"].includes(rewardPartner));
    }
    const achieved = { ...selected, openingAnnualQualifyingSpendSgd: 1000 };
    expect(recommend(purchase({ mcc: 5732, amountSgd: 100 }), context([achieved]))[0].miles).toBe(240);
    expect(recommend(purchase({ mcc: 5734, amountSgd: 100 }), context([achieved]))[0].miles).toBe(120);
    expect(recommend(purchase({ mcc: 7278, amountSgd: 100, merchant: "Shopee" }), context([achieved]))[0].miles).toBe(240);
    expect(recommend(purchase({ mcc: 7278, amountSgd: 100, merchant: "Other marketplace" }), context([achieved]))[0].miles).toBe(120);
  });
});

describe("confirmed annual qualification", () => {
  const template: CardTemplate = { id: "annual-fixture", name: "Annual fixture", issuer: "Fixture", accent: "#000000", role: "Fixture", rules: [
    { id: "annual-base", version: 1, label: "Base", validFrom: "2026-01-01", sourceUrl: "https://www.uob.com.sg/assets/pdfs/kf_credit_card_full_tnc.pdf", lastVerifiedAt: TODAY, verification: "Confirmed", conditions: {}, milesPerDollar: 1.2, cashbackRate: 0, fxFeeRate: 0.0325, rounding: { blockSgd: 5, scope: "transaction" } },
    { id: "annual-partner", version: 1, label: "Confirmed partner", validFrom: "2026-01-01", sourceUrl: "https://www.uob.com.sg/assets/pdfs/kf_credit_card_full_tnc.pdf", lastVerifiedAt: TODAY, verification: "Confirmed", conditions: { rewardPartners: ["singapore-airlines", "scoot", "krisshop", "krisplus", "pelago"] }, milesPerDollar: 3, cashbackRate: 0, fxFeeRate: 0.0325, rounding: { blockSgd: 5, scope: "transaction" } },
    { id: "annual-accelerator", version: 1, label: "Conditional dining", validFrom: "2026-01-01", sourceUrl: "https://www.uob.com.sg/assets/pdfs/kf_credit_card_full_tnc.pdf", lastVerifiedAt: TODAY, verification: "Confirmed", conditions: { mccs: [5812] }, milesPerDollar: 2.4, cashbackRate: 0, fxFeeRate: 0.0325, rounding: { blockSgd: 5, scope: "transaction" }, annualQualification: { amountSgd: 1000, conditions: { rewardPartners: ["singapore-airlines", "scoot", "krisshop"] } } },
  ] };
  const selected = (override: Partial<OwnedCard> = {}) => card(template.id, { annualQualificationStart: "2026-05-01", annualQualificationEnd: "2027-05-01", annualUsageKnown: true, openingAnnualQualifyingSpendSgd: 0, ...override });
  const ctx = (owned: OwnedCard, transactions: Transaction[] = []) => context([owned], { templates: [template], transactions });
  const dining = purchase({ amountSgd: 100, category: "dining", mcc: 5812 });
  const airline = purchase({ amountSgd: 1000, category: "travel", mcc: 4511, rewardPartner: "singapore-airlines" });

  it("withholds the annual accelerator until posted airline-group spend actually qualifies", () => {
    const owned = selected();
    const booked = record(airline, owned, ctx(owned));
    expect(recommend(dining, ctx(owned))[0].miles).toBe(120);
    expect(recommend(dining, ctx(owned, [{ ...booked, status: "pending" }]))[0].miles).toBe(120);
    expect(recommend(dining, ctx(owned, [{ ...booked, status: "reversed" }]))[0].miles).toBe(120);
    const achieved = recommend(dining, ctx(owned, [booked]))[0];
    expect(achieved.miles).toBe(240);
    expect(achieved.warnings.join(" ")).toContain("deferred");
    expect(getAnnualQualificationProgress(owned, [booked], TODAY, [template])?.qualified).toBe(true);
  });
  it("does not qualify through Kris+ or Pelago or an unconfirmed merchant name", () => {
    const owned = selected();
    for (const rewardPartner of ["krisplus", "pelago"] as const) {
      const booked = record({ ...airline, rewardPartner }, owned, ctx(owned));
      expect(booked.reward.miles).toBe(3000);
      expect(recommend(dining, ctx(owned, [booked]))[0].miles).toBe(120);
    }
    expect(recommend({ ...airline, rewardPartner: undefined, merchant: "Singapore Airlines" }, ctx(owned))[0].miles).toBe(1200);
  });
  it("requires a confirmed current year and ignores projected future spend", () => {
    const owned = selected({ openingAnnualQualifyingSpendSgd: 999 });
    expect(recommend(dining, { ...ctx(owned), naturalSpendByCard: { [owned.id]: 1000 } })[0].miles).toBe(120);
    expect(recommend(dining, ctx(selected({ openingAnnualQualifyingSpendSgd: 1000 })))[0].miles).toBe(240);
    expect(recommend(dining, ctx(selected({ annualUsageKnown: false, openingAnnualQualifyingSpendSgd: 1000 })))[0].miles).toBe(120);
    expect(recommend({ ...dining, date: "2027-05-01" }, ctx(selected({ openingAnnualQualifyingSpendSgd: 1000 })))[0].miles).toBe(120);
  });
});

describe("recommendations", () => {
  it("seeds no active ownership, real balances or Nurul cards", () => {
    expect(initialCards()).toHaveLength(7);
    expect(initialCards().every((item) => item.owner === "Aleem" && item.status !== "active" && !item.usageKnown)).toBe(true);
    expect(recommend(purchase(), context(initialCards()))).toEqual([]);
  });
  it("gives 4 mpd for an eligible S$512 online purchase", () => {
    const result = recommend(purchase({ amountSgd: 512 }), context([card()]))[0];
    expect(result.miles).toBe(2048);
    expect(result.effectiveMpd).toBe(4);
    expect(result.confidence).toBe("Confirmed");
  });
  it("uses the other owner's card when the primary owner's cap is nearly used", () => {
    const aleem = card("citi-rewards", { openingSpendSgd: 957 });
    const nurul = card("citi-rewards", { id: "nurul-citi", owner: "Nurul", openingSpendSgd: 220 });
    const results = recommend(purchase(), context([aleem, nurul]));
    expect(results[0].card.owner).toBe("Nurul");
    expect(results[0].miles).toBe(1200);
    expect(results[1].miles).toBeCloseTo(43 * 4 + 257 * 0.4);
  });
  it("records a snapshot, reduces capacity and switches once a cap is exhausted", () => {
    const citi = card();
    const trust = card("trust-freedom");
    const transaction = record(purchase({ amountSgd: 1000 }), citi, context([citi]));
    const ctx = context([citi, trust], { transactions: [transaction] });
    expect(getCardCapacity(citi, ctx.transactions, TODAY).remainingSgd).toBe(0);
    expect(recommend(purchase(), ctx)[0].card.templateId).toBe("trust-freedom");
  });
  it("counts only matching-period opening usage and resets on a new statement", () => {
    const citi = card("citi-rewards", { statementDay: 10, openingPeriodStart: "2026-09-10", openingSpendSgd: 900 });
    expect(getCardCapacity(citi, [], "2026-10-09").remainingSgd).toBe(100);
    expect(getCardCapacity(citi, [], "2026-10-10").remainingSgd).toBe(1000);
  });
  it("shares the cap between eligible online and in-store shopping rules", () => {
    const citi = card();
    const transaction = record(purchase({ amountSgd: 800 }), citi, context([citi]));
    const result = recommend(purchase({ amountSgd: 300, merchant: "TANGS", category: "shopping", channel: "in-store", mcc: 5311 }), context([citi], { transactions: [transaction] }))[0];
    expect(result.miles).toBe(840);
    expect(result.capacityRemainingSgd).toBe(200);
  });
  it("never treats unknown card usage or statement settings as a fresh cap", () => {
    const unknown = recommend(purchase(), context([card("citi-rewards", { usageKnown: false })]))[0];
    expect(unknown.miles).toBe(120);
    expect(unknown.confidence).toBe("Unverified");
    expect(unknown.capacityRemainingSgd).toBeNull();
    const missingCycle = recommend(purchase(), context([card("citi-rewards", { statementDay: undefined })]))[0];
    expect(missingCycle.miles).toBe(120);
    expect(missingCycle.warnings.join(" ")).toContain("statement cycle");
  });
  it("excludes travel and mobile-wallet channels from Citi online bonus", () => {
    const ctx = context([card()]);
    expect(recommend(purchase({ category: "travel", mcc: 4511 }), ctx)[0].effectiveMpd).toBe(0.4);
    expect(recommend(purchase({ paymentMethod: "apple-pay" }), ctx)[0].effectiveMpd).toBe(0.4);
    expect(recommend(purchase({ category: "financial", mcc: 6012 }), ctx)).toEqual([]);
  });
  it("does not manufacture MCC certainty", () => {
    const unknownMcc = recommend(purchase({ mcc: undefined, mccConfidence: undefined }), context([card()]))[0];
    expect(unknownMcc.confidence).toBe("Likely");
    expect(unknownMcc.warnings.join(" ")).toContain("not confirmed");
    const unverifiedMcc = recommend(purchase({ mccConfidence: "Unverified" }), context([card()]))[0];
    expect(unverifiedMcc.confidence).toBe("Unverified");
    expect(unverifiedMcc.miles).toBe(120);
  });
  it("uses HSBC's actual MCC whitelist instead of every contactless purchase", () => {
    const ctx = context([card("hsbc-revolution")]);
    expect(recommend(purchase({ category: "dining", channel: "contactless", mcc: 5812 }), ctx)[0].effectiveMpd).toBe(4);
    expect(recommend(purchase({ category: "dining", channel: "contactless", mcc: 5814 }), ctx)[0].effectiveMpd).toBe(0.4);
    expect(recommend(purchase({ category: "groceries", channel: "contactless", mcc: 5411 }), ctx)[0].effectiveMpd).toBe(0.4);
    expect(recommend(purchase(), ctx)[0].warnings.join(" ")).toContain("Asia Miles");
  });
  it("withholds Maybank bonus below minimum spend and awards it when threshold is met", () => {
    const maybank = card("maybank-xl");
    const below = purchase({ category: "dining", mcc: 5812, amountSgd: 300 });
    expect(recommend(below, context([maybank]))[0].miles).toBe(120);
    const reached = recommend(purchase({ category: "dining", mcc: 5812, amountSgd: 500 }), context([maybank]))[0];
    expect(reached.miles).toBe(2000);
  });
  it("allows a conditional minimum-spend estimate only with explicit natural spending", () => {
    const maybank = card("maybank-xl");
    const result = recommend(purchase({ category: "dining", mcc: 5812 }), context([maybank], { naturalSpendByCard: { [maybank.id]: 200 } }))[0];
    expect(result.miles).toBe(1200);
    expect(result.confidence).toBe("Likely");
  });
  it("considers retroactive bonus value when an intended purchase reaches the minimum", () => {
    const maybank = card("maybank-xl");
    const transaction = record(purchase({ amountSgd: 400, category: "dining", mcc: 5812 }), maybank, context([maybank]));
    const result = recommend(purchase({ amountSgd: 100, category: "dining", mcc: 5812 }), context([maybank, card()], { transactions: [transaction] }))[0];
    expect(result.card.templateId).toBe("maybank-xl");
    expect(result.miles).toBe(400);
    expect(result.minimumSpendIncrementalMiles).toBe(1440);
    expect(transaction.reward.miles).toBe(160);
  });
  it("applies Maybank's posting grace when allocating a purchase to minimum-spend periods", () => {
    const maybank = card("maybank-xl", { openingSpendSgd: 0 });
    const request = purchase({ date: "2026-09-30", amountSgd: 300, category: "dining", mcc: 5812 });
    const transaction = record(request, maybank, context([maybank]));
    expect(getCardCapacity(maybank, [{ ...transaction, postedDate: "2026-10-10" }], "2026-09-30").qualifyingSpendSgd).toBe(300);
    expect(getCardCapacity(maybank, [{ ...transaction, postedDate: "2026-10-11" }], "2026-09-30").qualifyingSpendSgd).toBe(0);
    expect(getCardCapacity(maybank, [{ ...transaction, postedDate: "2026-10-11" }], TODAY).qualifyingSpendSgd).toBe(300);
  });
  it("accounts for S$5 and S$1 bank earning blocks", () => {
    expect(recommend(purchase({ amountSgd: 9.99 }), context([card("trust-freedom")]))[0].miles).toBe(6.5);
    expect(recommend(purchase({ amountSgd: 9.99 }), context([card()]))[0].miles).toBe(36);
  });
  it("separates HSBC's aggregate base rounding from aggregate bonus eligibility", () => {
    const hsbc = card("hsbc-revolution");
    const baseRecord = record(purchase({ amountSgd: 99.6, category: "groceries", mcc: 5411 }), hsbc, context([hsbc]));
    const result = recommend(purchase({ amountSgd: 0.4 }), context([hsbc], { transactions: [baseRecord] }))[0];
    expect(result.miles).toBe(0.4);
    const bonusRecord = record(purchase({ amountSgd: 99.6 }), hsbc, context([hsbc]));
    expect(recommend(purchase({ amountSgd: 0.4 }), context([hsbc], { transactions: [bonusRecord] }))[0].miles).toBe(4);
  });
  it("ranks foreign purchases using net reward after FX, rather than headline mpd", () => {
    const results = recommend(purchase({ currency: "USD", amountSgd: 500 }), context([card(), card("trust-freedom")], { mileValueSgd: 0.01 }));
    expect(results[0].card.templateId).toBe("trust-freedom");
    expect(results.find((result) => result.card.templateId === "citi-rewards")?.fxFeeSgd).toBe(16.25);
  });
  it("compares cashback to miles at the chosen mile value", () => {
    const results = recommend(purchase({ category: "other", channel: "in-store" }), context([card("trust-freedom"), card("mari")], { mileValueSgd: 0.01 }));
    expect(results[0].card.templateId).toBe("mari");
    expect(results[0].cashbackSgd).toBe(4.5);
  });
  it("applies user-confirmed transfer cost allocations", () => {
    const result = recommend(purchase(), context([card("trust-freedom", { transferFeePerMileSgd: 0.002 })]))[0];
    expect(result.transferCostSgd).toBe(0.78);
    expect(result.netValueSgd).toBe(5.07);
  });
  it("requires total promotion usage before estimating capped Mari foreign cashback", () => {
    const unknown = recommend(purchase({ currency: "USD" }), context([card("mari")]))[0];
    expect(unknown.cashbackSgd).toBe(0);
    const known = recommend(purchase({ currency: "USD", amountSgd: 1000 }), context([card("mari", { openingLifetimeCashbackSgd: 267 })]))[0];
    expect(known.cashbackSgd).toBe(3);
  });
  it("ignores reversed transactions and reserves capacity for pending spend", () => {
    const citi = card();
    const transaction = record(purchase({ amountSgd: 900 }), citi, context([citi]));
    expect(getCardCapacity(citi, [{ ...transaction, status: "reversed" }], TODAY).remainingSgd).toBe(1000);
    expect(getCardCapacity(citi, [{ ...transaction, status: "pending" }], TODAY).remainingSgd).toBe(100);
  });
  it("moves the entire eligible reservation when pending spend posts into a new cycle", () => {
    const citi = card("citi-rewards", { openingSpendSgd: 900 });
    const transaction = record(purchase({ amountSgd: 300 }), citi, context([citi]));
    expect(transaction.reward.miles).toBe(480);
    expect(transaction.reward.bonusSpendSgd).toBe(300);
    expect(getCardCapacity(citi, [{ ...transaction, postedDate: "2026-11-01" }], "2026-11-01").remainingSgd).toBe(700);
    expect(transaction.reward.miles).toBe(480);
  });
  it("reserves pending spend without using it to meet Maybank's minimum", () => {
    const maybank = card("maybank-xl", { openingSpendSgd: 400 });
    const transaction = record(purchase({ amountSgd: 100, category: "dining", mcc: 5812 }), maybank, context([maybank]));
    const pending: Transaction = { ...transaction, status: "pending" };
    const capacity = getCardCapacity(maybank, [pending], TODAY);
    expect(capacity.remainingSgd).toBe(500);
    expect(capacity.qualifyingSpendSgd).toBe(400);
    expect(recommend(purchase({ amountSgd: 10, category: "dining", mcc: 5812 }), context([maybank], { transactions: [pending] }))[0].effectiveMpd).toBe(0.4);
    expect(recommend(purchase({ amountSgd: 10, category: "dining", mcc: 5812 }), context([maybank], { transactions: [transaction] }))[0].effectiveMpd).toBe(4);
  });
  it("preserves explanation snapshots when future rule definitions change", () => {
    const citi = card();
    const transaction = record(purchase(), citi, context([citi]));
    const templates = structuredClone(CARD_TEMPLATES);
    templates.find((template) => template.id === "citi-rewards")!.rules.forEach((rule) => { rule.milesPerDollar = 0.2; rule.version = 2; rule.validFrom = "2026-11-01"; });
    expect(transaction.reward.miles).toBe(1200);
    expect(transaction.reward.ruleVersion).toBe(1);
    expect(transaction.reward.sourceUrl).toContain("citibank.com.sg");
    expect(getCardCapacity(citi, [transaction], TODAY, CARD_TEMPLATES).remainingSgd).toBe(700);
  });
  it("only selects rule versions valid for the purchase date", () => {
    const custom = structuredClone(CARD_TEMPLATES.find((template) => template.id === "citi-rewards")!);
    custom.rules.push({ ...custom.rules[1], version: 2, validFrom: "2026-11-01", milesPerDollar: 2 });
    expect(recommend(purchase(), context([card()], { templates: [custom] }))[0].miles).toBe(1200);
    expect(recommend(purchase({ date: "2026-11-01" }), context([card()], { templates: [custom] }))[0].miles).toBe(600);
  });
  it("keeps manual-review card benefits and unverified rules outside ranking", () => {
    expect(recommend(purchase({ category: "fuel", merchant: "Esso", mcc: 5541 }), context([card("dbs-esso"), card("uob-one")]))).toEqual([]);
    const template: CardTemplate = { id: "unknown", name: "Unverified", issuer: "Unknown", accent: "#000", role: "Unverified", rules: [{ ...CARD_TEMPLATES[1].rules[0], verification: "Unverified" }] };
    expect(recommend(purchase(), context([card("unknown")], { templates: [template] }))).toEqual([]);
  });
  it("rejects non-finite or invalid purchase input", () => {
    expect(recommend(purchase({ amountSgd: Infinity }), context([card()]))).toEqual([]);
    expect(recommend(purchase({ amountSgd: -1 }), context([card()]))).toEqual([]);
    expect(recommend(purchase({ date: "2026-02-30" }), context([card()]))).toEqual([]);
  });
});

describe("welcome-offer incremental value", () => {
  it("moves a nearly complete attainable welcome offer ahead of headline earn", () => {
    const ctx = context([card(), card("trust-freedom")], { offers: [offer()] });
    const result = recommend(purchase({ amountSgd: 240 }), ctx)[0];
    expect(result.card.templateId).toBe("trust-freedom");
    expect(result.welcomeIncrementalMiles).toBe(20000);
    expect(result.miles).toBe(312);
    expect(result.snapshot.welcomeContributionSgd).toBe(240);
  });
  it("does not allocate a bonus already attainable through planned spending", () => {
    const ctx = context([card(), card("trust-freedom")], { offers: [offer({ plannedNaturalSpendSgd: 1000 })] });
    expect(recommend(purchase(), ctx)[0].card.templateId).toBe("citi-rewards");
    expect(recommend(purchase(), ctx).every((result) => result.welcomeIncrementalMiles === 0)).toBe(true);
  });
  it("assigns zero welcome value in the exact 760/1000, planned300, purchase512 demo", () => {
    const aleem = card("citi-rewards", { openingSpendSgd: 388 });
    const nurul = card("citi-rewards", { owner: "Nurul", id: "nurul-citi", openingSpendSgd: 220 });
    const results = recommend(purchase({ amountSgd: 512 }), context([aleem, nurul, card("trust-freedom")], { offers: [offer({ plannedNaturalSpendSgd: 300 })] }));
    expect(results[0].card.id).toBe(aleem.id);
    expect(results.find((result) => result.card.templateId === "trust-freedom")?.welcomeIncrementalMiles).toBe(0);
    expect(results.find((result) => result.card.templateId === "trust-freedom")?.netValueSgd).toBe(9.95);
  });
  it("does not chase unreachable higher tiers, or boost expired/unconfirmed offers", () => {
    expect(getOfferProgress(offer({ openingSpendSgd: 1000, plannedNaturalSpendSgd: 300 }), [], TODAY).message).toBe("Not worth chasing");
    for (const invalid of [offer({ deadline: "2026-10-04" }), offer({ eligibilityConfirmed: false }), offer({ verified: false })]) {
      expect(recommend(purchase(), context([card("trust-freedom")], { offers: [invalid] }))[0].welcomeIncrementalMiles).toBe(0);
    }
  });
  it("requires posted spend by the deadline and never counts pending or reversed spend", () => {
    const trust = card("trust-freedom");
    const transaction = record(purchase({ amountSgd: 240 }), trust, context([trust], { offers: [offer()] }));
    expect(getOfferProgress(offer(), [transaction], TODAY).spendSgd).toBe(1000);
    expect(getOfferProgress(offer(), [{ ...transaction, status: "pending" }], TODAY).spendSgd).toBe(760);
    expect(getOfferProgress(offer(), [{ ...transaction, status: "reversed" }], TODAY).spendSgd).toBe(760);
    expect(getOfferProgress(offer(), [{ ...transaction, postedDate: "2026-11-01" }], TODAY).spendSgd).toBe(760);
  });
});
