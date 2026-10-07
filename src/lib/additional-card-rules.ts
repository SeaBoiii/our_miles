import type { CardRule, CardTemplate, Category, RewardCategory, RuleConditions } from "./domain";

const checked = "2026-10-07";
const ladySource = "https://www.uob.com.sg/assets/pdfs/ladys-cards-tcs.pdf";
const ppvSource = "https://www.uob.com.sg/web-resources/personal/pdf/personal/cards/credit-cards/rewards-cards/uob-preferred-platinum-visa-card/terms-and-conditions-for-preferred-plat-visa.pdf";
const dbsSource = "https://www.dbs.com.sg/iwov-resources/media/pdf/cards/dbs-womans-card-tnc.pdf";
const krisSource = "https://www.uob.com.sg/assets/pdfs/kf_credit_card_full_tnc.pdf";
const excludedCategories: Category[] = ["utilities", "insurance", "education", "government", "financial"];
const uobExcludedMccs = [4829,4900,5199,5960,5965,5993,6012,6050,6051,6211,6300,6513,6529,6530,6534,6540,7349,7511,7523,7995,8062,8211,8220,8241,8244,8249,8299,8398,8661,8651,8699,8999,9211,9222,9223,9311,9402,9405,9399];
const uobConditions: RuleConditions = {
  excludedCategories,
  excludedMccs: uobExcludedMccs,
  excludedMerchantIncludes: ["wallet top-up", "wallet top up", "cash advance", "instalment", "axs", "amaze", "ez-link", "ezlink", "ez link", "flashpay atu", "ipaymy", "rws-levy", "smoove pay", "singpost-sam", "razerpay", "norwds", "oanda", "moneybookers", "skrill", "saxo cap", "igmarkets", "banc de binary", "skyfx", "nets vcashcard", "paypal bizconsulta", "paypal capitalroya"],
};
const dbsConditions: RuleConditions = {
  excludedCategories,
  excludedMccs: [4784,4829,4900,5047,5199,5960,5993,6010,6011,6012,6050,6051,6211,6300,6381,6399,6513,6529,6530,6534,6540,7349,7511,7523,7995,8062,8211,8220,8241,8244,8249,8299,8398,8651,8661,8699,8999,9211,9222,9223,9311,9399,9402,9405],
  excludedMerchantIncludes: ["wallet top-up", "wallet top up", "cash advance", "instalment", "axs", "amaze", "bagus", "cantine", "ezlink", "ez-link", "ez link", "flashpay atu", "fave ecard", "razerpay", "sam payments", "sam online", "sedap", "sgebiz", "singapore e-business", "singtel dash", "shopeepay", "smoovpay", "smoov pay", "smoov pte", "youtrip", "oanda", "coinbase", "bitcoin", "crypto", "saxo cap", "igmarkets"],
};
const dbsOnlineConditions: RuleConditions = {
  ...dbsConditions, channels: ["online"],
  excludedMccs: [...dbsConditions.excludedMccs!, 763,7261,7276,7311,7322,7339,7372,7375,7393,7399,8111,8911,8931],
  excludedMerchantIncludes: [...dbsConditions.excludedMerchantIncludes!, "cardup", "favepay", "ipaymy", "mail order", "telephone order", "online banking"],
};

function researched(id: string, sourceUrl: string, validFrom: string, details: Partial<CardRule> & Pick<CardRule,"label">): CardRule {
  return {id,sourceUrl,validFrom,version:1,lastVerifiedAt:checked,verification:"Confirmed",conditions:{},milesPerDollar:0,cashbackRate:0,fxFeeRate:0.0325,...details};
}
function uob(id: string, source: string, validFrom: string, details: Partial<CardRule> & Pick<CardRule,"label">): CardRule {
  return researched(id,source,validFrom,{conditions:uobConditions,rounding:{blockSgd:5,scope:"transaction"},transferFeeSgd:27,transferBlockMiles:10000,...details});
}

export const REWARD_CATEGORIES: {id: RewardCategory; label: string}[] = [
  {id:"beauty-wellness",label:"Beauty & Wellness"},{id:"dining",label:"Dining"},{id:"entertainment",label:"Entertainment"},{id:"family",label:"Family"},{id:"fashion",label:"Fashion"},{id:"transport",label:"Transport"},{id:"travel",label:"Travel"},
];
const ladyCategories: {id:RewardCategory; categories:Category[]; mccs:number[]; ranges?:[number,number][]}[] = [
  {id:"beauty-wellness",categories:["shopping","other"],mccs:[5912,5977,7230,7231,7298,7297]},
  {id:"dining",categories:["dining"],mccs:[5811,5812,5814,5499]},
  {id:"entertainment",categories:["other"],mccs:[5813,7832,7922]},
  {id:"family",categories:["groceries","shopping"],mccs:[5411,5641]},
  {id:"fashion",categories:["shopping"],mccs:[5311,5611,5621,5631,5651,5655,5661,5691,5699,5948]},
  {id:"transport",categories:["transport","fuel"],mccs:[4111,4121,4789,5541,5542]},
  // Schedule 1 describes airline/hotel main business, not an explicit MCC list.
  {id:"travel",categories:["travel"],mccs:[4511,7011],ranges:[[3000,3299],[3500,3999]]},
];
const ppvConditions: RuleConditions = {...uobConditions,excludedMerchantWords:["shell","spc"]};
const ppvMccs = [4816,5262,5306,5309,5310,5311,5331,5399,5611,5621,5631,5641,5651,5661,5691,5699,5912,5942,5944,5945,5946,5947,5948,5949,5964,5966,5967,5968,5969,5970,5992,5999,5811,5812,5814,5333,5411,5441,5462,5499,8012,9751,7278,7832,7841,7922,7991,7996,7998,7999];
const mobileMethods = ["apple-pay","google-pay","samsung-pay"] as const;

export const ADDITIONAL_CARD_TEMPLATES: CardTemplate[] = [
  {
    id:"uob-ladys",name:"UOB Lady’s Card",issuer:"UOB",accent:"#8b656b",role:"4 mpd · your selected category",
    rules:[
      uob("uob-ladys-base-2025-08",ladySource,"2025-08-01",{label:"Eligible retail base earn",conditions:{...uobConditions,excludedMerchantIncludes:[...uobConditions.excludedMerchantIncludes!,"paypal","youtrip"]},milesPerDollar:0.4}),
      ...ladyCategories.map(({id,categories,mccs,ranges})=>uob(`uob-ladys-${id}-2025-08`,ladySource,"2025-08-01",{
        label:`Selected ${REWARD_CATEGORIES.find(c=>c.id===id)!.label} category`,selectedCategory:id,
        conditions:{...uobConditions,excludedMerchantIncludes:[...uobConditions.excludedMerchantIncludes!,"paypal","youtrip"],categories,mccs,...(ranges?{mccRanges:ranges}:{})},milesPerDollar:4,
        cap:{group:"uob-ladys-bonus",label:"Selected category",spendSgd:1000,period:"calendar-month",usageRounding:"raw"},
        bonusRounding:{unitMiles:18,scope:"period",group:"uob-ladys-bonus"},
        verification:id==="travel"?"Likely":"Confirmed",
        notes:["Bonus points accumulate monthly; complete S$5 bonus blocks are assumed conservatively. Check fractional final blocks against the posted statement.", ...(id==="travel"?["Travel requires a qualifying airline or hotel whose main business is flights or hotel stays. MCC mapping is an estimate; travel agencies are not assumed eligible."]:["Confirm the category already registered with UOB for this calendar quarter. Changing it here does not register a bank selection."])],
      })),
    ],
  },
  {
    id:"dbs-wwmc",name:"DBS Woman’s World Mastercard",issuer:"DBS",accent:"#8c5650",role:"4 mpd · eligible online spend",
    rules:[
      researched("dbs-wwmc-local-base-2025-08",dbsSource,"2025-08-01",{label:"Local retail base earn",conditions:{...dbsConditions,currency:"local"},milesPerDollar:0.4,baseComponents:[{milesPerDollar:0.4,roundingUnitMiles:2}],transferFeeSgd:27.25,transferBlockMiles:10000}),
      researched("dbs-wwmc-foreign-base-2025-08",dbsSource,"2025-08-01",{label:"Foreign retail earn",conditions:{...dbsConditions,currency:"foreign"},milesPerDollar:1.2,baseComponents:[{milesPerDollar:0.4,roundingUnitMiles:2},{milesPerDollar:0.8,roundingUnitMiles:2}],transferFeeSgd:27.25,transferBlockMiles:10000}),
      ...(["local","foreign"] as const).map(currency=>researched(`dbs-wwmc-online-${currency}-2025-08`,dbsSource,"2025-08-01",{
        label:`Eligible ${currency} online spend`,conditions:{...dbsOnlineConditions,currency},milesPerDollar:4,
        cap:{group:"dbs-wwmc-online",label:"Online",spendSgd:1000,period:"calendar-month",usageRounding:"raw"},
        bonusRounding:{unitMiles:2,scope:"period",group:`dbs-wwmc-online-${currency}`},periodDate:"transaction",
        transferFeeSgd:27.25,transferBlockMiles:10000,
        notes:["Online spend must carry Mastercard’s online indicator. Enter the merchant settlement date when reconciling; bonus points post in the next calendar month. Base and foreign points floor per transaction; online bonus points floor separately after monthly accumulation."],
      })),
    ],
  },
  {
    id:"uob-ppv",name:"UOB Preferred Visa (PPV)",issuer:"UOB",accent:"#536975",role:"4 mpd · mobile tap & selected online",
    rules:[
      uob("uob-ppv-base-2025-10",ppvSource,"2025-10-01",{label:"Eligible retail base earn",conditions:{...ppvConditions,excludedMccs:[...uobExcludedMccs,4111]},milesPerDollar:0.4}),
      uob("uob-ppv-simplygo-base-2025-10",ppvSource,"2025-10-01",{label:"SimplyGo accumulated base earn",conditions:{...ppvConditions,mccs:[4111],categories:["transport"]},milesPerDollar:0.4,rounding:{blockSgd:5,scope:"period",group:"uob-ppv-simplygo"}}),
      uob("uob-ppv-online-2025-10",ppvSource,"2025-10-01",{label:"Selected non-recurring online",conditions:{...ppvConditions,channels:["online"],excludeRecurring:true,categories:["online","shopping","dining","groceries","other"],mccs:ppvMccs,mccRanges:[[5732,5735]]},milesPerDollar:4,cap:{group:"uob-ppv-online",label:"Online",spendSgd:600,period:"calendar-month"}}),
      uob("uob-ppv-mobile-2025-10",ppvSource,"2025-10-01",{label:"Mobile contactless at a physical reader",conditions:{...ppvConditions,channels:["contactless"],paymentMethods:[...mobileMethods],excludedMccs:[...uobExcludedMccs,4111]},milesPerDollar:4,cap:{group:"uob-ppv-mobile",label:"Mobile contactless",spendSgd:600,period:"calendar-month"},notes:["A physical card tap does not qualify. In-app wallet purchases count as online, not mobile contactless."]}),
      uob("uob-ppv-simplygo-2025-10",ppvSource,"2025-10-01",{label:"Mobile SimplyGo monthly spend",conditions:{...ppvConditions,channels:["contactless"],paymentMethods:[...mobileMethods],mccs:[4111],categories:["transport"]},milesPerDollar:4,cap:{group:"uob-ppv-mobile",label:"Mobile contactless",spendSgd:600,period:"calendar-month"},rounding:{blockSgd:5,scope:"period",group:"uob-ppv-simplygo"},notes:["SimplyGo shares the mobile cap and accumulates monthly. Physical-card SimplyGo has conflicting official descriptions; bonus is withheld conservatively."]}),
    ],
  },
  {
    id:"uob-krisflyer",name:"KrisFlyer UOB Credit Card",issuer:"UOB",accent:"#766952",role:"3 mpd · airline group & travel partners",
    rules: krisFlyerRules(),
  },
];

function krisFlyerRules(): CardRule[] {
  const conditions: RuleConditions = {...uobConditions,excludedMccs:[...uobExcludedMccs,6399,8011,8099],excludedMerchantWords:["spc"],excludedMerchantIncludes:[...uobConditions.excludedMerchantIncludes!,"uob$","youtrip"]};
  const annualQualification: NonNullable<CardRule["annualQualification"]> = {amountSgd:1000,conditions:{...conditions,rewardPartners:["singapore-airlines","scoot","krisshop"]}};
  const deferred = ["1.2 additional mpd is deferred until the month after your membership year ends, subject to the S$1,000 Singapore Airlines/Scoot/KrisShop condition. Kris+ and Pelago do not meet that condition.","Confirm bank online indicators and platform descriptors. UOB$ merchants do not earn miles; mark such purchases excluded."];
  const accelerated = (id:string,label:string,extra:RuleConditions)=>uob(`uob-krisflyer-${id}-2025-06`,krisSource,"2025-06-01",{label,conditions:{...conditions,...extra},milesPerDollar:2.4,annualQualification,transferFeeSgd:0,notes:deferred});
  return [
    uob("uob-krisflyer-base-2025-06",krisSource,"2025-06-01",{label:"Eligible retail base earn",conditions,milesPerDollar:1.2,transferFeeSgd:0,notes:["Miles credit directly to the principal cardholder’s linked KrisFlyer account; no points conversion fee."]}),
    uob("uob-krisflyer-partner-2025-06",krisSource,"2025-06-01",{label:"Confirmed airline group, Kris+ or Pelago",conditions:{...conditions,rewardPartners:["singapore-airlines","scoot","krisshop","krisplus","pelago"]},milesPerDollar:3,transferFeeSgd:0,notes:["Confirm payment through the eligible partner path. Merchant/app promotional miles are separate and are not added to the bank’s 3 mpd."]}),
    accelerated("dining","Eligible dining",{categories:["dining"],mccs:[5812,5813,5814]}),
    accelerated("rides","Taxi, ride-hailing or eligible delivery",{categories:["transport","dining"],mccs:[4121]}),
    accelerated("transit","Bus/MRT descriptor",{merchantIncludes:["bus/mrt"],categories:["transport"]}),
    accelerated("delivery","Specified food-delivery descriptions",{merchantIncludes:["deliveroo","delivery hero","foodpanda"],categories:["dining"]}),
    accelerated("online-shopping","Selected online shopping",{channels:["online"],categories:["online","shopping"],mccs:[4816,5262,5306,5309,5310,5311,5331,5399,5611,5621,5631,5641,5651,5661,5691,5699,5732,5733,5735,5912,5942,5944,5945,5946,5947,5948,5949,5999]}),
    accelerated("marketplace","Selected marketplace under MCC7278",{channels:["online"],categories:["online","shopping"],mccs:[7278],merchantIncludes:["shopee","lazada","qoo10"]}),
    accelerated("online-travel","Specified travel platform online",{channels:["online"],categories:["travel"],merchantIncludes:["agoda","airbnb","booking.com","expedia","hotels.com","kaligo","traveloka","trip.com"]}),
  ];
}
