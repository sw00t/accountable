# Spec: Platform

Part of the [Accountable spec](../spec.md), which has the summary of the whole product and the index. This file covers what every section relies on: running the app, saving, the database, money and dates, errors, sample data, the architecture, the repository layout, the libraries, the API's conventions and testing.

## Concerns

- **Concern 4: Offline use and Google Fonts.** The brand fonts come from Google Fonts, but the app must work with no internet connection. The fonts are installed as npm packages (Fontsource) and served locally.
- **Concern 5: A non-technical user and a terminal command.** `npm run dev` needs Node.js and uv installed, and a terminal to run it. `docs/STATUS.md` has a plain, step-by-step setup guide for Mac with links to the installers, and the command opens the browser by itself. There's no double-click launcher.
- **Concern 11: The sample data dates.** For the dashboard to look alive whenever it's seeded, the sample data is generated relative to today's date, with a fixed random seed so its shape is the same each time.

## Requirements

### General

- **G1** The app runs with `npm run dev` on a Mac, opens at `http://localhost:5173` and lands on the dashboard.
- **G2** It works with no internet connection once installed. Nothing is loaded from a CDN or a font service at run time.
- **G3** Every change is saved to the SQLite database at once. It's still there after a refresh and after a restart. The one exception is the light or dark choice, which the browser keeps (M2).
- **G4** When the database file doesn't exist, the backend creates it by running the migrations and fills it with the sample data.
- **G5** `npm run seed` deletes all data and loads the sample data again.
- **G6** The app is a single-user app with no sign-in. The backend answers only requests addressed to this computer (`127.0.0.1` or `localhost`), so a web page elsewhere can't reach the data.
- **G7** Lists, search, sort and screen changes respond in under 200 ms at 2,000 contacts, 1,000 deals and 10,000 activities on a typical laptop.
- **G8** Error messages are short, plain and say what to do next, for example "Couldn't save the deal. Check your connection to Accountable and try again." No stack traces or codes are shown to the user. When a form's list of choices, such as its organizations, doesn't load, the form says so under that field with a Retry button and keeps what was typed.
- **G9** Money is in US dollars, shown as `$48,200` in tables and cards and `$1.2M` only where space is short, such as chart axes. Amounts are whole dollars.
- **G10** Dates are shown as `16 Nov 2026`. The app uses the computer's local date for "today".
- **G11** No errors appear in the browser console during normal use. One exception: opening a link to a record that has been deleted logs the server's 404 reply, while the page says the record can't be found.
- **G12** Each time it starts, the backend applies any new database migrations, keeping all existing data.

### Sample data

- **S1** About 12 organizations across at least 5 industries, 40 contacts at every status, 30 deals at every stage and 120 activities, spread over the past 12 months and relative to today.
- **S2** It includes deals won and lost in most of the past 12 months, deals expected to close in the coming months, at least 3 late deals, at least 3 overdue follow-ups and at least 3 follow-ups due in the next 7 days.
- **S3** Each deal has a stage-change history that leads to its current stage, so the funnel and timelines look real.
- **S4** Names and companies are realistic but invented.

## Design

### Architecture

The technology is set in `docs/TECH_STACK.md`.

```
Browser (React app, port 5173)
   │  JSON over HTTP, /api proxied by Vite
   ▼
FastAPI (port 8000)
   │  SQLAlchemy Core
   ▼
SQLite file: data/accountable.db
```

- The frontend fetches lists in full and does search, sort and paging in the browser. At the sizes in G7 that's a few hundred kilobytes and keeps every keystroke instant. The API keeps limit and offset parameters so this can move to the server when the data grows; `limit` is at most 1,000.
- The backend is the only place business rules live: stage probabilities, close dates on Won and Lost, customer status, stage-change entries and delete rules. The frontend shows the result.

How the dashboard figures are computed is in [dashboard.md](dashboard.md#architecture), and how light and dark mode work is in [look-and-feel.md](look-and-feel.md#architecture).

### Repository layout

The frontend and backend are both grouped by section, and each frontend section folder matches one backend module. A new section, such as invoices when ERP arrives, gets its own backend module and frontend folder without touching the others.

```
package.json              npm scripts and workspaces
pyproject.toml, uv.lock   backend dependencies
alembic.ini               migration settings
scripts/dev.mjs           starts both servers, explains a missing tool, opens the browser
backend/
  app/
    main.py               FastAPI app, routers, error handlers, startup
    config.py             settings from environment variables
    deps.py               per-request dependencies: database connection, today's date
    db.py                 engine, metadata, tables
    schemas.py            Pydantic request and response models
    rules.py              stage probabilities and deal rules
    routers/              one module per section, holding its endpoints and their queries:
                          organizations, contacts, deals (with board positions), activities,
                          timeline, dashboard, health
    seed.py               sample data generator
  migrations/             Alembic migrations, starting with the first schema
  tests/                  pytest
frontend/
  index.html              sets the saved light or dark mode before the app loads
  src/
    shared/               used by every section: layout, DataTable, SidePanel, ConfirmDialog,
                          toasts, the mode switch, small display pieces, format and stage
                          helpers, API client, generated API types, theme (tokens for both
                          modes, saving the mode) and fonts
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

### Data model

All tables have an integer `id` primary key and `created_at` and `updated_at` timestamps. Foreign keys are on, with the delete behavior shown.

Each table is described in its area file: **organizations** in [organizations.md](organizations.md#data-model), **contacts** in [contacts.md](contacts.md#data-model), **deals** and **stage_changes** in [deals.md](deals.md#data-model), and **activities** in [activities.md](activities.md#data-model). How the deals' `position` sets card order is in [pipeline.md](pipeline.md#data-model).

Indexes: every foreign key, `deals(stage, position)`, `activities(follow_up_on, done)`, and `activities(occurred_on)`.

### API

All under `/api`. Responses are JSON. Errors use one shape: `{"message": "...", "fields": {"email": "Enter an email address like name@company.com"}}`, with status 400 for validation or a request addressed to another host (G6), 404 for a missing record and 500 for anything unexpected, which is logged on the server and shown to the user as a general friendly message.

Each area file lists its own endpoints. The one that belongs to no section:

| Method and path | Purpose |
| --- | --- |
| `GET /health` | used by the dev script and e2e tests |

The `today` date comes from the browser in an `X-Local-Date` header, so "late", "overdue" and "this month" match the user's calendar. The backend falls back to its own date when the header is missing, isn't a date, or is outside 1900 to 2999.

### Testing

- **Backend (pytest)**: every rule in D3 to D7, the delete rules in O4, C6 and D10, the timeline contents in C5, card positions and renumbering, validation messages, and each dashboard figure against a small hand-made data set.
- **Frontend (Vitest)**: money and date formatting, the table's search, sort and paging, form validation messages, the optimistic update and rollback on the board, and the mode switch (M1, M2, including a browser that won't store the choice). A token test reads `tokens.css` and checks that no file outside it names a color, that the dark block only overrides tokens the light block defines, and that each text and surface pair in the Colors table meets M5 in both modes.
- **End to end (Playwright with installed Chrome)**: the user journeys, against a fresh seeded test database on its own port. They cover adding, searching, sorting, editing and deleting in each table; the status filter; dragging a card between columns and within a column and checking it after a reload; logging an activity with a follow-up and seeing it on the dashboard; marking a deal won and seeing the dashboard change; opening in dark mode with nothing saved, turning dark mode off, finding light mode still on after a reload and turning dark mode on again; and no console errors on any page in either mode.
- The tests set the backend's database path with an environment variable, so they never touch `data/accountable.db`.
- Passing tests is necessary but not enough. Before a change is called done, a person uses what it touched end to end in a real browser, the way a salesperson would, with the browser's console open, and the result is noted in `docs/STATUS.md`.
