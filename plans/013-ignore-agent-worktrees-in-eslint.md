# Plan 013: `pnpm lint` ignores agent worktrees and scratch folders

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a59301d..HEAD -- eslint.config.mjs`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `a59301d`, 2026-11-12

## Why this matters

Coding agents work in git worktrees created under `.claude/worktrees/` inside
the repository. ESLint's flat config does not read `.gitignore`, so
`pnpm lint` in the main checkout also lints every file in every worktree.
Config files there (`vitest.config.ts`, `next.config.ts`, …) are not at the
repository root, so the shared config's root-only exemptions do not apply and
each one fails with `import/no-default-export`. With eight worktrees present,
`pnpm lint` on `main` reported 13 errors, none in the project's own code.
Vitest and TypeScript already skip these folders; ESLint is the last tool
that does not.

## Current state

- `eslint.config.mjs` (whole file):

  ```js
  import sharedConfig from '@carbonid1/eslint-config/nextjs'

  const config = [...sharedConfig, { ignores: ['.next/**', 'next-env.d.ts'] }]

  export default config
  ```

- `tsconfig.json` already excludes `".claude", "out", "Builds"`;
  `vitest.config.ts` already excludes `'.claude/**', 'out/**', 'Builds/**'`.
- `.gitignore` ignores `out`, `Builds/` and `.claude/worktrees/`.
- `.claude/` otherwise holds only `launch.json` and links to skill folders
  (Markdown); none of it is JavaScript or TypeScript.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |
| Typecheck | `pnpm ts` | exit 0 |

## Scope

**In scope**:
- `eslint.config.mjs`

**Out of scope** (do NOT touch):
- `@carbonid1/eslint-config` or any lint rule.
- `tsconfig.json`, `vitest.config.ts`, `.gitignore` — already correct.
- Any existing folder under `.claude/worktrees/` other than the probe folder
  this plan creates and deletes.

## Git workflow

- Branch: `advisor/013-ignore-agent-worktrees-in-eslint`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Stabilise test discovery and smoke test timeouts`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reproduce the failure with a probe file

Inside the repository you are working in, create the file
`.claude/worktrees/lint-probe/vitest.config.ts` containing exactly:

```ts
export default {}
```

**Verify**: `pnpm lint` exits with a non-zero code and reports
`import/no-default-export` for `.claude/worktrees/lint-probe/vitest.config.ts`.
(If it exits 0, see STOP conditions.)

### Step 2: Ignore the folders

Change the `config` line in `eslint.config.mjs` to:

```js
const config = [...sharedConfig, { ignores: ['.next/**', '.claude/**', 'out/**', 'Builds/**', 'next-env.d.ts'] }]
```

Keep the object with only the `ignores` key; in ESLint's flat config that is
what makes the patterns global.

**Verify**: with the probe file still present, `pnpm lint` exits 0.

### Step 3: Remove the probe

Delete the folder `.claude/worktrees/lint-probe` (and nothing else under
`.claude/worktrees/`).

**Verify**: `git status --short` lists only `eslint.config.mjs`. `pnpm lint`
and `pnpm ts` exit 0.

## Test plan

No automated test: the behaviour is a tool configuration. Steps 1 and 2 are
the before/after proof, using a probe file that step 3 removes.

## Done criteria

- [ ] `git grep -n "'.claude/\*\*', 'out/\*\*', 'Builds/\*\*'" -- eslint.config.mjs` → one match
- [ ] `pnpm lint` exits 0
- [ ] `pnpm ts` exits 0
- [ ] `.claude/worktrees/lint-probe` does not exist
- [ ] `git status --short` lists only `eslint.config.mjs` (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's `pnpm lint` exits 0 with the probe present (the failure does not
  reproduce; the fix may be unnecessary or the probe is in the wrong place).
- After step 2, `pnpm lint` still reports the probe file.
- `pnpm lint` reports an error in the project's own code (outside `.claude/`).

## Maintenance notes

- A new top-level scratch or output folder needs adding in three places:
  `eslint.config.mjs`, `tsconfig.json` and `vitest.config.ts`.
- If JavaScript or TypeScript is ever kept under `.claude/` on purpose, narrow
  the pattern to `.claude/worktrees/**`.
