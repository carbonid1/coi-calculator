# Plan 001: Every push runs typecheck, lint, tests and build in CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7c0a656..HEAD -- package.json README.md tsconfig.json .github`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `7c0a656`, 2026-11-11

## Why this matters

The repo has no CI (`.github/` does not exist) and no git hooks. The only lint
script rewrites files (`eslint . --fix`), so there is no command that merely
reports problems. Commits are large and touch the solver, the game data and the
mod together; today a regression in the recorded-factory tests is caught only
if the author remembers to run them. After this plan, every push and pull
request runs the four checks, and `pnpm lint` is safe to use as a gate.

## Current state

- `package.json` — scripts. Relevant lines today:

  ```json
  "packageManager": "pnpm@11.20.0",
  "engines": { "node": "24.x" },
  "scripts": {
    "build": "next build",
    "test": "vitest run && node --test tests/browser.smoke.mjs",
    "lint": "eslint . --fix",
    "ts": "tsc --noEmit"
  }
  ```

- `mise.toml` — pins `node = "24"` and `pnpm = "11.20.0"`.
- `README.md` — last paragraph but one reads exactly:
  `Checks: \`pnpm ts\`, \`pnpm exec vitest run\`, \`pnpm build\`. \`pnpm lint\` also fixes lint issues.`
- `tsconfig.json` excludes `**/*.test.ts` and `**/*.test.tsx`, so `pnpm ts`
  does not typecheck tests. Including them today yields 393 type errors
  (mostly "possibly undefined" in test code). Fixing those is **deferred** —
  do not attempt it in this plan.
- Baseline measured at `7c0a656` on Linux, Node 22: `pnpm ts` exit 0;
  `pnpm exec eslint .` exit 0; `pnpm build` exit 0; `pnpm exec vitest run`
  → 90 files, 929 tests, ~3 minutes, 928 pass. The one failure was a timeout,
  not an assertion: `tests/factory.smoke.test.ts:127` ("burns available Waste
  in Next and recovers residual local steam before importing Water and Brine")
  took 44 s against its 40 s limit.
- `tests/browser.smoke.mjs` needs a Chromium installed by the `agent-browser`
  dev dependency and runs its own `next build`. It is **out of scope** for CI
  in this plan.
- `pnpm-workspace.yaml` has an `allowBuilds` map; `pnpm install
  --frozen-lockfile` works as-is and runs the allowed postinstall scripts.
- Commit message style (from `git log`): one imperative sentence-case line, no
  prefix, e.g. `Add on-demand game sync and reset the polling timer`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Typecheck | `pnpm ts` | exit 0, no errors |
| Lint (check) | `pnpm exec eslint .` | exit 0, no output |
| Unit + smoke tests | `pnpm exec vitest run` | all pass |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `package.json` (the `scripts.lint` entry and one new script only)
- `README.md` (the "Checks:" line only)
- `.github/workflows/ci.yml` (create)

**Out of scope** (do NOT touch):
- `tsconfig.json` and any `*.test.ts` — typechecking tests is a deferred follow-up.
- `tests/browser.smoke.mjs` and the `test` / `test:smoke` scripts.
- Test timeouts in `tests/factory.smoke.test.ts`.
- `pnpm-lock.yaml` — no dependency may be added or changed.
- Anything under `game-mod/` or `scripts/`.

## Git workflow

- Branch: `advisor/001-add-ci-check-gate`
- One commit is enough. Message style: imperative sentence case, e.g.
  `Add CI checks and a check-only lint script`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make `pnpm lint` check-only and add `lint:fix`

In `package.json` `scripts`, change `"lint": "eslint . --fix"` to
`"lint": "eslint ."` and add `"lint:fix": "eslint . --fix"` directly after it.
Change nothing else in the file.

**Verify**: `pnpm lint` → exit 0 and `git status --short` shows only
`package.json` modified.

### Step 2: Update the README checks line

Replace the "Checks:" line in `README.md` with:

```
Checks: `pnpm ts`, `pnpm lint`, `pnpm exec vitest run`, `pnpm build`. `pnpm lint:fix` fixes lint issues.
```

**Verify**: `grep -n "lint:fix" README.md` → one match.

### Step 3: Add the workflow

Create `.github/workflows/ci.yml` with exactly this content:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  checks:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm ts
      - run: pnpm lint
      - run: pnpm exec vitest run
      - run: pnpm build
        env:
          NEXT_TELEMETRY_DISABLED: '1'
```

`pnpm/action-setup@v4` reads the pnpm version from `packageManager` in
`package.json`; do not pass a `version:` input.

**Verify**: `node -e "const s=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); if(/\t/.test(s)) process.exit(1)"` → exit 0 (no tabs), and
`grep -c "run: pnpm" .github/workflows/ci.yml` → `5`.

### Step 4: Run the gate locally

Run, in order: `pnpm ts`, `pnpm lint`, `pnpm exec vitest run`, `pnpm build`.

**Verify**: each exits 0. If the only vitest failure is the timeout named in
"Current state", note it in your report and continue — see STOP conditions for
any other failure.

## Test plan

No new tests. The workflow itself is the deliverable; its first run on GitHub
is the test. If you were told to push, check the run result and report it.

## Done criteria

- [ ] `pnpm lint` exits 0 and modifies no files (`git status --short` unchanged after running it)
- [ ] `grep -n '"lint:fix": "eslint . --fix"' package.json` returns one match
- [ ] `.github/workflows/ci.yml` exists with the content above
- [ ] `git status --short` lists only `package.json`, `README.md`, `.github/workflows/ci.yml` (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `pnpm exec eslint .` reports errors before you change anything (lint has
  drifted; fixing source files is out of scope).
- Any vitest failure other than the single timeout described above.
- The CI run on GitHub fails in `pnpm install` (private registry or build
  script problem) — report the log excerpt; do not edit `pnpm-workspace.yaml`.
- The CI run fails only on test timeouts — report which tests and their
  durations; do not raise timeouts yourself.

## Maintenance notes

- Deferred: typechecking the test files (393 errors at `7c0a656`). A
  `tsconfig.test.json` that extends `tsconfig.json` and drops the test
  excludes reproduces the list.
- Deferred: running `tests/browser.smoke.mjs` in CI (needs the agent-browser
  Chromium on the runner) and the C# mod tests (need Windows and the game).
- The full vitest run takes about three minutes; one smoke test sits close to
  its 40 s limit on slower machines. If CI flakes there, decide between a
  higher limit and a faster test rather than retrying.
