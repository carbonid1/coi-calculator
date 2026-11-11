# Plan 006: The Keep ready toast shows "Module · Recipe" without a stray character

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6a6d24..HEAD -- app/calculator.tsx`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e6a6d24`, 2026-11-11

## Why this matters

Every time the player turns Keep ready on or off, the confirmation toast shows
its detail line as `Recipe В· Module`: a Cyrillic capital letter "В" (U+0412)
sits before the middle dot. It is a text-encoding accident, not intended copy.
The same pair of names is shown elsewhere in the app as `Module · Recipe`, so
the toast is also in the opposite order.

## Current state

- `app/calculator.tsx` — the root client component. Lines 105–107:

  ```ts
      toast(enabled ? 'Keep ready enabled' : 'Pause suggestions restored', {
        id: toastId,
        description: `${diagnostic.recipeName} В· ${diagnostic.moduleName}`,
  ```

  The character between `recipeName} ` and `·` is U+0412. It is the only
  Cyrillic character in `app/`.
- `app/components/BuildingAttentionView.tsx:52-55` — the existing convention
  for the same two names:

  ```ts
  const getDiagnosticDetail = (diagnostic: BuildingDiagnostic) =>
    diagnostic.recipeName === diagnostic.buildingName
      ? diagnostic.moduleName
      : `${diagnostic.moduleName} · ${diagnostic.recipeName}`
  ```

- Product rule from the maintainer: no new UI elements. Changing the text of
  an existing element is allowed.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `app/calculator.tsx` (line 107 only)

**Out of scope**:
- `app/components/BuildingAttentionView.tsx` — do not change it or export from it.
- The toast titles, the Undo action, and every other line of `app/calculator.tsx`.
- Adding a lint rule or test for non-ASCII characters.

## Git workflow

- Branch: `advisor/006-fix-keep-ready-toast-separator`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Guard the pump zone assignment save`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the description line

In `app/calculator.tsx`, replace line 107 with:

```ts
      description: `${diagnostic.moduleName} · ${diagnostic.recipeName}`,
```

The separator is a space, the middle dot U+00B7, and a space. Save the file as
UTF-8 without a byte-order mark. Do not retype or re-encode any other line.

**Verify**:
- `git diff --stat app/calculator.tsx` shows 1 insertion and 1 deletion.
- `git grep -n -I -P "[\x{0400}-\x{04FF}]" -- app` prints nothing.
- `git grep -n "diagnostic.moduleName} · \${diagnostic.recipeName}" -- app/calculator.tsx` prints one match.
- `pnpm ts` and `pnpm lint` exit 0.

## Test plan

No new test: this is a one-line text change and the repository's policy
(`AGENTS.md`) prefers broad smoke tests over isolated tests of rendering or
formatting. The grep checks above are the regression guard for this change.

## Done criteria

- [ ] `git grep -n -I -P "[\x{0400}-\x{04FF}]" -- app` prints nothing
- [ ] `git diff --stat e6a6d24 -- app/calculator.tsx` shows exactly 1 insertion and 1 deletion from this plan
- [ ] `pnpm ts` and `pnpm lint` exit 0
- [ ] `git status --short` lists only `app/calculator.tsx` (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Line 107 does not match the excerpt above.
- After the edit, `git diff` shows changes on lines you did not edit (your
  editor re-encoded the file). Revert and report.
- `git grep -P` is not supported by your git build. Report it; do not skip the
  check.

## Maintenance notes

- The middle dot `·` is used as a separator throughout the UI. If more
  encoding accidents appear, they will show as `В·` or `Â·`; a repository-wide
  search for those two sequences finds them.
