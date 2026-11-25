# Plan: sign-in, search and a user menu

This plan says how to build what `docs/changes/multi-user/intent.md` asks for and `docs/spec.md` and its area files specify. Sign-in and the database come first, then search, then the user menu, then Render and the finishing checks.

IDs: G, S, U, F and M are the spec's requirements, in [platform.md](../../specs/platform.md), [accounts.md](../../specs/accounts.md), [search.md](../../specs/search.md) and [look-and-feel.md](../../specs/look-and-feel.md). CN1 to CN23 are the spec's [Concerns](../../spec.md#concerns). IC1 to IC15 are the intent's [Constraints](intent.md#constraints) in order, and SC1 to SC6 its [Success criteria](intent.md#success-criteria). PT, PH, W, R, TB, TF, TE and TM are this plan's parts, phases, work items, risks, and backend, frontend, end-to-end and by-hand tests. Test IDs carry on from the earlier changes (TB43, TF21, TE29, TM09).

## Files that change

The files are grouped into parts. Each file belongs to exactly one part, so each part can be built by a different agent without two of them editing the same file. Where one part needs something from another, such as a setting, a dependency or a generated type, the part that owns the file provides it, and the work items in [Order of work](#order-of-work) say which comes first.

Three choices keep the parts apart:

- The whole schema change is one migration in [PT1](#pt1), search columns included, so later phases change no shared backend file. One exception came up in PH2: `search_name` needed byte-order sorting on Postgres (IC9), and 0002 had already been applied to Supabase, so PT1 added migration 0003 ([W2.6](#w2-6)).
- New backend modules keep their own Pydantic models (`routers/search.py`, `routers/account.py`) instead of adding them to `schemas.py`.
- New frontend folders bring their own stylesheet (`account/account.css`, `search/search.css`), so only [PT6](#pt6) edits `components.css`.

### Backend

<a id="pt1"></a>**PT1 Database and settings**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `backend/app/config.py` | Every setting the change needs: the sign-in mode (`ACCOUNTABLE_SIGN_IN`, `local` or `supabase`, Supabase when unset), `DATABASE_URL` turned into a SQLAlchemy URL for psycopg, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, the Render host from `RENDER_EXTERNAL_HOSTNAME`, whether it runs on Render (`RENDER`), and where the built frontend is. A check that names any missing Supabase setting. | [W1.1](#w1-1) | Changed |
| `backend/app/db.py` | The `users` table; `created_by`, `updated_by` and `search_name` columns; the new indexes; an engine for Postgres (pre-ping, small pool) beside the SQLite one, chosen by the mode. On Postgres `search_name` is `VARCHAR COLLATE "C"`, through `String().with_variant(String(collation="C"), "postgresql")`, so it sorts by byte order as SQLite does (IC9). | [W1.2](#w1-2), [W2.6](#w2-6) | Changed |
| `backend/migrations/env.py` | Runs against the database the mode chooses, not only the SQLite file; the command-line upgrade uses `app_engine()`. In offline mode it writes SQL with no database connection, for the `sqlalchemy.url` option or else the mode's database (TB45). | [W1.2](#w1-2) | Changed |
| `backend/migrations/versions/0002_accounts_and_search.py` | Adds `users`, the four `created_by` and `updated_by` pairs and the three `search_name` columns, fills `search_name` for existing rows with Python's `casefold()`, and on Postgres turns on row level security for every table (CN21). It calls `casefold()` itself rather than importing `rules.search_key`, so the two must stay the same. Downgrading leaves row level security on, so the Data API stays shut. | [W1.2](#w1-2) | New |
| `backend/migrations/versions/0003_search_name_collation.py` | On Postgres, gives the three `search_name` columns the "C" collation, so they sort by byte order as on SQLite (IC9); their indexes are rebuilt with it. Changes nothing on SQLite. Downgrading restores the default collation. | [W2.6](#w2-6) | New |
| `pyproject.toml`, `uv.lock` | Adds `psycopg[binary]` and `pyjwt[crypto]`, and in PH4 `pyyaml` as a dev dependency for TB58 (see [New dependencies](#new-dependencies)) | [W1.1](#w1-1), [W4.1](#w4-1) | Changed |
| `backend/tests/test_config.py` | TB44 | [W1.1](#w1-1) | New |
| `backend/tests/test_migrations.py` | TB45, and TB57 for migration 0003 | [W1.2](#w1-2), [W2.6](#w2-6) | Changed |
| `backend/tests/test_db.py` | The new columns and indexes exist; `search_name` is required; removing a user empties `created_by` and `updated_by`; the Postgres engine has a small pool with pre-ping; `search_name` has the "C" collation on Postgres only | [W1.2](#w1-2), [W2.6](#w2-6) | Changed |

<a id="pt2"></a>**PT2 Sign-in on the backend**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `backend/app/auth.py` | Checks a token: with Supabase, an ES256 or RS256 signature against the project's published keys (fetched once and kept, fetched again once for an unknown key id), the issuer, the `authenticated` audience and expiry; with local sign-in, a key made when the process starts. Reads the person's id, email and display name (from the token's `user_metadata`: `display_name`, then `full_name`, then `name`), and adds or updates their `users` row only when something changed. Supabase's keys are kept until the process restarts, so a key Supabase revokes is still accepted until then. | [W1.3](#w1-3) | New |
| `backend/app/deps.py` | A `Person` dependency: the signed-in person's `users` row, or a 401 | [W1.3](#w1-3) | Changed |
| `backend/app/routers/account.py` | `GET /config`, `GET /me` (its name to show from `rules.shown_name`), and the local stand-in for Supabase Auth at `/local-auth/...` (sign in with a password, renew, read the person, sign out) for Test User, answering in Supabase Auth's shapes. The stand-in is mounted only for local sign-in and also checks the mode on each request. Like Supabase Auth's reuse interval, it renews with a used refresh token for 10 seconds after its first use ([R5](#r5)); where Supabase replays the first renewal's session, it issues a new one, which auth-js accepts just the same. | [W1.4](#w1-4) | New |
| `backend/tests/conftest.py` | Clears `DATABASE_URL` and the Supabase settings, sets local sign-in, makes the `client` fixture signed in as Test User, adds a second person (`second_person`) and a signed-out client, makes one signing key per test session, and fails any test that takes a second or more, except on CI (IC14) | [W1.5](#w1-5) | Changed |
| `backend/tests/test_auth.py` | TB46 to TB48. TB46 is plainly strict: the conditional xfail it carried until `main.py` protected the routes is removed. | [W1.3](#w1-3) | New |
| `backend/tests/test_account.py` | TB49 | [W1.4](#w1-4) | New |

<a id="pt3"></a>**PT3 Records: who added what**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `backend/app/rules.py` | `search_key(name)` (casefold, CN20) and `shown_name(name, email)` (display name, else email, else "Sample data", U9), the only two places those rules live | [W1.6](#w1-6) | Changed |
| `backend/app/schemas.py` | Responses for organizations, contacts and deals gain who added and last changed them, with dates; timeline activities gain who added them (null for stage changes). Activity replies from `POST` and `PATCH /activities` and the dashboard's items don't carry it, since the spec asks for it on timelines only. | [W1.6](#w1-6) | Changed |
| `backend/app/authorship.py` | The `created_by` and `updated_by` values every write shares, and the join on `users` that gives `added_by` and `changed_by` | [W1.6](#w1-6) | New |
| `backend/app/routers/organizations.py`, `contacts.py`, `deals.py`, `activities.py`, `timeline.py` | Every write except a delete takes the `Person` and sets `created_by` and `updated_by` as U8 says, including moves, marking done and D5; deletes record nothing, and `main.py` still requires sign-in for them. Renumbering a column keeps the other deals' `updated_at` (U8). Every write of a name sets `search_name`; reads join `users` for the names. | [W1.6](#w1-6) | Changed |
| `backend/app/seed.py` | Sets `search_name` on every sample record and leaves who added it empty; doesn't touch `users`. `load_sample_data(conn, today)` loads it through a given connection, for `seed_supabase.py`. | [W1.6](#w1-6) | Changed |
| `backend/tests/test_authorship.py` | TB50, and `search_name` on adding and renaming each kind of record ("Élan Straße" gives "élan strasse") | [W1.6](#w1-6) | New |
| `backend/tests/test_seed.py` | Sample records have a `search_name` and no one recorded; reseeding keeps `users` | [W1.6](#w1-6) | Changed |
| `backend/tests/test_performance.py`, `test_positions.py` | Their raw inserts set `search_name`, which is now required | [W1.6](#w1-6) | Changed |

<a id="pt4"></a>**PT4 Search on the backend**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `backend/app/routers/search.py` | `GET /search?q=`: casefolds and trims the text, escapes `%` and `_` (`LIKE` with autoescape and `ESCAPE '/'`), matches `search_name`, orders starts-with first then alphabetically, returns up to 5 per group with each group's total. A blank, missing or all-space `q` gives three empty groups. Each group's total comes from `count(*) OVER ()` in the same query, so a search makes three queries, not six. | [W2.1](#w2-1) | New |
| `backend/tests/test_search.py` | TB51, TB52 | [W2.1](#w2-1) | New |

<a id="pt5"></a>**PT5 Server and deployment**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `backend/app/main.py` | Includes every protected router with the `Person` dependency and `account` without it; the 401 reply in the usual error shape; allowed hosts plus the Render host, read on each request by the `KnownHostsOnly` middleware; at start, refuses local sign-in on Render, then migrates and seeds a new SQLite file, but never seeds Postgres; serves the built frontend when it exists, from its 404 handler rather than a catch-all route: a `GET` or `HEAD` outside `/api` gets the file at that path, else `index.html` (a path that tries to leave the folder with `..` gets `index.html` too), so the API's 404 and 405 replies are unchanged; later includes `search` | [W1.7](#w1-7), [W1.8](#w1-8), [W2.2](#w2-2) | Changed |
| `backend/app/routers/testing.py` | Unchanged in purpose: still mounted only while testing and still open, so the end-to-end fixture can reset the data before signing in | None | Unchanged |
| `backend/app/seed_supabase.py` | G15: shows the counts in the database at `DATABASE_URL` (0 for a table that doesn't exist yet), asks for "yes" (in any case, with spaces around it allowed), then migrates and loads the sample data, keeping `users`. When the database can't be reached it says so plainly, without the URL. | [W1.9](#w1-9) | New |
| `scripts/settings.mjs` | Loads `.env` with Node's own `process.loadEnvFile` when it exists and names any of the three settings that's missing. Gives the backend an environment without `ACCOUNTABLE_SIGN_IN`, so `npm start` can never use local sign-in. | [W1.8](#w1-8) | New |
| `scripts/start.mjs` | `npm start`: checks the settings, then runs the backend with Supabase sign-in on `PORT` or 8000, on `127.0.0.1` locally and `0.0.0.0` on Render | [W1.8](#w1-8) | New |
| `scripts/seed-supabase.mjs` | `npm run seed:supabase`: checks the settings, then runs `app.seed_supabase` | [W1.9](#w1-9) | New |
| `scripts/dev.mjs` | Starts the backend with local sign-in | [W1.7](#w1-7) | Changed |
| `package.json` | Scripts `build`, `start` and `seed:supabase` | [W1.8](#w1-8), [W1.9](#w1-9) | Changed |
| `.env.example` | The three setting names with no values | [W1.8](#w1-8) | New |
| `render.yaml` | One free web service on Render's Python runtime in the `oregon` region, beside the Supabase project (US West). Build: `pip install uv && uv sync --frozen && npm ci && npm run build`; start runs `node scripts/start.mjs`; health check `/api/health`. `PYTHON_VERSION` 3.12.14 and `NODE_VERSION` 24.22.1, since Render needs full versions; `UV_PROJECT_ENVIRONMENT=.venv-app`, so `uv sync` can't uninstall the uv that pip installed; the three settings with `sync: false` | [W4.1](#w4-1) | New |
| `backend/tests/test_render_yaml.py` | TB58 | [W4.1](#w4-1) | New |
| `backend/tests/test_serving.py` | TB53 | [W1.8](#w1-8) | New |
| `backend/tests/test_hosts.py` | TB54 | [W1.7](#w1-7), [W4.1](#w4-1) | New |
| `backend/tests/test_seed_supabase.py` | TB55 | [W1.9](#w1-9) | New |
| `backend/tests/test_startup.py` | TB56 | [W1.7](#w1-7) | New |

### Frontend

<a id="pt6"></a>**PT6 Frontend shell**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/package.json`, `package-lock.json` | Adds `@supabase/auth-js` (see [New dependencies](#new-dependencies)) | [W1.10](#w1-10) | Changed |
| `frontend/vite.config.ts` | Vitest's `testTimeout` is 1 second, or 10 on CI (IC14) | [W1.10](#w1-10) | Changed |
| `frontend/src/main.tsx`, `App.tsx` | `main.tsx` renders `<SessionGate><App/></SessionGate>` inside the query, router and toast providers; `App.tsx` needed no change for this. In PH3 `main.tsx` also calls `followDeviceTheme()` once, so System follows the device on every page. | [W1.10](#w1-10), [W3.3](#w3-3) | Changed |
| `frontend/src/shared/api.ts` | Sends `Authorization: Bearer` with the session's token; a 401 tells the session gate the session has ended instead of raising a toast. The account part connects through `connectSession(link)`, whose link gives `accessToken()` and `ended()`. A refused request's promise never settles, so nothing on the page reacts to it ([R12](#r12)), and the gate clears the cached queries after `ended()`. | [W1.10](#w1-10) | Changed |
| `frontend/src/shared/queryClient.ts` | Exports `useClearAll()`, which clears every cached query, for an ended session and signing out | [W1.10](#w1-10) | Changed |
| `frontend/src/shared/api-types.ts` | Regenerated with `npm run types` after each backend phase | [W1.10](#w1-10), [W2.3](#w2-3), [W3.3](#w3-3) | Changed |
| `frontend/src/shared/test-utils.tsx` | Record builders gain the new fields; `signIn` and `renderSignedIn(ui, client?, path?, person)` render inside a signed-in `SessionProvider`, and `renderApp` now renders the app signed in | [W1.10](#w1-10) | Changed |
| `frontend/src/main.test.tsx` | Stubs `/config` and a stored session, so the app starts signed in | [W1.10](#w1-10) | Changed |
| `frontend/src/pipeline/board.test.tsx` | Builds its deals with `dealRow`, which has the new fields | [W1.10](#w1-10) | Changed |
| `frontend/src/shared/TopBar.tsx` | The 64 px top bar with no line under it: the search box on the left, then the user menu on the right | [W2.3](#w2-3), [W3.3](#w3-3) | New |
| `frontend/src/shared/Layout.tsx` | Renders the top bar above the content; `SearchBox` takes no props | [W2.3](#w2-3) | Changed |
| `frontend/src/shared/Sidebar.tsx` | Drops the dark mode switch | [W3.3](#w3-3) | Changed |
| `frontend/src/shared/theme/components.css` | The `.authorship` style for [PT9](#pt9) (13 px, secondary text, 16 px above); top bar layout, 64 px high with no panel and no line under it, with the content's top padding cut from 28 px to 4 px; the switch's styles removed | [W1.12](#w1-12), [W2.3](#w2-3), [W3.3](#w3-3) | Changed |
| `frontend/src/shared/api.test.ts`, `frontend/src/App.test.tsx` | TF22, TF33. The app test for TF22 checks that no sign-in or "Couldn't" text shows, rather than an empty status region, since the search box adds a second one. TF33 finds the top bar as the banner outside `<main>`, because Testing Library also counts the page header as a banner. | [W1.10](#w1-10), [W2.3](#w2-3), [W3.3](#w3-3) | Changed |

<a id="pt7"></a>**PT7 Account: sign-in, user menu and theme**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/account/session.ts` | Reads `/config`, then makes the auth-js client: Supabase's URL and publishable key, or `/api/local-auth` for local sign-in, with the session stored under `accountable.session`. `SessionProvider` and `useSession()` give the session and the person, whose name comes from the token's `user_metadata` (`display_name`, then `full_name`, then `name`). An ended session is removed from storage. | [W1.11](#w1-11) | New |
| `frontend/src/account/SessionGate.tsx` | U1 and U3: shows the sign-in screen at any address while signed out or after the session ends, and the page asked for once signed in. It follows auth-js's session changes, so a renewed session, or one signed in from another tab, updates the person the menu shows (CN17; found in the independent review). | [W1.11](#w1-11) | New |
| `frontend/src/account/SignInPage.tsx` | U2, U3, U7: the form (both fields required), its messages, and the local note with the fields filled in. "Your session has ended. Sign in again." sits under the button in the usual text color as a status, not an error. If `/config` can't be reached, the screen shows U2's "Couldn't reach" message and Sign in tries again (U2). | [W1.11](#w1-11) | New |
| `frontend/src/account/initials.ts` | U11 | [W3.2](#w3-2) | New |
| `frontend/src/account/UserMenu.tsx` | U11, U12, U4: the initials circle, the menu, its keyboard use, and signing out. The name and email come from `useSession()`, which reads the sign-in token, not from `/me` (Concern 17). The circle is named "Account menu for" the name, or the email when there's none. The arrows move through the menu's items, the theme choices included. Escape or Tab closes it and puts focus back on the circle (Tab as the ARIA menu pattern does). A click outside closes it and puts focus back on the circle, unless the click landed in a field such as the search box, where focus stays. Choosing a theme keeps the menu open. | [W3.2](#w3-2) | New |
| `frontend/src/account/account.css` | Sign-in screen and user menu styles, from tokens only | [W1.11](#w1-11), [W3.2](#w3-2) | New |
| `frontend/index.html` | The theme script: `light` leaves dark off, `system` follows `prefers-color-scheme`, anything else is dark | [W3.1](#w3-1) | Changed |
| `frontend/src/shared/theme/mode.ts` | Theme `light`, `dark` or `system` under `accountable.theme`, anything else read as dark; applies it, saves it, and follows the device while System is chosen. Exports `followDeviceTheme()`, which `main.tsx` calls once. | [W3.1](#w3-1) | Changed |
| `frontend/src/shared/theme/ThemeChoice.tsx` | Light, Dark and System as three `menuitemradio` items in a group named "Theme" inside the menu, the chosen one checked, so screen readers say "checked" rather than "selected". The visible "Theme" label sits outside the `role="menu"` element. The items have `tabIndex` -1: the menu's arrow keys move focus to them. | [W3.1](#w3-1) | New |
| `frontend/src/shared/ThemeSwitch.tsx`, `ThemeSwitch.test.tsx` | Replaced by the theme choice | [W3.1](#w3-1) | Deleted |
| `frontend/src/account/session.test.ts`, `SessionGate.test.tsx`, `SignInPage.test.tsx`, `initials.test.ts`, `UserMenu.test.tsx` | TF23 to TF25, TF29, TF30 | [W1.11](#w1-11), [W3.2](#w3-2) | New |
| `frontend/src/shared/theme/mode.test.ts`, `ThemeChoice.test.tsx` | TF31, TF32 | [W3.1](#w3-1) | Changed, new |

<a id="pt8"></a>**PT8 Search on the frontend**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/search/SearchBox.tsx` | F1 to F6: the box, the grouped results, keyboard use and the combobox roles. The input is `type="text"`, because Chrome's search input clears its text on Escape. A hidden status inside the search landmark reads the total as "N results", or the no-results text, and each group is named by `aria-label`. A change of path (not only of query string) clears the box and closes the results, a product owner's decision from TM17. | [W2.4](#w2-4) | New |
| `frontend/src/search/useSearch.ts` | F7: waits for a 150 ms pause, keys each request by its text, and keeps showing the last results until newer ones arrive. Clearing the box forgets them, so text typed next shows nothing until its own reply. | [W2.4](#w2-4) | New |
| `frontend/src/search/highlight.ts` | Finds the matching part of a name, ignoring case, for the bold. It copies Python's `casefold()` for ß, ς and ſ; rarer letters that only `casefold()` folds still match, but aren't bolded. | [W2.4](#w2-4) | New |
| `frontend/src/search/search.css` | Search box and results styles, from tokens only | [W2.4](#w2-4) | New |
| `frontend/src/search/SearchBox.test.tsx`, `highlight.test.ts` | TF27, TF28 | [W2.4](#w2-4) | New |

<a id="pt9"></a>**PT9 Record pages: who added what**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `frontend/src/shared/Authorship.tsx` | "Added by Jane Smith on 3 Nov 2026" and "Last changed by Sam Lee on 16 Nov 2026", in the existing secondary-text style | [W1.12](#w1-12) | New |
| `frontend/src/organizations/OrganizationPage.tsx`, `contacts/ContactPage.tsx`, `deals/DealPage.tsx` | Show it at the foot of the details panel (U10) | [W1.12](#w1-12) | Changed |
| `frontend/src/activities/Timeline.tsx` | Each activity shows "Added by" at the end of its meta row, not in the date column, which is mono and doesn't wrap | [W1.12](#w1-12) | Changed |
| `frontend/src/shared/Authorship.test.tsx` and the three record page tests, `Timeline.test.tsx` | TF26 | [W1.12](#w1-12) | New, changed |

### End-to-end tests

<a id="pt10"></a>**PT10 End-to-end**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `playwright.config.ts` | Starts the backend with local sign-in and without the Supabase settings | [W1.13](#w1-13) | Changed |
| `e2e/fixtures.ts` | Resets the data, then signs in as Test User through the sign-in screen once per run and reuses that browser state, so every existing test runs signed in; the `request` fixture carries the saved session's token. Shared helpers `accountCircle`, `accountMenu` and `chooseTheme` open the user menu and pick a theme. | [W1.13](#w1-13), [W3.4](#w3-4) | Changed |
| `e2e/sign-in.spec.ts` | TE30 to TE33 | [W1.13](#w1-13) | New |
| `e2e/authorship.spec.ts` | TE34 | [W1.13](#w1-13) | New |
| `e2e/search.spec.ts` | TE35 | [W2.5](#w2-5) | New |
| `e2e/user-menu.spec.ts` | TE36 | [W3.4](#w3-4) | New |
| `e2e/dark-mode.spec.ts` | TE26 signs in first, since blocked storage can't hold the session; later TE23 to TE29 rewritten for the theme choice, and TE37 | [W1.13](#w1-13), [W3.4](#w3-4) | Changed |
| `e2e/console.spec.ts` | TE21 also walks the sign-in screen, open search results and the open menu, and switches theme through the menu | [W1.13](#w1-13), [W2.5](#w2-5), [W3.4](#w3-4) | Changed |
| `e2e/persistence.spec.ts` | TE09 starts its second backend, on port 8101, with local sign-in and signs in on it | [W1.13](#w1-13) | Changed |
| `e2e/pipeline.spec.ts` | TE12 waits for the board total before reading it; TE11's reads poll, and `moveSaved` waits for the board to reload after each save | [W1.13](#w1-13), [W2.5](#w2-5) | Changed |
| `e2e/deals.spec.ts` | TE06's sort check waits for the list and polls | [W2.5](#w2-5) | Changed |

### Docs and harness

<a id="pt11"></a>**PT11 Docs and harness**

| File | Purpose | Work | Status |
| --- | --- | --- | --- |
| `docs/STATUS.md` | Each phase's notes; the setup guide gains creating the Supabase project, adding people with a display name, filling in `.env`, `npm run seed:supabase`, `npm start` and deploying to Render | Every phase, [W4.2](#w4-2) | Changed |
| `docs/specs/platform.md` | Libraries table gains psycopg, PyJWT and auth-js | [W4.2](#w4-2) | Changed |
| `docs/TECH_STACK.md` | Supabase and Render are no longer "later" | [W4.2](#w4-2) | Changed |
| `.claude/agents/ui-check.md` | Signs in as Test User on the filled-in local sign-in screen, and stops if the screen asks for a real password (IC8) | [W4.2](#w4-2) | Changed |
| `AGENTS.md` | Lists `npm start` and `npm run seed:supabase`, and how ui-check signs in | [W4.2](#w4-2) | Changed |
| `docs/changes/multi-user/plan.md` | Kept in step with the build | Every phase | Changed |
| `.gitleaks.toml` | The allowlist skips what `.gitignore` ignores: `.env` and every `.env.<name>` except `.env.example`, which is committed and still scanned. Found in TM19, when a renamed `.env.off` failed the check. | [W4.2](#w4-2) | Changed |

### New dependencies

IC15 allows a new dependency only when the plan makes the case. Three are needed for the app, and a fourth, PyYAML, for one test only:

| Dependency | Where | Why it's needed | Instead of |
| --- | --- | --- | --- |
| `psycopg[binary]` | Backend | SQLAlchemy needs a driver to reach Postgres. The binary wheels mean Render's build needs no compiler. | Nothing: there's no Postgres without a driver. |
| `pyjwt[crypto]` | Backend | Checks the ES256 or RS256 signature on Supabase's tokens, with `PyJWKClient` fetching and keeping the project's keys. Getting signature checks wrong is a security hole, and checks like `alg` pinning, expiry and audience are what this library is for. Local tokens use the same library with a key made at start, so there's one way of checking. | Asking Supabase's `/auth/v1/user` about every request: no dependency, but a round trip to Supabase on every request (G7) and its rate limits. |
| `@supabase/auth-js` | Frontend | Signs in, keeps the session and renews it before it expires. Supabase rotates the refresh token on each renewal, so two tabs renewing at once both use the same old token. auth-js 2.119 holds no lock across tabs by default (its `lock` option is deprecated); it relies on Supabase Auth's reuse interval, which renews a used refresh token again for 10 seconds by default ([R5](#r5)). This is the auth part of `supabase-js` alone, so the browser doesn't load database, storage and realtime clients that Accountable doesn't use. | Hand-written calls to Supabase Auth, which would have to re-create the session storage and the renewal timing. |
| `pyyaml` | Backend, dev only | TB58 reads `render.yaml` as YAML to check the service it describes. PyYAML was already installed through `uvicorn[standard]`; declaring it means the test no longer depends on another package's extras. Added in PH4 ([W4.1](#w4-1)). | Checking `render.yaml`'s text line by line, which is weaker. |

Not added: `python-dotenv` (Node's `process.loadEnvFile` reads `.env` in `scripts/settings.mjs`), an HTTP client for the backend, and a test timeout plugin (a hook in `conftest.py` and Vitest's `testTimeout` set the one-second limit).

## Order of work

Phases run in order, and each ends with `npm run check` passing and a note in `docs/STATUS.md`. Within a phase, parts run in parallel once what they need is in place; the Needs column says what that is. [PT6](#pt6) regenerates `api-types.ts` once the backend work of a phase is done, so frontend parts build against real types.

### Phases

Status: complete. All four phases, every work item and every by-hand check (TM10 to TM19) are done; `docs/STATUS.md` has each phase's notes and the by-hand results.

| Phase | Name | Parts | Done when |
| --- | --- | --- | --- |
| <a id="ph1"></a>PH1 | Sign-in and the database | [PT1](#pt1), [PT2](#pt2), [PT3](#pt3), [PT5](#pt5), [PT6](#pt6), [PT7](#pt7), [PT9](#pt9), [PT10](#pt10) | Signed out, every page shows the sign-in screen and every API route refuses; signed in as Test User, every existing test passes; records show who added them; `npm start` signs in against the real Supabase project with its data loaded by `npm run seed:supabase` (TM10). |
| <a id="ph2"></a>PH2 | Search | [PT1](#pt1), [PT4](#pt4), [PT5](#pt5), [PT6](#pt6), [PT8](#pt8), [PT10](#pt10) | The top bar's search finds an organization, a contact and a deal by part of a name in any case (SC4). |
| <a id="ph3"></a>PH3 | User menu | [PT6](#pt6), [PT7](#pt7), [PT10](#pt10) | The menu shows the initials, name and email, signs out, and holds the theme, with System following the device and dark the default (SC5). The sidebar switch is gone. |
| <a id="ph4"></a>PH4 | Render and finish | [PT5](#pt5), [PT11](#pt11) | The app runs on Render at its `onrender.com` address, signed in against Supabase (SC6); the by-hand checks are done; the docs match what was built (SC1 to SC6). |

### Work items

| ID | Phase | Part | Work | Needs | Delivers | Risks | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="w1-1"></a>W1.1 | [PH1](#ph1) | [PT1](#pt1) | Add `psycopg[binary]` and `pyjwt[crypto]`. Add every setting to `config.py`. Supabase is the mode when nothing says otherwise, so a forgotten setting can't open local sign-in. Building the settings never reads `.env` and never fails at import, so `npm run types` still works. | None | IC1, IC5, IC15, G14, CN16 | [R1](#r1), [R13](#r13) | [TB44](#tb44) |
| <a id="w1-2"></a>W1.2 | [PH1](#ph1) | [PT1](#pt1) | Add the tables, columns and indexes in `db.py` and the Postgres engine. Write migration 0002: on SQLite with batch mode, on Postgres with `ENABLE ROW LEVEL SECURITY` for every Accountable table and `alembic_version`. Fill `search_name` in Python, row by row, so both databases get the same values. | [W1.1](#w1-1) | IC1, IC7, IC9, G12, CN20, CN21 | [R3](#r3), [R6](#r6) | [TB45](#tb45) |
| <a id="w1-3"></a>W1.3 | [PH1](#ph1) | [PT2](#pt2) | Write `auth.py` and the `Person` dependency. Accept only the algorithms the key says, require `exp`, `aud` and `iss`, and reject a local token in Supabase mode and the other way round. Write the person's row only when the email or name changed. | [W1.2](#w1-2) | IC2, U5, U6, CN16, CN17 | [R2](#r2), [R7](#r7), [R8](#r8) | [TB46](#tb46) to [TB48](#tb48) |
| <a id="w1-4"></a>W1.4 | [PH1](#ph1) | [PT2](#pt2) | Write `routers/account.py`. The local stand-in answers the requests auth-js makes, in Supabase Auth's JSON shapes, including its error for a wrong password. It exists only in local mode. | [W1.3](#w1-3) | U7, IC6, IC8, CN16 | [R1](#r1), [R4](#r4) | [TB49](#tb49) |
| <a id="w1-5"></a>W1.5 | [PH1](#ph1) | [PT2](#pt2) | Change `conftest.py` so every existing test runs signed in, with a second person and a signed-out client for new tests, one signing key per session, and the one-second limit. | [W1.3](#w1-3) | IC8, IC14 | [R10](#r10) | Every TB |
| <a id="w1-6"></a>W1.6 | [PH1](#ph1) | [PT3](#pt3) | Credit every write to the `Person` as U8 says, set `search_name` on every name write through `rules.search_key`, add the names to the responses through `rules.shown_name`, and update the seed. | [W1.3](#w1-3), [W1.5](#w1-5) | IC4, IC7, U8 to U10, CN18 | [R14](#r14) | [TB50](#tb50); `search_name` on adding and renaming in `test_authorship.py` and from the seed in `test_seed.py`, until [TB51](#tb51) in [W2.1](#w2-1) |
| <a id="w1-7"></a>W1.7 | [PH1](#ph1) | [PT5](#pt5) | In `main.py`, protect the routers, add the 401 handler and the Render host, and choose the startup by mode: a new SQLite file is seeded, Postgres never is, and local sign-in refuses to start on Render. `dev.mjs` sets local sign-in. | [W1.3](#w1-3), [W1.4](#w1-4) | U5, G1, G4, G6, IC6 | [R1](#r1), [R11](#r11) | [TB46](#tb46), [TB54](#tb54), [TB56](#tb56) |
| <a id="w1-8"></a>W1.8 | [PH1](#ph1) | [PT5](#pt5) | `npm run build` and `npm start`: `settings.mjs`, `start.mjs`, `.env.example`, and serving the built frontend from `main.py`. | [W1.7](#w1-7) | G13, G14, IC5, SC6 | [R13](#r13) | [TB53](#tb53), [TM10](#tm10) |
| <a id="w1-9"></a>W1.9 | [PH1](#ph1) | [PT5](#pt5) | `npm run seed:supabase`: `seed_supabase.py` and its script. Never print `DATABASE_URL`. | [W1.6](#w1-6), [W1.8](#w1-8) | G15, IC6 | [R6](#r6), [R16](#r16) | [TB55](#tb55), [TM13](#tm13) |
| <a id="w1-10"></a>W1.10 | [PH1](#ph1) | [PT6](#pt6) | Add auth-js and the Vitest time limit. Regenerate the API types, update the record builders, add the token to `api.ts` and the 401 signal, and wrap the app in the session gate. | [W1.6](#w1-6), [W1.7](#w1-7) | IC2, IC14, U3, U5 | [R11](#r11), [R12](#r12) | [TF22](#tf22) |
| <a id="w1-11"></a>W1.11 | [PH1](#ph1) | [PT7](#pt7) | `session.ts`, `SessionGate.tsx` and `SignInPage.tsx`, styled from tokens per the spec's sign-in screen. | [W1.4](#w1-4), [W1.10](#w1-10) | U1 to U3, U7, IC3, M3 | [R4](#r4), [R5](#r5), [R12](#r12) | [TF23](#tf23) to [TF25](#tf25) |
| <a id="w1-12"></a>W1.12 | [PH1](#ph1) | [PT9](#pt9) | `Authorship.tsx` on the three record pages and on timeline activities. | [W1.10](#w1-10) | U10, SC3 | None | [TF26](#tf26) |
| <a id="w1-13"></a>W1.13 | [PH1](#ph1) | [PT10](#pt10) | Local sign-in in `playwright.config.ts`, the signed-in fixture, TE30 to TE34, and the sign-in screen in TE21. Run every existing end-to-end test signed in. | [W1.7](#w1-7), [W1.11](#w1-11), [W1.12](#w1-12) | SC2, SC3, IC8 | [R4](#r4) | [TE30](#te30) to [TE34](#te34), [TE21](#te21), [TE22](#te22) |
| <a id="w1-14"></a>W1.14 | [PH1](#ph1) | [PT11](#pt11) | Create the Supabase project and add one real person with a display name, then do TM10, TM11 and TM12 with `npm start`, so any gap between local sign-in and Supabase shows up before search and the menu are built on top. Record the exact steps for adding a person in `docs/STATUS.md`. | [W1.8](#w1-8), [W1.9](#w1-9), [W1.11](#w1-11) | SC6, CN17, CN21 | [R3](#r3), [R4](#r4), [R18](#r18) | [TM10](#tm10) to [TM13](#tm13) |
| <a id="w2-1"></a>W2.1 | [PH2](#ph2) | [PT4](#pt4) | `routers/search.py`. | [PH1](#ph1) | F2, F3, F7, IC9, CN20 | [R14](#r14) | [TB51](#tb51), [TB52](#tb52) |
| <a id="w2-2"></a>W2.2 | [PH2](#ph2) | [PT5](#pt5) | Include the search router, protected, in `main.py`. | [W2.1](#w2-1) | U5 | None | [TB46](#tb46) |
| <a id="w2-3"></a>W2.3 | [PH2](#ph2) | [PT6](#pt6) | Regenerate the types, add `TopBar.tsx` with the search box, and its layout in `components.css`. | [W2.2](#w2-2) | F1 | None | [TF33](#tf33) |
| <a id="w2-4"></a>W2.4 | [PH2](#ph2) | [PT8](#pt8) | `SearchBox.tsx`, `useSearch.ts`, `highlight.ts` and `search.css`, per the spec's search screen. | [W2.3](#w2-3) | F1 to F7, M3 | [R15](#r15) | [TF27](#tf27), [TF28](#tf28) |
| <a id="w2-5"></a>W2.5 | [PH2](#ph2) | [PT10](#pt10) | TE35, and search results in TE21. | [W2.4](#w2-4) | SC4 | None | [TE35](#te35), [TE21](#te21) |
| <a id="w2-6"></a>W2.6 | [PH2](#ph2) | [PT1](#pt1) | Migration 0003 and `db.py`: the "C" collation for `search_name` on Postgres, so names sort alphabetically by byte order on both databases. A new migration, since 0002 was already applied to Supabase. The next `npm start` applies it there. | [PH1](#ph1) | IC9, F3, CN20 | [R6](#r6) | [TB57](#tb57) |
| <a id="w3-1"></a>W3.1 | [PH3](#ph3) | [PT7](#pt7) | The theme: `index.html`, `mode.ts` with System, `ThemeChoice.tsx`; delete `ThemeSwitch.tsx` and its test. | [PH2](#ph2) | M1, M2, IC10, IC11, CN12 | [R17](#r17) | [TF31](#tf31), [TF32](#tf32) |
| <a id="w3-2"></a>W3.2 | [PH3](#ph3) | [PT7](#pt7) | `initials.ts` and `UserMenu.tsx` with the theme choice and signing out, which clears the cached queries and keeps the theme. | [W3.1](#w3-1) | U4, U11, U12, IC4 | None | [TF29](#tf29), [TF30](#tf30) |
| <a id="w3-3"></a>W3.3 | [PH3](#ph3) | [PT6](#pt6) | Put the menu in the top bar, take the switch out of the sidebar and its styles out of `components.css`, and call `followDeviceTheme()` from `main.tsx`. | [W3.2](#w3-2) | U11, IC10 | None | [TF33](#tf33) |
| <a id="w3-4"></a>W3.4 | [PH3](#ph3) | [PT10](#pt10) | TE36, TE37, the rewritten TE23 to TE29, and the menu in TE21. | [W3.3](#w3-3) | SC5 | [R17](#r17) | [TE21](#te21), [TE23](#te23) to [TE29](#te29), [TE36](#te36), [TE37](#te37) |
| <a id="w4-1"></a>W4.1 | [PH4](#ph4) | [PT5](#pt5) | `render.yaml`; deploy it, enter the three settings in Render, and do TM14. Render's health check sends the service's `onrender.com` host as the Host header, which G6 already allows, so `/api/health` gets no exemption and G6 stays strict (the product owner's decision). | [PH3](#ph3) | G16, IC13, SC6 | [R9](#r9), [R19](#r19) | [TM14](#tm14) |
| <a id="w4-2"></a>W4.2 | [PH4](#ph4) | [PT11](#pt11) | Update the docs and `ui-check.md`, do TM15 to TM19, run ui-check, and check every area file still matches what was built. | [W4.1](#w4-1) | SC1 to SC6, IC8 | None | [TM15](#tm15) to [TM19](#tm19) |

## Risks

| ID | Risk | Effect | What we'll do | Handled in | Proven by |
| --- | --- | --- | --- | --- | --- |
| <a id="r1"></a>R1 | Local sign-in ends up on in the built app | Anyone who finds the address signs in as Test User with a password written in the spec | Supabase is the mode unless `ACCOUNTABLE_SIGN_IN=local` is set, which only `dev.mjs`, `conftest.py` and `playwright.config.ts` do. `start.mjs` never sets it, and `settings.mjs` removes it from the backend's environment. Local sign-in refuses to start when `RENDER` is set. The `/local-auth` routes aren't mounted in Supabase mode, and a local token fails Supabase's key check. | [W1.1](#w1-1), [W1.4](#w1-4), [W1.7](#w1-7) | [TB44](#tb44), [TB46](#tb46), [TB49](#tb49), [TM14](#tm14) |
| <a id="r2"></a>R2 | The token check accepts a token it shouldn't: `alg: none`, an HS256 token signed with the public key, another project's token, an expired one | Anyone can act as anyone | Pin the algorithms to what each key says, and require `exp`, the `authenticated` audience and the project's issuer. Test each forged kind against every protected route. | [W1.3](#w1-3) | [TB46](#tb46), [TB47](#tb47) |
| <a id="r3"></a>R3 | Supabase's Data API exposes the tables to anyone with the publishable key (CN21) | The whole database, emails included, readable and writable from the browser | Row level security on every table in the migration, with no policies. Check with Supabase's security advisor and a direct Data API request. | [W1.2](#w1-2), [W1.14](#w1-14) | [TB45](#tb45), [TM12](#tm12) |
| <a id="r4"></a>R4 | The local stand-in answers differently from the real Supabase Auth | Everything passes locally and sign-in fails on Render | Copy Supabase Auth's response and error shapes. Sign in against the real project with `npm start` at the end of PH1, before anything is built on top. | [W1.4](#w1-4), [W1.14](#w1-14) | [TB49](#tb49), [TM10](#tm10) |
| <a id="r5"></a>R5 | Two tabs renew the same session at once, and Supabase ends it for reusing a refresh token | People are signed out at random | Rely on Supabase Auth's refresh-token reuse interval (10 seconds by default), which lets a second tab renew with the token the first just used; auth-js 2.119 has no cross-tab lock. Leave the interval at its default in the Supabase project. The local stand-in honours the same window, so a second tab behaves the same locally. Check with two tabs open for over an hour. | [W1.11](#w1-11) | [TM15](#tm15) |
| <a id="r6"></a>R6 | Something that works on SQLite fails on Postgres: the migration, a query (stricter `GROUP BY`, sums returned as `Decimal`), booleans, the seed | The built app breaks while every test passes on SQLite | Queries use only portable SQLAlchemy functions (none use SQLite-only ones today). Run the migration, the seed and every page against the real project in PH1, not at the end. | [W1.2](#w1-2), [W1.9](#w1-9), [W1.14](#w1-14) | [TM10](#tm10), [TM13](#tm13) |
| <a id="r7"></a>R7 | Updating the person's row on every request slows every request or makes writes queue | G7 missed, more so on Supabase | Read the row by its indexed `auth_id` and write only when the email or name changed | [W1.3](#w1-3) | [TB48](#tb48), [TM16](#tm16) |
| <a id="r8"></a>R8 | Supabase's keys are fetched on every request, or a rotated key is never picked up | Slow requests, or everyone refused after Supabase rotates its keys | Fetch once and keep; fetch again once, and no more often than every few minutes, when a token names an unknown key id. A failed fetch (found in the branch review) keeps the keys already held, answers 503 rather than 401 so no one is signed out, and is tried again after a few seconds. A known key never waits behind a fetch. A key Supabase revokes is still accepted until the backend restarts, which on Render's free plan happens whenever the service sleeps. | [W1.3](#w1-3) | [TB47](#tb47) |
| <a id="r9"></a>R9 | Render's free service sleeps and the pooler limits connections (CN22, CN23) | A minute's wait after a quiet spell; errors when connections run out | Session pooler URL; a small connection pool with pre-ping, so connections the pooler dropped are replaced; the wait is described in the setup guide | [W1.2](#w1-2), [W4.1](#w4-1) | [TM14](#tm14) |
| <a id="r10"></a>R10 | Unit tests creep over a second each, from key generation, a heavier app import or slower renders (IC14) | CI times out on its slower machine | One signing key per test session; the one-second limit fails any slower test locally; TM18 reads the timings | [W1.5](#w1-5), [W1.10](#w1-10) | [TM18](#tm18) |
| <a id="r11"></a>R11 | Parts built by different agents clash where they meet: the generated types, the router list in `main.py`, the test fixtures | Broken builds, or one agent undoing another's work | One owner per file, in [Files that change](#files-that-change); the Needs column orders the hand-offs; [PT6](#pt6) alone regenerates the types | Every work item | `npm run check` at the end of each phase |
| <a id="r12"></a>R12 | A 401 on one request turns into a toast storm, or a loop of renewals | A wall of errors when a session ends | `api.ts` signals the gate once and doesn't toast a 401; the gate shows the sign-in screen and stops queries. A 401 ends only the session that sent the request, so a late refusal for an earlier session can't end the one signed in since (found in the independent review). | [W1.10](#w1-10), [W1.11](#w1-11) | [TF22](#tf22), [TF25](#tf25), [TE33](#te33) |
| <a id="r13"></a>R13 | Reading settings at import breaks `npm run types` or the tests, which import `app.main` without any settings | `npm run check` fails without `.env`, against SC1 | Settings are read and checked when the app starts, never at import | [W1.1](#w1-1), [W1.8](#w1-8) | [TB44](#tb44), [TM19](#tm19) |
| <a id="r14"></a>R14 | A write path forgets to update `search_name`, so a renamed record can't be found by its new name | Search misses records with no error | `search_key` in `rules.py` is the only way to make it; every create and rename path is tested; the column is required, so a create without it fails | [W1.6](#w1-6), [W2.1](#w2-1) | [TB51](#tb51) |
| <a id="r15"></a>R15 | A slow reply for older text replaces newer results (F7) | Results that don't match the box | Results are keyed by their text in TanStack Query, and only the current text's results show. Earlier results stay only while the current text's reply is due; a failed search shows "Couldn't search." instead (found in the independent review). | [W2.4](#w2-4) | [TF27](#tf27) |
| <a id="r16"></a>R16 | A secret ends up in the repo or a log: `DATABASE_URL` holds the database password | The database exposed | Settings live only in `.env` (git-ignored) and Render; nothing prints `DATABASE_URL`; signing keys are made at run time, never committed; gitleaks runs on every commit and push. If gitleaks flags the documented test password, ask before allowing it. | [W1.8](#w1-8), [W1.9](#w1-9) | gitleaks in `npm run check`, [TB44](#tb44) |
| <a id="r17"></a>R17 | Making dark the default and adding System breaks the theme script's no-flash promise, or loses a saved choice | A flash of the wrong theme, or someone's light choice reset | The script stays inline in `<head>`; it reads the old `light` and `dark` values unchanged | [W3.1](#w3-1) | [TF31](#tf31), [TE25](#te25), [TE37](#te37) |
| <a id="r18"></a>R18 | Supabase's dashboard can't set a display name when adding a person | Records show emails, and initials come from the email | Check in PH1. If the dashboard can't, the setup guide gives the SQL editor statement that sets it. | [W1.14](#w1-14) | [TM11](#tm11) |
| <a id="r19"></a>R19 | Render's Python runtime lacks Node or uv for the build | The deploy fails | Install uv with pip in the build command and check Node is present on the first deploy; if it isn't, switch the service to the Node runtime and install uv there. Closed: the service uses the Python runtime, and Render's docs say Node and npm exist on every native runtime, with `NODE_VERSION` choosing the version. `UV_PROJECT_ENVIRONMENT` keeps the app's packages apart from the environment that holds uv. | [W4.1](#w4-1) | [TM14](#tm14) |

## Proof

`npm test` runs every automated test below. Backend tests use their own SQLite file per test, signed in as Test User through local sign-in unless a test says otherwise. The end-to-end tests reset the sample data, sign in as Test User through the sign-in screen, fix today at 16 Nov 2026, and fail on any console error. No test reads `.env` or reaches Supabase. Every earlier test (TB01 to TB43, TF01 to TF19, TE01 to TE22) keeps passing, signed in. TF20 and TF21 are retired with the switch they tested; TF31 and TF32 replace them. TF18 already checks that no file outside `tokens.css` names a color, so it covers the new stylesheets too (M5).

### Backend unit tests (pytest)

| ID | File in `backend/tests/` | Proves | Requirements | Risks |
| --- | --- | --- | --- | --- |
| <a id="tb44"></a>TB44 | `test_config.py` | The mode is Supabase when nothing is set and local only when `ACCOUNTABLE_SIGN_IN=local`; local is refused when `RENDER` is set; a missing Supabase setting is named; a `postgresql://` or `postgres://` URL becomes a psycopg URL; reading settings never fails at import, `app.main` imports with no settings, and nothing logs `DATABASE_URL` | G14, IC5, CN16 | [R1](#r1), [R13](#r13), [R16](#r16) |
| <a id="tb45"></a>TB45 | `test_migrations.py` | Migration 0002 upgrades a database made by 0001 with data in it: rows kept, `users` added, the new columns empty, `search_name` filled with the casefolded names. Generated as SQL for Postgres, with no database connection, it turns on row level security for every table; that SQL leaves out filling `search_name`, since there are no rows to read. | G12, IC1, IC7, CN20, CN21 | [R3](#r3) |
| <a id="tb46"></a>TB46 | `test_auth.py` | Every route except `/health`, `/config` and `/local-auth` answers 401 with "Sign in to use Accountable." for no token, a malformed one, an expired one, a wrong signature, `alg: none`, an HS256 token signed with the public key, the wrong issuer or audience, and a local token in Supabase mode. The routes are read from the app, so a new one can't be missed. `/testing/reset` is left out too, since it's mounted only while testing. | U5, IC2 | [R1](#r1), [R2](#r2) |
| <a id="tb47"></a>TB47 | `test_auth.py` | A token signed with a test ES256 key, published through a stubbed key set, is accepted. The keys are fetched once over many requests, and once more for a new key id. A failed fetch (unreachable, too slow, not JSON, not a key set, no usable keys) answers 503 with its message, not 401, keeps the keys already held, and is tried again after `RETRY_AFTER_FAILURE_SECONDS` but not before; a known key is found while another request's fetch is held up on another thread, with a bounded wait so a regression fails rather than hangs. | U5, IC2 | [R2](#r2), [R8](#r8) |
| <a id="tb48"></a>TB48 | `test_auth.py` | A person's first request adds their row; the same claims again write nothing; a new name or email updates it; a row added by a request at the same moment is used, and any other failure adding the row is raised rather than retried; a user id sent in a body is ignored | U5, CN17 | [R7](#r7) |
| <a id="tb49"></a>TB49 | `test_account.py` | `/config` says local, or gives Supabase's URL and publishable key and nothing else; `/me` gives the person and the name to show; the local stand-in signs Test User in with the right password, refuses a wrong one in Supabase Auth's error shape, renews, reads the person and signs out. Signing out follows Supabase's scopes: `local` ends only that browser's session, renewed or not, `others` every other one, and `global` all of them; `/local-auth` is missing in Supabase mode | U7, CN16, IC2 | [R1](#r1), [R4](#r4) |
| <a id="tb50"></a>TB50 | `test_authorship.py` | Adding sets who added and last changed; editing, moving on the board and marking a follow-up done set who last changed; D5 credits the contact's change to the person who won the deal; O4 and C6 clearing a link changes neither; renumbering a column keeps the other deals' last change; responses show the display name, the email when there's no name, and "Sample data" when no one is recorded; timeline activities show who added them and stage changes don't | U8, U9, U10, IC4, IC7, CN18 | None |
| <a id="tb51"></a>TB51 | `test_search.py` | `search_name` is set on adding and renaming an organization, contact and deal, and by the seed | F2, CN20 | [R14](#r14) |
| <a id="tb52"></a>TB52 | `test_search.py` | Search finds by part of a name in any case, "élan" finds "Élan Studio", spaces at the ends are ignored, `%` and `_` match only themselves, names starting with the text come first then alphabetical, at most 5 per group with the full count, and it needs sign-in | F2, F3, IC9, SC4 | [R14](#r14) |
| <a id="tb53"></a>TB53 | `test_serving.py` | With a built frontend in a temporary folder, its files are served by path, `/deals/12` gets `index.html`, and an unknown `/api` path still gets the JSON 404 | G13 | None |
| <a id="tb54"></a>TB54 | `test_hosts.py` | The Render host is answered when `RENDER_EXTERNAL_HOSTNAME` names it, and any other host is refused, as before; `/api/health` answers 200 to the Render host, as Render's health check sends it; an unknown host gets 400 on `/api/health`, `/api/config`, `/api/organizations` and `/deals/12`; the Render host is answered in any case and with a trailing dot, and so is an upper-case `RENDER_EXTERNAL_HOSTNAME` (found in the branch review) | G6, G16 | None |
| <a id="tb55"></a>TB55 | `test_seed_supabase.py` | Against a temporary database, it shows the counts; any answer but "yes" leaves the data as it was; "yes" loads the sample data and keeps `users` | G15, IC6 | [R16](#r16) |
| <a id="tb56"></a>TB56 | `test_startup.py` | With local sign-in, a missing SQLite file is created and seeded; in Supabase mode the database is migrated and never seeded; local sign-in won't start when `RENDER` is set; `npm run seed` loads the SQLite file even with `DATABASE_URL` set | G4, G5, IC6 | [R1](#r1) |
| <a id="tb57"></a>TB57 | `test_migrations.py`, `test_db.py` | Migration 0003, generated as SQL for Postgres, gives each `search_name` the "C" collation and its downgrade takes it away; on SQLite it changes nothing and keeps the data; the tables declare the collation for Postgres only | IC9, F3 | [R6](#r6) |
| <a id="tb58"></a>TB58 | `test_render_yaml.py` | `render.yaml` is one free web service that builds the frontend, starts with `node scripts/start.mjs` and is checked at `/api/health`; it names the three settings with `sync: false` and no values, and never sets `ACCOUNTABLE_SIGN_IN` | G16, IC13 | [R1](#r1), [R16](#r16) |

### Frontend unit tests (Vitest)

| ID | File in `frontend/src/` | Proves | Requirements | Risks |
| --- | --- | --- | --- | --- |
| <a id="tf22"></a>TF22 | `shared/api.test.ts` | Requests carry the session's bearer token; a 401 signals the session's end once and raises no toast, and the request never settles (each check races it against a 20 ms timer, so it doesn't carry into later tests); a late 401 for an earlier session, including one for a request that was waiting on that session's token, leaves the session signed in since alone | U3, U5 | [R12](#r12) |
| <a id="tf23"></a>TF23 | `account/session.test.ts` | The client points at Supabase with the publishable key, or at `/api/local-auth`, as `/config` says, and stores the session under `accountable.session` | IC2, U7 | None |
| <a id="tf24"></a>TF24 | `account/SignInPage.test.tsx` | The form signs in; a wrong password gives U2's message and keeps the email but not the password; an unreachable sign-in gives its message; local sign-in shows the note with the fields filled in; there's no sign-up or reset link | U2, U3, U7, IC3, G8 | None |
| <a id="tf25"></a>TF25 | `account/SessionGate.test.tsx` | Signed out, any address shows the sign-in screen and then opens that address once signed in; when the session ends, the sign-in screen says so and returns to the same page; a renewed session's name, and a session signed in from another tab, show in place of the person before | U1, U3, CN19 | [R12](#r12) |
| <a id="tf26"></a>TF26 | `shared/Authorship.test.tsx`, the three record page tests, `activities/Timeline.test.tsx` | Each record page shows who added and last changed it, with dates; "Sample data" for sample records; dates as `16 Nov 2026`; timeline activities show who added them | U9, U10, G10 | None |
| <a id="tf27"></a>TF27 | `search/SearchBox.test.tsx` | One request per pause in typing; an older reply never replaces newer results; text typed after clearing the box never shows the cleared text's results; going to another page (a new path, not only a new query string) clears the box and closes the results; groups in order with "N more" lines; no-results text; a failed search after a successful one says "Couldn't search." rather than keep the earlier results; arrows, Enter and Escape; clicking a result opens it and clears the box; combobox and listbox roles | F1, F3 to F7 | [R15](#r15) |
| <a id="tf28"></a>TF28 | `search/highlight.test.ts` | The bold part is found in any case, including accented letters, and nothing is bolded when the match can't be placed | F4 | None |
| <a id="tf29"></a>TF29 | `account/initials.test.ts` | "Jane Smith" gives JS, "Jane van der Berg" JB, "Cher" C, no name the email's first letter, always in capitals | U11 | None |
| <a id="tf30"></a>TF30 | `account/UserMenu.test.tsx` | The circle's name for screen readers, with the email when there's no name; the menu shows the name and email; it opens with a click, Enter or Space, moves with the arrows into the theme choices, and Escape or Tab closes it and puts focus back; a click outside closes it, with focus back on the circle unless the click landed in a field; choosing a theme keeps it open; signing out clears the cached data, shows the sign-in screen and keeps the theme | U4, U11, U12 | None |
| <a id="tf31"></a>TF31 | `shared/theme/mode.test.ts` | Dark with nothing saved; a saved `light` or `dark` kept; System follows the device and changes with it, and stops when another theme is chosen; a storage error changes nothing but the saving; `index.html`'s script, run with stubbed storage and device setting, makes the same choice | M1, M2, CN12, IC10, IC11 | [R17](#r17) |
| <a id="tf32"></a>TF32 | `shared/theme/ThemeChoice.test.tsx` | Three `menuitemradio` choices in a group named Theme, the current one checked, each chosen with Enter or Space. Reaching them with the arrows is in TF30. | M1 | None |
| <a id="tf33"></a>TF33 | `App.test.tsx` | Every page has the top bar with the search box and the user menu, and the sidebar (the complementary landmark) has no switch, no button and no "dark mode" text | F1, U11, IC10 | None |

### End-to-end tests (Playwright with Chrome)

| ID | File in `e2e/` | Proves | Requirements | Risks |
| --- | --- | --- | --- | --- |
| <a id="te21"></a>TE21 | `console.spec.ts` (changed) | Every page, the sign-in screen, open search results and the open menu run with no console errors, in light and in dark | G11, M3 | None |
| <a id="te22"></a>TE22 | `offline.spec.ts` (unchanged) | With local sign-in, nothing is fetched from outside the app | G2, IC12 | None |
| <a id="te23"></a><a id="te24"></a><a id="te25"></a><a id="te26"></a><a id="te27"></a><a id="te28"></a><a id="te29"></a>TE23 to TE29 | `dark-mode.spec.ts` (rewritten) | As before, with the theme chosen in the menu: a first visit is dark (TE23); Light and Dark are kept after a reload (TE24); no flash (TE25); blocked storage opens dark and the menu still works (TE26); the theme choice works by keyboard (TE27); colors change without a reload (TE28); typed text is kept (TE29) | M1 to M4, IC10, IC11 | [R17](#r17) |
| <a id="te30"></a>TE30 | `sign-in.spec.ts` | Signed out, the dashboard, a table, a record page and the pipeline each show the sign-in screen, and API routes answer 401 without a token | U1, U5, SC2 | None |
| <a id="te31"></a>TE31 | `sign-in.spec.ts` | Signing in as Test User on the filled-in screen opens the page asked for; a reload keeps them signed in | U1, U3, U7, G1, SC2 | [R4](#r4) |
| <a id="te32"></a>TE32 | `sign-in.spec.ts` | A wrong password shows U2's message and keeps the email; the sign-in's 400 in the console is allowed (G11) | U2, G11 | None |
| <a id="te33"></a>TE33 | `sign-in.spec.ts` | When the session ends (the stored token made invalid), the next page shows "Your session has ended. Sign in again." and signing in returns to that page; the 401s and the 403 from signing out with the refused token are allowed in the console (G11) | U3, CN19, G11 | [R12](#r12) |
| <a id="te34"></a>TE34 | `authorship.spec.ts` | A contact added through the form shows "Added by Test User on" today's real date (the backend records its own clock, not the tests' fixed 16 Nov 2026); an activity logged on it shows Test User; a sample record shows "Added by Sample data on" a date | U8 to U10, SC3 | None |
| <a id="te35"></a>TE35 | `search.spec.ts` | Typing part of a name in another case finds an organization, a contact and a deal from the top bar ("garcia" finds Garcia Freight, Sabrina Garcia, "Garcia data migration" and "Garcia hardware refresh"); arrows and Enter open one; Escape closes the results | F1 to F5, SC4 | None |
| <a id="te36"></a>TE36 | `user-menu.spec.ts` | The circle shows TU; the menu shows Test User and the email; it works by keyboard; Sign out shows the sign-in screen, and the theme chosen before is still on; the test starts signed out and signs in with a session of its own, so signing out (scope `local`) leaves the session the other tests share able to renew | U4, U11, U12 | None |
| <a id="te37"></a>TE37 | `dark-mode.spec.ts` | With System chosen, the page follows the emulated device setting from light to dark and back without a reload, and after one; a `light` saved before this change still opens light | M1, M2, SC5 | [R17](#r17) |

### By hand

| ID | Check | Requirements | Risks |
| --- | --- | --- | --- |
| <a id="tm10"></a>TM10 | With `npm run build` and `npm start` against the real project: sign in as a real person, try a wrong password, reload, open every page, add and edit a record, reload, and see the change kept and the person's display name on it | SC6, U1 to U3, U10, G3 | [R4](#r4), [R6](#r6) |
| <a id="tm11"></a>TM11 | Add a person in Supabase's dashboard with a display name, following the steps written in `docs/STATUS.md`; their name and initials show once they sign in | U9, U11, IC3, IC4, CN17 | [R18](#r18) |
| <a id="tm12"></a>TM12 | Supabase's security advisor reports no table without row level security, and a Data API request with the publishable key gets no rows | CN21 | [R3](#r3) |
| <a id="tm13"></a>TM13 | `npm run seed:supabase`: shows the counts; "no" changes nothing; "yes" loads the sample data | G15 | [R6](#r6) |
| <a id="tm14"></a>TM14 | Deploy from `render.yaml` with the settings entered in Render: the `onrender.com` address shows sign-in, signs in, opens a record link after a refresh, and comes back after the service has slept; the logs show no settings; local sign-in isn't there | G16, IC13, SC6 | [R1](#r1), [R9](#r9), [R19](#r19) |
| <a id="tm15"></a>TM15 | Two people in two browsers on Render work on the same records, and each is credited for their own changes; one person with two tabs stays signed in for over an hour | U3, U6, U8 | [R5](#r5) |
| <a id="tm16"></a>TM16 | G7 and F7 at full size locally, and on Render once it's awake | G7, F7 | [R7](#r7) |
| <a id="tm17"></a>TM17 | ui-check of the sign-in screen, the top bar, open search results and the open menu, in light and dark, with `npm run dev`, signing in as Test User, with contrast measured on the new small text | M3, M5, IC8, brand | None |
| <a id="tm18"></a>TM18 | The slowest backend and frontend unit tests, read from `pytest --durations` and Vitest's report, each under a second | IC14 | [R10](#r10) |
| <a id="tm19"></a>TM19 | `npm run check` passes with `.env` filled in, with it removed, and with the network off | SC1, IC8, IC12 | [R13](#r13) |
