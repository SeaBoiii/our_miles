import {describe,expect,it} from "vitest";
import type {OwnedCard,Purchase,RecommendationContext,Transaction,WelcomeOffer} from "../src/lib/domain";
import {assessCards,getCardCapacity,getOfferProgress,recommend} from "../src/lib/engine";
import {getMerchant,MERCHANTS,MERCHANT_REFERENCE_COUNT,MERCHANT_LOOKUP_SOURCES,merchantPurchaseHints,searchMerchants} from "../src/lib/merchants";
import {getMccDescription,MCC_REFERENCE,searchMccCodes} from "../src/lib/mcc-reference";

const purchase = (overrides:Partial<Purchase>={}):Purchase=>({amountSgd:100,merchant:"UNIQLO",category:"shopping",channel:"online",paymentMethod:"card",currency:"SGD",date:"2026-10-07",mcc:5651,mccConfidence:"Likely",...overrides});
const card = (templateId:string,overrides:Partial<OwnedCard>={}):OwnedCard=>({id:`nurul-${templateId}`,templateId,owner:"Nurul",status:"active",usageKnown:true,statementDay:1,openingPeriodStart:"2026-10-01",openingSpendSgd:0,...overrides});
const context = (cards:OwnedCard[],overrides:Partial<RecommendationContext>={}):RecommendationContext=>({cards,transactions:[],offers:[],mileValueSgd:0.015,...overrides});

describe("sourced merchant evidence",()=>{
  it("keeps named Singapore examples and payment variants discoverable",()=>{
    expect(MERCHANTS.length).toBeGreaterThanOrEqual(90);
    for(const query of ["NTUC","Challenger","Timezone","McDonalds","Esso","MRT","Agoda","SIA","AirAsia","Scoot","Booking.com","IHG","Marriott Bonvoy"]) expect(searchMerchants(query).length,query).toBeGreaterThan(0);
    expect(searchMerchants("NTUC")[0].name).toBe("FairPrice");
    expect(searchMerchants("Love, Bonito")[0].name).toBe("Love Bonito");
    expect(searchMerchants("H&M")[0].mccs).toEqual([5621]);
  });
  it("treats bank examples as estimates and keeps ambiguous MCCs unforced",()=>{
    const fairPrice = searchMerchants("FairPrice")[0];
    expect(merchantPurchaseHints(fairPrice,"contactless","2026-10-07")).toMatchObject({category:"groceries",mcc:5411,mccConfidence:"Likely",lastVerifiedAt:"2026-10-07"});
    for(const query of ["Lazada","Timezone","Marriott Bonvoy","IHG"]) expect(merchantPurchaseHints(searchMerchants(query)[0],"online","2026-10-07").mcc,query).toBeUndefined();
    expect(merchantPurchaseHints(searchMerchants("RedMart")[0],"in-store","2026-10-07").mcc).toBeUndefined();
  });
  it("separates furniture, food, direct fares and wallet loading",()=>{
    expect(merchantPurchaseHints(searchMerchants("IKEA")[0],"contactless","2026-10-07").mcc).toBe(5712);
    expect(merchantPurchaseHints(searchMerchants("IKEA food")[0],"contactless","2026-10-07").mcc).toBe(5814);
    expect(merchantPurchaseHints(searchMerchants("MRT")[0],"contactless","2026-10-07")).toMatchObject({mcc:4111,category:"transport"});
    expect(merchantPurchaseHints(searchMerchants("SimplyGo top up")[0],"online","2026-10-07")).toMatchObject({excluded:true,category:"financial",mccConfidence:"Unverified"});
    expect(searchMerchants("Apple Pay")).toEqual([]);
  });
  it("imports licensed global references without asserting Singapore eligibility",()=>{
    expect(MERCHANT_REFERENCE_COUNT).toBeGreaterThan(6000);
    const reported = searchMerchants("1Password")[0];
    expect(reported.extended).toBe(true);
    expect(getMerchant(reported.id)).toEqual(reported);
    expect(merchantPurchaseHints(reported,"online","2026-10-07")).toMatchObject({mcc:5734,mccConfidence:"Unverified"});
    expect(searchMerchants("UNIQLO")[0].extended).not.toBe(true);
    for(const query of ["Esso automated pump","Challenger 5045","AirAsia","Scoot"]) expect(merchantPurchaseHints(searchMerchants(query)[0],"online","2026-10-07").mccConfidence,query).toBe("Unverified");
  });
  it("downgrades stale catalogue evidence without changing a historical purchase",()=>{
    const entry=searchMerchants("UNIQLO")[0];
    expect(merchantPurchaseHints(entry,"online","2026-10-07").mccConfidence).toBe("Likely");
    expect(merchantPurchaseHints(entry,"online","2027-04-07").mccConfidence).toBe("Unverified");
    expect(merchantPurchaseHints(entry,"online","invalid").mccConfidence).toBe("Unverified");
    expect(entry.lastVerifiedAt).toBe("2026-10-07");
  });
  it("uses unique IDs, valid source URLs and fixed privacy-preserving lookup links",()=>{
    expect(new Set(MERCHANTS.map(entry=>entry.id)).size).toBe(MERCHANTS.length);
    expect(MERCHANTS.every(entry=>new URL(entry.sourceUrl).protocol === "https:" && entry.mccs.every(mcc=>Number.isInteger(mcc)&&mcc>=0&&mcc<=9999))).toBe(true);
    expect(MERCHANT_LOOKUP_SOURCES.every(entry=>new URL(entry.url).protocol === "https:" && !new URL(entry.url).search)).toBe(true);
  });
  it("keeps standard MCC descriptions separate from merchant and reward rules",()=>{
    expect(MCC_REFERENCE).toHaveLength(981);
    expect(getMccDescription(763)).toContain("Agricultural");
    expect(searchMccCodes("5411")[0]).toMatchObject({code:"5411"});
    expect(searchMccCodes("fast food").some(entry=>entry.code === "5814")).toBe(true);
    expect(searchMccCodes("" )).toEqual([]);
  });
});

describe("explainable recommendations and conditional setup",()=>{
  it("shows why Trust is the safe fallback while a capped card's usage is unknown",()=>{
    const citi=card("citi-rewards",{usageKnown:false});
    const ctx=context([citi,card("trust-freedom")]);
    expect(recommend(purchase(),ctx)[0].template.id).toBe("trust-freedom");
    const assessment=assessCards(purchase(),ctx).find(entry=>entry.card.id===citi.id)!;
    expect(assessment.status).toBe("setup-needed");
    expect(assessment.recommendation?.miles).toBe(40);
    expect(assessment.potential?.miles).toBe(400);
    expect(assessment.potential?.confidence).toBe("Unverified");
    expect(assessment.potential?.reason).toContain("Conditional estimate only");
    expect(assessment.blockers).toContainEqual({id:"usage",cardId:citi.id,label:"Confirm remaining bonus capacity for this period."});
    expect(assessment.recommendation?.warnings.join(" ")).not.toContain("MCC is unverified");
  });
  it("ranks a sourced eligible specialist above Trust once real setup is known",()=>{
    const selected=card("citi-rewards");
    const ctx=context([selected,card("trust-freedom")]);
    expect(recommend(purchase(),ctx)[0]).toMatchObject({card:{id:selected.id},miles:400,confidence:"Likely"});
    expect(assessCards(purchase(),ctx).find(entry=>entry.card.id===selected.id)?.potential).toBeUndefined();
  });
  it("allows Trust to win honestly when specialist caps are exhausted or FX is uneconomic",()=>{
    const capped=card("citi-rewards",{openingSpendSgd:1000});
    expect(recommend(purchase(),context([capped,card("trust-freedom")]))[0].template.id).toBe("trust-freedom");
    expect(assessCards(purchase(),context([capped]))[0].potential).toBeUndefined();
    expect(recommend(purchase({currency:"USD"}),context([card("citi-rewards"),card("trust-freedom")],{mileValueSgd:0.01}))[0].template.id).toBe("trust-freedom");
  });
  it("never invents a statement date to compute potential",()=>{
    const selected=card("citi-rewards",{statementDay:undefined,usageKnown:false});
    const assessment=assessCards(purchase(),context([selected]))[0];
    expect(assessment.potential).toBeUndefined();
    expect(assessment.blockers.some(blocker=>blocker.id==="statement")).toBe(true);
    expect(selected.statementDay).toBeUndefined();
  });
  it("separates a hypothetical registered Lady's category from the actual base estimate",()=>{
    const request=purchase({category:"dining",mcc:5812});
    const selected=card("uob-ladys");
    const assessment=assessCards(request,context([selected]))[0];
    expect(assessment.recommendation?.miles).toBe(40);
    expect(assessment.potential?.miles).toBe(400);
    expect(assessment.blockers.some(blocker=>blocker.id==="category")).toBe(true);
    expect(selected.selectedRewardCategory).toBeUndefined();
    const mismatched={...selected,selectedRewardCategory:"fashion" as const,selectedRewardCategoryPeriodStart:"2026-10-01"};
    expect(assessCards(request,context([mismatched]))[0].potential).toBeUndefined();
  });
  it("does not pretend annual qualification or a lifetime cashback limit is known",()=>{
    const annual=assessCards(purchase({category:"dining",mcc:5812}),context([card("uob-krisflyer")]))[0];
    expect(annual.recommendation?.miles).toBe(120);
    expect(annual.potential).toBeUndefined();
    expect(annual.blockers.some(blocker=>blocker.id==="annual")).toBe(true);
    const lifetime=assessCards(purchase({currency:"USD"}),context([card("mari")]))[0];
    expect(lifetime.potential).toBeUndefined();
    expect(lifetime.blockers.some(blocker=>blocker.id==="lifetime")).toBe(true);
  });
  it("withholds a known unmet minimum and names unknown minimum assumptions",()=>{
    const selected=card("maybank-xl");
    const known=assessCards(purchase(),context([selected]))[0];
    expect(known.recommendation?.miles).toBe(40);
    expect(known.potential).toBeUndefined();
    expect(known.blockers.some(blocker=>blocker.id==="minimum")).toBe(true);
    const unknown=assessCards(purchase(),context([{...selected,usageKnown:false}]))[0];
    expect(unknown.potential?.miles).toBe(400);
    expect(unknown.potential?.reason).toContain("S$500 qualifying minimum is already met");
  });
  it("never upgrades an unspecified global MCC into bonus eligibility",()=>{
    const selected=card("citi-rewards",{usageKnown:false});
    const request=purchase({mcc:5734,mccConfidence:"Unverified"});
    const assessment=assessCards(request,context([selected]))[0];
    expect(assessment.recommendation?.miles).toBe(40);
    expect(assessment.potential).toBeUndefined();
    expect(assessment.blockers.some(blocker=>blocker.id==="mcc")).toBe(true);
  });
  it("never awards a welcome tier or contribution from an unverified MCC",()=>{
    const selected=card("citi-rewards");
    const offer:WelcomeOffer={id:"fixture-offer",cardId:selected.id,name:"Fictitious MCC-specific test offer",startsOn:"2026-10-01",deadline:"2026-10-31",tiers:[{spendSgd:100,miles:20000}],openingSpendSgd:0,plannedNaturalSpendSgd:0,sourceUrl:"https://example.com/fixture",verified:true,eligibilityConfirmed:true,conditions:{mccs:[5734]}};
    const request=purchase({merchant:"1Password",mcc:5734,mccConfidence:"Unverified"});
    const result=recommend(request,context([selected],{offers:[offer]}))[0];
    expect(result.miles).toBe(40);
    expect(result.welcomeIncrementalMiles).toBe(0);
    expect(result.snapshot.welcomeContributionSgd).toBe(0);
    expect(result.snapshot.qualifyingSpendSgd).toBe(0);
    expect(recommend({...request,mccConfidence:"Confirmed"},context([selected],{offers:[offer]}))[0].welcomeIncrementalMiles).toBe(20000);
    const historical:Transaction={...request,id:"uncertain-old-record",cardId:selected.id,status:"posted",reward:{...result.snapshot,welcomeOfferId:offer.id,welcomeContributionSgd:100,qualifyingSpendSgd:100}};
    expect(getOfferProgress(offer,[historical],request.date).spendSgd).toBe(0);
    expect(historical.reward.welcomeContributionSgd).toBe(100);
  });
  it("excludes uncertain historical MCC spend from minimum qualification and retroactive miles",()=>{
    const selected=card("maybank-xl",{openingSpendSgd:100,openingQualifyingSpendSgd:400});
    const uncertain=purchase({merchant:"UNIQLO",mccConfidence:"Unverified"});
    const result=recommend(uncertain,context([selected]))[0];
    expect(result.miles).toBe(40);
    expect(result.minimumSpendIncrementalMiles).toBe(0);
    expect(result.snapshot.qualifyingSpendSgd).toBe(0);
    const historical:Transaction={...uncertain,id:"old-unknown-mcc",cardId:selected.id,status:"posted",reward:{...result.snapshot,qualifyingSpendSgd:100}};
    expect(getCardCapacity(selected,[historical],uncertain.date).qualifyingSpendSgd).toBe(400);
    const knownPurchase=purchase({amountSgd:50});
    expect(recommend(knownPurchase,context([selected],{transactions:[historical]}))[0].miles).toBe(20);
    expect(historical.reward.qualifyingSpendSgd).toBe(100);
  });
  it("checks the applicable PPV bucket independently and preserves all context",()=>{
    const selected=card("uob-ppv",{capUsageKnown:{"uob-ppv-online":false,"uob-ppv-mobile":true},openingCapSpendSgd:{"uob-ppv-online":0,"uob-ppv-mobile":0}});
    const ctx=context([selected,card("trust-freedom")]);
    const before=JSON.stringify(ctx);
    const unknown=assessCards(purchase(),ctx)[0];
    expect(unknown.potential?.miles).toBe(400);
    expect(unknown.blockers.some(blocker=>blocker.label.includes("Online"))).toBe(true);
    expect(assessCards(purchase({channel:"contactless",paymentMethod:"apple-pay"}),ctx)[0].recommendation?.miles).toBe(400);
    expect(JSON.stringify(ctx)).toBe(before);
    expect(recommend(purchase(),ctx)[0].template.id).toBe("trust-freedom");
  });
  it("reports inactive, manual-review and excluded cards without fabricating rankings",()=>{
    const assessments=assessCards(purchase({excluded:true}),context([card("citi-rewards",{status:"inactive"}),card("dbs-esso"),card("trust-freedom")]));
    expect(assessments.map(entry=>entry.status)).toEqual(["inactive","manual-review","ineligible"]);
    expect(assessments.every(entry=>!entry.potential&&!entry.recommendation)).toBe(true);
    expect(assessCards(purchase({amountSgd:NaN}),context([card("trust-freedom")]))).toEqual([]);
  });
});
