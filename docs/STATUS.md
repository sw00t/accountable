The MVP, dark mode, and sign-in with search and a user menu (multi-user) are built and merged, and Accountable is live on Render. Two of the MVP's by-hand checks are still open: TM04 (how fast it feels at full size) and TM05 (code review), listed under PH8.

## How to start Accountable

You need two free tools on your computer, installed once. After that, starting Accountable is one command, and it works with no internet connection.

### The first time

1. **Install Node.js.** Go to [nodejs.org](https://nodejs.org), download the version marked LTS, and run the installer with its usual choices.
2. **Install uv**, which runs the part of Accountable that keeps your data.
   Open the Terminal app (in Applications, then Utilities), paste this line and press Return:
   `curl -LsSf https://astral.sh/uv/install.sh | sh`
   Then close that window. The full instructions are at [docs.astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/).
3. **Open a terminal in the Accountable folder.** Open Terminal, type `cd ` (with a space), drag the Accountable folder onto the window and press Return.
4. **Install Accountable's parts** by typing this and pressing Return. It takes a minute or two, and needs the internet this once:
   `npm install`

### Every day

1. Open a terminal in the Accountable folder, as in step 3.
2. Type `npm run dev` and press Return.
3. Your browser opens Accountable at http://localhost:5173 after a few seconds. The first start takes longer while it gets ready, and fills Accountable with sample data. It opens on a sign-in screen with Test User already filled in: click **Sign in**. This test sign-in works only on your computer and never touches Supabase.
4. Leave the terminal window open while you work. To stop Accountable, click the terminal window and press Ctrl+C, or just close it.

Everything you change is saved straight away, in the file `data/accountable.db` inside the Accountable folder. To keep a backup, copy that file somewhere safe while Accountable is stopped.

### Starting again with the sample data

Type `npm run seed` in the terminal. **This deletes everything you've entered** and loads the sample data again. If Accountable is running, refresh the browser afterwards.

### If something goes wrong

- **"Accountable needs a tool called uv"** or **"needs Node.js"**: that tool isn't installed yet. Follow the matching step above, then close the terminal window, open a new one and try again.
- **"Accountable's packages aren't installed yet"**: type `npm install`, then `npm run dev`.
- **A message says a port or address is already in use**: Accountable is probably already running in another terminal window. Use that one, or close it and start again.
- **The browser says it can't connect**: check the terminal window is still open and showing no error, then refresh the page.

## Running Accountable for your team, with Supabase

`npm run dev` is for one person on one computer. For a team, Accountable keeps its data and its sign-in in Supabase and runs on Render. Each step below ends with a check, so a mistake shows up straight away rather than at the end. Run the check commands in a terminal in the Accountable folder. None of them prints a setting's value.

### Set up Supabase (once)

1. **Create the project.** At [supabase.com](https://supabase.com), sign in and click New project. Give it a name and a strong database password, and keep the password somewhere safe: it goes into `.env` in step 2. Note the region you choose, because the Render service should be in the same one.
   *Check:* the project's home page loads and no longer says it is setting up.
2. **Fill in `.env`.** In the Accountable folder, copy `.env.example` to a new file named `.env` and fill in its three settings:
   - `DATABASE_URL`: click **Connect** at the top of the project, choose the **Session pooler** connection string, and put your database password in place of `[YOUR-PASSWORD]`.
   - `SUPABASE_URL`: in Project Settings, under Data API, the project URL.
   - `SUPABASE_PUBLISHABLE_KEY`: in Project Settings, under API Keys, the publishable key. Never use the secret key: it can read and change everything.

   `.env` is never committed, so the password stays on your computer.
   *Check:* this prints each name followed by "set", three times. A "MISSING" names the setting to fill in.

   ```sh
   node --env-file=.env -e 'for (const k of ["DATABASE_URL","SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY"]) console.log(k, process.env[k] ? "set" : "MISSING")'
   ```

   Then this prints `connected`, which shows the database can be reached through the session pooler with your password:

   ```sh
   uv run --env-file .env python -c "import os, psycopg; psycopg.connect(os.environ['DATABASE_URL']).close(); print('connected')"
   ```
3. **Turn off sign-ups.** In Authentication, under Sign In / Providers, turn off **Allow new users to sign up**, then save. Otherwise anyone who has the publishable key (every browser that opens Accountable has it) could make themselves an account through Supabase's API.
   *Check:* this prints `200 true`. The `200` shows the URL and key work, and `true` shows sign-ups are off.

   ```sh
   node --env-file=.env -e 'fetch(process.env.SUPABASE_URL+"/auth/v1/settings",{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}}).then(r=>r.json().then(j=>console.log(r.status, j.disable_signup)))'
   ```
4. **Check the token signing key.** In Project Settings, under JWT Keys, the current key should be ES256 or RS256. If it's a legacy HS256 secret, rotate to an asymmetric key there. Accountable accepts only ES256 and RS256 tokens, so with HS256 nobody can sign in.
   *Check:* this prints `[ 'ES256' ]` or `[ 'RS256' ]`. An empty list `[]` means the project still signs with the HS256 secret.

   ```sh
   node --env-file=.env -e 'fetch(process.env.SUPABASE_URL+"/auth/v1/.well-known/jwks.json").then(r=>r.json()).then(j=>console.log(j.keys.map(k=>k.alg)))'
   ```
5. **Add each person.** In Authentication, under Users, click Add user, then Create new user. Enter their email and a password, tick **Auto Confirm User**, and create them. The dashboard has no field for a display name, so set it in the SQL editor, with their name and email in place of the examples:

   ```sql
   update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}') || '{"display_name": "Their Name"}'
   where email = 'their@email';
   ```

   Give each person their email and password yourself. There's no sign-up or password reset in Accountable.
   *Check:* in the SQL editor, this lists each person's email with their name beside it:

   ```sql
   select email, raw_user_meta_data->>'display_name' from auth.users;
   ```

### Load the sample data (optional)

To try Accountable with the same sample data as `npm run dev`, type `npm run seed:supabase` and press Return. It says how many organizations, contacts, deals and activities the Supabase database holds now (0 when its tables aren't set up yet), and asks you to type `yes`. **Typing yes deletes everything in it**, sets up any tables that are missing, and loads the sample data. Anything else leaves the database as it was. The people you added in step 5 are kept either way.

*Check:* on a new project the counts are all 0. Run it again and the counts show the sample data; answer `no` and run it once more, and the counts are the same.

Skip this for a team's real data: a new project starts empty, and Accountable works with no sample data.

### Run the built app on this computer

This runs Accountable the way Render will, against your Supabase project, so you can check everything works before deploying.

1. Type `npm run build` and press Return. It builds the pages Accountable serves, and takes a few seconds.
2. Type `npm start` and press Return. It checks the three settings in `.env` and names any that's missing, then sets up any new database tables.
3. Open http://localhost:8000 in your browser. There's no Test User here: sign in with a person you added in step 5. Press Ctrl+C in the terminal to stop it.

Run `npm run build` again after any change to Accountable's code, before `npm start`.

*Check:* a wrong password is refused with "That email and password don't match"; the right one signs in. Add a contact, reload the page, and it's still there, with "Added by" and the person's display name at the foot of its details. If it shows their email instead, their display name isn't set (step 5): set it, then sign in again in a private window.

### Check the database is shut to browsers

Once either command above has set up the tables, check that nobody can read them with the publishable key, which every browser that opens Accountable holds.

*Check:* this prints `[]`, and in Supabase, Database, Advisors, the Security Advisor lists no table with row level security disabled.

```sh
node --env-file=.env -e 'fetch(process.env.SUPABASE_URL+"/rest/v1/organizations?select=*",{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY}}).then(r=>r.text()).then(console.log)'
```

### Deploy to Render

Render runs Accountable on the web for your team, from the settings in `render.yaml`, on its free plan. Do the steps above first: Render uses the same Supabase project and the same three settings.

1. **Push the branch.** Render builds from GitHub, so the code you want to run must be pushed. Make sure `render.yaml` is in it.
   *Check:* the branch on GitHub shows `render.yaml` at the top level.
2. **Create the service from the Blueprint.** At [render.com](https://render.com), sign in, click **New**, then **Blueprint**. The first time, Render asks to install its GitHub App: choose **Only select repositories** and pick the Accountable repository. Click **Connect** beside the repository. The Blueprint form that opens has a **Branch** dropdown, which starts on `main`: choose the branch to deploy from. Render reads `render.yaml` and shows one web service, `accountable`, on the free plan in Oregon (the same region as a US West Supabase project).
   *Check:* the Blueprint shows exactly one service, and asks for three settings.
3. **Enter the three settings.** Render asks for `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: copy each value from your `.env`. Render asks only this once. To change one later, open the service's **Environment** page. Never add `ACCOUNTABLE_SIGN_IN`: Accountable refuses to start with local sign-in on Render.
   *Check:* all three are filled in before you apply.
4. **Apply, and watch the build.** Click **Apply**. Open the service's **Logs** while it builds: it installs Python 3.12.14, Node 24.22.1 and uv, then the packages, then runs `npm run build`. This takes a few minutes the first time.
   *Check:* the log ends the build without an error, then shows the database migrations running and Uvicorn starting. The service shows as **Live** and its health check is green.
5. **Open it.** The service's page shows its address, ending in `onrender.com`. Send that address to your team.
   *Check:* the address opens the sign-in screen with no "Local test mode" note, and a person you added in step 5 of "Set up Supabase" can sign in.

Each later push to that branch deploys again by itself.

**What to expect on the free plans:** Render's free service stops after 15 minutes with no visits, and the next visit waits about a minute while it starts again. A free Supabase project pauses after a week with no use; restore it from Supabase's dashboard, then reload Accountable.

The by-hand checks of the deployed app are in the PH4 note under "Sign-in, search and a user menu" below.

## For developers

- `npm run dev` starts the backend (FastAPI, port 8000) and the frontend (Vite, port 5173).
- `npm test` runs the backend tests (pytest), the frontend tests (Vitest) and the end-to-end tests (Playwright with the installed Google Chrome). It runs all three even when one fails, prints a pass or fail summary, and exits with an error if any failed. `npm run test:backend`, `test:frontend` and `test:e2e` run one suite. The end-to-end tests start their own copy of the app on ports 8100 and 5273 with `data/e2e.db`, so they never touch your data.
- `npm run check` runs formatting, lint, complexity (15 per function), type and secret checks, then `npm test` with at least 80% unit test coverage. `npm run check:quick` skips the end-to-end tests, and `npm run format` fixes the formatting.
- `npm run types` regenerates `frontend/src/shared/api-types.ts` after a change to the backend's models or routes; a test fails if you forget.
- `npm run seed` reloads the sample data into `ACCOUNTABLE_DB` (default `data/accountable.db`).
- Every schema change is an Alembic migration in `backend/migrations/versions/`, applied when the backend starts.

## Intent

- `docs/intent.md` (now `docs/changes/mvp/intent.md`) was clarified through an interview with the product owner: delete rules, timelines, pipeline columns, stage probabilities, close dates on Won and Lost, contact status on a win, required fields, the dashboard's period, scale, sample data size, the user, and success in everyday use. No code yet.

## Spec

- `docs/spec.md` has the requirements and design for the MVP, following the brand, with concerns listed at the top. The product owner confirmed all of them. No code yet.

## Mockups

- `docs/mockups/` has three design directions for the dashboard and the pipeline, each an HTML file with a screenshot beside it. A uses a Midnight sidebar and follows the spec's layout. B uses a top navigation bar, a tapered funnel and a stacked pipeline strip. C uses a slim icon rail, a dark hero panel, and Won and Lost as drop zones. The sample data and chart helpers they share are in `docs/mockups/shared/`.
- Chosen design: A, with the funnel from C and the probability ring from B, in `docs/mockups/final-dashboard.html` and `docs/mockups/final-pipeline.html`. `docs/spec.md` is updated to match.

## Plan

- `docs/plan.md` (now `docs/changes/mvp/plan.md`) has the build plan: the files that change, eight phases of work, the risks and the tests that prove each requirement, with IDs linked to the spec and intent and a traceability matrix. No code yet.

## Structure review

- The layout is now grouped by section on both sides, with one backend module per section holding its endpoints and queries, and one frontend folder per section. Alembic migrations run on every start (new requirement G12), and the frontend's API types are generated with openapi-typescript. `docs/spec.md` (repository layout, libraries, G4, G12) and `docs/plan.md` (files, W2.1, W2.2, W2.4, W2.5, W3.9, W4.2, W4.7, TB42, TF17, R15, R16) are updated to match.

## Build

Following `docs/changes/mvp/plan.md`, phase by phase.

### PH1 Skeleton: done

- Root npm workspace with `dev`, `test`, `seed`, `types` and the three `test:*` scripts; `pyproject.toml` with uv and Python 3.12.
- `scripts/dev.mjs` checks for Node.js 24+, uv and installed packages, explaining any gap in plain words, starts both servers with concurrently and opens the browser once both answer.
- Vite React TypeScript app with the `/api` proxy and Vitest; FastAPI app with `/api/health` and the error format.
- Test harness: pytest gives each test its own database file; Playwright runs the app on ports 8100 and 5273 with `data/e2e.db`, resets the sample data before each test through a test-only endpoint (mounted only when `ACCOUNTABLE_TESTING=1`), fixes the clock at 16 Nov 2026 and fails on any console error.
- Versions pinned (R11): Node 26.13, React 19.3, Vite 8.3, Vitest 4.1, Playwright 1.65, FastAPI with SQLAlchemy 2 and Alembic. TypeScript is held at 5.9 because openapi-typescript 7 doesn't yet accept TypeScript 7.

### PH2 Data and rules: done

- Tables, foreign keys (turned on per connection), the one-parent check and indexes in `backend/app/db.py`, with the first Alembic migration in `backend/migrations/versions/0001_first_schema.py`. The backend migrates on every start and seeds only a brand-new database file.
- `ACCOUNTABLE_DB`, `ACCOUNTABLE_TODAY` and `X-Local-Date` handled in `config.py` and `deps.py`.
- Stage rules in `rules.py`; card positions with renumbering in `routers/deals.py`.
- Sample data in `seed.py`: 12 organizations over 7 industries, 40 contacts, 30 deals (11 won in 11 of the last 12 months, 5 lost, 14 open of which 4 are late) and 120 activities with overdue, upcoming, later and done follow-ups. `npm run seed` reloads it; it refuses the default database while tests run.

### PH3 API: done

- Every endpoint in the spec's API table, one router per section, plus `GET /activities/{id}`. Lists return `{items, total}` and take `limit` and `offset`; contacts add `status_counts`.
- Deal responses carry `expected_revenue` and `is_late`; activities and timeline entries carry `follow_up_status`, so the frontend shows rules without applying them.
- When a deal's stage changes through the edit form and the same request also changes the probability or close date, the typed values win over the stage's defaults; otherwise D3 and D4 apply.
- Errors: 400 with a plain message per field, friendly 404s naming the record, and a general 500 message with nothing technical in it.
- `npm run types` writes `frontend/src/shared/api-types.ts` with openapi-typescript; a Vitest test fails when it's out of date.

### PH4 Frontend shell: done

- Brand tokens, global and component styles in `frontend/src/shared/theme/`, with Fontsource fonts bundled.
- Layout with the Midnight sidebar and routes for every section, plus a not-found page for bad links.
- API client that sends `X-Local-Date` and turns every failure into a plain message; TanStack Query refetches whatever is on screen after any change, so figures stay in step (H8).
- Shared pieces: DataTable (TanStack Table: search across chosen columns, sort with arrows, 25 rows a page, row actions on hover and focus, empty and no-results states), SidePanel, ConfirmDialog with the delete wording, toasts, Late badge, probability ring and follow-up chip; money, date and stage helpers; form rules and messages matching the backend.

### PH5 Organizations, contacts and deals: done

- Tables, side-panel forms and record pages for organizations, contacts (status filter with counts, in the URL as `?status=`) and deals (stage filter, `?stage=`, and the Late badge). Record pages put details and linked records on the left and the timeline on the right; organization and contact pages add a contact or deal already linked.
- Deal form lists the chosen organization's contacts first (D2), allows an empty organization only when the deal already lost it (Concern 1), and leaves probability blank for the stage's usual one.
- Timeline with the Log activity form at the top, edit and delete (asks first) and Mark done. The form's order is type, description, follow-up date, then the date it happened, because Chrome gives each part of a date field its own tab stop; the follow-up is the field people fill in. Logging a call with a follow-up by keyboard takes about 11 seconds in TE20.
- Deletes ask first with the linked-record counts, and the refresh afterwards skips queries about the deleted record, so the browser never asks for something that's gone (a 404 would show as a console error).
- Date fields are checked for a complete date before saving, so a half-typed date shows a message under the field rather than reaching the server.

### PH6 Pipeline: done

- Board with six columns, column and board totals (open deals only), cards with the probability ring, Late badge and "Closed" date, a search box and Add deal per column (new deals go to the top).
- Drag and drop with dnd-kit by mouse and keyboard (Space to pick up, arrows to move, Space to drop, Enter opens the deal). The dragged card keeps its size in the list with a Sea Green line where it will land.
- Totals change the moment a card drops: the move is applied to the cached list straight away and rolled back with a message if the save fails (R6); a card can't be moved again until its save finishes.
- Three dnd-kit fixes worth knowing for later changes:
  - The pointer in the gap between columns keeps its last target. Guessing the nearest there made the card flip between two columns forever.
  - The dragged card's slot keeps its full height, so measurements stay right.
  - Left and right arrows jump to the next column; up and down use the sortable default.
- At 1440 px the six 196 px columns don't fit, so the board scrolls sideways, as the spec allows.

### PH7 Dashboard: done

- Headline tiles, revenue won line chart (Recharts, Sea Green with the page's one gradient), funnel, open pipeline by stage, won and lost bar chart, follow-ups with Mark done, and recent activity, laid out on the 12-column grid of the final mockup.
- Tiles link to the pipeline, the pipeline, the deals table filtered to Won, and the dashboard's own follow-ups panel (R12: there's no separate follow-ups screen; confirmed by the product owner in the MVP review).
- "Won this month" compares with last month ("up 78% on Oct"), as in the mockup. Charts carry their figures in an accessible label, which TE18 checks against the API.
- Differences from the mockup, following the spec: no "Log activity" button on the dashboard (activities are logged on a contact or deal), no user name in the sidebar (single user, no sign-in), and the funnel's "% of previous" is by value (Concern 6), not count.

### PH8 Finish: done, apart from TM04 and TM05

- **W8.1 Performance (G7):** TB41 builds 2,000 contacts, 1,000 deals and 10,000 activities. Every list, page and the dashboard answers in 2 to 14 ms against a 200 ms budget. In Chrome at that size, a keystroke in the contacts search takes 15 to 50 ms, a sort 48 ms, and a full page reload in dev mode 80 to 340 ms (the pipeline with 1,000 cards is the slowest).
- **W8.2 Copy:** no exclamation marks or dashes in UI text; buttons say what they do; every table, list and timeline has an empty state.
- **W8.3 Offline (G2):** TE22 blocks any request that leaves localhost and checks the bundled fonts are in use.
- **W8.4 Setup guide:** at the top of this file.
- **W8.6 Console (G11):** every end-to-end test fails on a console error, and TE21 walks every page, panel and dialog. The one allowed error is the browser's own 404 note when a link points to a deleted record; the page itself explains it plainly.
- A timeline ordering bug, found on 21 Nov when TE16 failed and now fixed and covered by TB28: on a day when the user's today differed from the computer's clock (a fixed test date, or near midnight across time zones), a stage change could show below an activity made before it. Same-day entries are now ordered by when they were really made, on the timelines and the dashboard's recent list.
- A bug found while checking the screens by eye, now fixed and covered by a test: adding a deal from an organization's page, opened directly, didn't preselect the organization, because the form drew before its list of organizations arrived.

#### By-hand checks

| Check | Status |
| --- | --- |
| TM01 Every screen against the final mockups and brand | Done: checked by the product owner. |
| TM02 Full walk-through as a salesperson, console open (SC8) | Done: walked through by the product owner. The Call, Email and Note choice looked like action buttons; now a labelled "Type" choice (RV2). Walked through again by hand after the fix, with no further issues. |
| TM03 Fresh setup and `npm run dev` on a Mac, following the guide | Done: checked on a Mac by the product owner. |
| TM04 Search, sort and screen changes feel instant at full size | To do soon. Measured above; needs a person's feel. |
| TM05 Code review of layout rules, rules only in the backend, API ready for paging | Not done. |
| R12 Follow-ups tile links to the dashboard's follow-ups panel | Confirmed by the product owner in the MVP review. |

All eight success criteria in the intent are met: covered by passing automated tests, with SC1, SC7 and SC8 also checked by hand (SC1 on a Mac only). SC8 was only met once the Log activity type choice was fixed in the MVP review (RV2).

## Known issues

- None open from TM02: the Log activity type choice was fixed in the MVP review (RV2).

## Review of the MVP branch (21 Nov)

Reviewed against `docs/REVIEW.md` (bugs, security, spec and plan). `npm test` passed before the review. All findings below are fixed on this branch and covered by tests; `npm test` passes.

Important:

- **RV1 Very large deal value gives a server error.** Typing `99999999999999999999` as a deal's value passes the form, overflows SQLite and shows "Something went wrong" instead of a field error. Sending `"inf"` or `"nan"` straight to the API also gives a 500 or a raw Python message.
- **RV2 STATUS claimed SC8 met with a known broken action.** The Log activity type buttons (from TM02) break A3 and SC8, so PH8 can't be called done until they're fixed.
- **RV3 R12 was built before the product owner's decision**, which the plan required first.
- **RV4 spec.md out of date on D3 and D4.** The code lets a probability or close date the user types win over the stage's usual one, and accepts a typed probability on a new deal; the spec still says the stage's values always apply.

Nits:

- **RV5 A Won or Lost deal could lose its close date** when it was cleared during the move or later, which dropped it from the dashboard's won figures.
- **RV6 Migrations ran with foreign keys on**, so a future batch migration rebuilding a parent table would cascade-delete or null its related rows.
- **RV7 Two quick pipeline drags could undo each other** for a moment when the first one's save failed.
- **RV8 Won and Lost column headers left out expected revenue**, which spec P5 asks for on every column.
- **RV9 The revenue line chart used the darker text green and hard-coded colours**, where the spec asks for Sea Green defined once as CSS variables.
- **RV10 Security (minor):** the API didn't check the Host header, and text fields and `limit` had no size caps.

Fixes:

| Finding | Fix | Test |
| --- | --- | --- |
| RV1 | Deal value capped at $1,000,000,000 on both sides, with the message "Enter a value from 0 to 1,000,000,000, in whole dollars."; `inf` and `nan` are field errors. Spec D1 updated. | `test_value_zero_or_more_whole_dollars`, TF validation test |
| RV2 | The type was wired correctly; it looked like three action buttons. It's now a segmented control with a visible "Type" label, the chosen type raised on white. | TE16 |
| RV3 | Product owner confirmed the follow-ups tile linking to the dashboard's panel. Plan R12 and spec H1 updated. | TE18 (unchanged) |
| RV4 | Product owner chose the code's rule: a typed probability or close date wins. Spec D3 and D4 updated. | Existing TB tests |
| RV5 | A Won or Lost deal saved with no close date gets today, as on create. | `test_closed_deal_never_loses_its_close_date` |
| RV6 | Migrations run on a connection with foreign keys off, check every link afterwards, then turn them back on. Without this, rebuilding two tables in a test lost half the activities and every contact's organization. | `test_table_rebuild_in_a_migration_keeps_linked_rows` |
| RV7 | A failed move puts back only its own card, and the board reloads only once the last move has saved. | TF15, second case |
| RV8 | Won and Lost headers show expected revenue (all of the value for Won, $0 for Lost). | TE12 |
| RV9 | Charts take their colors from the CSS tokens; the revenue line is Sea Green. Spec's token path corrected. | Checked by eye |
| RV10 | Security: the API answers only requests addressed to 127.0.0.1 or localhost (against DNS rebinding); names, emails and websites capped at 200 characters, other text at 10,000; list `limit` at 1,000. | `test_requests_for_another_host_are_refused`, `test_text_and_page_size_are_capped` |

Not fixed, as they were below the review's cut: with a search active, a drop is placed relative to the visible cards only (since fixed, RV23); and two moves into the same gap at the same moment can get equal positions (the next drop renumbers the column, so it fixes itself).

### Tests widened to similar areas (21 Nov)

Each fix above was tested only where the review found it. The tests now cover every endpoint, field and component of the same kind. Doing so found one more bug, fixed here:

- **RV11 Record ids and offsets beyond the database's range gave a server error.** Any id over 2^63 - 1 in a URL (every record page, timeline, delete and delete impact) or in a request body (every link to an organization, contact, deal or neighbouring card), and any such `offset` on the lists, crashed SQLite. Ids in a URL that can't exist, too large or not a number, are now "not found", like a deleted record. In a body they're a field error, and `offset` is capped.

Two smaller changes came out of the same sweep:

- **Text caps in the forms too.** Spec V4 has the frontend check the same rules as the backend, so the forms now refuse over-long text before sending it, with the backend's messages.
- **Every color is a token.** The stylesheets still had 26 color values outside `tokens.css` (the same rule as RV9). They're now named tokens with the same values, so nothing looks different.

New and widened tests:

| Area | Tests |
| --- | --- |
| Bad input on every endpoint (RV1, RV10, RV11) | TB43 `test_inputs.py`: 18 URL endpoints with impossible ids; 10 body links; paging on all 3 lists; value and probability edge cases on add and edit; all 10 text fields at and over their limit, on add and edit; 5 foreign Host headers against reads and writes, checking nothing changed |
| Close dates and typed values (RV4, RV5) | `test_rules.py`: every way into Won or Lost (add, edit, clear, drag, Won to Lost) sets a close date; no way in allows a future one; typed probability and close date win, an unchanged one sent back doesn't; a drag always takes the stage's figures |
| Migrations (RV6) | TB42: foreign keys back on in every pooled connection and cascades still work after migrating; a migration that breaks links is stopped; a failed one still restores foreign keys; the command-line upgrade path keeps data |
| Pipeline (RV7, RV8) | `board.test.tsx`: every column's totals, Won and Lost included; drops into Won, Lost and back to open; the board reloads only after the last of several moves |
| Activity type (RV2) | `LogActivityForm.test.tsx`: labelled Type group when logging and editing; two forms on one page keep their own choice; click and arrow keys, with wrapping; the last type is kept; an edit saves the new type. TE17: changing type in the edit panel shows on the timeline |
| Form limits (RV1, RV10) | `validation.test.ts`: value and probability edge cases; all 10 text fields at and over their limit. TE08: too long or too large shows under the field, keeps the text and saves nothing, on all four forms |
| Colors (RV9) | `colors.test.ts`: no color values outside `tokens.css` in any source file; every `var(--...)` used exists; the brand colors match the spec. TE18: the charts render Sea Green and Coral |
| Not found (RV11) | TE01: too-large and non-numeric ids on organization, contact and deal pages say the record can't be found |

## Second review of the MVP branch (21 Nov)

Reviewed again against `docs/REVIEW.md`. Two Important bugs were found and are fixed on this branch, each with a test that fails without the fix, along with one minor test race (RV14); `npm test` passes. The product owner also updated `docs/intent.md` and walked through the app by hand again after RV2.

| Finding | Fix | Test |
| --- | --- | --- |
| RV12 A pipeline move whose neighbouring cards were reversed or the same card (for example from a stale board in another tab) crashed with a server error. | The move is refused with "Choose where to put the deal." and nothing changes. | `test_neighbours_in_the_wrong_order_are_refused` |
| RV13 Table search skipped any column whose first row was empty, so one contact with no email stopped email search for every contact (all three list pages). | Columns are searchable whenever they opt in, whatever the first row holds. | TF03 `search still covers a column whose first row is empty` |
| RV14 TE10, TE11, TE12, TE14 and TE15 could reload or leave the board before the move they check had saved. Their "network idle" wait returns at once on a page that has already been idle. With moves slowed by 500 ms, TE10 and TE11 failed. | Each test waits for its own move's response and checks it saved before reloading or navigating. The other e2e specs were checked for the same race: only the board updates before the server answers, so they're unaffected. | TE10 to TE15 pass 20 times in a row, and with moves slowed by 500 ms |

### Minor findings, resolved (21 Nov)

The product owner chose a fix for each minor finding and parked none. Each code change has a test; `npm test` passes.

| Finding | Fix | Test |
| --- | --- | --- |
| RV15 A date far outside the normal range in `X-Local-Date` (year 1 or 9999) gave a server error on the dashboard and timelines. | A date outside 1900 to 2999 is ignored and the server's date is used, as for a missing header. | `test_a_date_outside_the_normal_range_falls_back_to_the_server_date` |
| RV16 A long crafted email address made the format check take seconds (about 9 s at 80 KB). | The 200-character limit is checked first, and the domain pattern can no longer backtrack, on both backend and frontend. Valid addresses are unaffected; malformed ones such as `a@b..c` are now refused. | `test_a_long_crafted_email_is_refused_quickly`, `test_email_format`, matching cases in `validation.test.ts` |
| RV17 A request for another host was refused with plain text, not the API's error shape. | The Host check now replies `{"message", "fields"}` like every other error. | `test_requests_for_another_host_are_refused` |
| RV18 `GET /api/activities/{id}` wasn't in the spec and nothing called it. | Removed; tests that used it now check the database directly. | `test_there_is_no_endpoint_to_read_one_activity` |
| RV19 On a descending sort, empty values came first. | Empty values sort last in both directions (spec T2). | TF04 `empty values sort last in both directions` |
| RV20 Changing the Deals stage filter briefly showed the previous stage's rows and total. | The page shows Loading until the new stage's list arrives. | TE07 `changing the stage filter shows loading` |
| RV21 Logging an activity on a deal or contact deleted elsewhere said "Check the highlighted fields" with nothing highlighted. | A server message about something the form has no field for is shown for the whole form, for example "That deal no longer exists." This applies to every form. | `forms.test.ts` |
| RV22 When the organizations or contacts list failed to load, the deal and contact forms got stuck: fetching the list again swapped the form back to Loading, round and round, so the form never appeared. | Only the first load shows Loading. A failed list says "Couldn't load the organizations." under its field with a Retry button; what was typed and a preset choice are kept. | `DealForm.test.tsx`, `ContactForm.test.tsx` |
| RV23 With a board search on, a drop between two visible cards could land on either side of a hidden card. | The card goes directly under the visible card above it, ahead of hidden cards (spec P4). | TF14, three cases |
| RV24 Dropping a card next to one still saving could be refused and snap back. | Moves are sent one after another; the board still updates the moment a card drops (spec P6). | TF15 `moves save one after another` |
| RV25 Behaviour in the code but not the spec. | Spec updated and signed off by the product owner: D1 value cap, V5 text limits, `limit` at most 1,000, the localhost-only Host check (G6), the 404 console exception (G11), the Retry message (G8), the date fallback range. | Docs only |
| RV26 Plan test descriptions out of date. | TB01 to TB03, TB17, TF14 and TF15 updated to the current rules and file names. | Docs only |

## Docs reorganized for future changes (22 Nov)

- `docs/spec.md` now describes the whole product as it stands, with the problem, users and goals brought in from the MVP intent, and a roadmap. Nothing in it defers to an intent any more.
- The MVP's `intent.md` and `plan.md` moved to `docs/changes/mvp/`. Each future change gets its own `docs/changes/<branch name>/` folder with its intent and plan.
- `AGENTS.md` says to read `docs/spec.md` first, and only the current change's folder.
- `docs/REVIEW.md` has a new pass that flags code `docs/spec.md` doesn't describe.
- No code changed.

## Harness

- `npm run check`, `npm run check:quick` and `npm run format` added. Config: `frontend/eslint.config.js`, `frontend/.prettierrc.json` (100 columns), `[tool.ruff]` in `pyproject.toml` (100 columns, C901 at 15), `.gitleaks.toml` (allows the git-ignored `.env`), coverage thresholds in `frontend/vite.config.ts` and pytest `addopts`.
- Fixed everything the checks found: split the complex forms, pages and `seed` into smaller functions, typed the backend for ty, and added frontend tests (coverage up from 45% to over 90%). SidePanel now focuses the first field once it appears, replacing `autoFocus`. TanStack Table's `useReactTable` has one approved line-level ESLint exception (react-hooks/incompatible-library), because the React Compiler isn't used.
- Hooks added. A lefthook pre-commit hook (`lefthook.yml`) formats the staged files, then runs lint, types and gitleaks, without the tests; the root `prepare` script installs it. Claude Code hooks in `.claude/settings.json`: a Stop hook (`.claude/hooks/stop-check.mjs`) runs `npm run check:quick` and sends a failure back to Claude once, then lets it stop; a PreToolUse hook (`.claude/hooks/protect-env.mjs`) blocks edits to `.env`, including Bash commands that name it.
- CI added: `.github/workflows/ci.yml` runs one job, `check`, on every push to any branch. It scans the repo and its history with gitleaks first, then runs `npm run check` with the runner's Google Chrome, and uploads the Playwright report if the run fails. It uses no secrets. Playwright writes an HTML report only on CI.
- `docs/IMPROVE.md` added: the steps for improving the harness at Deploy, after the review fixes and before the merge. AGENTS.md says to follow it.

## Dark mode

Following `docs/changes/dark-mode/plan.md`, phase by phase.

### PH1 Light baseline: done

- `e2e/capture.spec.ts` (temporary, skipped unless `CAPTURE` is set) fingerprints 11 screens and states: the dashboard, the pipeline, the three tables, a record page of each kind, an open side panel, a confirm dialog and a form with field errors. For every visible element outside the switch it records the place, size and computed colors, waiting until charts stop animating.
- `CAPTURE=record` on the untouched branch saved `docs/changes/dark-mode/light-before.json` (about 4,800 elements, 66 distinct styles). A `CAPTURE=compare` straight after matched it exactly, so the fingerprint is stable.

### PH2 Split the shared tokens: done

- `tokens.css` gains `--midnight`, `--raspberry-fill` and `--cerulean-fill`, with exactly the values they replace, and `color-scheme: light`.
- Midnight as a surface (sidebar, toasts, chart tooltips) and as text on Sea Green (primary buttons, wordmark, active link) now uses `--midnight`; ghost buttons name `--ink` themselves rather than inherit it from the primary style. The danger button, Late badge and overdue and upcoming chips use the fill tokens. No component uses `--ink` or a text shade as a surface or behind white text any more.
- `colors.test.ts` reads the light block on its own through `tokens.testing.ts`, and checks Midnight and the fills too.
- Fingerprint compare: identical to the baseline. A one-step change to `--midnight` was tried to confirm the compare catches it (84 differences), then reverted.
- `npm run check` passes.

### PH3 Dark tokens: done

- `tokens.css` has a `:root[data-theme="dark"]` block with `color-scheme: dark` and only the tokens that change: the spec's page, panel, text and text shade values, the open stages reversed, and dark lines, hover, table header, fields, status tints, column washes, bar sheen, stage total key, scrim and deeper shadows. The hover, table header, field and tint surfaces are all darker than the page, so the spec's contrast figures on the page are the floor.
- TF19 `contrast.test.ts` checks every text and surface pair by role in both modes, and TF18 `colors.test.ts` now checks the dark block (only known tokens, fixed brand colors, the spec's dark values, reversed stages). The spec's published ratios were recomputed from the tokens and all match.
- Plan correction: TF19 in the plan says every stage color is at least 3:1 against the panel in both modes. Light mode's pale stages never met that on white (New is 1.6:1) and light mode can't change (IC2); the spec only claims stage contrast for dark mode. TF19 checks stages in dark mode only, against the page and the panel.
- With `data-theme="dark"` set by hand, the dashboard and pipeline turn fully dark.
- `npm run check` passes.

### PH4 Switch and memory: done

- `frontend/index.html` has a few lines of inline script in `<head>` that set `data-theme="dark"` when `accountable.theme` holds exactly `dark`, ignoring a storage error.
- `shared/theme/mode.ts` reads the mode from `<html>` and `setMode` changes the attribute, then saves, ignoring a storage error. `shared/ThemeSwitch.tsx` is a `button` with `role="switch"`, a moon icon and the label "Dark mode", pinned to the bottom of the sidebar in Sea Mist with a Sea Green track when on.
- TF20 (`mode.test.ts`, which also runs index.html's inline script), TF21 (`ThemeSwitch.test.tsx`) and TE23 to TE27 (`e2e/dark-mode.spec.ts`) pass. SC2 is met: TE24 turns dark mode on, finds it still on after a reload, and turns it off again.
- `frontend/vite.config.ts`: the unit tests run Node with `--no-experimental-webstorage`. Node 26's own `localStorage` global is undefined without a storage file and was hiding jsdom's, so no test could touch storage.
- Fingerprint compare: identical to the baseline apart from the switch.
- `npm run check` passes.

### PH5 Every screen in dark: done

- TM07, walked in dark mode in Chrome with a throwaway script that screenshotted each state (deleted afterwards): the dashboard with both chart tooltips, the pipeline with a card mid-drag and an empty search, the three tables with row hover, keyboard focus and an empty search, each record page with the Log activity form and timeline hover, a side panel with field errors, a confirm dialog, and a success and an error toast. No console errors.
- One fix, in `tokens.css` only: the dark scrim was black, so the black confirm dialog and side panel had almost no edge against the dimmed black panels behind them. The dark scrim is now Midnight at 60%, which still dims what's behind but leaves a page-like backdrop the black dialog lifts off.
- Native controls: with `color-scheme: dark` the selects and date fields draw dark, with light arrows and calendar icons. The browser's own date picker and select menus open outside the page, so screenshots can't show them; they follow `color-scheme`, which TE28 checks.
- TE21 now runs once in each mode; TE28 and TE29 added. All pass.
- `npm run check` passes.

### PH6 Finish: done

- SC3: `docs/changes/dark-mode/` has `dashboard-light.png`, `dashboard-dark.png`, `pipeline-light.png` and `pipeline-dark.png` at 1440 by 900, with sample data, today fixed at 16 Nov 2026, and dark mode turned on with the switch.
- TM06, last fingerprint compare (after every token and component change, including the PH5 scrim fix): light mode is identical to the baseline apart from the switch. `e2e/capture.spec.ts` and `light-before.json` are deleted.
- TM07: done in PH5 (see above).
- TM08: checked against the brand. The black panels lift off the `#04232E` page clearly enough with the deeper shadows, so R8 needs no follow-up. The Midnight sidebar still stands apart from the page, and stage colors, Late badges and chips keep their brand fills.
- TM09, small text measured on the real elements in dark mode in Chrome (text color against the nearest solid background behind it): secondary text 6.5:1 on the page and 8.3:1 on panels, links 10.3:1, table header 7.7:1, field errors and required marks 9.8:1, field hints 8.3:1, status pills 8.1 to 11.6:1, the Late badge and overdue chip 5.7:1, the upcoming chip 5.3:1. All meet 4.5:1.
- `docs/spec.md` checked against what was built: it matches, so it's unchanged. One loose fit: the repository layout lists "the mode switch" under `shared/` theme; the switch component is `shared/ThemeSwitch.tsx`, next to the sidebar that uses it, with its logic in `shared/theme/mode.ts`, as the plan placed them.
- Beyond the plan's file list: `shared/theme/tokens.testing.ts` (reads `tokens.css` per mode for both token tests) and `frontend/vite.config.ts` (see PH4).
- SC1: `npm run check` passes (433 unit tests, 45 end-to-end tests). SC2: TE24. SC3: the four screenshots.

### Review fixes

The review against `docs/REVIEW.md` found nothing Important and three minor points, all fixed.

- `plan.md` now matches what was built: TF19 checks stage contrast in dark mode only, with the reason, and the file table lists `tokens.testing.ts` and the `vite.config.ts` change.
- `docs/spec.md`'s repository layout places the mode switch in `shared/` and saving the mode in `shared/theme/`, which closes the loose fit noted in PH6.
- TE28 no longer relies on Recharts' internal class names, chart position or copied token values. It finds the revenue chart by its accessible name, resolves `--line` and `--ink-muted` in the browser before and after switching, and checks that every gridline and axis label takes the dark value. The side panel and confirm dialog are found by role.

### CI fix

- The first CI run of this branch failed TE06 (`e2e/deals.spec.ts`), which this change didn't touch. The test chose "All stages" and typed a search straight away. Each stage filter gets a fresh table, so on the slower runner the text went into the outgoing Won table and was lost, and the deal was never found. Locally the new table always rendered first.
- TE06 now waits for the "N deals" summary before it types. It passed 10 runs in a row locally. No other end-to-end test types straight after changing a filter.

## Harness improvements

### After dark mode (22 Nov)

Followed `docs/IMPROVE.md`, looking at the dark mode review, the two MVP reviews and what the checks caught.

- **Repeated: the plan and spec fell behind the build.** MVP: RV3 (built before the product owner's decision), RV4 and RV25 (spec out of date), RV26 (plan tests out of date). Dark mode: TF19 and the plan's file list were noted in STATUS only, and a spec mismatch was left as "a loose fit". `AGENTS.md` now has "Keeping the docs in step": update `plan.md` in the same phase, and ask before building anything the spec doesn't say. A check of changed files against the plan's file table was considered and left out: it would catch only the file list, not tests or rules.
- **Repeated, suggested for `docs/STANDARDS.md`:** end-to-end tests that find elements by a library's class names or by position. TE28 did it (fixed in the review), and `e2e/dashboard.spec.ts` still does from the MVP (`.recharts-surface`, `.recharts-area-curve`, `.recharts-bar path`). Suggested wording: "In end-to-end tests, find elements by role, label or text, not by a library's class names or their position on the page." Not changed: that file is the product owner's to approve.
- **Repeated, found after the first round: end-to-end tests that move on before the app has caught up.** RV14 reloaded before a move had saved, and TE06 typed before the new table appeared (see "CI fix" above). `AGENTS.md` now says to wait for something that shows the change before the next step. A tool can't tell a missing wait from a needed one, so it's a rule, not a check.
- **Out of date:** the opening line of this file now says dark mode is built. Nothing in `AGENTS.md` or `docs/REVIEW.md` was out of date.
- `docs/IMPROVE.md` now says where to find earlier mistakes and asks each round to record a watch list here.

Watch list (seen once; a second time calls for a fix in the harness):

- A test environment hiding a browser API: Node 26's own `localStorage` hid jsdom's until the unit tests ran with `--no-experimental-webstorage` (dark mode PH4).
- A fix tested only where the review found it, not across the same kind of code (MVP review, "Tests widened").

### After multi-user (25 Nov)

Followed `docs/IMPROVE.md` on the `harness-after-multi-user` branch, since multi-user was merged before this round. Looked at the two reviews of multi-user, what the product owner corrected, and what the checks caught, against the MVP and dark mode reviews and the watch list above.

- **Repeated: a fix made only where the review found it.** On the MVP's watch list, and seen again: RV20 stopped Deals showing the previous stage's rows while a new filter loads, but Contacts kept `placeholderData` and showed the previous status's rows under the new filter. Found by searching for the same pattern in this round; now fixed the same way, with a test in `ContactsPage.test.tsx` that failed before the fix. `AGENTS.md` now says to search for the same kind of mistake when fixing a finding, and to record the search here.
- **Repeated: behaviour between states left untested.** MVP: RV7, RV20, RV22 and RV24. Multi-user: a failed key fetch signing everyone out, a late 401 ending a newer session, and a failed search after a successful one keeping its results. Each test started from a fresh state. `AGENTS.md` (Checks and testing) now lists the transitions to test, and `docs/REVIEW.md`'s Bugs pass asks the reviewer to check them and any slow or failing service.
- **Repeated: timing tests failing under load.** TB41 failed while other agents ran tests (PH1), three frontend tests hit IC14's one second under load (TM18), and TB41 failed again in the stop hook. TB41 now times a slow request again before failing. `AGENTS.md` now says to allow for a busy machine rather than raise a limit.
- **Process: the round ran after the merge.** `AGENTS.md` now says not to merge until this section records the change's round, and `docs/IMPROVE.md` says how to find a merged change's commits.
- **Searched, nothing else found:** module-level state in the frontend (`api.ts`'s session, now tied to each request; `Toast.tsx`'s id counter; `mode.ts`'s theme); other `placeholderData` lists (Deals already shows loading); other `except` clauses in the backend (each catches one known cause); tests waiting on threads (only TB47's, which now has time limits).
- **Tests:** `npm run check` passes in full: backend 512, frontend 544 unit tests in 39 files, end-to-end 56.
- **Still suggested for `docs/STANDARDS.md`,** from the last round and not yet taken up: find elements in end-to-end tests by role, label or text, not a library's class names. `e2e/dashboard.spec.ts` still uses Recharts' classes.

Watch list (seen once; a second time calls for a fix in the harness):

- A test environment hiding a browser API (dark mode PH4).
- A local stand-in differing from the service it stands in for: local sign-out ignored Supabase's `scope` (independent review).
- A copy of state that can drift from its source: the session gate's copy of the person (independent review).
- Error handling that assumes one cause: any `IntegrityError` adding a person was treated as a race and retried without limit (independent review).
- A test that hangs rather than fails: TB47's lock test (independent review).
- A comment stating behaviour no test checked: TE36's note that signing out left the shared session valid (independent review).

## Subagents (23 Nov)

- `.claude/agents/reviewer.md`: reviews the changes on a branch (or a named commit or range) against `docs/REVIEW.md` and reports Important findings, at most five nits, and open questions. Tools: Read, Grep, Glob and Bash. Model: Sonnet. Its PreToolUse hook, `.claude/hooks/reviewer-read-only.mjs`, splits each Bash command at unquoted `;`, `&&`, `||`, `|` and `&`, and blocks it unless every part is a read-only command (git diff, log, show, grep, status, blame and similar; grep, cat, head, ls, find and similar). It also blocks writing to a file, command substitution, `find -delete` or `-exec`, `git branch` with anything but listing options, and environment-variable prefixes. Tried on 15 commands that read (all allowed) and 15 that write or run things (all blocked).
- `.claude/agents/ui-check.md`: checks the running app at `http://localhost:5173` through the Playwright MCP server, 1440 by 900, every page in light and dark mode unless told otherwise. It preloads the brand skill, reads the spec, and reports Broken, Off-brand and Doesn't match the spec, with a screenshot per page and mode. Tools: Read, Grep, Glob and the Playwright browser tools, without file upload or running arbitrary Playwright code. No Bash, Edit or Write. Model: Sonnet. It doesn't save, delete or drag records.
- `.mcp.json`: the Playwright server now runs with `--output-dir .playwright-mcp`. That covers only files the server names itself (snapshots, console logs); a screenshot given a file name is saved relative to the repo root.
- `AGENTS.md` has a "Subagents" section describing both.
- Tried on 23 Nov. reviewer reviewed `df6b07a` ("Deploy: harness improved"): no Important findings, three nits. ui-check checked the dashboard and pipeline in both modes: nothing off-brand, and the pipeline's Lost column starts off-screen at 1440 wide. Its four screenshots landed in the repo root because `ui-check.md` told it to pass a bare file name. A test after a restart showed the same result, so `ui-check.md` now tells it to put `.playwright-mcp/` in the file name, and `AGENTS.md` says why.

## Quicker CI (23 Nov)

- `.github/workflows/ci.yml` runs `npm run check:quick` instead of `npm run check`, so CI no longer runs the end-to-end tests, which took most of each run's time. They still run locally in `npm run check`. Gitleaks still scans first.
- Taken out because only the end-to-end tests needed them: the step that uploaded the Playwright report on failure, and the HTML report that `playwright.config.ts` wrote only on CI. The end-to-end tests now use the list reporter everywhere.
- `AGENTS.md` describes the new CI step. The CI entry above, under the harness work, describes CI as it was then.

## Spec split by area (24 Nov)

- `docs/spec.md` is now a short summary of the whole product (problem, product, users, goals, not in Accountable yet, roadmap) with an index: which area file holds each requirement ID, each concern and each design section.
- The detail moved, unchanged, to nine area files in `docs/specs/`: `platform.md`, `look-and-feel.md`, `tables-and-forms.md`, `organizations.md`, `contacts.md`, `deals.md`, `pipeline.md`, `activities.md` and `dashboard.md`. Each holds its area's concerns (keeping their numbers), requirements, and its part of the data model, API and screens.
- Only wording that pointed at a neighbor changed: the API rows that said "as above" or had an empty purpose now say it in full, links between sections point at the right file, and each concern is labelled with its number.
- `AGENTS.md` says to read `docs/spec.md` first, then only the area files the current change touches, and to keep every spec file a change affects up to date in the same change. `docs/REVIEW.md`'s two spec passes cover the area files and the index. `.claude/agents/reviewer.md` and `ui-check.md` point at the area files.
- No code changed. The comment at the top of `frontend/src/shared/theme/tokens.css` still says "docs/spec.md, Colors"; the index in `docs/spec.md` leads to Colors in `docs/specs/look-and-feel.md`.

## Sign-in, search and a user menu (multi-user)

- `docs/spec.md` and the area files describe the product with this change. New area files: `docs/specs/accounts.md` and `docs/specs/search.md`. Concerns 16 to 23 are new.
- `docs/changes/multi-user/plan.md` is written: 11 parts with one owner per file, four phases (sign-in and the database, search, user menu, Render and finish), 19 risks, and tests TB44 to TB56, TF22 to TF33, TE30 to TE37 (with TE23 to TE29 rewritten) and TM10 to TM19. It asks for three new dependencies: psycopg, PyJWT and `@supabase/auth-js`. No code yet.

### PH1 Sign-in and the database: done

Built by a team of agents, one per part of the plan, each editing only its own files.

- **Database and settings (PT1):** `config.py` reads every setting when the app starts, never at import, and the mode is Supabase unless `ACCOUNTABLE_SIGN_IN=local`. `db.py` adds `users`, `created_by` and `updated_by` on the four record tables, `search_name` on organizations, contacts and deals, their indexes, and a Postgres engine with a small pool and pre-ping. Migration 0002 fills `search_name` for existing rows and on Postgres turns on row level security for every table; `env.py` can also write the SQL with no database connection, which TB45 checks.
- **Sign-in on the backend (PT2):** `auth.py` checks Supabase's ES256 or RS256 tokens against the project's published keys, or local tokens against a key made at start, and keeps each person's `users` row up to date, writing only when their email or name changed. `routers/account.py` has `/config`, `/me` and the local stand-in for Supabase Auth. Every test runs signed in as Test User, with a second person and a signed-out client for the tests that need them.
- **Who added what (PT3):** every write except a delete records the person (U8), through the new `authorship.py`, and every name write sets `search_name`. Renumbering a pipeline column keeps the other deals' last change, so sample deals don't show today's date. Sample records have no one recorded and show "Sample data".
- **Server (PT5):** `main.py` protects every route but `/health`, `/config` and local sign-in, refuses local sign-in on Render, never seeds Postgres, allows the Render host, and serves the built frontend. `npm start` (`scripts/start.mjs` with `settings.mjs`) can never run local sign-in, and `npm run seed:supabase` asks before replacing any data and never prints `DATABASE_URL`.
- **Frontend (PT6, PT7, PT9):** the app sits inside a session gate that shows the sign-in screen at any address while signed out and opens the page asked for afterwards. A 401 ends the session once, with no toast, and clears the cached data. Record pages show "Added by" and "Last changed by" at the foot of the details panel, and each timeline activity shows who added it.
- **End to end (PT10):** the tests sign in as Test User through the sign-in screen once per run; TE30 to TE34 are new.
- **Departures from the plan,** all now in `plan.md`: `authorship.py` is a new file; `test_performance.py`, `test_positions.py`, `board.test.tsx`, `main.test.tsx`, `persistence.spec.ts` and `pipeline.spec.ts` changed for sign-in or the new required column; auth-js has no cross-tab lock, so two tabs rely on Supabase Auth's 10-second refresh-token reuse window, which the local stand-in copies (R5); TE34 checks today's real date, since the backend records its own clock.
- **Spec gaps filled:** U8 and pipeline.md's card order say renumbering isn't a change; accounts.md places "Your session has ended" under the button in the usual text color; platform.md's layout lists `authorship.py`, `seed_supabase.py` and the new scripts.
- **Spec changes the product owner decided:** G11 also allows the console's 400 for a wrong password, and the 401s and the 403 from signing out with the refused token when a session ends (TE32, TE33). U2's "Couldn't reach" message also covers `GET /config` failing, and Sign in tries again. The `users` table's name comes from the token's `display_name`, then `full_name`, then `name`. The user menu takes the name and email from the sign-in token, not `/me` (Concern 17).
- **Tests:** `npm run check` passes in full: backend 450 passed, frontend 471 unit tests in 35 files, end-to-end 52 passed.

#### By-hand checks (W1.14)

The user set up the Supabase project following the guide at the top of this file, then ran these against it.

| Check | Status |
| --- | --- |
| TM10 `npm run build` and `npm start` against the real project | Done. A wrong password was refused and the right one signed in. Every page opened; a contact was added and a deal moved through two stages, and both were still there after a reload. |
| TM11 A person added in Supabase's dashboard, with a display name | Done. With no display name yet, records showed "Added by" and the person's email (U9, as specified). After setting `display_name` with the SQL in the setup guide and signing in again in a private window (there's no Sign out until PH3), records showed the name, earlier ones included. |
| TM12 Data API shut (CN21) | Done. Supabase's Security Advisor shows no table without row level security, and a Data API request with the publishable key returns `[]`. |
| TM13 `npm run seed:supabase` | Done. The first run on the new project showed zero counts and was answered yes. Later runs showed the sample counts, and answering no, twice, left them unchanged. |

Still open, for later phases: `test_performance.py::test_full_size_within_budget` failed once while other agents were running tests, and passed on its own. Worth watching in TM18. (Since checked in TM18: it takes 0.32 s on its own.)

### PH2 Search: done

SC4 is met: the search box in the top bar finds an organization, a contact and a deal by part of a name in any case, and opens the one chosen.

- **Backend (PT4, PT5):** `GET /api/search?q=` matches the casefolded text anywhere in `search_name`, with `%` and `_` matching only themselves, and returns up to 5 per group, names starting with the text first. Each group's total comes from the same query, so a search makes three queries. A blank search returns three empty groups. `main.py` includes the router, protected like the others.
- **Same order on both databases (PT1):** Postgres sorted `search_name` by language rules, which skip spaces, while SQLite sorts by byte order. Migration 0003 gives the column the "C" collation on Postgres, so the alphabetical order matches (IC9). It's a new migration because 0002 was already applied to Supabase; it changes nothing on SQLite.
- **Top bar (PT6):** 64 px high, with no panel and no line under it, holding the search box on the left; the content's top padding went from 28 px to 4 px to make room.
- **Search box (PT8):** results appear 150 ms after typing pauses, grouped with "N more" lines, with the match in bold and a second line for each result. It works by keyboard, closes on Escape keeping the text, and announces the number of results to screen readers. A failed search says "Couldn't search." in the results panel.
- **End to end (PT10):** TE35 searches for "garcia" and finds Garcia Freight, Sabrina Garcia and two Garcia deals; TE21 now also checks open results and the no-results text for console errors.
- **Departures from the plan,** all now in `plan.md`: migration 0003 (new work item W2.6 and test TB57); the search query's details; the top bar's padding; the TF22 and TF33 app tests' new ways of finding things now that the search box adds a second status region; and the PT8 details below.
- **Spec gaps filled in `search.md`:** the "C" collation in the data model; and in the search box's screen, the second lines when an organization, industry or stage is missing, the keys (wrapping, Up from nothing goes to the last result, Down reopens, Enter with nothing highlighted does nothing), Escape keeping the text, focus closing and reopening the results, the failed-search message, and what screen readers hear.
- **Tests:** `npm run check` passes in full: backend 476 passed, frontend 510 unit tests in 37 files, end-to-end 53 passed.

Checked on Supabase: after the user's `npm run build` and `npm start` applied migration 0003 there, "gArCiA" found Garcia Freight, Sabrina Garcia and the two Garcia deals, and the arrow keys and Enter opened one.

For PH4, the Host header Render's health check sends was checked: it's the `onrender.com` host, which G6 allows (see PH4).

### PH3 User menu: done

- **Theme (PT7):** dark is now the theme until someone picks another, and System follows the device's setting as it changes. `index.html`'s script reads `light`, `dark` or `system` from `accountable.theme` and treats anything else as dark, so a light or dark choice saved before this change is kept. `mode.ts` applies and saves the theme, and its `followDeviceTheme()` is called once from `main.tsx`.
- **User menu (PT7):** a Sea Green circle with the person's initials at the right of the top bar. The menu shows their name and email, the Light, Dark and System choice, and Sign out. Signing out clears the cached data, shows the sign-in screen and keeps the theme. It works by keyboard: Enter or Space opens it, the arrows move through it and into the theme choices, and Escape or Tab closes it with focus back on the circle. Choosing a theme keeps the menu open.
- **Accessibility:** the theme choices are radio items in a menu group named "Theme", so screen readers say which is "checked". The circle is announced as "Account menu for" the person's name, or their email when they have no display name.
- **Top bar and sidebar (PT6):** the menu sits in the top bar, and the sidebar's dark mode switch is gone, with its styles. `ThemeSwitch.tsx` and its test are deleted.
- **Product owner's decision:** a click outside the open menu closes it and puts focus back on the circle, unless the click landed in a field such as the search box, where focus stays. U12 is updated to match.
- **Product owner's decision on M1:** screen readers announce the chosen theme as "checked", as the menu's radio items do; M1 in `look-and-feel.md` is updated.
- **Departures from the plan,** all now in `plan.md`: `main.tsx` changed again in W3.3 for `followDeviceTheme()`; the theme choice uses menu radio items rather than plain buttons; TF32 covers choosing with Enter and Space and TF30 reaching the choices with the arrows; TF33 also checks the sidebar has no switch, button or "dark mode" text.
- **Spec gaps filled in U12:** Tab closes the menu like Escape; choosing a theme keeps it open; the circle's name uses the email when there's no display name.
- **Tests:** `npm run check` passes in full: backend 476 passed, frontend 537 unit tests in 39 files (ThemeSwitch's tests deleted), end-to-end 56 passed. PT10 added TE36 and TE37, rewrote TE23 to TE29 for the menu's theme choice, and TE21 now walks the open menu.

### PH4 Render and finish: done

- **Render (PT5):** `render.yaml` describes one free web service in Oregon, beside the Supabase project in US West, on Render's Python runtime. Its build is `pip install uv && uv sync --frozen && npm ci && npm run build`, and it starts with `node scripts/start.mjs`, which migrates the database and serves the app. `PYTHON_VERSION` 3.12.14 and `NODE_VERSION` 24.22.1 are pinned, since Render needs full versions. `UV_PROJECT_ENVIRONMENT=.venv-app` keeps the app's packages apart from the environment pip installed uv into, so syncing can't remove uv. The three settings are named with no values; `ACCOUNTABLE_SIGN_IN` is never set. TB58 (`test_render_yaml.py`) checks all of this.
- **Host check:** the product owner kept G6 strict, with no exemption for `/api/health`. Render's health check sends the service's `onrender.com` address as its Host header, which G6 already allows, and TB54 now checks `/api/health` answers it.
- **R19 closed:** Render's docs say Node and npm are on every native runtime, so the Python runtime builds the frontend too.
- **Docs (PT11, W4.2):** `platform.md`'s libraries table gains psycopg, PyJWT and `@supabase/auth-js`, and its deployment notes name the region. `TECH_STACK.md` describes Supabase and Render as they are, no longer "later". `ui-check.md` signs in as Test User on the filled-in local sign-in screen, stops if the screen asks for a real password, checks the sign-in screen, search results and the user menu, and switches theme through the menu. `AGENTS.md` gains "Running the app" (`npm run build`, `npm start`, `npm run seed:supabase`) and how ui-check signs in. The setup guide above gains "Deploy to Render".
- **Tests:** the final `npm run check` passes in full: backend 486 passed, frontend 538 unit tests in 39 files, end-to-end 56 passed.

#### By-hand checks

Deployed from the Blueprint on the `multi-user` branch. The service is live at https://accountable-q9l3.onrender.com.

| Check | Status |
| --- | --- |
| TM14 Deploy from `render.yaml` and use it on Render | Done. After the service had slept, the next visit woke it and the app worked. The user signed in as themselves, opened each page, added and edited a record, reloaded, and the change was kept. The public endpoints answer as they should: `/api/health` gives 200 `{"status":"ok"}`; `/api/config` gives Supabase mode with only the URL and publishable key; `/api/local-auth/user` is 404, so local sign-in isn't there (R1); `/api/organizations` without a token gives 401 "Sign in to use Accountable."; and a fresh load of `/deals/1` serves the app. |
| TM15 Two people, two browsers, and two tabs for over an hour | Done. Two people in two browsers on Render were each credited for their own changes, and one person's two tabs stayed signed in for over an hour (R5). |
| TM16 G7 and F7 at full size, locally and on Render | Done. Pages and search were quick locally, and on Render once it was awake. |
| TM17 ui-check of the new screens in light and dark | Done, with the user. Nothing broken; the only console errors were the two expected 400s from deliberate wrong-password tries (G11). All the new small text meets M5: secondary text 4.60:1 in light (the closest to 4.5) and 8.30:1 in dark, the local note 7.46:1, the sign-in error 5.7:1 in light and 9.75:1 in dark, and Midnight on Sea Green 6.40:1. A sample record's foot read "Added by Sample data on 2 Jul 2026"; a real name is covered by TE34, TM10 and TM11. Screenshots in `.playwright-mcp/` (git-ignored): `signin`, `signin-wrong-password`, `dashboard-topbar`, `deal-record`, `search-garcia`, `search-noresults`, `search-more` and `user-menu`, each in `-light` and `-dark`. Two findings went to the product owner: the dark panels' edges (left as the brand says, see Ideas for later) and the search box keeping its text after the page changes (now cleared whenever the path changes, with `search.md` and TF27 updated). |
| TM18 Slowest unit tests under a second (IC14) | Done. Backend: the slowest is 0.45 s (the setup of `test_rules.py::test_a_probability_typed_in_on_a_new_deal_wins[new]`); `test_full_size_within_budget` takes 0.32 s. Frontend: the slowest is 455 ms (`api-types.test.ts`, which has its own 60 s timeout), then 218 ms, and the other 535 are under 220 ms. Under load from other test runs, 3 frontend tests hit the 1 s limit (ContactsPage Delete, OrganizationsPage Edit, PipelinePage Space-move); run on their own 3 times, all 27 tests in those files passed. CI's limit is 10 s. |
| TM19 `npm run check` with `.env` filled in, removed, and with the network off | Done, passing in all three. With `.env` filled in: the user's own `npm run check` passed. With the network off: Wi-Fi can't be turned off here, so the lead ran it inside macOS `sandbox-exec` with every outbound connection refused except to localhost and local sockets (a `curl` to example.com inside it was refused), and it passed with backend 486, frontend 538 and end-to-end 56. With `.env` removed: the user moved it out of the repo for the run, and it passed. A first try that renamed it inside the repo to `.env.off` failed only gitleaks's working-tree scan, since the real keys sat in a file `.gitleaks.toml` didn't skip; its allowlist now matches `.gitignore` (see below). The commands are under the table. |

How TM19 was run, from the repo root. Network off, with a sandbox that refuses every outbound connection except to this computer:

```sh
sandbox-exec -p '(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:*"))(allow network-outbound (remote unix-socket))' npm run check
```

`.env` removed, by moving it out of the repo and back afterwards:

```sh
mv .env ../accountable.env.off && npm run check; mv ../accountable.env.off .env
```

- **gitleaks allowlist (PT11):** `.gitleaks.toml` skipped only `.env`, so a renamed copy such as `.env.off` was scanned and its real keys failed the check. With the user's approval it now skips what `.gitignore` ignores: `.env` and every `.env.<name>`, except `.env.example`, which is committed and still scanned. Go's regular expressions have no lookahead, so the pattern spells out every name other than `example`, and a comment says what it matches. Tested with fake keys in a scratch folder: gitleaks's own rules flagged all eight test files, and with the repo's config only `.env.example` was reported, while `.env.off`, `.env.examples`, `.env.local`, `.env.exampl`, `.env.e`, `.env.` and `.env.xample` were skipped. `git check-ignore` treats the same eight names the same way. The scratch folder is deleted, and `gitleaks dir .` reports no leaks.

The multi-user change is complete: every phase, work item and by-hand check is done.

### Review of the multi-user branch (25 Nov)

The `reviewer` subagent reviewed `main..multi-user` and found one Important problem and five nits. The security pass found nothing else: token checks, search's bound parameters, row level security and the handling of settings all held up.

- **Important, fixed: a failed key fetch signed everyone out for five minutes.** `SupabaseKeys` recorded the fetch time before fetching Supabase's signing keys, and a network error wasn't caught. So the first request got a 500, and for the next five minutes every request got a 401 with a valid token, which the frontend reads as an ended session. This was most likely when Render wakes while Supabase is slow (Concern 22). Now a failed fetch keeps the keys already held, answers 503 "Accountable can't check your sign-in right now. Try again in a moment." so no one is signed out, and is tried again after 5 seconds (`RETRY_AFTER_FAILURE_SECONDS`). A reply that isn't a JSON object counts as a failed fetch. `accounts.md` (Checking the token) and `platform.md` (API errors) now describe the 503. The frontend shows its usual "Something went wrong" message for it, as for any 5xx, and keeps the session.
- **Nit, fixed: a known key waited behind a fetch.** Every request took the lock, so all of them waited while one fetched (up to 10 s). A token whose key is held is now checked without the lock, and only requests needing a fetch wait for it.
- **Nit, fixed: the Host check was case-sensitive (G6).** `LOCALHOST`, `localhost.` or an upper-case `RENDER_EXTERNAL_HOSTNAME` were refused. Both sides are now lower-cased and lose a trailing dot; `platform.md` says so.
- **Nits, left as they are, with the product owner's agreement:** a missing `SUPABASE_URL` gives a 500 rather than a 401 (the startup check already stops the app without it); local sign-in is refused only when `RENDER` is set, which meets U7, and `start.mjs` removes the variable; `/api/testing/reset` has no sign-in check, but it's mounted only when `ACCOUNTABLE_TESTING=1`, which `render.yaml` never sets, and it only touches SQLite.
- **Tests:** `npm run check` passes in full: backend 507 passed, frontend 538 unit tests in 39 files, end-to-end 56 passed. TB47 gains the failed-fetch tests (five kinds of failure, no retry straight away, the keys already held are kept, the API's 503 and its message, a known key found while the lock is held) and a test that a reply that isn't a key set fails the fetch. TB54 and RV10's host tests gain upper case and trailing dots. Run against the old code, every new test failed (the lock test deadlocked); with the fix they pass. `plan.md`'s R8, TB47 and TB54 are updated.

### Independent review of the multi-user branch (25 Nov)

Reviewed `main...multi-user` through `1a8acc7`, with an emphasis on code quality and readability, and recorded the findings in [INDEPENDENT_REVIEW.md](INDEPENDENT_REVIEW.md): four Important findings and two nits, all confirmed by probes.

### Independent review fixes (25 Nov)

All six findings were fixed:

- **A late 401 ending a newer session:** `api()` keeps the session link it started with, through getting the token and the reply, and a 401 ends only that link while it's still the current one.
- **The menu keeping an old identity:** `SessionGate` subscribes to auth-js's `onAuthStateChange`, so a renewed session, or one signed in from another tab, updates the person shown (Concern 17).
- **A failed search showing earlier results:** `useSearch` keeps the last results only while the current text's reply is due; a failed search shows "Couldn't search.".
- **Local sign-out ending every browser:** the local stand-in tracks each refresh token's sign-in session across renewals and honours Supabase's `local`, `others` and `global` scopes. TE36 now signs in with its own session, so its sign-out can't touch the session the other tests share.
- **Nits:** a failed insert of a person's row is retried only when the other request's row is there, and is raised otherwise; the lock test holds a fetch up on another thread with bounded waits, so a regression fails rather than hangs.
- **Tests:** TF22, TF25, TF27, TB48 and TB49 gain regression tests, and TB47's lock test is rewritten. Run against the old code, each new test failed (the insert test with a recursion error), except the rewritten lock test, which guards against a regression the code doesn't have. `plan.md` is updated: R12, R15, TB47 to TB49, TF22, TF25, TF27, TE36 and the `SessionGate.tsx` row. `npm run check` passes in full: backend 512, frontend 543 unit tests in 39 files, end-to-end 56.
- **TB41's retries:** `/api/dashboard` once took 457 ms while the machine was busy, though over five runs it averaged 13.5 ms (the slowest endpoint, `/api/contacts`, averaged 41 ms). With the product owner's agreement, the budget stays at G7's 200 ms and a request over it is timed again, up to three times, failing only if every try is over. A normal run makes no extra requests, so the test stays well inside IC14's one second.

Committed as `0ccf8c9` and merged into `main` on 25 Nov, before its harness round (see "After multi-user" under Harness improvements).

## A phone view (phone-view)

- **Plan:** `docs/changes/phone-view/intent.md` is agreed. Everything that works on a laptop works on a phone, and the pipeline shows one stage at a time with a "Move to" choice on each card. At phone widths only, Dark is AMOLED dark with a true black page, and the default. The product owner signs off portrait and landscape on a real phone. The product owner reviews each stage before the next starts.
- **Design:** three phone mockups in `docs/mockups/phone/`, all in AMOLED dark: A (tab bar, rail in landscape), B (menu drawer) and C (quick add). The product owner chose A, near-black Midnight panels on the black page (Concern 25), and Move up and Move down for a card's place within a stage. The spec describes the product with the phone view: Concerns 24 to 26, M6, N1 to N7, T8, P9 to P11, U13, F8, H9, A7, C7, D11 and O5, phone screens in each area file, end-to-end tests at phone sizes and the by-hand sign-off in `platform.md`'s Testing, and `docs/spec.md`'s summary, index and "Not in Accountable yet". No code yet.
- **Build:** `docs/changes/phone-view/plan.md` is written: nine parts with one owner per file, four phases (foundations; tables, forms, records, search and the menu; pipeline and dashboard; finish), 14 risks, and tests TF34 to TF46, TE38 to TE44 and TM20 to TM23. No backend change and no new dependencies. No code yet.

### PH1 Foundations: done

- **Phone size (PT1):** `shared/phone.ts` holds `PHONE_QUERY` (Concern 24) and `usePhone()`; `usePhoneShape()` adds portrait or landscape. Every stylesheet's phone rules use that one query, which TF34 checks; landscape rules hang off a `landscape` class on `.app`, since a bare landscape query would match laptops too. Unit tests get a `matchMedia` stand-in with `setPhone()`, laptop by default.
- **AMOLED dark (PT1, M6):** in Dark at phone sizes the page is `#000000`, panels `#0B1A1F`, raised things `#12252C`, with no shadows. TF35 checks every text and surface pair (lowest: secondary text on `--raised`, 6.3:1). `index.html` has `viewport-fit=cover` so the tab bar keeps clear of the home bar.
- **Shell (PT2):** on a phone the layout renders the tab bar (a rail in landscape) in place of the sidebar, the page's title, summary and main action sit in the top bar through a portal, and the list pages' "Add contact" shows as "Add" (still named "Add contact" for screen readers, `AddButton.tsx`). `Sheet.tsx` is the bottom sheet the later phases use. Buttons and fields are 44 px and fields 16 px on a phone; the account circle keeps its 32 px look with a 44 px space to tap.
- **Found while building:** Chrome on a phone widens its whole layout to fit the laptop's table, even inside a clipped panel, which pushes the tab bar off screen. The three lists become lists on a phone in PH2 (T8), so TE38 checks the shell on the dashboard, pipeline and record pages for now. `main` also scrolls sideways on its own as a safety net, and TE38 measures against the phone's real width, since the widened layout fooled the first version of the check. The content of each page is still the laptop's until PH2 and PH3.
- **Departures from the plan,** all now in `plan.md`: `topBarSlot.ts` and `AddButton.tsx` are new, and the three list pages use `AddButton` from PH1; the layout renders either the sidebar or the tab bar rather than hiding one; `usePhoneShape()` and the `landscape` class; `Toast.tsx` needs no change, as toasts move with CSS alone; `account.css` changed in PH1 for the circle's tap area; the circle moves to the rail's foot in PH2 with the menu's sheet.
- **Tests:** `npm run check` passes in full: backend 512, frontend 627 unit tests in 42 files, end-to-end 68 (56 laptop tests unchanged, and TE38 and TE39 in the three phone projects). A first run failed only because the stop hook's quick check ran Vitest at the same moment and removed its coverage folder; run again on their own, all 627 passed.

### PH2 Tables, forms, records, search and the menu: done

- **Lists (PT3, T8):** on a phone the contacts, deals and organizations tables are lists: the name (with the Late badge for a deal), a second line, and the status, amount or value, then a More button with Edit and Delete. Sort by opens a sheet of every column in both orders ("Close date, earliest first", "Stage, New to Lost"), and paging reads "26 to 50 of 412" between Previous and Next. Search, filters, sort and page are the same table, so they survive turning the phone.
- **Forms and confirm dialogs:** full screen on a phone with Cancel and Save at the bottom, and the confirm sheet rises from the bottom with Delete on top. This is CSS alone.
- **Record pages (PT4):** `RecordHeader` gives every record page Back and More (Edit, Delete) in the top bar, then the name, second line and status, and Log activity, which opens the form full screen with Call chosen and What happened focused (A7). A contact has Call and Email beside it, opening the phone's dialer and mail app (C7). The details, linked records and timeline are one column in portrait and two in landscape, with links 44 px tall to tap. Each timeline activity's Edit and Delete are behind its More button.
- **Search and the menu (PT5):** search is a button in the top bar that opens the same search full screen (F8), as a history entry of its own, so the back button closes it and stays on the page, and choosing a result takes that entry's place. The user menu opens as a sheet (U13), at the foot of the rail in landscape. The sign-in panel fits the phone.
- **End to end:** TE38 now checks every list and record page's content too, not only the shell; TE40 (lists, Sort by, More, the form and confirm sheets), TE41 (search to a logged call with a follow-up in 10.3 seconds), TE43 (turning the phone keeps a half-filled form and a list's sort and page) and TE44 (the menu's sheet and signing out and in) are new.
- **Found while building:** in landscape the rail covered the account circle at its foot, since the top bar's stacking order held it beneath, so TE39 now taps the circle in landscape; links in the record pages were under 44 px; a status badge ran off a 360 px screen in an organization's contacts; the tap-target check sometimes measured a field mid-animation, so it now waits for animations and allows half a pixel of rounding. Chrome's phone emulation takes no typed dates, so TE41 sets the follow-up date directly, and picking it is part of TM20 on a real phone.
- **Spec:** the sign-in panel on a phone sits near the top rather than a third of the way down, so the keyboard can't cover Sign in; `accounts.md` says so.
- **Tests:** `npm run check` passes in full: backend 512, frontend 660 unit tests in 47 files, end-to-end 77 (the 56 laptop tests unchanged). After the back-button change, the search and phone end-to-end tests (22, and 6 portrait-only skips), the quick checks and the 661 unit tests pass again.
- **Departures from the plan,** all now in `plan.md`: `TablePhone.tsx` is new; the phone tests are in new files (`DataTablePhone`, `RecordHeader`, `TimelinePhone`, `SearchBoxPhone`, `UserMenuPhone`); `RecordHeader` serves both sizes, so the record pages drop `PageHeader`; `SearchBox` splits into the button and `SearchField`; the side panel and confirm dialog change only through CSS; TE20's date helpers move into the fixtures.

### PH3 Pipeline and dashboard: done

- **Pipeline (PT6, P9 to P11):** on a phone the board shows one stage at a time. A row of stage tabs (color dot, name and count) chooses it, kept in the address as `?stage=`, so a reload or Back returns to it; the arrow keys move between tabs. Under the tabs are the stage's total and expected revenue; the open totals sit under the title, and Add is in the top bar. In landscape the tabs and the stage's totals move into the top bar and the cards run in two columns. Cards can't be dragged on a phone: the card's top lines open the deal, and "Move to" opens a sheet with the six stages, the current one marked "(now)", then Move up and Move down, each left out at the ends. A move to another stage goes to the top of that stage and says "Moved Mobile app to Won"; the board stays on the stage the card left.
- **One save path:** `useSendMove` holds the drop's rules (no save when the card stays put, one move at a time per card) and the laptop board and the sheet both use it, so a move from the sheet updates the totals at once, saves in order and puts the card back with a message if the save fails. `moveToStage` and `moveWithin` give the same move a drop at that place gives, past cards a search hides (TF42).
- **Dashboard (PT7, H9):** one column in portrait in H9's order (tiles two by two, revenue won, follow-ups, recent activity, the pipeline by stage, the funnel, won and lost) and two in landscape, set by the grid's order so the markup is unchanged. The charts are 180 and 160 px high, label every third month counting back from this month, and open their tooltips on a tap. The funnel's and stage bars' names sit above their bars; list rows are at least 56 px with the date and a 44 px Mark done on the right.
- **End to end:** TE38 now checks every page's content, the dashboard and pipeline included, plus the dashboard's order, month labels and tap tooltips; TE42 (Negotiation, Move to Won, Move up and down, a reload keeps all three, and Back from a deal returns to the stage) is new. All run in portrait, landscape and at 360 px.
- **Found while building:** the chosen tab could sit off screen in landscape, or cut at the edge in portrait, since the tabs widen once their counts load after the first scroll; the row now centres the chosen tab again when the counts change, and its ends fade in landscape. Follow-ups' Mark done wrapped onto a line of its own, doubling the list's length; the row is now a grid. A card's name alone as its link measured under 44 px, so the card's top three lines are the link. Chrome reads a visually hidden span as a separate word ("Move to : …"), so the button and tabs have their names set directly. The Move to sheet's first focus fell on the disabled current stage and went nowhere; the sheet now skips disabled buttons.
- **Spec:** the stage tabs are 44 px high, not 40, as N3 sets for anything tapped; `pipeline.md` says so.
- **Tests:** `npm run check` passes in full: backend 512, frontend 688 unit tests in 48 files, end-to-end 89 passed and 6 skipped (the portrait-only journeys in landscape and at 360 px), with the 56 laptop tests unchanged.
- **Departures from the plan,** all now in `plan.md`: `PhonePipeline.tsx` is new and `PipelinePage` picks it or the drag board; `useSendMove` moves into `hooks.ts`; `Column` splits into `ColumnFrame`; `stageFromParam` moves to `shared/stages.ts`; `Sheet.tsx` skips disabled buttons; the tabs and sheet are tested through the page in `PipelinePhone.test.tsx`; the funnel, lists and tiles change through `dashboard-phone.css` alone; Mark done's 44 px is measured by TE38 rather than TF46.

### PH4 Finish: done

- **Every phone test at every size (W4.1):** TE41, TE43 and TE44 ran in portrait only; they now run in portrait, landscape and at 360 px like the rest, 39 phone tests in all. They run in AMOLED dark, a phone's first-visit default, and TE38 covers light. As a one-off, every phone test also ran with the theme forced to light: all passed except TE39's "a first visit opens in AMOLED dark", which can't pass with light forced.
- **ui-check at phone sizes (TM21):** `.claude/agents/ui-check.md` now checks 390 by 844 and 844 by 390 when asked. It found no sideways scroll, no console errors, AMOLED colors as specified (secondary text on the raised color 6.25:1), and these, all fixed: in landscape a list's filters sat under its search box rather than in the top bar's row, and the deals top bar wrapped; summaries under a title and the dashboard's follow-up descriptions were cut off; the deals stage filter squeezed the search box; the Add deal form's date field ran 8 px past the margin; form fields were 14 px, not N7's 16; the Log activity form's type buttons were 30 px high and it had no Cancel; full-screen search left the tab bar showing in portrait, since the top bar's stacking held it beneath; activity icons were black on the AMOLED panel instead of the raised color; the menu sheet had no initials circle and its theme choice was the laptop's filled chip, not a 44 px control with the chosen one ringed. Tests added: the filters moving to the top bar in landscape (`setPhone("landscape")` is new in the test setup), the log form's Cancel, the menu's circle, and TE41 checking search covers the tab bar; each fails on the code before its fix.
- **ui-check on a laptop (TM22):** at 1440 by 900, light and dark, nothing from the phone work shows: sidebar, search box, user menu panel, tables with hover icons, six pipeline columns and 480 px side panels as before, and the dashboard and pipeline match `docs/changes/dark-mode/` apart from the later top bar and data. It noted three small things that were there before this branch (the laptop stylesheets are unchanged from `main`): the inline Log activity field cuts its placeholder short, a long email breaks mid-word on a contact's details, and contact table rows wrap unevenly. They're under Ideas for later.
- **Timings (TM23):** the slowest frontend unit test is the API types check at 0.7 s, then 0.23 s; all under a second. End to end: the 56 laptop tests take 113 seconds on their own; with the 39 phone tests the whole run takes 209 seconds.
- **Docs:** `platform.md`'s repository layout lists the phone files and the rule that phone CSS lives in its own stylesheets inside the phone query. Each area file was read against the build; the spec's panel corners (12 px) and padding (14 px) on a phone now hold everywhere.
- **Not changed, for the product owner:** the full-screen search placeholder, "Search organizations, contacts and deals", is cut off at phone width; F1 sets that wording. And in landscape the top bar reads title, Add, filters, search, where the spec lists the main action last.
- **Tests:** `npm run check` passes in full: backend 512, frontend 692 unit tests in 48 files, end-to-end 95 (56 laptop, 39 phone).
- **Departures from the plan,** all now in `plan.md` as PT10: the fixes above, `TableFilters` in `TablePhone.tsx`, and the journeys at every size.

## Ideas for later

- **Laptop tidying found by ui-check (TM22):** the inline Log activity field is too narrow for its placeholder; a long email on a contact's details breaks mid-word; contact table rows wrap unevenly at 1440 wide.

- The revenue line chart isn't very pleasant to look at; try other graph and chart types for it.
- The "Dark mode" switch takes more sidebar space than it needs; make it a small icon that toggles dark mode on and off. Done in multi-user PH3: the switch was replaced by the theme choice in the user menu.
- Hide people's emails where they have no display name, rather than showing the email in "Added by" and "Last changed by" (U9 shows the email today). This changes the spec, so it belongs in a later change, not multi-user.
- In dark mode, the search results panel and the user menu are black over black cards, so their edges almost disappear (found in TM17). Left as the brand says for now; a possible brand tweak, such as a lighter panel or a stronger shadow for floating panels in dark mode.
