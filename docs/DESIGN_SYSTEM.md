# Our Miles design system

Selected direction: Field Notes, explicitly reselected by Aleem on 7 October 2026. A composed personal travel journal with an immediate card finder; not a grid of metrics. Family context comes from our_flight and our_gallery. The visual restoration retains merchant lookup, recommendation explanations and authentic card images.

| Role | Value | Use |
| --- | --- | --- |
| Canvas | #f7f2e8 | Warm ivory app background |
| Paper | #fffdf8 | Forms, sheets, grouped content |
| Ink | #122821 | Text and numerical hierarchy |
| Forest | #173d35 | Primary actions and winning recommendation |
| Secondary | #5c685e | Supporting text; contrast verified on paper and tinted surfaces |
| Line | #deded2 | Sparse grouping and dividers |
| Positive | #32624b | Available capacity and progress |
| Attention | #805523 | Deadline/minimum/uncertainty context |

Instrument Serif (locally served, normal and italic, 400) carries editorial titles and primary mile totals. System UI carries controls, body, and tabular numbers. Never use serif for currency-entry fields. Page title 38–48px; balance 60–94px by viewport; section title 25–28px; body 12–16px; supporting metadata 10–12px. Uppercase eyebrows are tertiary navigation/context cues. Input text is 16px to avoid iOS focus zoom. Numerals remain legible under long-value stress tests.

Spacing: 4, 8, 12, 16, 20, 24, 32, 48px. Phone gutter 24px (20px at 360); maximum working width 1080px; desktop main and contextual column. Radius: 6px controls, 10px editorial surfaces, 20px sheet top. Borders only where they explain grouping. Elevation restricted to sheets and sticky navigation.

Lucide icons use 1.6px strokes. Route mark connects two waypoints and hints at shared A/N ownership without literal aircraft. Touch targets at least 44px. Current navigation carries label, underline, and tint; ownership always appears in text.

Motion: recommendation-change opacity/4px displacement, 140ms; sheet 180ms. No animated numbers delaying results. Respect OS reduced motion in MotionConfig and CSS. Primary action tint is forest; active press feedback uses opacity. Focus rings 2px forest with 3px offset.

Four permanent destinations: Home, What Card?, Wallet, Activity. Goals accessible from Home; Bonuses from Home and Wallet; Settings via profile sheet. Detail forms are focus-trapped Radix dialogs from the bottom on mobile. Preserve finder form across navigation. Safe areas apply to top shell and bottom navigation; use dynamic viewport units and visualViewport to hide navigation while the keyboard is open.

Uncertainty is textual (Confirmed/Likely/Unverified), never color-only. Unverified card templates and unknown usage do not imply a guaranteed bonus. Demo data is explicitly identified and isolated from private data. Empty states explain the useful next action.

Wallet rows show independent cap amounts with channel labels rather than a misleading combined balance. Setup sheets keep owner/status and essential eligibility first; annual qualification, benefits and sources use disclosure. Lady’s category selection explicitly distinguishes a bank registration from the app preference. Benefit sections carry source links, conditional labels and dates; merchant promotions do not compete with the core recommendation or inflate bank earn rates. DBS opening online usage splits by currency for correct monthly rounding while showing one shared cap.

Authentic issuer artwork supports card recognition in recommendations and wallet rows. Keep the bank artwork's natural proportions and design, using locally served assets and a labelled fallback when unavailable. Images never replace the readable card name, owner or reward estimate. Artwork sources live in [CARD_ARTWORK.md](CARD_ARTWORK.md).

Merchant suggestions sit within the established purchase form and support keyboard selection and clear focus. Show the source and textual confidence of an MCC estimate. A merchant name, category or MCC description alone does not prove the merchant's acquiring MCC; stale confirmation must clear when the merchant or payment route changes. Detailed MCC coverage lives in [MERCHANTS.md](MERCHANTS.md).

When a higher potential reward needs setup, show the missing conditions and a direct link to the relevant wallet card. Keep the actual available recommendation and any conditional estimate distinct. Saving setup returns to the same purchase; hypothetical rewards cannot be recorded. Detail sheet titles and close controls stay visible while the body scrolls.

The Pages entrance uses invited email/password sign-in with password-manager autocomplete. Remembering a trusted device is an explicit, initially unchecked choice; profile selection follows authentication. Credential fields and the primary action fit the 360px first fold, and the page scrolls normally when keyboard space is limited. Placeholders use the secondary text token with full opacity. Loading errors offer retry and, when signed in, sign-out.
