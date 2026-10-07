# Our Miles design system

Selected direction: Field Notes. A composed personal travel journal with an immediate card finder; not a grid of metrics. Family context comes from our_flight and our_gallery.

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

The Pages entrance uses invited email/password sign-in with password-manager autocomplete. Remembering a trusted device is an explicit, initially unchecked choice; profile selection follows authentication. Credential fields and the primary action fit the 360px first fold, and the page scrolls normally when keyboard space is limited. Placeholders use the secondary text token with full opacity. Loading errors offer retry and, when signed in, sign-out.
