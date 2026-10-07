# Our Miles — rendered product review

Independent review on 5 October 2026 using `.agents/skills/our-miles-design-critic/SKILL.md`. Direction previews, actual application pixels, interactions and accessibility were inspected separately.

## Verdict

Accepted after refinement. The Field Notes implementation is personal, calm and clear. The winning card and owner are easy to read; capacity rows make remaining value actionable. All four major findings from the first runtime pass were corrected and verified in the rebuilt application. All 10 browser tests passed; the six screens and profile sheet produced no automated WCAG A/AA violations.

## What works

- Home makes a shared balance, immediate purchase action and one relevant welcome deadline distinct. Goals and Bonuses remain secondary rather than filling the bottom bar with six destinations.
- The result communicates owner, card, earn rate, estimated miles, remaining cap and merchant uncertainty. Alternatives stay lighter and calculations expand deliberately.
- Wallet presents money remaining with actual owner and reset date; near-cap states use words as well as color. Long merchants and a S$999,999.99 purchase remain readable at 360px. A billion-mile balance fits without horizontal overflow.
- Local serif type, restrained forest color and the vector destination illustration establish family resemblance without a heavy visual asset. The forest route app icon remains recognizable in its 192px rendering and tiny header mark.
- Recorded reward snapshots, reversal, two-person recommendations, foreign costs, fresh ownership state and the offline public shell were exercised successfully.

## Resolved findings

| Severity | Observed issue | Required correction | Verification state |
| --- | --- | --- | --- |
| Major | A 390px user entered S$512 but the winner started about 980px down, beyond merchant/payment details. | Place an explicit reachable result action directly after amount; dismiss the keyboard, scroll and focus the recommendation. | Fixed. Short-viewport browser test and all five mobile screenshots show the action. |
| Major | Minor text and inactive navigation colors failed WCAG AA; footer contrast was 3.25, nav 4.06 and several tinted-surface labels 4.22–4.41. | Darken shared muted, segmented, currency, footer, navigation and bonus guidance text roles. | Fixed. All six screens and the profile sheet pass axe after animations settle. First evidence: `artifacts/qa/axe-first-report.json`. |
| Major | Escape closed the profile sheet but focus returned to `body`. | Retain and restore the opening control for all externally opened sheets. | Fixed. Tab stays inside the sheet; Escape returns focus to the profile opener. |
| Major | Recording Aleem's Citi purchase immediately recomputed and showed Nurul as the winning owner beside the recorded confirmation. The underlying transaction was correct. | Keep the recorded recommendation and owner until the next purchase or an input change; hide fresh alternatives during confirmation. | Fixed. Confirmation says “Recorded with Aleem’s”; original owner remains visible and alternatives are hidden. Next purchases use updated capacity. |

No unresolved blocker or major visual/interaction finding remains from the inspected states.

## Polish

Small supporting text is intentionally restrained but must meet contrast requirements. Avoid duplicating “Not worth chasing” as both a guidance heading and its entire explanation; a concise explanation would carry more value. No new container, chart or decorative media is needed.

## Scores — final rendered pass

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
| Product personality | 5 |
| Visual polish | 4 |

## Verification

Chromium Playwright captured all six screens at 360 × 800, 390 × 844, 393 × 873, 412 × 915, 430 × 932 and 1440 × 1000. Detailed pixels were inspected for all six 390px screens, four other mobile first-fold comparison strips, the reached recommendation, desktop Home/What Card?, 360px large-balance and long-merchant stress states, profile sheet and keyboard-viewport emulation. Artifacts live in `artifacts/qa/`; `geometry-report.json` recorded no page overflow and no uncaught JavaScript exceptions.

The second capture repeated those screenshots after fixes and added actual editor-driven cap states at 0%, 50%, 95%, reached and exceeded; offer states at just started, almost complete, target reached and expired. Expired offers visibly say “Offer window closed”; completed targets ask the user to check issuer fulfilment. Reached/exceeded caps show S$0 remaining and “Bonus cap reached”. No negative capacity or clipped monetary value was observed.

`npm run test:e2e` passed all 10 tests in 9.4 seconds against the final production build. The suite covers online S$512, recording/reversal and capacity changes, cap exhaustion switching to Nurul, a welcome threshold changing the winner, remembered Aleem/Nurul choice, foreign-currency costs, browser back with preserved purchase inputs, fresh sample clearing, invalid input, result reachability, six-screen and sheet accessibility, service-worker readiness, offline record reopening, cache API exclusion and reconnect. The first stable build exposed the contrast/focus/confirmation failures above; the repeated run proves their correction.

The keyboard check reduces/emulates viewport height and exercises navigation hiding plus a result jump. It is not a real operating-system keyboard. Safe-area rules and install metadata are inspected, but physical iOS/Android home-screen installation is not claimed. Private API security/storage tests are separate from this visual review; no live shared Supabase account was connected.

Final root verification repeated the production build, clean typecheck/lint, 50 unit/API tests and all 10 browser tests (9.2s). The isolated private browser check confirmed Nurul’s S$512/2,048-mile purchase, S$488 remaining after reload, two-device sync and no API cache. Additional screenshots of all six screens at 720 × 1024 and 820 × 1180 show no overflow; tablet Home and the refined 390px goal artwork were visually inspected. Final evidence lives in `artifacts/final` and `artifacts/private`. A complete local mobile Lighthouse report scored performance 96, accessibility 100 and best practices 100; the temporary-profile cleanup limitation is recorded in `docs/TOOLING.md`.

## GitHub Pages and Supabase gate — rendered follow-up

Accepted for the inspected static-export states. The account gate keeps the same type, route mark and warm canvas as the application. Visible Email and Password labels make the next action clear; the invited-email placeholder explains the private access model. The remember-device option starts unchecked and its label provides a 44px touch area. The offline gate explains why the wallet is unavailable and offers one reconnect action.

The shared placeholder color was refined from 3.20:1 contrast to 5.74:1 against the input surface. Updated login screenshots were inspected after the rebuild. No unresolved blocker or major visual issue remains in these states. The short-viewport screenshot demonstrates scroll and focus reachability; it does not simulate a real operating-system keyboard.

| Area | Follow-up score (1–5) |
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

`npm run build:pages` successfully exported the isolated app with fake public Supabase configuration at `/our_miles/`. `npm run verify:pages` passed against those exported files: 49 files and 34 assets, correct manifest/icon/font paths, rejected login and non-member access, optimistic save/reload, conflict rejection, owner-preserving pending/posting flow, remembered and temporary authentication, logout, and an offline cold-start gate. Twenty cached resources were public and same-origin; no API or Supabase responses entered Cache Storage. No private wallet data entered browser persistence. The functional browser context reported zero CSP violations, runtime errors or asset failures. Auth and Home had zero automated WCAG A/AA findings in a separate accessibility-auditor context.

Actual pixels inspected: login at 360 × 800 and 390 × 844, the 390px reduced-height login, empty confirmed-access Home and the offline private gate. Evidence is in `artifacts/pages/verification.json` and the five listed screenshots. Authentication and REST were mocked; this does not claim a live Supabase login, deployed database policy check, physical PWA installation or completed GitHub deployment.

The exported HTML uses a meta CSP with hashes for generated inline hydration scripts. A Zod runtime support probe initially violated that policy; disabling JIT resolved it without permitting inline scripts or eval. Pages does not use the Node-mode security headers. In particular, meta CSP cannot enforce [`frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors); that hosting limit remains documented.
