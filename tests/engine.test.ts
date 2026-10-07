import { describe, expect, it } from "vitest";
import type { CardTemplate, OwnedCard, Purchase, RecommendationContext, Transaction, WelcomeOffer } from "../src/lib/domain";
import { getCardCapacity, getOfferProgress, recommend } from "../src/lib/engine";
import { getPeriod, singaporeDate } from "../src/lib/periods";
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
