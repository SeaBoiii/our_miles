# Tooling

- Next.js App Router, React, strict TypeScript; version locked in package-lock.json. APIs checked against [current Next.js documentation](https://nextjs.org/docs/app/getting-started/installation).
- Tailwind CSS v4 PostCSS integration; semantic CSS tokens establish the visual system.
- Radix Dialog supplies focus trapping, Escape dismissal, and focus restoration for mobile sheets.
- Motion uses LazyMotion with reduced-motion policy; only meaningful state transitions.
- Vitest tests independent recommendation/period/auth logic. Playwright tests rendered flows, responsive screenshots, offline behavior, and Axe accessibility.
- Project skill: [.agents/skills/our-miles-design-critic/SKILL.md](../.agents/skills/our-miles-design-critic/SKILL.md), applied during direction selection and rendered visual QA.
- 21st CLI 1.17.1 initialized design context. Catalog search and usage require unavailable login, so hosted generation was not attempted. Public [21st mobile navigation guidance](https://news.21st.dev/blog/react-mobile-navigation-components) informed safe-area and keyboard behavior. No arbitrary registry components installed.
- Context7, Motion AI Kit, Chrome DevTools MCP, and ElevenCreative are not connected in this session. Official framework/bank documentation and Playwright are the fallbacks. No credentials or unrelated environment configuration changed.
- Icons and the compact destination landscape are original SVGs; local font assets reuse the family typeface. No external media waterfall.
- 21st local review completed: informational literal-color findings in the token stylesheet and original vector art; no structural or interaction findings. The project critic and rendered contrast checks govern those deliberate colors.
- Google Lighthouse produced a complete local mobile report: performance 96, accessibility 100, best practices 100; LCP 2.3s, CLS 0.01, blocking time 170ms. Raw report: `artifacts/lighthouse.json`. Its Windows temporary-profile cleanup then failed with EPERM; report generation succeeded with no audit runtime error. These are simulated local measurements, not physical-phone benchmarks.
- GitHub Pages uses an isolated Next static export with Webpack because Turbopack rejects the dependency junction outside the staging root. The standard Node build remains unchanged. The exported app uses Supabase JS for Auth and authenticated data access; Zod is configured without JIT for the strict script policy. PGlite is a development-only PostgreSQL engine for migration/RLS regression checks. Pages browser QA uses an entirely mocked Supabase project; the publishing workflow repeats the export with the actual public repository configuration before uploading.
