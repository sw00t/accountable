# Spec: Platform

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers what every section relies on: running the app, saving, the database, money and dates, errors, sample data, deployment, the architecture, the repository layout, the libraries, the API's conventions and testing.

## Concerns

- **Concern 4: Offline use and Google Fonts.** The brand fonts come from Google Fonts, but the app must work with no internet connection. The fonts are installed as npm packages (Fontsource) and served locally.
- **Concern 5: A non-technical team and a terminal command.** The team opens Accountable at its web address and installs nothing. Only whoever develops or deploys it needs a terminal: `npm run dev` needs Node.js and uv installed. `docs/STATUS.md` has a plain, step-by-step setup guide for Mac with links to the installers, and steps for adding people in Supabase and deploying to Render. The command opens the browser by itself. There's no double-click launcher.
- **Concern 11: The sample data dates.** For the dashboard to look alive whenever it's seeded, the sample data is generated relative to today's date, with a fixed random seed so its shape is the same each time.
- **Concern 21: Supabase's Data API and the publishable key.** Supabase serves every table in the `public` schema through its Data API to anyone holding the publishable key, which the browser holds. Accountable doesn't use the Data API, but its tables would be open through it. So on Postgres every Accountable table has row level security turned on with no policies, which shuts the Data API out, while the backend connects as the database owner, which row level security doesn't apply to.
- **Concern 22: Render's free plan sleeps.** A free web service stops after 15 minutes with no visits, and the next visit waits about a minute while it starts again. A free Supabase project pauses after a week with no use and has to be restored in its dashboard. Both are accepted for a small team; the setup guide in `docs/STATUS.md` says what to expect.
- **Concern 23: Reaching Supabase from Render.** Supabase's direct database address works over IPv6 only, and Render's services connect over IPv4. `DATABASE_URL` is the project's session pooler connection string, which works over IPv4.

## Requirements

### General

- **G1** `npm run dev` runs the app on a Mac and opens `http://localhost:5173` at the sign-in screen, filled in for Test User (U7). Signing in lands on the dashboard.
- **G2** Accountable serves its own code and fonts: nothing is loaded from a CDN or a font service at run time. The built app needs an internet connection to reach Supabase. `npm run dev`, `npm run seed` and the tests work with no internet connection once installed.
- **G3** Every change is saved to the database at once: Postgres on Supabase for the built app, the local SQLite file for `npm run dev`. It's still there after a refresh and after a restart. The one exception is the theme, which the browser keeps (M2).
- **G4** When the local SQLite file doesn't exist, the backend creates it by running the migrations and fills it with the sample data. A Postgres database is never filled by itself (G15).
- **G5** `npm run seed` deletes all data in the local SQLite file and loads the sample data again. It never touches Supabase, even with the settings in `.env`.
- **G6** Everyone signs in (U1 to U5). The backend answers only requests addressed to this computer (`127.0.0.1` or `localhost`) or to the app's own address on Render, so a web page that points another name at the backend can't use it.
- **G7** Lists, search, sort and screen changes respond in under 200 ms at 2,000 contacts, 1,000 deals and 10,000 activities on a typical laptop.
- **G8** Error messages are short, plain and say what to do next, for example "Couldn't save the deal. Check your connection to Accountable and try again." No stack traces or codes are shown to the user. When a form's list of choices, such as its organizations, doesn't load, the form says so under that field with a Retry button and keeps what was typed.
- **G9** Money is in US dollars, shown as `$48,200` in tables and cards and `$1.2M` only where space is short, such as chart axes. Amounts are whole dollars.
- **G10** Dates are shown as `16 Nov 2026`. The app uses the computer's local date for "today".
- **G11** No errors appear in the browser console during normal use. Three exceptions, each where the page itself says what happened: opening a link to a record that has been deleted logs the server's 404 reply, while the page says the record can't be found; a wrong email or password logs the sign-in's 400 reply, while the sign-in screen shows U2's message; and when the session ends, the refused requests log their 401 replies and signing out with the refused token logs a 403, while the sign-in screen shows (U3).
- **G12** Each time it starts, the backend applies any new database migrations, keeping all existing data. The same migrations run on SQLite and on Postgres.

### Running it on the web

- **G13** `npm run build` builds the frontend. `npm start` then runs the built app the way Render does: the backend serves the built frontend and the API from one address, `http://localhost:8000` on this computer, using the settings in `.env` for the database and sign-in.
- **G14** The settings are `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, in `.env` on this computer and entered in Render's dashboard there. `.env` is git-ignored, and `.env.example` lists the three names with no values. `npm start` won't run without all three and says which is missing. `npm run dev`, `npm run seed`, `npm test` and `npm run check` never read them.
- **G15** `npm run seed:supabase` loads the sample data into the Supabase database in `.env`. First it says how many organizations, contacts, deals and activities are there now and asks the person to type "yes" to delete them. Anything else leaves the database as it was. The `users` table is kept.
- **G16** `render.yaml` describes one web service on Render's free plan that builds the frontend, runs the migrations when it starts, serves the app and answers at its `onrender.com` address. It names the three settings without their values, so they're entered in Render. Render checks `GET /api/health` to know the service is up.

### Sample data

- **S1** About 12 organizations across at least 5 industries, 40 contacts at every status, 30 deals at every stage and 120 activities, spread over the past 12 months and relative to today.
- **S2** It includes deals won and lost in most of the past 12 months, deals expected to close in the coming months, at least 3 late deals, at least 3 overdue follow-ups and at least 3 follow-ups due in the next 7 days.
- **S3** Each deal has a stage-change history that leads to its current stage, so the funnel and timelines look real.
- **S4** Names and companies are realistic but invented.

## Design

### Architecture

The technology is set in `docs/TECH_STACK.md`.

```
Browser (React app)
   │  signing in: Supabase Auth (built app) or local sign-in (npm run dev, tests)
   │  JSON over HTTP to /api, with the session's token
   ▼
FastAPI: the API, and the built frontend for npm start and Render
   │  SQLAlchemy Core
   ▼
Postgres on Supabase (npm start, Render)  or  SQLite file data/accountable.db (npm run dev)
```

With `npm run dev`, the frontend is served by Vite on port 5173, which passes `/api` on to FastAPI on port 8000.

- The frontend fetches lists in full and does search, sort and paging in the browser. At the sizes in G7 that's a few hundred kilobytes and keeps every keystroke instant. The API keeps limit and offset parameters so this can move to the server when the data grows; `limit` is at most 1,000.
- The backend is the only place business rules live: stage probabilities, close dates on Won and Lost, customer status, stage-change entries, delete rules and who added or changed what. The frontend shows the result.
- How the app starts decides both the database and the sign-in. `npm start` and Render use Postgres on Supabase with Supabase Auth. `npm run dev`, `npm run seed` and the tests use a SQLite file with local sign-in (Concern 16). Nothing in a request can switch between them.
- The backend checks the token on every request that needs one (U5) and takes the person from it, as set out in [accounts.md](accounts.md#api).
- In the built app, the backend serves the files in the built frontend by their paths, and answers any other path outside `/api` with the frontend's `index.html`, so a link to a record still opens after a refresh.

How the dashboard figures are computed is in [dashboard.md](dashboard.md#architecture), and how light and dark mode work is in [look-and-feel.md](look-and-feel.md#architecture).

### Repository layout

The frontend and backend are both grouped by section, and each frontend section folder matches one backend module. A new section, such as invoices when ERP arrives, gets its own backend module and frontend folder without touching the others.

```
package.json              npm scripts and workspaces
pyproject.toml, uv.lock   backend dependencies
alembic.ini               migration settings
render.yaml               the Render web service
.env.example              the names of the three settings, with no values
scripts/dev.mjs           starts both servers, explains a missing tool, opens the browser
scripts/start.mjs         npm start: checks the settings, then runs the built app with Supabase
scripts/seed-supabase.mjs npm run seed:supabase: checks the settings, then runs seed_supabase.py
scripts/settings.mjs      reads .env for those two and names any missing setting
backend/
  app/
    main.py               FastAPI app, routers, error handlers, startup, serving the built frontend
    config.py             settings from environment variables
    deps.py               per-request dependencies: database connection, today's date, the person
    auth.py               checking tokens and keeping the users table up to date
    authorship.py         who added and last changed a record: the values to save, the names to show
    db.py                 engine, metadata, tables
    schemas.py            Pydantic request and response models
    rules.py              stage probabilities and deal rules
    routers/              one module per section, holding its endpoints and their queries:
                          organizations, contacts, deals (with board positions), activities,
                          timeline, dashboard, search, account (config, me, local sign-in),
                          health
    seed.py               sample data generator
    seed_supabase.py      loading the sample data into Supabase after asking (G15)
  migrations/             Alembic migrations, starting with the first schema
  tests/                  pytest
frontend/
  index.html              sets the saved theme before the app loads
  src/
    shared/               used by every section: layout with the top bar, DataTable, SidePanel,
                          ConfirmDialog, toasts, small display pieces, format and stage
                          helpers, API client, generated API types, theme (tokens for both
                          modes, saving the theme) and fonts
    account/              sign-in screen, session, user menu with the theme choice
    search/               the top bar's search box and results
    organizations/        tables, record page, form, Query hooks and tests for one section
    contacts/
    deals/
    activities/           timeline and Log activity form, used by contacts and deals
    pipeline/
    dashboard/
e2e/                      Playwright Test
data/                     SQLite file (git-ignored)
```

Frontend unit tests sit next to the code they test. The rules for adding to this layout:

- A new section gets a backend module in `routers/` and a frontend folder. Its endpoints, queries, pages, form and hooks live there.
- Code moves to `shared/` only when a second section needs it.
- Business rules stay in `rules.py` and the backend modules, never in the frontend.
- Every schema change is an Alembic migration, so existing data is upgraded safely.
- The frontend's API types are generated from the backend with `npm run types`, never written by hand.

### Libraries

| Need | Library |
| --- | --- |
| Routing | React Router |
| Server data and caching | TanStack Query |
| Tables | TanStack Table |
| Forms and validation | React Hook Form with Zod |
| Charts | Recharts |
| Drag and drop | dnd-kit (core and sortable) |
| Fonts, served locally | Fontsource: Instrument Sans, Instrument Serif, JetBrains Mono |
| Icons | Lucide |
| Running both servers | concurrently |
| Backend | FastAPI, SQLAlchemy Core, Pydantic, Uvicorn |
| Database migrations | Alembic |
| API types for the frontend | openapi-typescript, generated from the backend's OpenAPI schema |
| Sample data | Faker, with a fixed seed |
| Reaching Postgres | psycopg 3.3 (`psycopg[binary]`), SQLAlchemy's driver |
| Checking tokens | PyJWT 2.15 (`pyjwt[crypto]`), with its key client for Supabase's published keys |
| Signing in and keeping the session | `@supabase/auth-js` 2.119, the sign-in part of Supabase's client alone |

### Data model

All tables have an integer `id` primary key and `created_at` and `updated_at` timestamps. Foreign keys are on, with the delete behavior shown. The tables are the same on SQLite and Postgres. On Postgres, each has row level security on with no policies (Concern 21).

Each table is described in its area file: **organizations** in [organizations.md](organizations.md#data-model), **contacts** in [contacts.md](contacts.md#data-model), **deals** and **stage_changes** in [deals.md](deals.md#data-model), **activities** in [activities.md](activities.md#data-model), and **users** in [accounts.md](accounts.md#data-model). Organizations, contacts, deals and activities also record who added and last changed them, described in [accounts.md](accounts.md#data-model). How the deals' `position` sets card order is in [pipeline.md](pipeline.md#data-model), and the names' search copies are in [search.md](search.md#data-model).

Indexes: every foreign key, `deals(stage, position)`, `activities(follow_up_on, done)`, `activities(occurred_on)`, `users(auth_id)`, and `search_name` on organizations, contacts and deals.

### API

All under `/api`. Responses are JSON. Every route except `GET /health`, `GET /config` and local sign-in needs the header `Authorization: Bearer <token>` (U5). Errors use one shape: `{"message": "...", "fields": {"email": "Enter an email address like name@company.com"}}`, with status 400 for validation or a request addressed to another host (G6), 401 for a missing, invalid or expired token, 404 for a missing record, 503 when Supabase's signing keys can't be fetched to check a token (see Checking the token in `accounts.md`) and 500 for anything unexpected, which is logged on the server and shown to the user as a general friendly message.

Each area file lists its own endpoints. The one that belongs to no section:

| Method and path | Purpose |
| --- | --- |
| `GET /health` | used by the dev script, e2e tests and Render |

The `today` date comes from the browser in an `X-Local-Date` header, so "late", "overdue" and "this month" match the user's calendar. The backend falls back to its own date when the header is missing, isn't a date, or is outside 1900 to 2999.

### Deployment

- Render runs one web service from `render.yaml` on the free plan. Its build installs the backend and frontend dependencies and builds the frontend. Its start command runs the backend on the port Render gives it, which runs the migrations and then serves the app (G13, G16).
- The backend's allowed hosts (G6) are `127.0.0.1`, `localhost` and, on Render, the service's own address, which Render provides in `RENDER_EXTERNAL_HOSTNAME`. Host names are compared without regard to case or a trailing dot.
- `DATABASE_URL` is the Supabase project's session pooler connection string (Concern 23). The Render service and the Supabase project are in the same region, to keep each query quick: Oregon, for a Supabase project in US West.

### Testing

- **Backend (pytest)**: every rule in D3 to D7, the delete rules in O4, C6 and D10, the timeline contents in C5, card positions and renumbering, validation messages, and each dashboard figure against a small hand-made data set. Tokens: a missing, expired or wrongly signed token, and a local token offered to Supabase sign-in, are each refused on every route that needs one. Who added and last changed each record (U8), the names shown (U9), and search (F2, F3) with mixed case, accented letters, `%` and `_`.
- **Frontend (Vitest)**: money and date formatting, the table's search, sort and paging, form validation messages, the optimistic update and rollback on the board, and the theme choice (M1, M2, including System and a browser that won't store the choice). A token test reads `tokens.css` and checks that no file outside it names a color, that the dark block only overrides tokens the light block defines, and that each text and surface pair in the Colors table meets M5 in both modes. The sign-in screen's messages (U2, U3), the initials (U11), the user menu's keyboard use (U12), and the search box's keyboard use and stale replies (F5, F7).
- **End to end (Playwright with installed Chrome)**: the user journeys, against a fresh seeded test database on its own port, signed in as Test User through the sign-in screen with local sign-in. They cover adding, searching, sorting, editing and deleting in each table; the status filter; dragging a card between columns and within a column and checking it after a reload; logging an activity with a follow-up and seeing it on the dashboard; marking a deal won and seeing the dashboard change; opening in dark mode with nothing saved, choosing Light, finding light still on after a reload, and choosing System with the device set to light and then dark; signed out, every page showing the sign-in screen and the API refusing; signing in and out; a new record showing Test User as who added it; finding an organization, a contact and a deal from the top bar by part of a name in another case; and no console errors on any page in either mode.
- The tests set the backend's database path with an environment variable, so they never touch `data/accountable.db`. They never read `.env` and never reach Supabase, so `npm run check` passes with or without the settings, and CI needs no secrets.
- Every unit test, backend and frontend, runs in under a second on this computer, because CI runs on a much slower machine.
- Passing tests is necessary but not enough. Before a change is called done, a person uses what it touched end to end in a real browser, the way a salesperson would, with the browser's console open, and the result is noted in `docs/STATUS.md`. Sign-in with Supabase is checked this way with `npm start` against the real project, since no test reaches it.
