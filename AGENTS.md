# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/spec.md`: read this first. It's a short summary of the whole product as it stands today (what it does, who it's for, what's not in it yet and the roadmap) with an index of the area files.
- `docs/specs/<area>.md`: the detail, one file per product area, such as `docs/specs/deals.md`. Each holds that area's concerns, requirements and design. After `docs/spec.md`, read only the area files the current change touches; the index in `docs/spec.md` says which file holds each requirement, concern and design section.
- `docs/changes/<branch name>/`: one folder per change, named after the branch the change is made on. Each holds the change's `intent.md` (what it's for) and `plan.md` (how it's built). Read only the current change's folder, the one matching `git branch --show-current`; the others are history, such as `docs/changes/mvp/` for the first version.
- `docs/STANDARDS.md`: how code is written in this repo. Follow it in every change.
- `docs/TECH_STACK.md`: the stack
- `docs/STATUS.md`: what's done so far

## Checks and testing

- `npm run check` runs every check and fails if any fails: Prettier and ESLint (TypeScript, React Hooks and accessibility rules) for the frontend, ruff format and ruff check for the backend, a cyclomatic complexity limit of 15 per function, tsc and ty, gitleaks over the working tree and git history, and `npm test`.
- `npm run check:quick` runs the same checks without the end-to-end tests.
- `npm run format` fixes the formatting (Prettier and ruff format).
- `npm test` runs every test: backend (pytest), frontend unit (Vitest) and end-to-end (Playwright with the installed Chrome). The unit suites fail below 80% coverage.
- One suite at a time: `npm run test:backend`, `npm run test:frontend`, `npm run test:e2e`.
- In end-to-end tests, after a step that changes the screen or saves, wait for something that shows the change before the next step.
- Run `npm run check` before calling a piece of work finished, and fix any failure. Fix the code rather than weakening or suppressing a rule; ask before changing one.

## Hooks

- Git pre-commit (lefthook, `lefthook.yml`, installed by `npm install`): formats the staged files, then runs ESLint, tsc, ruff check, ty and gitleaks on the staged changes. It skips the tests.
- Claude Code (`.claude/settings.json`, scripts in `.claude/hooks/`): `npm run check:quick` runs when Claude finishes a turn and sends any failure back once; edits to `.env` are blocked.
- CI (`.github/workflows/ci.yml`): on every push, gitleaks scans the repo first, then `npm run check:quick` runs. CI skips the end-to-end tests, so run `npm run check` locally before calling work finished.

At Deploy, after the review fixes and before the merge, follow `docs/IMPROVE.md` to improve the harness.

## Subagents

Project subagents live in `.claude/agents/`. Both run on Sonnet and change nothing.

- `reviewer`: reviews a branch, commit or range against `docs/REVIEW.md` and reports findings as Important or nit. A PreToolUse hook in its file (`.claude/hooks/reviewer-read-only.mjs`) lets its Bash run only commands that read, such as `git diff`, `git log`, `git show`, `git grep` and `grep`.
- `ui-check`: opens the running app (start it with `npm run dev` first) through the Playwright MCP server, screenshots each page in light and dark mode, and reports anything broken, off-brand or unlike the spec (`docs/spec.md` and its area files). Its screenshots go in `.playwright-mcp/`, which git ignores; `.mcp.json` sets that folder as the server's output folder, which holds the files the server names itself (snapshots, console logs). A screenshot given a file name is saved relative to the repo root, so the agent passes the folder in the name.

## Keeping the docs in step

- When the build departs from the current change's `plan.md` (a file, a test or a rule), update `plan.md` in the same phase. A note in `docs/STATUS.md` alone isn't enough.
- When code would behave differently from the spec (`docs/spec.md` or an area file in `docs/specs/`), ask the person before building it, then update the spec.
- Keep every spec file a change affects up to date in the same change: the area files whose concerns, requirements, data model, API or screens it changes, and `docs/spec.md` when the summary or the index changes (a new area file, a moved section, or new requirement or concern IDs). A change that needs a new area gets a new file in `docs/specs/` and a row in the index.

Update `docs/STATUS.md` when you finish a piece of work
