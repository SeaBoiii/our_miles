/** Published card knowledge only. Personal eligibility is never inferred here. */
export type BenefitStatus = "Confirmed" | "Conditional" | "Unverified";
export interface BenefitSource { label: string; url: string }
export interface CardBenefit {
  title: string;
  detail: string;
  status: BenefitStatus;
  sources: BenefitSource[];
  validFrom?: string;
  /** Inclusive Singapore calendar date. */
  validUntil?: string;
}
export interface CardBenefitSection {
  id: "earning" | "caps" | "exclusions" | "fees" | "transfers" | "perks" | "promotions";
  title: string;
  items: CardBenefit[];
}
export interface CardBenefits {
  verifiedAt: string;
  summary: string;
  sections: CardBenefitSection[];
  caveats: string[];
}

const checked = "2026-10-07";
const source = (label: string, url: string): BenefitSource => ({ label, url });
const fact = (title: string, detail: string, sources: BenefitSource[], status: BenefitStatus = "Confirmed", dates: { validFrom?: string; validUntil?: string } = {}): CardBenefit => ({ title, detail, sources, status, ...dates });
const section = (id: CardBenefitSection["id"], title: string, items: CardBenefit[]): CardBenefitSection => ({ id, title, items });

const uobFees = source("UOB fees", "https://www.uob.com.sg/personal/cards/credit-cards/terms-and-conditions.page");
const uobRewards = source("UOB Rewards terms", "https://www.uob.com.sg/assets/pdfs/personal/cards/rewardsplus_tnc.pdf");
const uobMiles = source("UOB miles conversion", "https://forms.uob.com.sg/personal/cards/rewards/miles.html");
const uobNotices = source("UOB notices", "https://www.uob.com.sg/personal/cards/news-and-announcements.page");
const uobWaiver = source("Fee waiver eligibility", "https://www.uob.com.sg/personal/cards/services/card-fee-waiver.page");
const uobInsurance = source("Travel insurance certificate", "https://www.uob.com.sg/assets/pdfs/certificate-of-insurance-group-2-opt-in.pdf");
const uobOptIn = source("Activate travel cover", "https://forms.uob.com.sg/personal/cards/privileges/travelinsurance.html");
const ladyTerms = source("Lady’s Card terms", "https://www.uob.com.sg/assets/pdfs/ladys-cards-tcs.pdf");
const ladyFaq = source("Lady’s Card FAQ", "https://www.uob.com.sg/assets/pdfs/faqs-final.pdf");
const ladyProduct = source("Lady’s Card benefits", "https://www.uob.com.sg/personal/cards/rewards/ladys-card/index.page");
const ppvTerms = source("Preferred Visa terms", "https://www.uob.com.sg/web-resources/personal/pdf/personal/cards/credit-cards/rewards-cards/uob-preferred-platinum-visa-card/terms-and-conditions-for-preferred-plat-visa.pdf");
const ppvProduct = source("Preferred Visa benefits", "https://www.uob.com.sg/personal/cards/rewards/preferred-visa-card.page");
const krisTerms = source("KrisFlyer UOB terms", "https://www.uob.com.sg/assets/pdfs/kf_credit_card_full_tnc.pdf");
const krisProduct = source("KrisFlyer UOB benefits", "https://www.uob.com.sg/personal/cards/travel/krisflyer-card.page");
const dbsTerms = source("Woman’s World terms", "https://www.dbs.com.sg/iwov-resources/media/pdf/cards/dbs-womans-card-tnc.pdf");
const dbsProduct = source("Woman’s World benefits", "https://www.dbs.com.sg/personal/cards/credit-cards/dbs-woman-mastercard-card");
const dbsRewards = source("DBS Rewards terms", "https://www.dbs.com.sg/iwov-resources/pdf/cards/rewards_programme_tnc.pdf");
const mayTerms = source("XL Rewards terms", "https://www.maybank2u.com.sg/iwov-resources/sg/pdf/cards/xl-privileges-tp-tnc.pdf");
const mayProduct = source("XL Rewards benefits", "https://www.maybank2u.com.sg/en/personal/cards/credit/maybank-xl-card.page");
const mayRewards = source("TREATS terms", "https://www.maybank2u.com.sg/iwov-resources/sg/pdf/cards/terms_and_conditions.pdf");
const mayCatalogue = source("TREATS catalogue", "https://www.maybank2u.com.sg/en/personal/cards/rewards/catalogue.page");

const uobFx = fact("Foreign payments", "Foreign-currency administration fee is 3.25%. SGD processed overseas attracts 1% instead; the merchant’s DCC exchange spread is separate. A linked FX+ debit account does not remove credit-card fees.", [uobFees]);
const uobTransfer = section("transfers", "Points & miles", [
  fact("Convert UNI$ to airline miles", "5,000 UNI$ → 10,000 KrisFlyer or Asia Miles. S$27 per conversion, effective 15 December 2025. Same person’s eligible UOB points can pool; Aleem’s and Nurul’s points cannot pool through this facility. Transfer processing can take five working days for KrisFlyer and fourteen for Asia Miles.", [uobMiles, uobNotices]),
  fact("Points expire by quarter", "UNI$ expire two years after the last day of the quarter in which they were earned. Check the bank’s expiry statement. Ordinary KrisFlyer auto-conversion ended 20 May 2026; this does not affect direct co-brand KrisFlyer credits.", [uobRewards, uobNotices]),
]);
const uobFee = (name: string, product: BenefitSource) => section("fees", "Fees & waivers", [
  fact("Annual fee", `${name}: principal S$196.20 including GST; published first-year waiver. First supplementary card is free; later cards S$98.10. Existing-card cash fee waiver requires the applicable bank conditions.`, [product, uobFees]),
  fact("Request a qualifying waiver", "With multiple UOB cards, published waiver routes require S$5,500 on the card charged the fee, S$22,000 across UOB cards, or S$3,000 overseas across UOB cards within the first eleven months from the previous card anniversary. Request through UOB for a current unbilled fee or one in the past three statements; bank approval applies. Do not spend just to qualify.", [uobWaiver], "Conditional"),
  uobFx,
]);

export const CARD_BENEFITS: Record<string, CardBenefits> = {
  "uob-ladys": {
    verifiedAt: checked,
    summary: "4 mpd in the one category already selected with UOB; S$1,000 monthly capacity.",
    sections: [
      section("earning", "Earn & setup", [
        fact("Choose the bank’s actual category", "Standard Lady’s has one category: Beauty & Wellness, Dining, Entertainment, Family, Fashion, Transport or Travel. Earn 4 mpd in that registered category, otherwise 0.4 mpd. No monthly minimum. ‘Miles’ describes the reward, not a spending category. An app selection does not register a choice with UOB.", [ladyTerms, ladyFaq], "Conditional"),
        fact("When selections take effect", "Initial enrolment starts on its actual enrolment date. Later category changes start next calendar quarter; unchanged selections carry forward. Travel means qualifying airlines/hotels whose main business is flights/stays, not every travel agency or marketplace.", [ladyTerms, ladyFaq]),
      ]),
      section("caps", "Caps & timing", [
        fact("S$1,000 each calendar month", "Standard card cap is 1,800 bonus UNI$, equivalent to S$1,000 selected-category spend; base 0.4 mpd continues beyond it. Principal and supplementary spending share the principal account. Posting date assigns usage; bonus arrives by the following month’s end.", [ladyTerms, ladyFaq]),
        fact("Base and bonus round differently", "Base rounds per purchase; selected-category bonus accumulates monthly. Opening eligible spend matters. The bank’s worked example does not fully resolve fractional final S$5 blocks, so estimates remain conservative until reconciled to a statement.", [source("Savings rewards FAQ", "https://www.uob.com.sg/assets/pdfs/lsa-faq.pdf")], "Unverified"),
      ]),
      section("exclusions", "What does not earn", [
        fact("Check both MCC and merchant", "Financial/funding, wallet top-ups, insurance, utilities, education, government, hospitals, charities, parking, cash, fees and instalments are excluded. The bank’s detailed schedule also excludes AMAZE*, PAYPAL* and NORWDS*. Selected-category labels alone cannot confirm the MCC.", [ladyTerms]),
      ]),
      uobFee("Standard Lady’s", ladyProduct),
      uobTransfer,
      section("perks", "Other benefits", [
        fact("Lady’s Savings pairing", "A separately owned qualifying Lady’s Savings account can add nominal 2/4/6 mpd at confirmed monthly-average balances of S$10,000/S$50,000/S$100,000, subject to the same selected-category limits and principal/primary-holder conditions. No deposit account is assumed.", [source("Account bonus terms", "https://www.uob.com.sg/assets/web-resources/personal/pdf/highlights/solutions/for-the-ladies/unstoppable-duo-promo.pdf")], "Conditional"),
        fact("Birthday and Mastercard offers", "Birthday merchant treats, UOB Rewards+/UOB$ and advertised Mastercard e-commerce protection each have separate terms. Standard Lady’s does not have the complimentary travel medical cover advertised for Solitaire/Metal. No free lounge visits are established.", [ladyProduct, source("Birthday treats", "https://www.uob.com.sg/personal/cards/rewards/ladys-card/ladys-birthdays.page")], "Conditional"),
      ]),
    ],
    caveats: ["Confirm Nurul’s registered category and initial effective date.", "Do not apply Solitaire’s two-category limits or assume Lady’s Savings ownership.", "Bank MCC, posting date and opening spend can change the estimate."],
  },
  "uob-ppv": {
    verifiedAt: checked,
    summary: "4 mpd on eligible mobile taps and selected online purchases, with separate S$600 monthly caps.",
    sections: [
      section("earning", "Earn & setup", [
        fact("Use a mobile device at the reader", "4 mpd on eligible in-person Apple Pay, Google Pay or Samsung Pay taps at a physical Visa payWave reader. An ordinary physical-card tap does not qualify for this bonus. In-app wallet payments are online transactions instead.", [ppvTerms]),
        fact("Selected online purchases", "4 mpd on the listed shopping, groceries/dining, entertainment and ticketing MCCs, excluding recurring arrangements. Online travel is not a general bonus category. Other eligible retail earns 0.4 mpd; no ordinary minimum-spend requirement.", [ppvTerms]),
      ]),
      section("caps", "Caps & timing", [
        fact("Two separate S$600 caps", "Since 1 October 2025, selected online and mobile contactless each have 1,080 bonus UNI$ per calendar month, equivalent to S$600 qualifying spend in complete S$5 blocks. Capacity cannot move between buckets. Posting dates and principal/supplementary sharing matter.", [ppvTerms]),
        fact("SimplyGo shares the mobile cap", "SimplyGo’s monthly accumulated spend can receive 10X from 28 August 2025, credited on the following month’s seventh day. Use a supported mobile wallet. Official wording also defines physical-card SimplyGo, so this app withholds physical-card bonus conservatively pending statement confirmation.", [ppvTerms, ppvProduct], "Unverified"),
      ]),
      section("exclusions", "What does not earn", [
        fact("Issuer exclusions", "Shell and SPC transactions, recurring online purchases for online bonus, AMAZE, wallet/payment-service top-ups, bills, insurance, utilities, education, government, hospitals, charities, funding, fees and instalments are excluded as specified in the bank schedule. Do not treat an eligible merchant label as a confirmed MCC.", [ppvTerms]),
      ]),
      uobFee("Preferred Visa", ppvProduct),
      uobTransfer,
      section("perks", "Other benefits", [
        fact("Opt-in travel cover", "Available from 10 March 2026, including holders of the old PPV card design. Activate and receive confirmation before departure and satisfy full-fare payment requirements. Published cover includes up to S$500,000 public-conveyance accident, S$50,000 emergency assistance, limited delays and S$5,000 card liability; the certificate governs. This is not comprehensive medical-expense insurance.", [source("Rename and benefits FAQ", "https://www.uob.com.sg/assets/web-resources/personal/pdf/preferred-visa-card-faq.pdf"), uobInsurance, uobOptIn], "Conditional", {validFrom: "2026-03-10"}),
        fact("UOB$ and merchant privileges", "Participating merchants can offer UOB$ cashback and Rewards+ deals. Merchant, payment, redemption and current offer conditions apply. Do not assume permanent discounts, free lounge visits or an acquisition gift from card ownership.", [ppvProduct], "Conditional"),
      ]),
    ],
    caveats: ["Formerly Preferred Platinum Visa; the rename does not create a new account.", "Separate online/mobile capacities, recurring status and payment method are essential.", "Physical-card SimplyGo bonus remains unconfirmed in the app."],
  },
  "uob-krisflyer": {
    verifiedAt: checked,
    summary: "3 mpd with confirmed airline-group/Kris+/Pelago paths; 2.4 mpd accelerator is conditional and deferred.",
    sections: [
      section("earning", "Earn & setup", [
        fact("Confirmed partner purchases", "3 mpd on eligible direct Singapore Airlines, Scoot, KrisShop, Kris+ and Pelago paths. Ordinary eligible retail earns 1.2 mpd. Merchant/app bonus miles are separate from these bank rates; no ordinary earn cap is stated.", [krisTerms, krisProduct]),
        fact("Annual accelerator condition", "Eligible dining, selected online shopping/travel and transport earn 1.2 base plus 1.2 deferred mpd only with S$1,000 qualifying Singapore Airlines/Scoot/KrisShop spend in the membership year. Kris+ and Pelago do not satisfy that threshold. Until qualification is known/achieved, the app ranks base only.", [krisTerms, krisProduct], "Conditional"),
      ]),
      section("caps", "Qualification & timing", [
        fact("Confirm the approval month", "Membership year is twelve full calendar months beginning with approval month. Deferred bonus credits in the month after year end. The threshold rose from S$800 to S$1,000 for years ending November 2025 onward; extra accelerator fell from 1.8 to 1.2 mpd for postings from 1 June 2025.", [krisTerms, krisProduct]),
        fact("Complete S$5 blocks", "Each purchase rounds to complete S$5 blocks. Principal and supplementary spend credit to the principal’s linked KrisFlyer account. Opening annual airline-group spend is needed; bonus should not be chased with unwanted purchases.", [krisTerms]),
      ]),
      section("exclusions", "What does not earn", [
        fact("Issuer and platform restrictions", "UOB$ merchants, SPC, AMAZE, funding/prepaid, fees, instalments and the bank’s institutional/MCC schedule are excluded. Online accelerator requires selected MCCs or named travel-platform descriptors; not every online purchase or travel merchant qualifies. Some PayPal delivery/travel descriptors are explicitly eligible, so no blanket PayPal exclusion.", [krisTerms]),
      ]),
      uobFee("KrisFlyer UOB Credit", krisProduct),
      section("transfers", "Miles & renewal", [
        fact("Direct credit, no conversion fee", "Bank miles credit monthly to the principal’s own linked KrisFlyer account. There is no UNI$ conversion charge for this co-brand flow. Ordinary KrisFlyer Basic/Silver/Gold miles expire at the equivalent month-end three years after credit; PPS rules differ.", [krisTerms, source("KrisFlyer conditions", "https://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/termsconditions-kf/")]),
        fact("10,000 renewal miles", "Full annual renewal fee payment can earn 10,000 KrisFlyer miles within three months. Miles can be reversed if the fee is later waived. Compare the fee with the value you actually expect; no renewal fee payment is assumed.", [krisTerms], "Conditional"),
      ]),
      section("perks", "Travel & account benefits", [
        fact("Scoot booking benefits", "Book through flyscoot.com/KrisFlyerUOB, pay with the principal card and include that cardholder in the booking. BoardMeFirst and eligible seats apply to the party; principal +5kg requires at least 20kg baggage purchased initially at least 24 hours before departure. Later baggage add-ons are ineligible.", [source("Scoot benefit terms", "https://www.uob.com.sg/assets/web-resources/personal/pdf/cards/travel/revisions-to-krisflyer-uob-credit-and-debit-card-privileges-for-scoot.pdf")], "Conditional"),
        fact("Opt-in travel cover", "Activate and receive confirmation before departure; pay the required full fare on the card. The operative certificate includes limited public-conveyance accident, emergency assistance/evacuation, delay/misconnection and card-liability cover. It does not establish ordinary overseas physician/medical bills coverage or free lounge access.", [uobInsurance, uobOptIn], "Conditional"),
        fact("Separate deposit-account bonuses", "An owned qualifying KrisFlyer UOB deposit account can add up to 6 mpd under deposit, salary and balance-based caps. It is not an automatic credit-card benefit. No deposit ownership or movement of funds is assumed.", [source("KrisFlyer UOB Account", "https://www.uob.com.sg/personal/save/everyday-accounts/krisflyer-uob-account.page")], "Conditional"),
      ]),
      section("promotions", "Current conditional offers", [
        fact("KrisShop S$30 off", "KFUOBSG30 on eligible regular-price S$180 nett purchases, once per calendar year. Merchant restrictions and direct card payment apply.", [krisTerms], "Conditional", {validFrom:"2026-07-01",validUntil:"2026-12-31"}),
        fact("KrisShop merchant miles", "Eligible enrolled KrisShopper purchases can add 2 merchant mpd to the bank’s 3 mpd. Merchant points and eligibility are separate; do not inflate ordinary bank rewards.", [krisTerms], "Conditional", {validUntil:"2026-12-31"}),
        fact("Pelago additional 600 miles", "Eligible completed activities totalling S$300 per calendar month. Extra promotion requires direct card details; Apple/Google Pay is excluded for this extra, although ordinary bank earn has separate terms.", [krisTerms], "Conditional", {validFrom:"2026-07-01",validUntil:"2026-12-31"}),
        fact("Grab airport rides and ChangiWiFi", "KFUOBCC: S$15 off an eligible Changi ride once each half-year, first 1,000 monthly, card primary payment. ChangiWiFi S$10 e-code is SMS-issued, first 1,000 monthly, and expires by year end. Check previous usage and availability.", [krisTerms], "Conditional", {validUntil:"2026-12-31"}),
      ]),
    ],
    caveats: ["Confirm approval month and qualifying annual opening spend.", "First-year welcome miles and once-in-lifetime Elite Silver acceleration are not recurring benefits.", "The KrisShop tier upgrade ended 1 July 2026; expired acquisition offers are omitted."],
  },
  "dbs-wwmc": {
    verifiedAt: checked,
    summary: "4 mpd on eligible online spend up to S$1,000 per calendar month; no minimum spend.",
    sections: [
      section("earning", "Earn & eligibility", [
        fact("Online, local and foreign rates", "4 mpd on eligible online purchases; 1.2 mpd on eligible foreign-currency retail and 0.4 mpd on other eligible retail. No minimum-spend hurdle. Bank online indicators determine eligibility; app/Internet labels alone do not confirm it. Online and foreign earn do not stack above 4 mpd.", [dbsTerms, dbsProduct]),
      ]),
      section("caps", "Caps & timing", [
        fact("Shared S$1,000 online cap", "Local and foreign online purchases share the first S$1,000 qualifying gross online spend each calendar month. Principal/supplementary spend combines. Excess returns to 0.4 mpd locally or 1.2 mpd in foreign currency. This cap has applied since 1 August 2025.", [dbsTerms]),
        fact("Bank component rounding", "Base and extra foreign points floor separately per purchase; local and foreign online bonus points floor separately after monthly accumulation. Online bonus arrives by the following month’s end. Exact marginal miles need the prior local/foreign online totals, not just cap remaining.", [dbsTerms]),
        fact("Which calendar month?", "The bank uses merchant/acquirer settlement transaction date, subject to timezone, with successful posting by computation. Receipt date and posting-month can differ. Earlier online caps were S$2,000 before 1 March 2024 and S$1,500 until 31 July 2025.", [dbsTerms, source("DBS notices", "https://www.dbs.com.sg/personal/cards/cards-news-announcements.page")]),
      ]),
      section("exclusions", "What does not earn", [
        fact("Base and online schedules differ", "All-reward exclusions include insurance, utilities, education, government, financial/funding, wallets/crypto, charities, specified hospitals/parking, bills, fees and instalments. Online bonus has additional MCC and merchant exclusions, including CardUp, ipaymy and FavePay. An online-only exclusion can still retain otherwise eligible base rewards.", [dbsRewards, dbsTerms]),
      ]),
      section("fees", "Fees & waivers", [
        fact("Annual fee and revised waiver", "Principal S$196.20; supplementary S$98.10, including GST. First year waived. Automatic next-year waiver for S$25,000 previous-card-year retail spend ceased on 1 August 2026. Any further discretionary waiver must be confirmed with DBS.", [dbsProduct]),
        fact("Foreign payments", "Foreign-currency fees total 3.25%. SGD processed overseas/DCC attracts 1% instead, plus any merchant DCC exchange spread. SGD is not foreign currency for the 1.2 mpd condition; eligible online SGD can still receive online bonus.", [source("DBS credit-card fees", "https://www.dbs.com.sg/personal/cards/cards-rates-fees.page")]),
      ]),
      section("transfers", "Points & miles", [
        fact("Convert DBS Points", "5,000 points → 10,000 KrisFlyer or Asia Miles; 500 → 1,500 AirAsia points. S$27.25 including GST per conversion. First transfer can take fourteen working days, later ones ten. Points can pool across the same person’s DBS cards, not across different people.", [dbsProduct, dbsRewards, source("DBS Rewards", "https://www.dbs.com.sg/personal/cards/rewards/card-rewards")]),
        fact("Short points validity", "First-year points expire within twelve months of account opening; points earned in succeeding years expire one year after earning. Check statement expiry. WWMC points are not non-expiring and its eligibility for premium-card auto-conversion is not established.", [dbsRewards]),
      ]),
      section("perks", "Protection & privileges", [
        fact("E-commerce protection: confirm policy", "DBS advertises it, but its linked offer was unavailable during verification. Current Mastercard Singapore World terms specify participating issuers and US$200 per occurrence/annual aggregate for qualifying physical goods, full card payment, tracked delivery to Singapore and unresolved seller remedies. Many exclusions apply. Confirm your policy before treating a purchase as insured.", [dbsProduct, source("Current Mastercard policy", "https://specials.priceless.com/mastercard/images/6d5f1de2-f362-4e12-8bd2-b5e666eb14bc.pdf")], "Unverified"),
        fact("Mastercard and DBS privileges", "Mastercard Priceless and DBS merchant offers have individual conditions. No complimentary WWMC lounge visits or comprehensive travel insurance were established. Vouchers, cash credits and eligible fee redemption are alternatives to miles, with catalogue-specific values.", [dbsProduct, dbsRewards], "Conditional"),
      ]),
      section("promotions", "Current conditional offers", [
        fact("Agoda World Mastercard", "12% off, capped US$45, on coupon-eligible accommodation via the dedicated Mastercard page; stays through 30 June 2027. Detailed terms say minimum US$200 while the card page says S$200: confirm checkout using the stricter US$200 condition.", [source("Agoda offer terms", "https://www.dbs.com.sg/personal/promotion/card-privileges-ylagoda2"), dbsProduct], "Unverified", {validFrom:"2026-04-01",validUntil:"2027-03-31"}),
        fact("Agoda October offer", "20%, capped S$50, through the dedicated DBS page. Eligible properties and checkout restrictions apply; stays through 30 June 2027. Do not stack with other Agoda offers.", [source("Agoda offer terms", "https://www.dbs.com.sg/personal/promotion/card-privileges-ylagoda2")], "Conditional", {validFrom:"2026-10-01",validUntil:"2026-10-31"}),
        fact("Agoda Shiok Sundays", "50%, capped S$100, minimum S$200, limited weekly Sunday codes and eligible properties through the dedicated Sunday page. Stays through 30 June 2027. Availability is not guaranteed; do not stack discounts.", [source("Agoda offer terms", "https://www.dbs.com.sg/personal/promotion/card-privileges-ylagoda2")], "Conditional", {validFrom:"2026-01-25",validUntil:"2026-12-27"}),
        fact("Hotel dining", "WWMC up to 20% at Landing Point, Town, Jade and Courtyard; 15% at Colony/Ritz Lounge on eligible menus/days. Reservations, blackouts, service-charge/GST exclusions and non-stacking conditions apply.", [dbsProduct, source("Colony terms", "https://www.dbs.com.sg/personal/promotion/card-privileges-ritzcolony"), source("Landing Point terms", "https://www.dbs.com.sg/personal/promotion/card-privileges-thelandingpoint"), source("Ritz Lounge terms", "https://www.dbs.com.sg/personal/promotion/card-privileges-ritzlounge")], "Conditional", {validUntil:"2026-12-30"}),
        fact("Ferns N Petals and LUMOS", "DBSFNP17 gives 17% on fnp.sg, one code per checkout. DBSLUMOS55OFF gives S$55 for a LUMOS cart of S$200 or more, first 1,000 redemptions. Neither code stacks with other offers; check availability.", [source("Ferns N Petals terms", "https://www.dbs.com.sg/personal/promotion/cards-privileges-fnp"), source("LUMOS terms", "https://www.dbs.com.sg/personal/promotion/cards-privileges-lumos")], "Conditional", {validUntil:"2026-12-31"}),
      ]),
    ],
    caveats: ["This is Woman’s World Mastercard, not the lower-earning ordinary Woman’s Card.", "Confirm bank settlement dates, online indicator and opening local/foreign bonus totals.", "Personal fee-waiver, insurance and promotion eligibility are not assumed."],
  },
  "maybank-xl": {
    verifiedAt: checked,
    summary: "4 mpd on selected local categories and foreign retail, with S$500 monthly eligible spend.",
    sections: [
      section("earning", "Earn & eligibility", [
        fact("Selected MCCs, not all online spend", "4 mpd on eligible local Dine/Shop/Travel/Play MCCs and foreign-currency retail, after S$500 aggregate eligible retail that calendar month. Other eligible purchases and months below the minimum earn 0.4 mpd. Principal/supplementary spend combines.", [mayTerms, mayProduct], "Conditional"),
        fact("Etiqa insurance exception", "MCC6300 with ETIQA* description can earn base 0.4 mpd, but no 10X and no contribution toward the S$500 minimum. Other insurance remains excluded. Confirm the actual bank descriptor.", [mayTerms]),
      ]),
      section("caps", "Caps & timing", [
        fact("Standard 10,000-TREATS cap", "The monthly cap is 10,000 TREATS at the total 10X rate, equivalent to S$1,000 qualifying spend rounded in S$5 purchase blocks. Above it, base continues. The S$1,000 equivalent is derived from the official rate/conversion; do not add base again to show 4.4 mpd.", [mayTerms, mayRewards, mayCatalogue]),
        fact("Posting and minimum spend", "Points round down per purchase to complete S$5 blocks and arrive by the following month’s end. For minimum-spend attribution, purchases posted by the tenth of the next month count in the original month; later postings count toward the following month. The same grace rule for cap attribution is not explicit.", [mayTerms]),
      ]),
      section("exclusions", "What does not earn", [
        fact("Issuer exclusions", "NETS/eNETS, AXS/SAM, funding, prepaid wallets, Instarem, corporate spend, fees, instalments, government, utilities, insurance except the specific Etiqa base exception, financial/crypto, charities and the detailed current MCC schedule are excluded. Online checkout does not override these exclusions.", [mayTerms, mayRewards]),
      ]),
      section("fees", "Fees & waivers", [
        fact("Annual fee", "Principal S$87.20 including GST; first two years waived. Thereafter automatic waiver requires S$6,000 annual spend. Supplementary cards are free. Confirm the actual card year before estimating a waiver.", [mayProduct]),
        fact("Foreign payments", "Bank 2.25% plus network up to 1%: up to 3.25% total. SGD processed overseas/DCC attracts up to 1% instead, plus the merchant’s exchange spread. DCC SGD does not meet the foreign-currency bonus condition.", [source("Maybank credit-card fees", "https://www.maybank2u.com.sg/en/bank-charges/cc/credit-cards.page")]),
      ]),
      section("transfers", "Points & miles", [
        fact("Convert TREATS", "25,000 TREATS → 10,000 KrisFlyer; 12,500 → 5,000 Asia Miles or Enrich; 4,000 → 2,000 AirAsia points. S$27.25 including GST per conversion, to the same cardmember’s own airline account. Transfers take seven–fourteen working days, KrisFlyer up to fifteen.", [mayCatalogue, mayRewards]),
        fact("Expiry and Rewards Infinite", "Ordinary TREATS expire one year from their earning quarter; check the statement/app. Conditional Rewards Infinite membership requires S$24,000 eligible spending over the previous twelve months across named cards and can remove expiry while active. Do not assume membership or guarantee rollover after termination.", [mayRewards, mayCatalogue], "Conditional"),
      ]),
      section("perks", "Travel & other benefits", [
        fact("Travel accident and inconvenience", "Full travel/tour fare on XL can qualify cardholder, spouse and dependent children under 23. Published XL tier includes up to S$500,000 public-transport accident death/disability, S$400 missed connection, S$400 baggage delay and S$1,000 baggage loss. Timing, eligible expenses and exclusions apply; this is not comprehensive medical/cancellation insurance.", [source("XL travel coverage", "https://www.maybank2u.com.sg/en/personal/cards/card-services/complimentary-travel-insurance.page"), source("Insurance certificate", "https://www.maybank2u.com.sg/iwov-resources/sg/pdf/cards/certificate-insurance.pdf")], "Conditional"),
        fact("TripXpLorer Protect", "Conditional first-year leisure/adventure medical cover up to S$5,000 for eligible new XL holders aged 21–39 among the first 15,000 approved. One year from first approval, no auto-renewal; medical bills must be paid with XL. Check the actual insurer policy; card ownership alone does not establish cover.", [mayProduct, source("Insurer conditions", "https://www.etiqa.com.sg/privileges/maybank/trip-xlporer-protect")], "Conditional"),
        fact("SaveUp and merchant offers", "With a separate qualifying SaveUp account, S$500 eligible monthly card spend can count as one linked product. Other products/balance tiers determine interest; card ownership alone does not earn the advertised maximum. Maybank dining, lifestyle and regional deals have individual conditions.", [source("SaveUp conditions", "https://www.maybank2u.com.sg/en/personal/saveup/save-up-programme.page"), source("Maybank offers", "https://cardspromo.maybank2u.com.sg/")], "Conditional"),
      ]),
      section("promotions", "Current conditional offers", [
        fact("New-card higher cap: confirm approval", "Qualified new XL Rewards approvals July–September 2026 can receive 15,000 total 10X TREATS/month with S$500 minimum. July approval ends 31 October, August 30 November, September 31 December. Existing prior XL/cancellation restrictions apply; the approval window has closed and Nurul’s eligibility is unknown.", [source("Higher-cap promotion terms", "https://www.maybank2u.com.sg/iwov-resources/sg/pdf/cards/xl-rewards-new-tnc.pdf")], "Conditional", {validFrom:"2026-07-01",validUntil:"2026-12-31"}),
        fact("Luggage charge-and-redeem", "TREATS registration before eligible spending; specific categories/foreign retail. Limited gifts at S$3,500/S$5,500/S$18,500 spend, one redemption/person, posted by 7 November. Registration does not guarantee a gift. Spending cannot also satisfy the KLIA campaign. Only intended natural spending should count.", [source("Luggage full terms", "https://www.maybank2u.com.sg/iwov-resources/sg/pdf/promos/holiday-tnc.pdf")], "Conditional", {validFrom:"2026-09-01",validUntil:"2026-10-31"}),
        fact("Subang lounge promotion", "Skylounge/Skylounge Xpress: S$1,000 eligible retail during the prior month, principal only, one two-hour visit per month, subject to excluded categories and availability. This is a dated Malaysia offer, not permanent worldwide lounge access.", [source("Subang lounge terms", "https://cardspromo.maybank2u.com.sg/promotions/exclusive-access-to-skylounge-and-skylounge-xpress-at-subang-airport")], "Conditional", {validFrom:"2026-08-18",validUntil:"2026-11-30"}),
        fact("KLIA Ekspres VIP: confirm dates", "Prior calendar-month S$2,000/S$3,000 eligible spend and issuer booking verification. Published period extends to 31 January 2027 but booking/use clauses stop 31 December 2026 and passenger wording differs. Confirm itinerary and entitlement with Maybank before relying on it.", [source("KLIA VIP conditions", "https://cardspromo.maybank2u.com.sg/promotions/complimentary-klia-ekspres-vip-service")], "Unverified", {validFrom:"2026-08-01",validUntil:"2026-12-31"}),
        fact("Agoda October offer", "18% advertised on eligible hotel room charges through agoda.com/maybanksg, first come, direct card payment and no stacking. Full stay-period/cap details are image-only and were not verified; check the displayed checkout discount.", [source("Agoda conditions", "https://cardspromo.maybank2u.com.sg/promotions/agoda-2")], "Unverified", {validUntil:"2026-10-31"}),
        fact("Klook Malaysia and Tiq travel", "Klook Malaysia: SGMBB15, 15% capped S$25, no minimum, once/user/month while codes last; direct card, no mobile wallets, excluded listings. Separately, Tiq advertises up to 55% single-trip and 30% annual-plan travel premiums with card/code/plan conditions. These are discounts, not free insurance or extra bank miles.", [source("Klook conditions", "https://cardspromo.maybank2u.com.sg/promotions/klook"), source("Tiq offer", "https://cardspromo.maybank2u.com.sg/promotions/etiqa")], "Conditional", {validUntil:"2026-12-31"}),
      ]),
    ],
    caveats: ["This is XL Rewards, not XL Cashback.", "Confirm the S$500 minimum, bank-posted opening usage and any personally eligible higher-cap approval window.", "No signup gift, Rewards Infinite membership or active insurance policy is assumed."],
  },
};

/** Filter dated benefits against an explicit Singapore YYYY-MM-DD calendar date. */
export function getCardBenefits(templateId: string, date?: string): CardBenefits | undefined {
  const benefits = CARD_BENEFITS[templateId];
  if (!benefits) return undefined;
  if (!date) return benefits;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Benefits date must use YYYY-MM-DD");
  return {
    ...benefits,
    sections: benefits.sections.map((group) => ({
      ...group,
      items: group.items.filter((item) => (!item.validFrom || date >= item.validFrom) && (!item.validUntil || date <= item.validUntil)),
    })).filter((group) => group.items.length > 0),
  };
}
