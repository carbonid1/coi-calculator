# Plan 005: Tests are discovered from fixed folders, heavy smoke tests have explicit timeouts, and the smoke script runs every smoke file

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6a6d24..HEAD -- package.json tsconfig.json .gitignore tests/factory.smoke.test.ts vitest.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `e6a6d24`, 2026-11-11

## Why this matters

The repository's CI workflow (`.github/workflows/ci.yml`) has never completed a
run. Three of the heaviest tests in `tests/factory.smoke.test.ts` have no
timeout argument, so they run under vitest's 5-second default while their
neighbours allow 30–60 seconds; they pass on the maintainer's machine and are
likely to time out on a slower CI runner. There is also no vitest config, so
vitest collects every `*.test.ts` under the repository except `node_modules`
and `.git` — including copies inside agent worktrees under `.claude/worktrees/`
and scratch files under `out/`. `tsc` has the same problem: `tsconfig.json`
includes `**/*.ts` and does not exclude those folders. Finally the
`test:smoke` script runs only one of the two smoke test files.

## Current state

- `package.json` scripts (lines 12–13):

  ```json
  "test": "vitest run && node --test tests/browser.smoke.mjs",
  "test:smoke": "vitest run tests/factory.smoke.test.ts && node --test tests/browser.smoke.mjs",
  ```

- No `vitest.config.*` or `vite.config.*` exists anywhere in the repository.
- All tracked test files live in three places: `app/**` (87 files),
  `scripts/**` (1 file), `tests/**` (2 files: `factory.smoke.test.ts`,
  `processing-chains.smoke.test.ts`). None of them imports through the `@/`
  path alias.
- `tsconfig.json` (whole file):

  ```json
  {
    "extends": "@carbonid1/tsconfig/nextjs.json",
    "compilerOptions": {
      "paths": {
        "@/*": ["./app/*"]
      }
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules", ".next", "**/*.test.ts", "**/*.test.tsx"]
  }
  ```

- `.gitignore` already ignores `out` and `Builds/`. It does not list
  `.claude/worktrees/`.
- `tests/factory.smoke.test.ts` — every `it(...)` ends with a timeout such as
  `}, 60_000)` except three, which end with a bare `})`:
  - the test starting at line 476, titled
    `projects native maintenance for planned builds and unpauses without duplicating shared physical machines`, closes at line 530;
  - the test starting at line 532, titled
    `replays connected tank and pipe reserves, refill and shared-source exclusions through the existing shortfall forecast`, closes at line 576;
  - the test starting at line 578, titled
    `replays live crop phase and soil reserves into the existing water forecast while retaining steady production plans`, closes at line 661.

  A neighbouring test for comparison (line 432): `}, 60_000)`.
- Conventions: TypeScript config files at the repository root use ES module
  syntax and single quotes without semicolons (see `next.config.ts`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |
| List test files | `pnpm exec vitest list --filesOnly` | prints one path per test file |
| All unit tests | `pnpm exec vitest run` | all pass (about 3 minutes) |
| Smoke files only | `pnpm exec vitest run tests/` | 2 files pass |

## Scope

**In scope** (the only files you should modify):
- `vitest.config.ts` (create)
- `tests/factory.smoke.test.ts` (three timeout arguments only)
- `package.json` (the `test:smoke` script only)
- `tsconfig.json` (the `exclude` array only)
- `.gitignore` (one added line)

**Out of scope** (do NOT touch):
- `.github/workflows/ci.yml` — leave the CI command as it is.
- Any test body, assertion, fixture or source file under `app/`.
- Splitting `tests/factory.smoke.test.ts` into several files.
- `tests/browser.smoke.mjs`.
- Adding a global `testTimeout`; the repository sets timeouts per test.

## Git workflow

- Branch: `advisor/005-stabilise-test-discovery-and-timeouts`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Add CI checks and a check-only lint script`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the current test file list

Run `pnpm exec vitest list --filesOnly` and save the output (outside the
repository, or just keep it in your notes). Count the lines that end in
`.test.ts` or `.test.tsx` and that do NOT contain `.claude/` or `out/`. Call
this number N. With a clean checkout N is 90.

If `vitest list --filesOnly` is not supported by the installed vitest, run
`pnpm exec vitest run` instead and take N from the `Test Files` summary line.

**Verify**: you have a number N ≥ 90.

### Step 2: Create `vitest.config.ts`

Create the file at the repository root with exactly this content:

```ts
import { defineConfig } from 'vitest/config'

// Collect tests from the three tracked folders only, so agent worktrees and
// scratch output never run as a second copy of the suite.
export default defineConfig({
  test: {
    include: ['app/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '.next/**', '.claude/**', 'out/**', 'Builds/**'],
  },
})
```

**Verify**: `pnpm exec vitest list --filesOnly` lists the same N test files as
step 1 (none missing), and no path containing `.claude/` or `out/`.

### Step 3: Give the three unbounded smoke tests an explicit timeout

In `tests/factory.smoke.test.ts`, change the closing line of each of the three
tests named in "Current state" from `})` to `}, 60_000)`. Find each one by its
title, then go to the first line after it that is exactly `})` at column 0.
Change nothing else in the file.

**Verify**: `git diff --stat tests/factory.smoke.test.ts` shows 3 insertions
and 3 deletions. `git grep -c "^})$" -- tests/factory.smoke.test.ts` prints
nothing (no bare closers remain).

### Step 4: Make `test:smoke` run both smoke files

In `package.json`, change the `test:smoke` script to:

```json
"test:smoke": "vitest run tests/ && node --test tests/browser.smoke.mjs",
```

**Verify**: `pnpm exec vitest run tests/` reports `Test Files  2 passed (2)`.
(One test, `burns available Waste in Next and recovers residual local steam
before importing Water and Brine`, has a 40-second limit and has been observed
at 42–44 seconds on slow machines. If only that test fails, and only by
timeout, note it in your report and continue; it is a known issue outside this
plan.)

### Step 5: Keep typecheck off scratch folders

In `tsconfig.json`, change the `exclude` array to:

```json
"exclude": ["node_modules", ".next", ".claude", "out", "Builds", "**/*.test.ts", "**/*.test.tsx"]
```

In `.gitignore`, add the line `.claude/worktrees/` directly after the line
`Builds/`.

**Verify**: `pnpm ts` exits 0 and `pnpm lint` exits 0.

### Step 6: Full run

**Verify**: `pnpm exec vitest run` passes with the same number of test files
as N from step 1 (the known 40-second timeout from step 4 is the only
acceptable failure).

## Test plan

No new tests. The verification is that the set of collected test files is
unchanged (steps 1, 2 and 6) and that both smoke files run from one command
(step 4).

## Done criteria

- [ ] `vitest.config.ts` exists with the content from step 2
- [ ] `git grep -c "^})$" -- tests/factory.smoke.test.ts` prints nothing
- [ ] `git grep -n "vitest run tests/ &&" -- package.json` → one match
- [ ] `git grep -n '".claude", "out", "Builds"' -- tsconfig.json` → one match
- [ ] `git grep -n "^.claude/worktrees/$" -- .gitignore` → one match
- [ ] `pnpm ts` and `pnpm lint` exit 0
- [ ] `pnpm exec vitest run` collects N files, same as before the change
- [ ] `git status --short` lists only the five in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- After step 2, any test file from step 1 is missing from the list. Report the
  missing paths; do not widen the `include` globs by guessing.
- `pnpm ts` reports errors after step 5 that were not present before it.
- `pnpm lint` fails on `vitest.config.ts`. Report the rule name.
- Any test other than the known 40-second one fails in step 6.

## Maintenance notes

- A new top-level folder with tests must be added to `include` in
  `vitest.config.ts`; otherwise its tests silently never run.
- Deferred: splitting `tests/factory.smoke.test.ts` so vitest can run its
  scenarios in parallel, and making `app/test-fixtures/recorded-game-data.ts`
  parse the recorded factory lazily. Both would shorten the suite; neither is
  needed for correctness.
- Deferred: the first GitHub Actions run of `.github/workflows/ci.yml` has
  still not completed. After this plan lands, check that run before trusting
  CI.
