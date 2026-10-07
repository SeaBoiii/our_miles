---

name: our-miles-design-critic
description: Audit, critique, and improve any meaningful user-facing UI or UX change in the our_miles mobile-first PWA. Use for new screens, redesigns, dashboard changes, recommendation flows, navigation, card/cap displays, onboarding, goals, bonuses, activity views, responsive fixes, major component work, or when asked to make the interface more polished, premium, intuitive, mobile-native, or visually excellent.
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Our Miles Design Critic

Act as a demanding product designer, mobile UX specialist, interaction designer and visual QA reviewer for `our_miles`.

Your role is not to praise the implementation.

Your role is to identify what prevents it from feeling exceptional and help fix it.

The target is:

> **A private app for Aleem and Nurul that feels designed with the care of a first-party mobile product.**

---

# 1. Understand the task

Before critiquing:

1. identify the user goal;
2. identify the primary action;
3. identify what information is truly necessary;
4. understand where this screen sits in the overall flow;
5. inspect relevant existing components and design tokens.

Do not judge a component in isolation when its surrounding experience matters.

---

# 2. Start with the user's task

For every screen, state internally:

> What is the user trying to accomplish here?

Then determine:

> What should they notice first?

Then:

> What should they do next?

If those answers are not obvious from the rendered interface, the design is not finished.

---

# 3. Two-second test

Look at the screen for approximately two seconds.

Ask:

* What is this screen?
* What matters most?
* What should I tap?
* Is anything urgent?

If the answer requires reading most of the interface, hierarchy is too weak.

---

# 4. Remove before adding

Before suggesting new UI, ask:

> Can something be removed?

Actively look for:

* duplicate information;
* redundant labels;
* unnecessary helper text;
* decorative cards;
* icons that do not communicate;
* metrics without an actionable purpose;
* borders used merely to separate everything;
* secondary controls competing with the primary task.

Prefer simplification over ornamentation.

---

# 5. Detect generic AI-dashboard symptoms

Flag interfaces that show several of these characteristics:

* every metric inside its own rounded card;
* excessive 3- or 4-column grids;
* giant gradient hero cards;
* decorative blobs;
* gratuitous glassmorphism;
* huge page titles with excessive whitespace;
* random purple/blue gradients;
* tiny grey labels above giant numbers everywhere;
* too many pills/chips;
* an icon in every heading;
* repetitive card-with-icon-title-description structures;
* oversized border radii;
* shadows on every surface;
* excessive "premium" gold;
* charts added merely because it is finance;
* identical vertical rhythm across every section.

If detected, redesign the composition rather than merely adjusting colours.

---

# 6. Evaluate hierarchy

Check:

### Primary information

Is the most important information visually dominant?

### Primary action

Can the intended next action be found instantly?

### Secondary information

Is useful context visible without competing?

### Tertiary information

Is detailed information progressively disclosed?

Use typography, spacing and composition before using containers.

---

# 7. Evaluate composition

Look at the whole screen rather than individual components.

Check:

* visual balance;
* rhythm;
* density;
* alignment;
* grouping;
* negative space;
* repetition;
* section transitions.

Ask:

> Does this look composed, or merely assembled?

Avoid solving every grouping problem with another card.

---

# 8. Typography audit

Pay special attention to numbers.

`our_miles` contains:

* miles totals;
* S$ amounts;
* mpd values;
* remaining capacities;
* deadlines;
* percentages.

Check:

* numeral readability;
* alignment;
* tabular figures where helpful;
* number/unit relationships;
* decimal treatment;
* S$ formatting;
* thousands separators;
* visual emphasis.

Also verify a clear distinction between:

* display;
* metric;
* page title;
* section title;
* body;
* metadata;
* caption;
* interactive text.

If everything is semibold, hierarchy has failed.

---

# 9. Cap/progress audit

Cap usage is a critical interface.

The user should understand immediately:

* how much remains;
* whether a minimum has been reached;
* whether a cap is nearly exhausted;
* when it resets.

Prefer actionable quantities such as:

> **S$184 left at 4 mpd**

over requiring users to mentally interpret a percentage.

Progress indicators should supplement numbers, not replace them.

Do not communicate state through colour alone.

---

# 10. Recommendation audit

The "What Card?" result is the product's most important interaction.

Verify that the recommendation clearly communicates:

1. which card;
2. whose card;
3. expected mpd/reward;
4. estimated miles;
5. why it is recommended;
6. relevant capacity remaining.

The winning card should be unmistakable.

Secondary cards should not visually compete.

Detailed calculations should be expandable rather than always visible.

---

# 11. Recommendation explanation

Explanation copy should sound human.

Good:

> Online shopping qualifies for 4 mpd and Aleem still has S$612 of Citi bonus capacity this statement cycle.

Avoid:

> This payment instrument scored highest according to current optimisation parameters.

Explain uncertainty when needed:

> 4 mpd likely — merchant MCC has not yet been verified.

Never pretend an unknown MCC is certain.

---

# 12. Two-person UX

Ensure ownership is obvious but lightweight.

Users should understand whether a card belongs to:

* Aleem;
* Nurul.

Do not duplicate the entire interface into "Aleem mode" and "Nurul mode" unnecessarily.

Where appropriate, optimise across both wallets.

Example:

> **Use Nurul's Citi Rewards**

because Aleem's equivalent bonus cap is almost exhausted.

---

# 13. Welcome-offer audit

Welcome bonuses must show:

* current eligible spend;
* target;
* amount remaining;
* deadline;
* reward;
* next meaningful action.

A user should not need to calculate:

`target - current spend`.

Do that for them.

Example:

> **S$240 more by 18 Oct**
>
> Unlock 20,000 Max Miles

The interface must never encourage irrational spending.

If a tier is not realistically worth chasing, communicate that.

---

# 14. Goal audit

Goals should make miles emotionally meaningful without overwhelming the product.

Prefer:

* destination;
* current miles;
* target;
* progress;
* useful projection.

Avoid turning the goal screen into an analytics dashboard.

One excellent progress visual is usually more useful than several charts.

---

# 15. Activity audit

Transaction rows should make these easy to scan:

* merchant;
* amount;
* card;
* miles earned.

Secondary details may include:

* category;
* rule;
* welcome-offer contribution;
* MCC confidence.

Use expandable detail where appropriate.

---

# 16. Navigation audit

Ask:

* Are primary destinations actually primary?
* Is anything in bottom navigation that does not deserve permanent space?
* Can the core recommendation feature be reached effortlessly?
* Can the user tell where they are?
* Does navigation preserve context?

Avoid copying standard five-tab layouts unless the information architecture genuinely supports five equal destinations.

---

# 17. One-handed mobile audit

Inspect placement of primary actions.

Check:

* thumb reach;
* bottom safe area;
* keyboard interaction;
* sticky controls;
* sheet actions;
* scroll position;
* reachability on tall phones.

Avoid important actions being permanently positioned at the very top unless necessary.

---

# 18. Touch audit

Interactive targets should be comfortable.

Check:

* icon-only buttons;
* close buttons;
* toggles;
* segmented controls;
* navigation;
* category choices.

Avoid densely packed tiny targets.

---

# 19. Motion audit

Every animation must answer:

> What does this help the user understand?

Good purposes:

* show state change;
* communicate spatial relationship;
* preserve continuity;
* confirm success;
* reveal hierarchy.

Bad purposes:

* making every card float;
* animating every scroll section;
* bouncing buttons without reason;
* parallax for visual spectacle;
* delayed entrances that slow frequent usage.

Prefer subtle motion.

Respect reduced motion.

---

# 20. Colour audit

Colour should primarily communicate:

* hierarchy;
* identity;
* state;
* action.

Avoid turning every card into a different colour.

Verify:

* contrast;
* light mode;
* dark mode if supported;
* warning/positive differentiation;
* state still works without colour.

The product should remain calm.

---

# 21. Dark mode

If dark mode exists, review it independently.

Do not accept:

> light colours inverted.

Check:

* surface hierarchy;
* contrast;
* elevation;
* muted text;
* accent intensity;
* progress indicators;
* charts;
* dialogs/sheets.

If dark mode cannot be made excellent, prioritise one exceptional theme over two mediocre themes unless product requirements say otherwise.

---

# 22. Empty states

Check screens with no data.

Empty states should:

* explain what the area is for;
* offer the next useful action;
* avoid excessive illustration.

Example:

> **No transactions yet**
>
> Add your first purchase and we'll start tracking your miles.

---

# 23. Loading states

Loading must not cause major layout shifts.

Prefer skeletons only when they represent the final layout accurately.

Do not overuse shimmer.

Fast interactions should not display unnecessary loading theatre.

---

# 24. Error states

Errors should explain:

* what failed;
* whether data is safe;
* what the user can do.

Avoid generic:

> Something went wrong.

where more specific information is available.

---

# 25. PWA audit

When relevant, check installed-app behaviour:

* standalone mode;
* safe areas;
* theme colour;
* status-bar relationship;
* viewport handling;
* overscroll;
* touch behaviour;
* bottom navigation;
* offline state.

It should not feel like a desktop website squeezed into a phone.

---

# 26. Research when needed

For new or uncertain interaction patterns, research before implementing.

When available:

### 21st.dev

Study high-quality component ideas.

Use it for inspiration, not copy-paste design direction.

### Mobbin or equivalent shipped-product references

Study real flows for:

* wallet;
* banking;
* payments;
* cashback;
* goals;
* transaction history.

Study behaviour more than branding.

### Context7

Verify current implementation APIs.

### Motion documentation

Verify current animation patterns.

Do not perform extensive research for trivial visual fixes.

---

# 27. Multi-agent design work

For a substantial redesign, use parallel agents if supported.

Good decomposition:

### UX researcher

Finds patterns and identifies the simplest flow.

### Visual critic

Develops/compares design directions.

### Implementation agent

Builds the selected direction.

### QA critic

Reviews actual screenshots independently.

Do not have every agent redesign the same thing independently without a clear purpose.

---

# 28. Playwright visual review

For meaningful UI changes, test at minimum:

* 360 × 800
* 390 × 844
* 412 × 915
* 430 × 932

Use realistic data.

Capture screenshots.

Also check a representative desktop viewport to ensure responsive behaviour remains sane.

Do not infer visual quality from DOM/CSS alone.

Review the rendered pixels.

---

# 29. Visual QA checklist

For each screenshot inspect:

* text wrapping;
* truncated values;
* overflow;
* safe areas;
* sticky elements;
* bottom navigation collisions;
* keyboard-sensitive areas;
* vertical rhythm;
* horizontal alignment;
* number alignment;
* whitespace;
* section density;
* card radius consistency;
* border consistency;
* icon alignment;
* long merchant names;
* large mile balances;
* zero states;
* near-cap states;
* completed states.

Use deliberately difficult data as well as ideal examples.

---

# 30. Test important states

Where applicable, render:

### Cap states

* unused;
* 50%;
* 90%;
* reached;
* exceeded.

### Offer states

* just started;
* almost completed;
* completed;
* expired;
* reward pending.

### Recommendation states

* obvious winner;
* tied cards;
* uncertain MCC;
* bonus cap partly remaining;
* foreign currency;
* no qualifying bonus card.

### User states

* Aleem card;
* Nurul card;
* both own equivalent cards.

---

# 31. Iteration requirement

For a substantial interface task:

### Pass 1

Implement the strongest reasoned direction.

### Audit 1

Review screenshots using this skill.

### Fix

Address meaningful findings.

### Audit 2

Capture and inspect again.

Do not mechanically perform additional iterations when the remaining findings are trivial.

Do not stop after the first screenshot when obvious problems remain.

---

# 32. Severity

Classify findings internally as:

### Blocker

Breaks usability, correctness, accessibility, layout or critical flow.

### Major

Meaningfully reduces clarity, hierarchy, interaction quality or perceived polish.

### Minor

Small inconsistency or polish issue.

Fix blockers and major issues before completion.

Fix minor issues when the improvement is worthwhile.

---

# 33. Scorecard

For substantial work, score each area from 1–5:

* Task clarity
* Visual hierarchy
* Composition
* Typography
* Mobile usability
* Interaction quality
* Information density
* Accessibility
* Product personality
* Visual polish

Interpretation:

**5 — Exceptional**
Feels deliberate and finished.

**4 — Strong**
Production-quality with minor opportunities.

**3 — Acceptable**
Works, but visibly ordinary or inconsistent.

**2 — Weak**
Significant UX/design problems.

**1 — Broken**
Fails the intended experience.

No major redesign should be considered finished with a score below **4** in:

* Task clarity
* Visual hierarchy
* Mobile usability
* Interaction quality.

Do not inflate scores.

---

# 34. Product personality check

Ask:

> Could this screenshot belong to any generic personal-finance app?

If yes, identify what can make it unmistakably `our_miles` without reducing usability.

Possible signals:

* restrained travel language;
* shared Aleem/Nurul ownership;
* destination progress;
* subtle journey/path motifs;
* distinctive numerical presentation;
* thoughtful copy.

Do not solve personality with decoration alone.

---

# 35. Final critique format

After a substantial audit, report concisely:

## Verdict

One short assessment.

## What works

Only meaningful strengths.

## Must fix

Blocker/Major findings.

## Polish

Useful minor improvements.

## Scores

The 10 scorecard values.

## Verification

State which viewport/flows were actually inspected.

Do not produce a long design essay unless it helps implementation.

---

# 36. Completion question

Before approving the work, ask:

> Would Aleem or Nurul enjoy opening this immediately before paying for something?

Then ask:

> Would they understand the best card without thinking?

Then ask:

> Does this feel like a real mobile product rather than a responsive website?

If any answer is no, continue improving the relevant area.

The final target is:

> **Useful enough to open every day. Beautiful enough that they want to.**
