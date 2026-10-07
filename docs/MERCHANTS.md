# Merchant evidence and recommendation assessment

Reviewed on **7 October 2026**, Singapore time.

The app searches **99 curated merchant/payment variants** and **6,531 additional global reference records** after removing names already covered by curated evidence: **6,630 searchable entries**. There are also **981 standard MCC descriptions**. This is useful coverage, not an exhaustive or issuer-confirmed register of Singapore terminals.

## What the evidence means

A single bank merchant example supplies a **Likely** MCC. It does not establish the code for every outlet, acquiring bank, network or checkout. An explicit MCC confirmed from the issuer's posted transaction takes precedence over catalogue suggestions. Multiple possible codes remain visible; the app does not pick an arbitrary code from a list.

Inferred terminals, out-of-country evidence and uncertain historical mappings remain **Unverified**. Catalogue checks older than 180 days also downgrade to Unverified until rechecked; this affects new suggestions and does not rewrite historical transactions.

The extended reference is deliberately **Unverified** for a Singapore purchase: its source provides names, MCCs and broad categories, without country, channel or card network. Selecting it does not unlock a bonus until the transaction classification is confirmed. Standard MCC descriptions explain a code; they do not grant rewards or change the card engine's eligibility rules.

Direct fares, stored-value top-ups, food purchases, hardware and digital subscriptions are separate payment paths. Examples in the catalogue include IKEA furniture versus restaurant food, Esso counter versus automated pump, BUS/MRT fares versus SimplyGo/EZ-Link top-ups, and a hotel booking paid to Agoda versus paid at the hotel.

Priority coverage includes FairPrice/Finest/Xtra, Giant, Cold Storage, Sheng Siong, RedMart and other supermarkets; Challenger; Timezone; McDonald's, KFC, Burger King and Subway; Esso; MRT/bus; Agoda and Booking.com; SIA, Scoot and AirAsia; IHG and Marriott Bonvoy hotel brands. The catalogue does not certify halal status or substitute a hotel loyalty membership for its actual paid-to merchant.

## Sources and durable differences

| Source | Use in the app | Limits |
| --- | --- | --- |
| [OCBC retailer examples](https://www.ocbc.com/personal-banking/cards/rewards-card.page) | Department stores, clothing, footwear, sports and luggage | The bank expressly says merchant classification can differ. Named marketplace exceptions are not universal MCC assignments. |
| [Maybank category terms](https://www.maybank2u.com.sg/iwov-resources/sg/pdf/cards/fnf-cashrebate-tnc.pdf) | Supermarket and pharmacy examples; ride/delivery categories | A grouped transport list does not map every ride operator to one exact code. |
| [UOB Lazada terms](https://www.uob.com.sg/personal/cards/cashback/lazada-uob-card.page) | Several possible Lazada codes | RedMart and wallet loading are distinct. |
| [OCBC historical merchant list](https://www.ocbc.com/iwov-resources/sg/ocbc/personal/pdf/accounts/terms-and-conditions-governing-myown-account-debit-card-promotion.pdf) | Timezone, food and beverage examples | December 2024 campaign; grouped codes are retained as possibilities, not current outlet verification. |
| [EZ-Link historical campaign](https://ezlink.simplygo.com.sg/wordpress/wp-content/uploads/2023/03/Terms-and-Conditions-Top-Spenders-Campaign-v2.pdf) and [Seedly reports](https://blog.seedly.sg/mcc-codes-singapore-for-credit-cards/) | Challenger 5045/5732 variants | Sources disagree; a user must choose the relevant posted/likely checkout, not silently assume one code. |
| [ICBC Singapore fast-food examples](https://v.icbc.com.cn/userfiles/resources/icbc/haiwai/singapore/download/2023/horoscope_faq_321cashback.pdf) | Common fast-food MCC examples | Historical issuer examples; app/delivery/franchise routes can differ. |
| [Citi commute guidance](https://www.citibank.com.sg/credit-cards/cashback/citi-cash-back-card/pdf/cashbackFAQs.pdf) and [SimplyGo descriptor guidance](https://www.citigold.com.sg/global_docs/pdf/Rewards_Exclusion_List.pdf) | Taxi operator descriptors and BUS/MRT fare code | Direct fares differ from stored-value loading. |
| [DCS travel examples](https://dcscc.com/gotravel-doc) | Travel-agent checkouts | Booking through an agent does not prove the agent collected the payment. |
| [HSBC SIA booking terms](https://cardpromotions.hsbc.com.sg/flysq-tnc/) | Direct SIA booking example | Different airline/agency routes need confirmation. The app does not automatically register a KrisFlyer UOB partner from the name. |
| [Visa April 2026 manual](https://usa.visa.com/content/dam/VCOM/download/merchants/visa-merchant-data-standards-manual.pdf) | Hotel brand codes and classification principles | A local property's actual terminal can differ, including 7011. |

Each curated entry also carries its own URL, checked date and explanatory note. The date means the source was checked; it is not evidence that the users' particular transaction was posted under that code. Historical campaign evidence is labelled as such.

## Wider directory coverage

The app provides fixed, human-initiated links to [CheckMCC](https://www.check-mcc.sg/), [MEVA](https://meva.sg/merchants), [MCC Explorer](https://www.mccexplorer.com/) and [PointsPick](https://www.pointspick.com/tools/mcc-lookup). No merchant name, purchase amount, wallet or search query is appended to these links. Search works locally and offline; there is no third-party API call during a purchase recommendation.

- CheckMCC publishes a no-auth search API with rate limits, but no clear bulk redistribution licence was found in its API documentation. Some example card rates/caps are stale. Its card suggestions are not imported.
- MEVA advertises 8,920 network-aware mappings, last updated 23 June 2026. These counts and verification labels are its own claims; a public redistribution licence was not established.
- MCC Explorer offers regional data and a keyed API; full export is a licensed paid feature. The app links to it without exposing a key or adding a runtime dependency.
- PointsPick supplies a downloadable dataset and explicitly grants MIT use with attribution. Its 6,569 source records are global, not a verified Singapore-location count; its published update date is 3 March 2026.

## Pinned data and attribution

`src/lib/merchant-data/sources.json` records exact source revisions and retrieval dates. The standard-code data comes from [greggles/mcc-codes](https://github.com/greggles/mcc-codes/tree/df792275c567946119a8903d36dbd33e44a248bf), a public-domain/Unlicense USDA/IRS-derived reference. Its original licence is preserved in `docs/licenses/mcc-codes-UNLICENSE.txt`. This reference may include historical codes and does not replace Visa's current manual.

Global merchant mappings come from [PointsPick revision 18c6b42](https://github.com/pointspick/mcc-database/tree/18c6b42f8a07c9ca92956fb3be35cbc158383d86). Attribution is retained in the app's source registry and `docs/licenses/pointspick-attribution.md`. The provider's README grants MIT use; this revision does not supply a separate copyright notice/licence file. Only factual merchant names, numeric MCCs and category labels are imported. No provider card eligibility or rewards logic is imported.

The optional `node scripts/update-merchant-data.mjs` refreshes fixed public sources, pins revisions, checks the licence grants, validates counts/schema/code ranges/text and writes compact static data. It sends no user information. Review changed data and run the existing tests before deploying an update; do not make this a silent recurring refresh.

## Why Trust could appear first so often

The previous view showed a conservative ranking without explaining that unknown cap usage reduced many specialist cards to base earn. A 0.4 mpd base estimate loses to Trust's eligible 1.3 mpd. Unknown statement cycles, UOB Lady's registration, minimum qualification and annual airline spend can also withhold bonuses. Adding MCC knowledge cannot safely invent those personal facts.

`assessCards()` now returns the actual conservative result for every active card, explicit setup blockers and a separate **conditional potential**. For a S$100 eligible local online purchase, Citi can show 40 current estimated miles versus 400 conditional miles if remaining usage is confirmed; Trust's 130 miles is the current fallback. Once real bonus capacity is entered, Citi's 400 miles ranks above Trust. The conditional comparison lists every assumption and cannot be used as the ordinary recommendation to record.

The engine never invents a statement day, annual qualifying spend or lifetime cashback balance. A hypothetical Lady's match says that the bank must already have registered the category; changing the app does not enroll with UOB. A known unmet minimum stays withheld without inviting extra spending. Exhausted caps, exclusions, small-transaction rounding and FX economics can still make Trust the correct choice.

Recommendation tests cover all of those cases, independent PPV buckets, unchanged input state and unverified extended merchant codes. Recorded reward snapshots and existing historic transactions are unchanged.

Unverified MCCs cannot unlock a welcome tier, contribute welcome spend, satisfy a monthly minimum or award retroactive minimum-spend miles. The same guard applies when summing uncertain historical records, without mutating their recorded evidence.
