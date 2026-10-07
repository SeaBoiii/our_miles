# Private access and storage

Our Miles supports a private Supabase wallet on GitHub Pages, an optional private Node server, and an explicit local sample-data demo. Browser Supabase configuration takes precedence. Without browser configuration or a server PIN/signing secret, demo changes belong only to that browser and the private state API is disabled. Partial private configuration fails closed. See [HOSTING.md](HOSTING.md) for complete Pages setup.

## GitHub Pages and browser Supabase Auth

GitHub Pages serves public app files. Aleem and Nurul sign in with separate administrator-created email/password accounts. Only the HTTPS project URL and a `sb_publishable_` key enter the public build; Pages has no shared PIN, server API or secret key. Public signup and anonymous sign-in must be disabled in Supabase. A private Git repository does not substitute for database authorization.

Apply both migrations in order. `public.our_miles_members` has exactly two possible owner slots, each bound to a unique Auth UID. Browser access requires both slots configured and the authenticated UID allowlisted. Membership SELECT exposes only the signed-in user's row. Membership writes are administrator-only. The shared wallet permits member SELECT; writes use the guarded `save_our_miles_state` RPC, with authenticated direct UPDATE revoked. An unlisted signed-in account receives no wallet rows and cannot save. RLS and explicit RPC membership checks enforce this independently of the frontend.

The browser verifies restored sessions with Supabase Auth before opening the wallet. The trusted-device option starts off. Auth tokens use sessionStorage by default; choosing a remembered device stores tokens in localStorage. Neither stores wallet contents there. These browser-readable tokens need the same care as other signed-in browser sessions; Pages cannot issue server HttpOnly cookies. Sign-out clears local auth storage even if network revocation fails. Supabase's [API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys) and [RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) describe the underlying boundary.

## Optional private Node server

For shared-PIN server mode, leave browser Supabase settings empty. Copy `.env.example` to `.env.local`, choose a new 6–12 digit `OUR_MILES_PIN`, and supply a random `OUR_MILES_SESSION_SECRET` of at least 32 characters. Generate one locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Set `OUR_MILES_PUBLIC_ORIGIN` to the HTTPS origin when using a proxy. Restart after changing settings. No real PIN or credential is included in the repository.

The server verifies the PIN and signs a session in an HttpOnly, SameSite=Strict cookie. Production cookies require HTTPS. Ordinary sessions expire after eight hours; remembered trusted devices after thirty days. The Aleem/Nurul profile is a device preference; both share one wallet. Sign-out removes the cookie; rotating the signing secret invalidates all sessions. Copied tokens otherwise remain valid until expiry.

State reads/writes require a valid server session. Responses use `private, no-store`; mutations require the same Origin. Login attempts are limited to eight per identity per fifteen minutes, plus a server-wide limit. By default both users share the conservative identity bucket. Enable `OUR_MILES_TRUST_PROXY=true` only when a trusted proxy overwrites `X-Forwarded-For` and prevents direct access. Limits live in one process and reset on restart. Multiple replicas need shared rate limiting and shared database storage.

## Storage and integrity

**Pages:** Supabase PostgreSQL stores the singleton wallet. The publishable key grants no anonymous table/RPC access. Both members can read/save the household state. See [HOSTING.md](HOSTING.md).

**One private Node server:** the default file is `.our-miles/state.json`, outside `public` and ignored by Git. Set `OUR_MILES_DATA_DIR` to a persistent private volume. The writer validates data, serializes writes in the process, flushes a temporary file and atomically renames it. File permissions request operating-system owner access; Windows uses the host directory's access controls. Run one process, since JSON writes do not coordinate multiple processes. Ephemeral storage is unsuitable. Recognized serverless environments require explicit storage configuration and otherwise refuse private saves.

**Node with Supabase storage:** set `OUR_MILES_SUPABASE_URL` and server-only `OUR_MILES_SUPABASE_SECRET_KEY` (`sb_secret_...`). The server adapter uses REST after PIN-session checks. The first migration supports this original mode; the second preserves service-role access and adds database validation. Never prefix a server secret with `NEXT_PUBLIC_`. Server secrets bypass RLS; Next.js authentication remains this mode's access boundary.

State has no fields for full card numbers, CVV, expiry/security details, banking passwords or Singpass. Strict app/database schemas reject unknown credential fields. Avoid putting credentials in merchant names or other free text. Updates are limited to 1 MiB; the database additionally checks canonical JSONB size. Database validation bounds collections, dates, URLs, IDs, owners, numbers, references and offer tiers.

Every save includes the version last loaded. Node returns HTTP 409 for stale versions; Supabase returns an empty RPC row array. Both preserve stored state, allowing reload before retry. Corrupt files surface as errors and are never silently reset. Recorded purchase evidence cannot change under the same transaction ID, except posting status/date. A corrected purchase needs a new record. The second migration retains private evidence across deletion/reinsertion; removing current activity does not erase that integrity record. Browser users cannot read/modify this evidence table.

For file backups, stop writes and copy `state.json` privately; restore with the app stopped. Supabase backups must include wallet, memberships and private evidence. Never commit credentials/backups or put them in `public` or browser caches.

## Installed and offline use

The manifest includes standalone mode, ordinary/maskable icons and an iOS touch icon. Installation/service workers require HTTPS except on localhost. iOS uses Safari's Share → Add to Home Screen. See [Next.js's PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).

The worker caches public shell, code, fonts and icons. It never caches `/api/` responses or cross-origin Supabase requests. Private wallet data is not persisted to localStorage, sessionStorage or Cache Storage. A private offline reload asks you to reconnect and verify sign-in. An already-open screen may retain loaded information in memory until closed or signed out. Demo remains usable offline in its own browser.

## Node API contract

These routes exist only on the Node deployment and are excluded from Pages.

| Route | Request | Response |
| --- | --- | --- |
| `GET /api/session` | Session cookie when present | `{ mode: 'demo' \| 'private', authenticated, owner: 'aleem' \| 'nurul' \| null }` |
| `POST /api/session` | `{ pin, owner, remember }`, JSON and same Origin | Private session and HttpOnly cookie |
| `DELETE /api/session` | Same Origin | Removes browser cookie |
| `GET /api/state` | Valid private session | `{ version, state }`; new wallet: `{ version: 0, state: null }` |
| `PUT /api/state` | Valid session; `{ version, state }`, JSON and same Origin | New `{ version, state }`, or `409` when stale |

Validation errors return `422`, expired sessions `401`, demo storage requests `403`, unavailable/incomplete infrastructure `503`. Sign-in bodies are capped at 2 KiB. Errors do not disclose paths, database responses or credentials.

## Verification

`npm run verify:supabase` runs real PostgreSQL migration, privilege, RLS, validation/integrity checks through isolated development-only PGlite. Trusted Supabase JWT functions/roles are stubbed; this is not live Auth/gateway QA. `npm run verify:pages` checks the static export with a mocked backend and screenshots under `artifacts/pages`; follow the documented mock build first.

After a normal production build, `node scripts/verify-private.mjs` starts an isolated server with random temporary credentials/storage. It checks cookies, shared state, reload/foreground refresh, recording an S$512 purchase with its 2,048-mile snapshot, remaining bonus capacity, offline gating and cache exclusions. It saves screenshots under `artifacts/private` and removes its temporary server/storage. It refuses an occupied QA port; `OUR_MILES_QA_PORT` can override port 3001.

No live Supabase project was available during implementation. Actual Auth settings, two-user login, deployed RLS and unauthenticated/outsider HTTP denial must be checked against the project using [HOSTING.md](HOSTING.md).
