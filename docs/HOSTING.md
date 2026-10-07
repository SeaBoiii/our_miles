# GitHub Pages + Supabase setup

GitHub Pages hosts the public application files; Supabase Auth and PostgreSQL protect the shared private wallet. Aleem and Nurul each sign in with their own email and password. A publishable key is safe to include in the site only because database permissions and row-level security enforce access. The shared-PIN Node server is a separate deployment option described in [PRIVACY.md](PRIVACY.md).

Pages runs a static export with no Next.js server or `/api` routes. The build script excludes server code and environment files. The resulting HTML, JavaScript, card rules and two profile names are public; wallet contents and passwords are not included. GitHub documents Pages as [static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages); Next.js describes the [static export limitations](https://nextjs.org/docs/app/guides/static-exports).

## 1. Create the Supabase project and close registration

Create a dedicated Supabase project, choosing an available region close to Singapore. Keep its database password private. In **Authentication → Sign In / Providers**, keep email/password sign-in enabled and turn off **Allow new users to sign up**. Turn off **Allow anonymous sign-ins** and leave unused providers disabled. Save the settings. Public registration must be disabled in Supabase even though the app has no signup button. These controls are described in [Supabase Auth configuration](https://supabase.com/docs/guides/auth/general-configuration).

Enable [MFA on your Supabase dashboard account](https://supabase.com/docs/guides/platform/multi-factor-authentication) and two-factor authentication on the GitHub account that controls deployment. These protect the administrator accounts; the app's two-user entrance uses email/password.

In **Authentication → Users**, use **Add user → Create new user** to create exactly two accounts with Aleem's and Nurul's own email addresses and distinct strong passwords. Mark their email addresses confirmed when creating these administrator-managed accounts. Copy each account's **User UID**; the UID, rather than email or editable user metadata, determines wallet membership. Keep passwords in a password manager, never in SQL, Git or repository variables.

In **Authentication → URL Configuration**, set the Site URL to the final address, for example `https://YOUR_GITHUB_USERNAME.github.io/our_miles/`. This app uses password sign-in and does not implement signup, magic-link or password-recovery callback screens. Account creation and password recovery are administrator tasks; see recovery below. Supabase's [user guide](https://supabase.com/docs/guides/auth/users) explains Auth users and their identities.

## 2. Apply both database migrations

In the project's **SQL Editor**, run the complete contents of these files, in order:

1. [202610050001_private_wallet.sql](../supabase/migrations/202610050001_private_wallet.sql)
2. [202610050002_browser_auth.sql](../supabase/migrations/202610050002_browser_auth.sql)

The first creates the singleton wallet and original server adapter. The second adds restricted browser access and database validation while preserving server-role access. The second migration is transactional and rejects an existing wallet that fails the closed state schema. Neither migration creates users, seeds private financial data or adds members.

Do not reapply the first migration after the second: it reinstates the original server-only function permissions. A new project needs both migrations in order; an existing project that already applied the first needs only the second.

## 3. Allowlist Aleem and Nurul

Replace both placeholder strings with real Auth User UIDs, then run this entire block in the SQL Editor. The unchanged placeholders are intentionally invalid UUIDs, so an unedited block cannot grant access. Both inserts happen together. The foreign key requires actual Auth users; a duplicate UID or owner aborts the operation.

```sql
do $$
declare
  aleem_uid uuid := 'REPLACE_WITH_ALEEM_AUTH_USER_UID'::uuid;
  nurul_uid uuid := 'REPLACE_WITH_NURUL_AUTH_USER_UID'::uuid;
begin
  if aleem_uid = nurul_uid then
    raise exception 'Aleem and Nurul need separate Auth accounts.';
  end if;
  insert into public.our_miles_members (owner, user_id)
  values ('Aleem', aleem_uid), ('Nurul', nurul_uid);
end;
$$;
```

The table has only two possible owner slots. Browser users cannot insert, update or delete memberships. Access fails closed until both slots exist; deleting either account or membership disables browser wallet access for both until an administrator restores the pair. Each user can select only their own membership, and both members can select the same wallet. An unlisted Auth user has no wallet access even if someone accidentally creates a third account.

Check setup as database administrator:

```sql
select owner, user_id from public.our_miles_members order by owner;
select id, version, state is null as new_wallet from public.our_miles_state;
select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('our_miles_members', 'our_miles_state');
select prosecdef, proconfig
from pg_proc
where oid = 'public.save_our_miles_state(bigint,jsonb)'::regprocedure;
```

Expect exactly Aleem and Nurul, one wallet row with `id = true`, two SELECT policies and `prosecdef = true` with an empty `search_path`. A fresh wallet is version zero with null state. Existing wallet data is preserved.

## 4. Choose the public project configuration

Copy the project HTTPS URL and a **publishable** API key from Supabase's project settings/API keys. The key must begin `sb_publishable_`. This app rejects secret keys and legacy service-role JWTs in browser configuration. Supabase's [API-key guide](https://supabase.com/docs/guides/getting-started/api-keys) distinguishes public publishable keys from secret keys that bypass row-level security.

For local development, copy `.env.example` to the ignored `.env.local` and set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_WITH_YOUR_PUBLIC_KEY
```

Restart `npm run dev` after editing configuration. Setting browser configuration activates Supabase mode; incomplete configuration shows a setup error. No shared PIN or server secret is needed for Pages. The real project URL and publishable key are public build inputs. User passwords, database passwords, `sb_secret_` keys and service-role credentials must never be browser variables or GitHub Pages configuration.

## 5. Verify the application and database locally

Use Node.js 24 (Node 22 is the minimum) and install the locked dependencies:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run verify:supabase
```

`verify:supabase` applies both real SQL migrations to isolated PostgreSQL through the development-only PGlite dependency. It stubs Supabase's trusted JWT functions and roles, then checks anonymous/outsider denial, two-owner constraints, own-row membership, shared reads, RPC-only client writes, optimistic versions, JSON validation, recorded evidence immutability across multiple saves and original service-role access. It uses no project, secrets or real wallet. This verifies SQL behavior; it does not test Supabase's live Auth server or HTTP gateway.

For a reproducible static export browser check, use these mock settings in a new PowerShell session:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_our_miles_qa'
$env:NEXT_PUBLIC_BASE_PATH = '/our_miles'
npm run build:pages
npm run verify:pages
```

That export checks the `/our_miles/` subpath, static assets, sign-in, remembering a trusted device, wallet writes/reloads, conflicts, sign-out, offline behavior, accessibility and public-bundle checks against a mocked backend. It creates screenshots under ignored `artifacts/pages`. Close this PowerShell session afterward; the mock export is for testing. Deployment builds a separate export using real public repository variables after this check.

For a real-project local Pages build, supply the real public URL/key as process environment variables and run `npm run build:pages`. The result is `out/`; the script does not load or copy `.env.local` into its staging directory. A repository site defaults to `/our_miles`; set `NEXT_PUBLIC_BASE_PATH` for a different repository, or to an empty string for a root/custom-domain site. GitHub Actions obtains the deployment base path automatically.

## 6. Put the project on GitHub

Create an empty GitHub repository named `our_miles`, without adding a README or `.gitignore` there. Repository visibility is separate from data access: plan the Pages application shell as publicly accessible, and rely on Supabase for private wallet access.

GitHub Free requires a public repository for Pages. Publishing from a private repository requires an eligible paid plan, such as GitHub Pro or Team. See [GitHub's Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

If this folder has no Git repository yet, run:

```powershell
git init
git branch -M main
git check-ignore .env.local .our-miles/state.json out/index.html
git add .
git status --short
git diff --cached --stat
```

Review staged files before committing. `.env.local`, private wallet files, build output, screenshots and test artifacts must be absent; `.env.example` contains empty examples and is intended to be committed. If a custom `OUR_MILES_DATA_DIR` is inside the repository, ignore that directory before staging. Then run:

```powershell
git commit -m "Build Our Miles with private Supabase wallet"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/our_miles.git
```

For an existing Git repository, preserve its history and remote instead of reinitializing it. Do not push private environment files or backups.

## 7. Configure GitHub Actions and publish

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add:

| Repository variable | Value |
| --- | --- |
| `SUPABASE_URL` | The project HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_` key |

These are public values. No secret key, user password, database password, PIN or Supabase personal access token is needed by the workflow.

Open **Settings → Pages**, choose **GitHub Actions** as the source, then push:

```powershell
git push -u origin main
```

Watch **Actions → Deploy Our Miles to GitHub Pages**. The checked-in [workflow](../.github/workflows/pages.yml) runs type/lint/unit/SQL checks, verifies a mock static export, rebuilds with real public configuration and uploads only `out/`. It derives the repository base path through `configure-pages`. The deployment job uses the `github-pages` environment and scoped Pages permissions. The URL appears in the completed deployment. GitHub documents this source in [Pages configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

If Pages settings are unavailable in the empty repository, push the code first, select **GitHub Actions** as the Pages source, then use **Actions → Deploy Our Miles to GitHub Pages → Run workflow** on `main`. The workflow also supports a manual run after correcting setup.

Changing a repository variable requires a new build: public Next.js variables are bundled at build time. Rerun the workflow after correcting or rotating public configuration. A missing URL/key or wrong key type fails the Pages build instead of falling back to demo.

## 8. Verify the real deployed access boundary

Open the deployed site in a private browser window. Confirm that the signed-out view contains no private wallet; sign in as Aleem, confirm his account identity, confirm an owned card and record a small intended purchase. Reload and check persistence. Sign in as Nurul on another device and check that she sees the same wallet. Foreground/reconnect refreshes shared state. Concurrent saves use a version check; a stale write must ask you to reload rather than silently overwrite changes.

These commands need only the public URL/key. Use `curl.exe` on Windows (`curl` on macOS/Linux). Set these PowerShell variables with your **public** values:

```powershell
$supabaseProjectUrl = 'https://YOUR_PROJECT_REF.supabase.co'
$supabasePublishableKey = 'sb_publishable_REPLACE_WITH_YOUR_PUBLIC_KEY'
curl.exe -i "$supabaseProjectUrl/rest/v1/our_miles_state?select=version,state" -H "apikey: $supabasePublishableKey"
curl.exe -i "$supabaseProjectUrl/rest/v1/our_miles_members?select=owner" -H "apikey: $supabasePublishableKey"
'{"expected_version":0,"next_state":{}}' | curl.exe -i -X POST "$supabaseProjectUrl/rest/v1/rpc/save_our_miles_state" -H "apikey: $supabasePublishableKey" -H 'Content-Type: application/json' --data-binary '@-'
```

All three unauthenticated requests must be denied, with no wallet contents. Use the publishable key in `apikey`; signed-in requests also use the user's access JWT in `Authorization: Bearer ...`. A publishable key is not a user JWT.

To check an outsider without creating a third account, run this read-only impersonation in the **SQL Editor**, then roll back:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
select owner from public.our_miles_members;
select version, state from public.our_miles_state;
rollback;
```

Choose a UUID different from both member UIDs. Expect zero rows from both SELECTs. This is an administrator-only SQL simulation, not a way to mint a signed Auth token. For an end-to-end outsider REST test, if another test Auth account already exists, its genuine JWT must likewise return `[]` from both SELECT routes, while the RPC returns permission denied (`42501`/HTTP 403). A member JWT must return exactly their own membership and one wallet row; direct table PATCH and membership writes must be denied. Keep test JWTs out of Git, screenshots and logs, then sign out the test session.

Confirm public signup and anonymous sign-in remain off. Test sign-out and an offline reload: cached app files can open, but the private wallet requires a connection and verified sign-in. Check browser Application/Storage tools: auth tokens may exist in session storage, or local storage only after choosing a trusted device; private wallet JSON and Supabase responses must not be in Cache Storage.

No live Supabase project or GitHub account was supplied during implementation. SQL and browser checks are automated locally; applying migrations, configuring actual accounts and completing live checks remain deployment steps.

## Database contract and integrity

The browser selects its own `owner` from `public.our_miles_members` by `user_id`, then selects `version,state` from the singleton `public.our_miles_state` where `id = true`. It saves through `public.save_our_miles_state(expected_version bigint, next_state jsonb)`. Success returns one `{ version, state }` row; a stale version returns an empty row array without changes. The function locks the row, explicitly verifies membership, uses an empty `search_path` and schema-qualified references. Authenticated users have no direct UPDATE permission. These safeguards follow [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [function privilege guidance](https://supabase.com/docs/guides/database/functions).

The database accepts closed state structure with bounded arrays, strings/numbers, valid dates, HTTPS sources, card references and at most 1 MiB of canonical JSONB text. Unknown credential fields are rejected. Only Aleem and Nurul can own cards. Reward snapshots and purchase evidence are immutable under an existing transaction ID; posting status/date can change. Private `our_miles_private.transaction_evidence` preserves this even after a record is removed/reinserted. It has no browser read/write access. Removing current activity does not erase private integrity evidence; use a new ID for a corrected purchase.

The optional authenticated Node server retains service-role access, including newer secret-key requests without a user JWT role claim. Server secrets bypass RLS and belong only on trusted servers. They are unnecessary for Pages.

## Recovery, backup and maintenance

For forgotten passwords, use trusted administrator user management. When direct password editing is unavailable in the dashboard, [server-side `auth.admin.updateUserById`](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) can set `{ password: newPassword }` for the existing Auth UID. Run it only from a trusted local/server process with a server secret and inputs outside committed files; never put this capability or key in the browser. Keeping the same UID preserves membership. There is no password-recovery redirect flow, so a recovery link pointing to the normal app home is insufficient.

For lost-device access, remove that user's membership in the SQL Editor immediately; this blocks database requests even from still-valid tokens, and leaves the pair closed until restored. Use Supabase administrator controls to revoke sessions/secure the account, then restore membership after recovery. Already-read information cannot be removed from another device's memory or screenshots. Sign out on shared devices; remember only trusted personal devices.

Use Supabase database backup/export facilities according to the project plan. A complete logical backup includes `public.our_miles_state`, `public.our_miles_members` and `our_miles_private.transaction_evidence`; a different project also requires recreating Auth users and mapping their new UIDs. Keep backups privately outside this repository. Review access settings after restoration and repeat member/outsider checks before using the wallet.

The export includes a hash-based script Content Security Policy and restricted connections in HTML. GitHub Pages cannot send app-defined HTTP security headers; header-level controls such as `frame-ancestors` require a host/proxy that supports them. Database authorization remains essential. Review dependency/migration changes and rerun SQL/export verification afterward.
