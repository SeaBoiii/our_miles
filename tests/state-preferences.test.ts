import { describe, expect, it } from "vitest";
import { appStateSchema, parseAppState, snapshotsPreserved } from "@/lib/state-schema";
import type { AppState } from "@/lib/state";

function fixture(): AppState {
  return {
    schemaVersion: 1,
    cards: [{
      id: "nurul-uob-krisflyer", templateId: "uob-krisflyer", owner: "Nurul", status: "active", usageKnown: false,
      openingCapSpendSgd: { "ppv-online": 184.12 }, capUsageKnown: { "ppv-online": true },
      openingRewardSpendSgd: { "dbs-local": 100.25, "dbs-foreign": 12 },
      selectedRewardCategory: "dining", selectedRewardCategoryPeriodStart: "2026-10-01",
      annualQualificationStart: "2026-05-01", annualQualificationEnd: "2027-05-01",
      openingAnnualQualifyingSpendSgd: 999.95, annualUsageKnown: true,
    }],
    transactions: [{
      id: "flight", cardId: "nurul-uob-krisflyer", amountSgd: 500, merchant: "Singapore Airlines", category: "travel", channel: "online", paymentMethod: "samsung-pay", currency: "SGD", date: "2026-10-07", mcc: 763, recurring: false, rewardPartner: "singapore-airlines",
      reward: { calculatedAt: "2026-10-07", templateId: "uob-krisflyer", ruleId: "kf-partners-2026", ruleVersion: 1, sourceUrl: "https://www.uob.com.sg/assets/pdfs/kf_credit_card_full_tnc.pdf", lastVerifiedAt: "2026-10-07", miles: 1500, cashbackSgd: 0, fxFeeSgd: 0, effectiveMpd: 3, confidence: "Confirmed", bonusSpendSgd: 0, roundingGroup: "kf-partners", bonusRoundingGroup: "dbs-local", qualifyingSpendSgd: 500, welcomeContributionSgd: 0, welcomeIncrementalMiles: 0, reason: "Confirmed partner", warnings: [] },
    }],
    offers: [{ id: "fixture-offer", cardId: "nurul-uob-krisflyer", name: "Validation fixture", startsOn: "2026-10-01", deadline: "2026-10-31", tiers: [{ spendSgd: 100, miles: 1000 }], openingSpendSgd: 0, plannedNaturalSpendSgd: 0, sourceUrl: "", verified: false, eligibilityConfirmed: false, conditions: { excludeRecurring: true, rewardPartners: ["singapore-airlines", "krisplus"], paymentMethods: ["samsung-pay"], mccs: [0, 763], excludedMerchantWords: ["spc", "shell"] } }],
    goals: [], mileBalance: 0, mileValueSgd: 0.015,
  };
}

describe("persisted card preferences", () => {
  it("keeps unconfirmed legacy cards valid and roundtrips explicit preferences without assigning defaults", () => {
    const legacy: AppState = { schemaVersion: 1, cards: [{ id: "lady", templateId: "uob-ladys", owner: "Nurul", status: "active", usageKnown: false }], transactions: [], offers: [], goals: [], mileBalance: 0, mileValueSgd: 0.015 };
    expect(parseAppState(legacy)).toEqual(legacy);
    expect(parseAppState(fixture())).toEqual(fixture());
    const zeroMcc = fixture();
    zeroMcc.transactions[0].mcc = 0;
    expect(parseAppState(zeroMcc).transactions[0].mcc).toBe(0);
  });

  it("bounds group records and rejects unknown preferences, partners and credential fields", () => {
    for (const fields of [
      { openingCapSpendSgd: { "ppv-online": -1 } },
      { openingRewardSpendSgd: { "invalid key": 1 } },
      { openingRewardSpendSgd: { "dbs-local": 100_000_001 } },
      { capUsageKnown: { "ppv-online": "yes" } },
      { openingCapSpendSgd: Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`group-${index}`, 0])) },
      { selectedRewardCategory: "Miles" },
      { bankingPassword: "not-allowed" },
    ]) {
      const state = fixture();
      Object.assign(state.cards[0], fields);
      expect(appStateSchema.safeParse(state).success).toBe(false);
    }
    for (const fields of [{ rewardPartner: "unknown-airline" }, { recurring: "yes" }, { mcc: -1 }, { mcc: 10000 }]) {
      const state = fixture();
      Object.assign(state.transactions[0], fields);
      expect(appStateSchema.safeParse(state).success).toBe(false);
    }
    const unknownReward = fixture();
    Object.assign(unknownReward.transactions[0].reward, { cvv: "not-allowed" });
    expect(appStateSchema.safeParse(unknownReward).success).toBe(false);
    const unknownConditions = fixture();
    Object.assign(unknownConditions.offers[0].conditions!, { rewardPartners: ["unknown-airline"] });
    expect(appStateSchema.safeParse(unknownConditions).success).toBe(false);
    for (const words of [[""], ["x".repeat(241)], Array(101).fill("spc"), [42]]) {
      const invalidWords = fixture();
      Object.assign(invalidWords.offers[0].conditions!, { excludedMerchantWords: words });
      expect(appStateSchema.safeParse(invalidWords).success).toBe(false);
    }
  });

  it("requires the full approval-month membership year before annual usage can be confirmed", () => {
    for (const fields of [
      { annualQualificationEnd: undefined },
      { annualQualificationEnd: "2026-05-01" },
      { annualQualificationEnd: "2027-06-01" },
      { annualQualificationStart: "2026-05-02", annualQualificationEnd: "2027-05-02" },
      { annualQualificationStart: "invalid-date" },
    ]) {
      const state = fixture();
      Object.assign(state.cards[0], fields);
      expect(appStateSchema.safeParse(state).success).toBe(false);
    }
    const unknown = fixture();
    unknown.cards[0].annualUsageKnown = false;
    delete unknown.cards[0].annualQualificationStart;
    delete unknown.cards[0].annualQualificationEnd;
    expect(appStateSchema.safeParse(unknown).success).toBe(true);
  });

  it("preserves partner, recurring and rounding evidence when posting dates change", () => {
    const previous = fixture();
    const posted = fixture();
    posted.transactions[0].postedDate = "2026-10-08";
    posted.transactions[0].status = "posted";
    expect(snapshotsPreserved(previous, posted)).toBe(true);
    for (const change of [
      (state: AppState) => { state.transactions[0].rewardPartner = "scoot"; },
      (state: AppState) => { state.transactions[0].recurring = true; },
      (state: AppState) => { state.transactions[0].reward.roundingGroup = "different-group"; },
      (state: AppState) => { state.transactions[0].reward.bonusRoundingGroup = "dbs-foreign"; },
    ]) {
      const changed = fixture();
      change(changed);
      expect(snapshotsPreserved(previous, changed)).toBe(false);
    }
  });
});
