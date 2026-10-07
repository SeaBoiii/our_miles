# our_miles

A private, mobile-first wallet for Aleem and Nurul. Choose a purchase category and amount; compare both wallets using eligible earn, remaining capacity, FX costs, cashback and incremental welcome rewards.

## Run locally

Use [Node.js 24 LTS](https://nodejs.org/en/about/previous-releases) (minimum 22, required by the Supabase SDK).

```sh
npm install
npm run dev
```

Open http://localhost:3000. With no private configuration, the app explicitly opens an isolated **sample wallet**. The sample balance, ownership, usage and welcome offer are illustrative. Use Profile → Start fresh to clear sample data. Demo changes remain on that device.

## Host on GitHub Pages with Supabase

The recommended deployment is a static GitHub Pages app with **two invited Supabase Auth accounts** and a database protected by row-level security. The Pages build has no Node API routes or shared PIN. Its public URL and publishable key grant no access to private wallet data.

Follow the [GitHub Pages and secure Supabase setup guide](docs/HOSTING.md): create the project and two users, apply both SQL migrations, allowlist their user IDs, add the two public repository variables, and select **GitHub Actions** in Pages settings. The included [deployment workflow](.github/workflows/pages.yml) builds and publishes `out/`.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YOUR_KEY'
$env:NEXT_PUBLIC_BASE_PATH = '/our_miles'
npm run build:pages
```

`npm run verify:pages` uses the dedicated fake public configuration described in the guide to test the export without connecting to a live project. Private wallet data is never exported or placed in the offline cache. Remembering a trusted device stores its Auth session; leaving the option off keeps the session in that tab.

## Optional Node server with a private PIN

Copy `.env.example` to `.env.local`; set `OUR_MILES_PIN` (6–12 digits) and `OUR_MILES_SESSION_SECRET` (at least 32 random characters). Restart the server. You now get a PIN gate and a fresh wallet, separate from the demo. Confirm the active cards, current usage, statement-cycle dates and any welcome offer before relying on recommendations.

The default store is `.our-miles/state.json`, suitable for one persistent Node server. Back it up. Ephemeral/serverless hosting requires the optional server Supabase adapter and migration, or an explicitly configured persistent directory. Deploy over HTTPS for secure cookies and installation. These server settings are separate from GitHub Pages. Hosting and credentials are not configured or deployed by this build.

See [private storage and setup](docs/PRIVACY.md) for exact variables, Supabase setup and operational limits. Bank card numbers, security codes and banking credentials are never requested or stored.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run start
npm run test:e2e
node scripts/verify-private.mjs
```

Install Chromium once with `npx playwright install chromium` if needed. Private browser verification uses random test credentials and temporary storage. The service worker registers only in production, so offline/install QA uses `build` and `start`.

## Financial boundaries

Versioned bank rules live in `src/lib/rules.ts`; pure calculations in `src/lib/engine.ts`; personal state in `src/lib/state.ts`; UI in `src/components`. Each recorded transaction preserves its original calculation and source. Reversing a record restores tracked capacity; confirming bank posting updates qualifying spend. Both actions affect this tracker only.

MCC hints are **Likely**, never confirmed from a merchant name. Unknown usage withholds bonus estimates. HSBC figures use Asia Miles conversion and disclose the difference from KrisFlyer. Flat transfer fees require your expected transfer-size allocation. DBS Esso pump discounts and UOB One quarterly cashback remain manual-review templates; their benefits are omitted from automated ranking.

Read [card sources and calculation boundaries](docs/CARD_RULES.md). The banks’ actual classification and posted rewards are final. Recheck changing terms before use; source dates remain attached to rules and records.

## Design and verification

[Design system](docs/DESIGN_SYSTEM.md), [three directions and research](docs/DESIGN_RESEARCH.md), [tooling](docs/TOOLING.md), and [rendered design review](docs/DESIGN_REVIEW.md). QA screenshots are generated in the gitignored `artifacts/` directory.
