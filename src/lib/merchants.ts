import type { Category, Channel, Confidence } from "./domain";
import globalMappings from "./merchant-data/global-merchants.json";
import sources from "./merchant-data/sources.json";
import {daysBetween,singaporeDate} from "./periods";

export interface MerchantEvidence {
  id: string;
  name: string;
  aliases: string[];
  category: Category;
  /** Possibilities from the source, not a guarantee for a particular charge. */
  mccs: number[];
  channels?: Channel[];
  sourceUrl: string;
  sourceTitle: string;
  lastVerifiedAt: string;
  note: string;
  /** Named payment exclusions need no invented MCC. */
  excluded?: boolean;
  /** Imported global references are not confirmed for Singapore checkout. */
  extended?: boolean;
  mccConfidence?: Confidence;
}

export interface MerchantPurchaseHints {
  category: Category;
  mcc?: number;
  mccConfidence: Confidence;
  note: string;
  sourceUrl: string;
  lastVerifiedAt: string;
  excluded?: boolean;
}

const checked = "2026-10-07";
const retail = "https://www.ocbc.com/personal-banking/cards/rewards-card.page";
const daily = "https://www.maybank2u.com.sg/iwov-resources/sg/pdf/cards/fnf-cashrebate-tnc.pdf";
const business = "https://www.ocbc.com/business-banking/smes/transactions/business-credit-card";
const lazada = "https://www.uob.com.sg/personal/cards/cashback/lazada-uob-card.page";
const exclusions = "https://www.dbs.com.sg/iwov-resources/pdf/cards/rewards_programme_tnc.pdf";
const visa = "https://usa.visa.com/content/dam/VCOM/download/merchants/visa-merchant-data-standards-manual.pdf";
const youthful = "https://www.ocbc.com/iwov-resources/sg/ocbc/personal/pdf/accounts/terms-and-conditions-governing-myown-account-debit-card-promotion.pdf";
const fastFood = "https://v.icbc.com.cn/userfiles/resources/icbc/haiwai/singapore/download/2023/horoscope_faq_321cashback.pdf";
const electronics = "https://ezlink.simplygo.com.sg/wordpress/wp-content/uploads/2023/03/Terms-and-Conditions-Top-Spenders-Campaign-v2.pdf";
const taxi = "https://www.citibank.com.sg/credit-cards/cashback/citi-cash-back-card/pdf/cashbackFAQs.pdf";
const transit = "https://www.citigold.com.sg/global_docs/pdf/Rewards_Exclusion_List.pdf";
const travel = "https://dcscc.com/gotravel-doc";
const hotelNote = "Visa lists this hotel brand code. An individual property may instead use MCC 7011; hotel restaurants and bookings paid to a travel agent can differ. Confirm the actual property/checkout.";
const standardNote = "Bank merchant example. The outlet, payment route and issuer can classify your charge differently; confirm the posted MCC.";

function merchant(name: string, category: Category, mccs: number[], sourceUrl: string, extras: Partial<MerchantEvidence> = {}): MerchantEvidence {
  return { id: normalizeMerchant(name).replaceAll(" ", "-"), name, aliases: [], category, mccs, sourceUrl, sourceTitle: sourceUrl === retail ? "OCBC merchant examples" : sourceUrl === daily ? "Maybank category terms" : sourceUrl === business ? "OCBC business merchant examples" : sourceUrl === lazada ? "UOB Lazada terms" : "DBS rewards exclusions", lastVerifiedAt: checked, note: standardNote, ...extras };
}

/** Public knowledge only. No personal transactions, card ownership or tracking calls. */
export const MERCHANTS: MerchantEvidence[] = [
  ...["Takashimaya", "TANGS", "Isetan", "OG", "Metro", "BHG", "Marks & Spencer"].map(name => merchant(name, "shopping", [5311], retail)),
  ...["Benjamin Barker", "Timberland"].map(name => merchant(name, "shopping", [5611], retail)),
  ...["ZARA", "H&M", "Mothercare"].map(name => merchant(name, "shopping", [5621], retail)),
  ...["Tory Burch", "Love Bonito", "Pandora"].map(name => merchant(name, "shopping", [5631], retail, name === "Love Bonito" ? { aliases: ["Love, Bonito", "LoveBonito"] } : {})),
  ...["Kiddy Palace", "Motherswork"].map(name => merchant(name, "shopping", [5641], retail)),
  ...["UNIQLO", "ASOS", "Burberry"].map(name => merchant(name, "shopping", [5651], retail)),
  ...["Nike", "Lululemon", "Adidas"].map(name => merchant(name, "shopping", [5655], retail)),
  ...["Skechers", "CHARLES & KEITH", "Bata", "Foot Locker"].map(name => merchant(name, "shopping", [5661], retail)),
  ...["ZALORA", "FARFETCH"].map(name => merchant(name, "shopping", [5691], retail)),
  ...["Cotton On", "Royal Sporting House"].map(name => merchant(name, "shopping", [5699], retail)),
  ...["Decathlon", "New Balance"].map(name => merchant(name, "shopping", [5941], retail)),
  ...["Louis Vuitton", "Coach", "RIMOWA"].map(name => merchant(name, "shopping", [5948], retail)),
  merchant("FairPrice", "groceries", [5411], daily, { aliases: ["NTUC", "NTUC FairPrice", "FairPrice Finest", "FairPrice Xtra", "FairPrice X-tra"], note: "Supermarket purchases. FairPrice app food orders, wallet top-ups and different payment routes are separate purchases; check their classification." }),
  ...["Cold Storage", "Giant", "Market Place", "Sheng Siong", "DON DON DONKI", "HAO Mart", "RedMart", "Amazon Fresh"].map(name => merchant(name, "groceries", [5411], daily, name === "DON DON DONKI" ? { aliases: ["Donki", "Don Donki"] } : name === "RedMart" ? { channels: ["online"] } : name === "Amazon Fresh" ? { channels: ["online"], note: "Amazon Fresh groceries; other Amazon purchases and subscriptions can have different MCCs." } : {})),
  ...["Guardian", "Watsons", "Unity"].map(name => merchant(name, "shopping", [5912], daily, name === "Unity" ? { aliases: ["Unity by FairPrice"] } : {})),
  merchant("Lazada", "shopping", [5262, 5311, 5310, 5331, 5399, 5732, 5999], lazada, { channels: ["online"], note: "UOB lists several Lazada MCCs. No single code is assumed. RedMart and Lazada wallet top-ups are separate." }),
  merchant("Shopee", "shopping", [], retail, { channels: ["online"], note: "Named retailer in the bank guide; no universal MCC is supplied. ShopeePay top-ups are separate and excluded by several cards." }),
  merchant("Amazon", "shopping", [], retail, { channels: ["online"], note: "The bank names Amazon but does not give a universal MCC. Fresh, marketplace purchases, digital goods and subscriptions can differ." }),
  merchant("IKEA — furniture", "shopping", [5712], business, { aliases: ["IKEA"], note: "Furniture purchases. IKEA food uses a different category; choose the restaurant entry for food." }),
  merchant("IKEA — restaurant", "dining", [5814], business, { aliases: ["IKEA food", "IKEA restaurant", "IKEA cafe"], note: "Restaurant purchases, separate from IKEA furniture. Confirm the terminal's posted MCC." }),
  merchant("Apple", "shopping", [5732, 5045, 5818], business, { aliases: ["Apple Store", "Apple.com", "App Store"], note: "Hardware and digital purchases can use different codes. Choose the actual posted MCC; Apple Pay is a payment method, not this merchant." }),
  merchant("Foodpanda", "dining", [], daily, { aliases: ["Food Panda", "Delivery Hero"], channels: ["online"], note: "Bank names this food-delivery platform, without a universal MCC. Grocery orders and other payment routes can differ." }),
  merchant("Grab — rides", "transport", [4111, 4121, 4789], daily, { aliases: ["Grab", "GrabTaxi", "Grab ride", "JustGrab"], channels: ["online"], note: "Bank groups ride-hailing with several transport MCCs, without mapping one universal code. GrabFood, GrabMart and top-ups are separate." }),
  merchant("GOJEK — rides", "transport", [4111, 4121, 4789], daily, { aliases: ["Gojek", "GoCar"], channels: ["online"], note: "Ride-hailing example; the source does not establish one MCC for every ride. Confirm the posted code." }),
  merchant("ShopeePay top-up", "financial", [5262], retail, { aliases: ["Shopee Pay", "ShopeePay"], channels: ["online"], excluded: true, note: "Wallet top-up, not Shopee shopping. OCBC identifies this descriptor under MCC 5262; rewards exclusions still depend on the card." }),
  merchant("YouTrip top-up", "financial", [], exclusions, { aliases: ["YouTrip", "You Trip"], channels: ["online"], excluded: true, note: "Prepaid-wallet loading is excluded by the researched reward rules. No single MCC is invented." }),
  merchant("Challenger — electronics", "shopping", [5732], "https://blog.seedly.sg/mcc-codes-singapore-for-credit-cards/", { aliases:["Challenger", "Hachi.tech", "Hachi Tech"], sourceTitle:"Seedly merchant examples", note:"Secondary merchant report. A 2023 EZ-Link issuer campaign instead lists Challenger Technologies under MCC 5045. The outlet/online route must be checked; choose that variant if the statement shows 5045." }),
  merchant("Challenger — computer equipment", "shopping", [5045], electronics, { aliases:["Challenger Technologies", "Challenger 5045"], mccConfidence:"Unverified", sourceTitle:"EZ-Link 2023 campaign examples", note:"Historical issuer campaign example; other reports use 5732. Check the exact terminal/online route rather than assuming all Challenger purchases share this code." }),
  merchant("Timezone", "other", [7832,7994,7996], youthful, { aliases:["Time Zone", "Timezone arcade"], sourceTitle:"OCBC 2024 campaign examples", note:"Historical bank entertainment group lists Timezone with MCCs 7832, 7994 and 7996, without an outlet-specific mapping. No single MCC is forced; arcade card loading may differ from admission/game purchases." }),
  ...["McDonald's", "KFC", "Burger King", "Subway"].map(name => merchant(name, "dining", [5814], fastFood, {aliases:name === "McDonald's" ? ["McDonalds", "Mcd", "McDelivery", "Maccas"] : name === "KFC" ? ["Kentucky Fried Chicken"] : [], sourceTitle:"ICBC Singapore fast-food examples", note:"Bank fast-food example. App checkout, delivery aggregators and individual franchise terminals can differ; confirm the charge's MCC."})),
  ...["Starbucks", "Pizza Hut", "4Fingers", "The Coffee Bean & Tea Leaf", "MOS Burger"].map(name => merchant(name, "dining", [5812,5814], youthful, {sourceTitle:"OCBC 2024 dining examples",note:"Historical bank dining group lists both restaurant and fast-food codes without assigning one code to every listed merchant. Choose the actual posted MCC."})),
  merchant("Esso — station counter", "fuel", [5541], "https://www.check-mcc.sg/mcc/esso", {aliases:["Esso", "Esso petrol", "Esso fuel"], channels:["in-store","contactless"], sourceTitle:"CheckMCC merchant report", note:"Reported station-terminal MCC, not issuer-confirmed for your charge. Automated pumps and Esso app payments can differ. Compare DBS Esso pump discounts separately."}),
  merchant("Esso — automated pump", "fuel", [5542], "https://www.citibank.com.sg/credit-cards/cashback/citi-cash-back-card/pdf/cashbackFAQs.pdf", {aliases:["Esso pump", "Esso automated pump"], channels:["in-store","contactless"], mccConfidence:"Unverified", sourceTitle:"Citi petrol category definition", note:"Inference from the network's automated-fuel category, not a verified Esso terminal. Confirm 5542 on the statement before relying on MCC-dependent eligibility."}),
  merchant("BUS/MRT — SimplyGo fares", "transport", [4111], transit, {aliases:["SimplyGo", "MRT", "Bus", "Bus MRT", "BUS/MRT", "SMRT", "SBS Transit"], channels:["contactless"], sourceTitle:"Citi SimplyGo descriptor guidance",note:"Direct gate/reader fare payments; keep the BUS/MRT descriptor. Physical card and phone taps have different PPV rules. EZ-Link and SimplyGo wallet top-ups are separate, excluded transactions."}),
  merchant("SimplyGo / EZ-Link top-up", "financial", [], exclusions, {aliases:["SimplyGo top up", "EZ-Link", "EZLink", "TransitLink top up"], excluded:true, sourceTitle:"DBS top-up exclusions",note:"Stored-value loading is not a direct bus/MRT fare and is excluded from the researched reward rules; do not substitute fare MCC 4111."}),
  ...["ComfortDelGro Zig", "TADA", "Ryde"].map(name=>merchant(name,"transport",[4121],taxi,{aliases:name==="ComfortDelGro Zig"?["Comfort", "CityCab", "Zig", "ComfortDelGro"]:[],channels:["online"],sourceTitle:"Citi commute descriptor guidance",note:"Bank requires the matching operator descriptor and MCC 4121. Direct app fares are separate from wallet loading and any other operator services."})),
  merchant("Agoda", "travel", [4722], travel, {aliases:["Agoda.com"],channels:["online"],sourceTitle:"DCS travel merchant examples",note:"Travel-agent checkout paid to Agoda. A pay-at-hotel booking is charged by the hotel and uses the hotel's MCC instead; SGD processed overseas may have extra fees."}),
  merchant("Booking.com", "travel", [4722], travel, {aliases:["Booking", "Booking com"],channels:["online"],sourceTitle:"DCS travel merchant examples",note:"Only a payment charged by the travel agent. Pay-at-property and separately charged activities can differ; use the hotel entry for a hotel-terminal payment."}),
  ...["Expedia", "Hotels.com", "Trip.com", "Klook"].map(name=>merchant(name,"travel",[4722],travel,{channels:["online"],sourceTitle:"DCS travel merchant examples",note:"Travel-agent checkout example. A booking made here but paid directly to the airline/hotel can use the provider's MCC instead."})),
  merchant("Singapore Airlines — direct", "travel", [3075], "https://cardpromotions.hsbc.com.sg/flysq-tnc/", {aliases:["SIA", "SQ", "Singapore Airlines", "SingaporeAir", "SingaporeAir.com"],channels:["online"],sourceTitle:"HSBC Singapore Airlines direct-booking terms",note:"Direct airline website/app example. Other issuers/routes can report 4511; agency bookings differ. Confirm the eligible partner payment route separately for KrisFlyer UOB."}),
  merchant("Scoot — direct", "travel", [4511], "https://suitesmile.com/wp-content/uploads/2025/07/dbs-cards-sia-and-scoot-promo-tnc.pdf", {aliases:["Scoot", "FlyScoot", "Scoot airlines"],channels:["online"],mccConfidence:"Unverified",sourceTitle:"DBS 2025 Scoot terms (archived copy)",note:"Archived issuer terms identify direct Scoot website/app as 4511. This is historical evidence, not current issuer confirmation; agency bookings differ. Confirm the partner route separately."}),
  merchant("AirAsia — direct", "travel", [4511], "https://www.hlb.com.my/content/dam/hlb/my/docs/pdf/Personal/CreditCard/airasia-card/hlb-airasia-credit-card-june-tnc-en.pdf", {aliases:["AirAsia", "Air Asia", "AirAsia flights"],channels:["online"],mccConfidence:"Unverified",sourceTitle:"Hong Leong AirAsia descriptor terms",note:"Issuer example from Malaysia; Singapore card routing remains unconfirmed. AirAsia MOVE hotels, marketplace products and third-party flight bookings can use different MCCs."}),
  merchant("IHG — hotel payment", "travel", [3501,3512,3750,3791,3813,3838,7011], visa, {aliases:["IHG", "IHG One Rewards", "Intercontinental Hotels Group", "IHG hotels"],sourceTitle:"Visa April 2026 hotel brand codes",note:"IHG spans several hotel brands, each with its own code, and individual properties can use 7011. Select the specific brand/property or enter the posted MCC; membership itself is not a merchant."}),
  merchant("Marriott Bonvoy — hotel payment", "travel", [3509,3503,3513,3690,3710,3745,3778,3779,3847,7011], visa, {aliases:["Marriott Bonvoy", "Marriott hotels", "Bonvoy"],sourceTitle:"Visa April 2026 hotel brand codes",note:"Bonvoy covers many hotel brands; this list illustrates common possibilities, not every property. Select the actual brand/property and paid-to merchant. Membership is not a single MCC."}),
  ...([{name:"Marriott",code:3509},{name:"JW Marriott",code:3847},{name:"Sheraton",code:3503},{name:"Westin",code:3513},{name:"Ritz-Carlton",code:3710},{name:"Holiday Inn",code:3501},{name:"InterContinental",code:3512},{name:"Crowne Plaza",code:3750},{name:"Hotel Indigo",code:3813},{name:"Hilton",code:3504}] as const).map(({name,code})=>merchant(`${name} — direct hotel`,"travel",[code,7011],visa,{aliases:[name,`${name} hotel`],sourceTitle:"Visa April 2026 hotel brand codes",note:hotelNote})),
];

/** Human-initiated lookup only: never append merchant, amount or wallet data to URLs. */
export const MERCHANT_LOOKUP_SOURCES = [
  {id:"visa",name:"Visa MCC manual",url:visa,kind:"official",note:"Current network classifications; not a directory of Singapore terminals."},
  {id:"ocbc",name:"OCBC merchant examples",url:retail,kind:"official",note:"Named retailer examples; the acquiring bank decides the posted code."},
  {id:"checkmcc",name:"CheckMCC Singapore",url:"https://www.check-mcc.sg/",kind:"community",note:"Channel-specific merchant reports. Verify with your issuer; card suggestions here are not imported."},
  {id:"meva",name:"MEVA merchant directory",url:"https://meva.sg/merchants",kind:"community",note:"Advertises 8,920 mapped merchants across networks; coverage and verification are the directory's claims."},
  {id:"milelion",name:"MileLion MCC guidance",url:"https://milelion.com/2025/12/23/which-credit-card-covers-the-most-bonus-mccs/",kind:"editorial",note:"Explains channel and payment-route differences. Official card terms decide eligibility."},
  {id:"codes",name:"Public MCC code reference",url:"https://github.com/greggles/mcc-codes",kind:"public-data",note:"Unlicense reference derived from USDA/IRS data; code descriptions, not a merchant directory or current bank rules."},
  {id:"pointspick",name:"PointsPick global merchant reference",url:"https://www.pointspick.com/tools/mcc-lookup",kind:"public-data",note:"6,569 licensed global mappings. Region, channel and card network are unspecified; not confirmed Singapore terminal data."},
  {id:"mccexplorer",name:"MCC Explorer",url:"https://www.mccexplorer.com/",kind:"community",note:"Regional directory and API provider; advanced exports require a provider licence. Counts and verification are provider claims."},
] as const;

function referenceCategory(code: number, providerCategory: string): Category {
  if (code === 5411) return "groceries";
  if ([5541,5542,5552].includes(code)) return "fuel";
  if ([4111,4112,4121,4131,4789].includes(code)) return "transport";
  if ([5811,5812,5813,5814,5462,5499].includes(code)) return "dining";
  if ((code >= 3000 && code < 4000) || [4411,4511,4722,4723,7011,7012].includes(code)) return "travel";
  if ([6010,6011,6012,6050,6051,6211,6540].includes(code)) return "financial";
  if ([6300,6381,6399].includes(code)) return "insurance";
  if (code === 4900) return "utilities";
  if ([8211,8220,8241,8244,8249,8299].includes(code)) return "education";
  if ([9211,9222,9223,9311,9399,9402,9405].includes(code)) return "government";
  return ["retail","software","shopping"].includes(providerCategory) ? "shopping" : "other";
}

const curatedNames = new Set(MERCHANTS.flatMap(entry=>[entry.name,...entry.aliases]).map(normalizeMerchant));
const extended: MerchantEvidence[] = globalMappings.filter(([name])=>!curatedNames.has(normalizeMerchant(name))).map(([name,code,category],index)=>({
  id:`reference-${index}`,name,aliases:[],category:referenceCategory(Number(code),category),mccs:[Number(code)],sourceUrl:"https://www.pointspick.com/tools/mcc-lookup",sourceTitle:"PointsPick global reference (MIT)",lastVerifiedAt:sources.retrievedAt,extended:true,mccConfidence:"Unverified",note:`Global reference updated ${sources.merchants.sourceUpdatedAt}; Singapore location, payment channel and card network are unspecified. Confirm the posted MCC before relying on bonus eligibility.`,
}));
export const EXTENDED_MERCHANT_REFERENCE_COUNT = extended.length;
export const MERCHANT_REFERENCE_COUNT = MERCHANTS.length + extended.length;
const searchIndex = [...MERCHANTS,...extended].map(entry=>({entry,names:[entry.name,...entry.aliases].map(normalizeMerchant)}));

export function normalizeMerchant(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function getMerchant(id: string): MerchantEvidence | undefined {
  return searchIndex.find(result => result.entry.id === id)?.entry;
}

/** Exact names and aliases come first. Never resolve an ambiguous free-text brand automatically. */
export function searchMerchants(query: string, limit = 8): MerchantEvidence[] {
  const needle = normalizeMerchant(query);
  if (!needle) return [];
  return searchIndex.map(({entry,names}) => {
    const score = names.some(name => name === needle) ? 0 : names.some(name => name.startsWith(needle)) ? 1 : names.some(name => name.includes(needle)) ? 2 : needle.split(" ").every(part => names.some(name => name.includes(part))) ? 3 : Infinity;
    return { entry, score };
  }).filter(result => Number.isFinite(result.score)).sort((a,b) => Number(!!a.entry.extended) - Number(!!b.entry.extended) || a.score - b.score || a.entry.name.localeCompare(b.entry.name)).slice(0, Math.max(0, limit)).map(result => result.entry);
}

export function merchantPurchaseHints(entry: MerchantEvidence, channel: Channel, date = singaporeDate(new Date().toISOString())): MerchantPurchaseHints {
  const channelMatches = !entry.channels || entry.channels.includes(channel);
  const mcc = channelMatches && entry.mccs.length === 1 ? entry.mccs[0] : undefined;
  let stale = true;
  try { stale = daysBetween(entry.lastVerifiedAt,date) > 180; } catch { /* Invalid dates cannot increase confidence. */ }
  const channelNote = channelMatches ? entry.note : `${entry.note} The source covers ${entry.channels!.join(" / ")} payments; this channel is unverified.`;
  return { category: entry.category, mcc, mccConfidence: mcc === undefined || stale ? "Unverified" : entry.mccConfidence ?? "Likely", note: stale ? `${channelNote} The source check is over six months old or its date is invalid; recheck the issuer before relying on bonus eligibility.` : channelNote, sourceUrl: entry.sourceUrl, lastVerifiedAt: entry.lastVerifiedAt, ...(entry.excluded ? { excluded: true } : {}) };
}
