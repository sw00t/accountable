# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/spec.md`: read this first. It describes the whole product as it stands today: what it does, who it's for and how it's built.
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
- Run `npm run check` before calling a piece of work finished, and fix any failure. Fix the code rather than weakening or suppressing a rule; ask before changing one.

## Hooks

- Git pre-commit (lefthook, `lefthook.yml`, installed by `npm install`): formats the staged files, then runs ESLint, tsc, ruff check, ty and gitleaks on the staged changes. It skips the tests.
- Claude Code (`.claude/settings.json`, scripts in `.claude/hooks/`): `npm run check:quick` runs when Claude finishes a turn and sends any failure back once; edits to `.env` are blocked.
- CI (`.github/workflows/ci.yml`): on every push, gitleaks scans the repo first, then `npm run check` runs. A failed run uploads the Playwright report.

At Deploy, after the review fixes and before the merge, follow `docs/IMPROVE.md` to improve the harness.

## Keeping the docs in step

- When the build departs from the current change's `plan.md` (a file, a test or a rule), update `plan.md` in the same phase. A note in `docs/STATUS.md` alone isn't enough.
- When code would behave differently from `docs/spec.md`, ask the person before building it, then update the spec.

Update `docs/STATUS.md` when you finish a piece of work
