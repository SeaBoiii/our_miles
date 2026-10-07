# Our Miles — restored design review

Reviewed 7 October 2026 with [our-miles-design-critic](../.agents/skills/our-miles-design-critic/SKILL.md). This review supersedes the Apple-inspired visual assessment. The requested direction is the original Field Notes design with issuer card artwork and the retained merchant/MCC functionality.

## Verdict

Accepted for the inspected screens and interactions after refinement. The ivory canvas, forest accents, serif headings, original Home composition, category grid and cap-first Wallet are restored. Card images fit that design without replacing its visual character. No unresolved blocker or major finding remains in the inspected states.

## What works

- Home restores the shared miles estimate, original purchase action, shortcuts and destination composition. Phone-width shortcuts fit without clipping.
- What Card? restores the original categories and amount hierarchy. The dark forest result shows the actual card, owner, reward and remaining capacity. Full calculations and every card's eligibility remain available through disclosure.
- Merchant suggestions, evidence, the MCC codebook and external directories retain their functionality. Likely and Unverified labels remain visible; selecting a reference does not assert bank confirmation.
- Higher rewards that need setup still explain their conditions and open the relevant card. Saving returns to the preserved purchase.
- Wallet restores its capacity-led rows and separate PPV online/mobile amounts. Issuer thumbnails replace abstract card marks. Lady's bank registration, DBS opening accumulators and KrisFlyer membership-year controls remain intact.
- Setup sheets retain the original typography and surfaces with card artwork. Close stays reachable while long content scrolls. Activity keeps owner, merchant, amount, reward and recognizable card imagery.

## Must fix

None in the inspected states.

## Resolved findings

| Severity | Finding | Verified correction |
| --- | --- | --- |
| Major | The new merchant suggestion list opened beneath fixed navigation at 360px after restoring the original input placement. | Mobile focus scrolls the lookup into view when needed. The list anchors beneath the lookup. Geometry assertions and fresh 360/390px screenshots confirm every visible suggestion fits above navigation. |
| Minor | Activity displayed “1 purchases.” | Singular purchase copy is restored for a single record. |

Result captures also now align the result's start with the viewport, matching the purchase action, so the card image and recommendation heading are inspected together.

## Polish

The design intentionally retains the original spacing and display typography requested by the user. Physical iOS keyboard behavior, VoiceOver and home-screen installation remain outside this browser review.

## Scores

| Area | Score (1–5) |
| --- | ---: |
| Task clarity | 4 |
| Visual hierarchy | 4 |
| Composition | 4 |
| Typography | 4 |
| Mobile usability | 4 |
| Interaction quality | 4 |
| Information density | 4 |
| Accessibility | 4 |
| Product personality | 4 |
| Visual polish | 4 |

## Verification

The final mocked GitHub Pages run captured **68 screenshots** across **360 × 800, 390 × 844, 412 × 915, 430 × 932 and 1440 × 1000**. Coverage includes all six screens, the mobile payment recommendation, Wallet top/lower, four card setup sheets, expanded DBS fees, narrow merchant dropdowns, login, reduced-height login and the private offline gate. Evidence is listed in `artifacts/pages/verification.json`.

Actual pixels were inspected across all viewport sizes: narrow Home/Finder/Wallet and all four setup sheets, the 390px Activity/Goals/Bonuses screens, larger-phone Home and Wallet, and desktop Wallet/Finder. After refinement, the 360/390px merchant dropdowns and result were inspected again. The 360px result shows the complete issuer card image, owner, card name, earn rate, miles, capacity and recording action. No horizontal overflow was reported, and all five issuer images loaded in every fresh viewport context.

`npm run build:pages` and `npm run verify:pages` passed against the fake-project export at `/our_miles/`: **60 files and 45 assets**, restored local font and 11 local card images, owner-preserving saves, conflict rejection, card setup, pending/posting snapshots, remember-device handling, logout and private offline gating. There were **zero failed assets, uncaught browser errors, CSP violations or unexpected external/Node API requests**. Authentication, Wallet, four setup sheets, Home, Activity, Goals and Bonuses had zero automated WCAG A/AA violations. Audit injection uses a separate CSP-bypassing context; application flows retain strict CSP. Private wallet data and Supabase responses did not enter persistent wallet storage or Cache Storage.

The implementation check passed **91 unit tests and 13 production-demo Playwright scenarios**. Browser coverage retains the existing recommendation, owner/cap switching, natural-spend welcome reward, FX, immutable recording/reversal, fresh-wallet, navigation, accessibility and offline cases. It also retains sourced merchant uncertainty, stale MCC clearing, direct setup returning to the purchase and unverified global/codebook references with payment-route confirmation reset.

The restoration checksum audit confirmed eight engine, merchant and card-art knowledge files were unchanged from the beginning of this design-only restoration. Supabase Auth/REST in the Pages run are mocked. This review does not claim a live shared-wallet update, deployed RLS verification, physical installation or GitHub deployment.
