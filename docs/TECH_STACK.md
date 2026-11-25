This project will use the following high level technical stack:

1. Node.js 26, the current LTS (24 or later works) / TypeScript for the frontend, using React and Vite, in `frontend/`
2. Python 3.12 for the backend using uv, with FastAPI, in `backend/`, with `pyproject.toml` and `uv.lock` at the repo root

The frontend gets its data from the backend's JSON API. The backend keeps the data using SQLAlchemy Core with no raw SQL: in a local SQLite database file for `npm run dev`, which it fills with the sample data when the file is new, and in Postgres on Supabase for the built app.

Prefer popular, well-supported libraries to custom code, such as for the data tables, the charts and the drag-and-drop pipeline. Don't hand-roll what a mature library does well.

Supabase provides sign-in (Supabase Auth) and the database (Postgres) for the built app, which is deployed to Render as one web service on the free plan, described in `render.yaml`. `npm run dev` and the tests run locally with SQLite and a local test sign-in, and never reach Supabase.

Commands are npm scripts in a `package.json` at the repo root, with `frontend/` as an npm workspace. Accountable runs on a Mac:

- `npm run dev` starts the backend and the frontend together
- `npm test` runs all the tests and fails if any test fails
- `npm run seed` resets the database to the sample data
- `npm run build` and `npm start` run the built app the way Render does, against Supabase
- `npm run seed:supabase` loads the sample data into Supabase, after asking

`docs/STATUS.md` says how to run the app. `README.md` is the course's own guide, so leave it as it is.

Testing will cover:

1. Unit tests for the frontend, using Vitest
2. Unit tests for the backend, using pytest
3. End-to-end tests of the whole app in a browser, in `e2e/`, using Playwright Test (`@playwright/test`) with the installed Google Chrome. They start the app themselves, so `npm test` needs nothing else running.

The tests use a database of their own, so running them never changes your data.
