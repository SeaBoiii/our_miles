# our_miles — Agent Instructions

## Product

`our_miles` is a private, mobile-first PWA for Aleem and Nurul.

Its primary purpose is to answer:

> **Which of our cards should we use for this purchase right now?**

It should optimise miles across the cards we own while accounting for:

* earn rates;
* bonus caps;
* minimum spend;
* statement/calendar periods;
* MCC/category;
* online/contactless/payment method;
* local/foreign currency;
* FX fees;
* exclusions;
* welcome-offer progress;
* welcome-offer deadlines;
* card ownership;
* remaining bonus capacity.

This is a personal tool for two people, not a public fintech product.

---

## Product priorities

When requirements conflict, optimise in this order:

1. Correct recommendation logic
2. Fast "What Card?" experience
3. Exceptional mobile UX
4. Clear cap and bonus tracking
5. Accessibility
6. Performance
7. Visual polish
8. Desktop experience

Never sacrifice recommendation correctness for visual effects.

---

## Core product principle

The application should feel:

**designed, not generated.**

Avoid generic AI/SaaS dashboard conventions.

Do not default to:

* grids of identical statistic cards;
* excessive rounded rectangles;
* glassmorphism everywhere;
* decorative gradients;
* giant hero areas inside the application;
* unnecessary charts;
* excessive borders and shadows;
* animation without purpose;
* stock shadcn appearance;
* fintech/crypto visual clichés.

Prefer:

* strong typography;
* restrained colour;
* excellent spacing;
* clear numerical hierarchy;
* compositions rather than card grids;
* progressive disclosure;
* highly intentional motion;
* quiet, premium interaction design.

---

## Brand character

`our_miles` belongs to Aleem and Nurul's wider `our_*` ecosystem.

The visual character should be:

* personal;
* premium;
* calm;
* precise;
* travel-oriented;
* subtly aviation-inspired;
* modern;
* warm without being romantic or childish.

Avoid obvious wedding motifs, hearts, airplane clipart, or overly literal aviation UI.

Copy can use language such as:

* Our Miles
* Our Wallet
* Where we're going
* Best next move
* Aleem's cards
* Nurul's cards

---

## Mobile first

The mobile experience is the product.

Primary design range:

* 360 × 800
* 390 × 844
* 393 × 873
* 412 × 915
* 430 × 932

Desktop and tablet must work, but they are secondary.

Design for:

* one-handed use;
* thumb reach;
* safe areas;
* virtual keyboards;
* installed PWA mode;
* large enough touch targets;
* short interaction paths.

The principal flow should ideally be:

**open → describe purchase → see best card**

within seconds.

---

## Design skill

For any meaningful user-facing UI task, use the:

**`our-miles-design-critic`**

skill.

Use it:

1. when establishing a new screen or major component;
2. after implementing a meaningful visual change;
3. before considering a redesign complete.

Do not run a full design audit for trivial text or one-line style fixes.

---

## Research tools

When available:

### 21st.dev

Use it to study high-quality components and interaction patterns.

Do not copy components blindly.

Adapt useful ideas to the `our_miles` design system.

### Context7

Use it to verify current APIs and recommended implementation patterns for dependencies.

Do not rely on stale library knowledge when current documentation is available.

### shadcn/ui

Use shadcn as accessible behavioural primitives.

Do not allow the application to retain obvious default shadcn styling.

### Motion

Use Motion for React when motion improves understanding of:

* hierarchy;
* navigation;
* state;
* completion;
* progress;
* card switching.

Respect `prefers-reduced-motion`.

### Playwright

Use Playwright for functional and visual QA.

For meaningful interface changes, screenshots are part of the definition of done.

---

## Design documentation

Maintain:

`docs/DESIGN_SYSTEM.md`

for:

* colour roles;
* typography;
* spacing;
* radius;
* surfaces;
* elevation;
* icons;
* motion;
* interaction patterns.

Maintain:

`docs/DESIGN_RESEARCH.md`

only for durable findings that meaningfully influence the product.

Do not turn either document into a dumping ground.

---

## Architecture

Prefer the existing repository architecture.

If beginning from scratch, the intended stack is:

* Next.js
* React
* TypeScript strict mode
* Tailwind CSS
* Supabase/PostgreSQL
* shadcn primitives where useful
* Motion for React
* Lucide or similarly restrained icons
* PWA support

Do not introduce a heavy dependency without a concrete product benefit.

---

## Separation of concerns

Keep these layers separate:

### Card knowledge

Card earn rules, caps, exclusions, fees and validity periods.

### Recommendation engine

Pure/testable logic deciding which card is optimal.

### User state

Cards owned, transactions, cap usage, offers and preferences.

### UI

Presentation and interaction only.

Never embed Singapore credit-card earning rules directly inside page components.

---

## Rule versioning

Credit-card rules change.

Rules should support fields such as:

* `valid_from`
* `valid_until`
* `source_url`
* `last_verified_at`

Do not mutate old rules in ways that make historic transaction calculations incorrect.

Prefer versioned rules.

---

## External financial facts

When adding or changing a card rule:

Prefer official bank documentation for:

* earn rates;
* caps;
* qualifying categories;
* exclusions;
* FX fees;
* transfer rules.

Comparison sites can be used for:

* acquisition promotions;
* signup gifts;
* campaign discovery.

Record sources.

Do not represent uncertain card rules as certain.

---

## Recommendation confidence

Where MCC/category information is uncertain, expose that uncertainty.

Use human-readable states such as:

* Confirmed
* Likely
* Unverified

Do not fabricate MCC certainty.

---

## Miles optimisation

Never rank cards solely by headline mpd.

Consider:

* remaining bonus cap;
* base rate after cap;
* minimum-spend qualification;
* welcome-offer incremental value;
* FX fees;
* cashback alternatives;
* points transfer fees;
* qualifying payment channel;
* owner;
* relevant period;
* future flexibility.

The best recommendation is the best expected outcome, not necessarily the largest displayed mpd.

---

## Overspending

The app must optimise spending the users already intend to make.

It must not encourage spending merely to earn rewards.

For promotional tiers, it is acceptable and desirable to recommend:

> **Not worth chasing**

when projected natural spending does not justify the next tier.

---

## People and authentication

There are only two users:

* Aleem
* Nurul

Do not build enterprise authentication.

A simple private authentication model is sufficient, such as:

* shared PIN;
* remembered trusted device;
* device-level default profile;
* manual Aleem/Nurul switching.

Do not store:

* full card numbers;
* CVV;
* banking passwords;
* expiry/security credentials;
* Singpass credentials.

---

## Product areas

Keep the product intentionally small.

Expected primary areas:

* Home
* What Card?
* Wallet
* Goals
* Bonuses
* Activity

Settings should remain secondary.

Do not add features merely to fill navigation.

---

## UI copy

Use concise human language.

Prefer:

> S$184 left at 4 mpd

instead of:

> 18.4% remaining within the monthly rewards threshold

Prefer:

> Use Citi Rewards

instead of:

> Recommended payment instrument

Prefer:

> Not worth chasing

instead of:

> Projected spending is insufficient to attain the subsequent promotional threshold.

---

## Accessibility

User-facing work must consider:

* semantic HTML;
* contrast;
* screen-reader labels;
* keyboard navigation;
* focus visibility;
* reduced motion;
* touch target size;
* colour-independent state communication.

Accessibility is part of design quality.

---

## Performance

Premium UX must also be fast.

Avoid:

* unnecessary client components;
* excessive animation bundles;
* avoidable waterfalls;
* oversized images/assets;
* unnecessary font weights;
* layout shifts;
* animation jank.

Prefer progressive enhancement.

---

## Tests

Recommendation logic should be testable without rendering the UI.

Add or update tests when changing:

* rule eligibility;
* cap calculations;
* minimum-spend logic;
* welcome bonuses;
* FX comparisons;
* blended earn rates;
* period boundaries;
* owner-specific recommendations.

For UI flows, use the repository's existing browser testing setup.

Do not invent test commands. Inspect `package.json` and existing project configuration.

---

## Visual QA

For substantial UI changes:

1. implement;
2. run functional checks;
3. render realistic data;
4. capture mobile screenshots;
5. invoke the design critic;
6. fix meaningful findings;
7. repeat screenshots;
8. only then consider the UI complete.

One implementation pass is not sufficient for a major redesign.

---

## Multi-agent work

If parallel agents/worktrees are available, use them selectively for substantial design work.

Useful separation:

### Research agent

Studies UX patterns and reduces the problem.

### Design critic

Challenges hierarchy, composition and interaction.

### Implementation agent

Builds the selected solution.

### QA agent

Runs Playwright and critiques rendered output.

Do not introduce multi-agent overhead for small fixes.

---

## Existing product before new product

Before replacing established UI or architecture:

* inspect it;
* understand why it exists;
* preserve working behaviour unless there is a reason to change it.

Do not rewrite functional code solely to make it look cleaner.

---

## Decision making

Make reasonable product and design decisions autonomously.

Do not interrupt Aleem for minor choices.

Ask only when a decision is genuinely blocked by information that cannot be inferred or safely chosen.

---

## Completion standard

A feature is not complete merely because:

* it compiles;
* tests pass;
* all requested fields exist.

For user-facing work, it should also:

* feel excellent on a phone;
* communicate hierarchy immediately;
* avoid unnecessary complexity;
* behave consistently;
* remain accessible;
* feel like part of `our_miles`.

The quality bar is:

> **Useful enough to open every day. Beautiful enough that Aleem and Nurul want to.**
