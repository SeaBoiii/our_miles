# Our Miles — design decisions

Reviewed 5 October 2026. This document records findings that affect the product, not a gallery of references. [The three comparable previews](design-directions.html) use explicitly illustrative financial data; they are design evidence, not bank rules.

## The family resemblance

Local `our_flight/src/styles.css` and `our_gallery/src/styles/tokens.css` share warm ivory `#f7f2e8`, paper `#fffdf8`, navy ink `#081b31`, locally hosted Instrument Serif, system UI text, restrained metallic accents and small radii. Our Miles retains ivory, paper, serif headings and sparse composition. Forest green becomes the principal action/result color. Wedding imagery, literal aircraft and decorative gold do not carry into this daily tool.

## Shipped product principles

| Reference | Durable observation | Our Miles consequence |
| --- | --- | --- |
| [Apple Design Evangelism Q&A](https://developer.apple.com/news/?id=s8sl4tpa) | Apple recommends labeled tabs, stable navigation, progressive disclosure in crowded rows, and one main action tint. Safe areas vary with device and surrounding UI. | Four labeled mobile tabs. Detailed eligibility remains expandable. Forest marks the primary action. Safe areas use environment insets instead of fixed assumptions. |
| [Monzo's overview redesign](https://monzo.com/blog/2023/08/01/see-into-the-future-of-monzo) | The 2023 design presents aggregate position and summarized activity, with spotlights that reveal deeper information when opened. | Home shows a shared total, destination and one timely next move. Activity is a short preview. Card capacity belongs in Wallet. |
| [Monzo's launch retrospective](https://monzo-prod.com/blog/2023/08/03/how-we-launch-new-products-at-monzo) | An introduction to a redesigned home interrupted people approving payments and moving money. Monzo explicitly describes this as a rollout failure. | Returning users go straight to their task. No repeated onboarding, delayed entrances or promotional interruptions before What Card? |
| [21st's mobile navigation guide](https://news.21st.dev/blog/react-mobile-navigation-components) | Persistent labeled bottom destinations need safe-area padding, visible selection, generous touch targets and keyboard-aware layout. Magnifying docks depend on pointer hover. | A plain bottom bar, `env(safe-area-inset-bottom)`, dynamic viewport height and selected-state shape. No dock magnification or hidden swipe-only actions. |

Apple's dedicated tab/sheet pages and Wise's public design documentation required JavaScript or were inaccessible in this research environment. No product-specific claims are derived from those unavailable pages. We do not copy brand identity or proprietary assets.

21st CLI design-context initialization succeeded; catalog search and usage required a signed-in account. No hosted generation ran. Public catalog research continued through [Animated Tabs](https://contact_2a72bbaa.21st.dev/@kuratlielia/components/tabs) and its [actual MIT source](https://raw.githubusercontent.com/kuratlielia/arc-library/main/public/r/tabs.json). Code review found Radix keyboard behavior, active selection continuity, reduced-motion handling and overflow-aware tabs useful. Its animated height measurement, leaving-panel geometry and extra foundation dependency are unnecessary for this fixed four-item app navigation. We adopt principles, not this component or its styling.

## Three directions

Shared constraints: phone-first 390 × 844; same sample purchase, ownership, balance and goal; warm family tokens; at least 44px controls; numerical progress; uncertainty disclosed; no decorative media or animation bundle. Each preview has the same recommendation dialog, isolating the difference in entry hierarchy and navigation.

| Direction | Core idea and best fit | Meaningful differences | Risk |
| --- | --- | --- | --- |
| **Field Notes — selected** | A composed personal overview for everyday use: how we are doing, where we are going and what to do now. | Editorial home composition; four persistent destinations; central What Card? action plus bottom access; one attention item instead of a dashboard. | Keep goal composition compact so the action is visible on short phones. Wallet and bonus details need deliberate disclosure. |
| Decision Desk | Immediate purchase entry for users who only want the answer before paying. | Recommendation form is the opening screen; two destinations; categories are open text rows; shared progress is reduced to a small footer. | Other product areas become harder to discover. Repeated form exposure reduces the sense of a shared journey. |
| Journey Ledger | Capacity-first instrument for planned purchases and active wallet management. | Dense two-column wallet rows; owner segmentation; three management tabs; floating What Card? action. | People must interpret their wallet before describing the purchase. Floating controls obscure content and compete with the nav. |

The user explicitly authorized autonomous selection. Field Notes gives the strongest balance of task speed, clarity and product personality. We commit to its composition rather than blending all three navigation models.

## Design critic — direction gate

The initial direction critique applies `.agents/skills/our-miles-design-critic/SKILL.md`. These are direction scores; production acceptance requires rendered application screenshots and working interactions.

| Area (1–5) | Field Notes | Decision Desk | Journey Ledger |
| --- | ---: | ---: | ---: |
| Task clarity | 4 | 5 | 3 |
| Visual hierarchy | 4 | 4 | 4 |
| Composition | 5 | 4 | 4 |
| Typography | 4 | 4 | 4 |
| Mobile usability | 4 | 4 | 3 |
| Interaction quality | 4 | 4 | 3 |
| Information density | 4 | 4 | 3 |
| Accessibility | 4 | 4 | 4 |
| Product personality | 5 | 3 | 4 |
| Visual polish | 4 | 4 | 4 |

Verdict: Field Notes is the strongest direction. Its dedicated bottom action makes the purchase flow clear while the warm typographic overview feels specific to Aleem and Nurul. The first implementation must preserve quick task access on 360px phones, avoid making all sections containers, and keep the winning owner visible in the result. All directions use trivial HTML/CSS previews and share strong maintainability/performance; production dependency choices remain separate.

Rendered evidence: Chromium Playwright captured all three 390 × 844 phone previews at `artifacts/design/direction-*.png`, a comparison at `artifacts/design/directions-comparison.png`, and the shared result at `artifacts/design/direction-result.png`. The result's owner, card, earn rate and estimated miles are immediately legible. The Ledger's floating finder covers destination metadata, confirming its mobile risk. Production must keep a distinct, color-independent current tab, stack the balance delta on narrow widths, and prevent activity rows from underlapping navigation. Preview navigation is a visual prototype; only finder/category controls are interactive.

## Interaction decisions

- **Home / What Card? / Wallet / Activity** are the shipped stable bottom destinations. This retains Field Notes' four-destination composition while giving recorded transactions direct access. Goals opens from the destination on Home; Bonuses opens from Wallet and the timely Home prompt. Settings/profile stays secondary.
- The recommendation says **Use [owner]'s [card]**. The owner is part of the heading, not an avatar the user must decode.
- **S$184 left at 4 mpd** is the primary cap signal. A progress line supports the number and a reset date; color does not carry the state alone.
- Category and amount are the common path. MCC, foreign currency details, payment method and exclusions appear when needed, with merchant uncertainty remaining visible in the result.
- A single pale attention band gives a relevant deadline and remaining spend. Natural spending constraints remain explicit. Expired offers and unrealistic tiers must not use action urgency.
- Locally hosted type, a small vector route mark and CSS progress lines supply identity without slowing the payment decision. No generated media is necessary for this direction.
