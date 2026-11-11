# Plan 015: Every text file uses LF line endings, enforced by `.gitattributes`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: run `git ls-files --eol` and list the lines that
> do not start with `i/lf`. If that list differs from the one in "Current
> state" (four source files, four binary files, three empty files), treat it
> as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (whitespace only), but it rewrites four files completely — see Maintenance notes about open branches
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `29c10d9`, 2026-11-12

## Why this matters

Four source files do not use plain LF line endings, and nothing in the
repository says which line ending to use. Two of them mix CRLF and LF inside
one file. Any editor or tool that rewrites such a file normalises it and turns
a one-line change into a diff of several hundred lines — this already happened
once with `app/helpers/calculate/calculate.ts`, the largest and most-edited
file in the solver. Normalising once, and recording the rule in
`.gitattributes`, removes the trap. The same commit also closes a small gap in
`.gitignore`, which covers only two of the env file names Next.js loads.

## Current state

- There is no `.gitattributes`. `git config core.autocrlf` is `false`.
- `git ls-files --eol` reports 457 files as `i/lf`. The others:

  | File | Index state |
  |---|---|
  | `app/helpers/calculate/calculate.ts` | `i/mixed` (about 2,100 CRLF lines, 900 LF) |
  | `app/components/MinesView.tsx` | `i/mixed` |
  | `game-mod/CoiCalculatorExporter/FactoryDefinitionSnapshot.cs` | `i/mixed` |
  | `app/components/ResourcePicker.tsx` | `i/crlf` |

  plus 4 binary files (`i/-text`) and 3 empty files (`i/`), which must not
  change.
- `.gitignore` lines 8–9:

  ```
  .env
  .env.local
  ```

- The build scripts under `scripts/*.ps1` are already LF and run fine.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Line-ending report | `git ls-files --eol` | one line per file |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |
| Tests | `pnpm exec vitest run` | all pass (about 2 minutes) |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope**:
- `.gitattributes` (create)
- `.gitignore` (lines 8–9)
- The four files in the table above — line endings only

**Out of scope** (do NOT touch):
- Any character other than line endings in those four files.
- Formatting with Prettier or any other formatter.
- Any other file.

## Git workflow

- Branch: `advisor/015-normalise-line-endings`
- One commit. Message style: imperative sentence case, no prefix, e.g.
  `Stabilise test discovery and smoke test timeouts`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the rule

Create `.gitattributes` at the repository root with exactly:

```
* text=auto eol=lf
```

In `.gitignore`, replace the two lines `.env` and `.env.local` with the single
line `.env*`.

**Verify**: `git status --short` lists `.gitattributes` (untracked) and
`.gitignore` (modified) only.

### Step 2: Renormalise the index

Run `git add .gitattributes .gitignore`, then `git add --renormalize .`

**Verify**:
- `git diff --cached --stat` lists exactly six files: `.gitattributes`,
  `.gitignore` and the four files from "Current state".
- `git diff --cached --stat --ignore-cr-at-eol` lists only `.gitattributes`
  and `.gitignore` (the four source files differ in line endings and nothing
  else).

### Step 3: Refresh the working copies

The index now holds LF, but the four working files still have their old
endings. For each of the four files, delete the working file and restore it
from the index, for example:

`git checkout-index --force -- app/helpers/calculate/calculate.ts app/components/MinesView.tsx app/components/ResourcePicker.tsx game-mod/CoiCalculatorExporter/FactoryDefinitionSnapshot.cs`

**Verify**:
- `git ls-files --eol` shows `i/lf    w/lf` for all four files.
- The lines of `git ls-files --eol` that do not start with `i/lf` are only the
  4 `i/-text` and 3 `i/` entries (7 lines).
- `git status --short` shows the six staged files and nothing unstaged.

### Step 4: Check nothing but whitespace changed

**Verify**: `pnpm ts`, `pnpm lint`, `pnpm exec vitest run` and `pnpm build`
all succeed. (One recorded-factory test,
`burns available Waste in Next and recovers residual local steam before importing Water and Brine`,
runs close to its 40-second limit; a timeout on that test alone is not caused
by this plan — re-run it once.)

Then commit.

## Test plan

No new tests. The proof that only line endings changed is the
`--ignore-cr-at-eol` diff in step 2; the proof that behaviour is unchanged is
the full suite and build in step 4.

## Done criteria

- [ ] `.gitattributes` contains exactly `* text=auto eol=lf`
- [ ] `git ls-files --eol` has no `i/crlf` or `i/mixed` line
- [ ] `git grep -n "^\.env\*$" -- .gitignore` → one match
- [ ] `git show --stat --ignore-cr-at-eol HEAD` lists only `.gitattributes` and `.gitignore`
- [ ] `pnpm ts`, `pnpm lint`, `pnpm exec vitest run`, `pnpm build` succeed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 2 stages any file other than the six named. In particular, if a binary
  file (`.png`, `.ico`, `.gz`) appears, the `text=auto` detection is wrong for
  it; report the file name and do not commit.
- `git diff --cached --ignore-cr-at-eol` shows a content change in any of the
  four source files.
- Any test that passed before fails after step 3 (other than the known
  40-second timeout).

## Maintenance notes

- A branch or worktree that has uncommitted or unmerged edits to one of the
  four files will conflict when it next merges `main`. Merge with
  `git merge -X renormalize main` to let git ignore the line-ending difference.
- `.gitattributes` now forces LF in the working tree on Windows too. Editors
  that insist on CRLF need to be configured per repository.
- Windows-only files added later that genuinely need CRLF (for example a
  `.bat` file) must get their own line in `.gitattributes`.
