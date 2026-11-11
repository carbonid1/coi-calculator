# Plan 018: Three exports nothing references and one helper only its own test uses are gone

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29c10d9..HEAD -- app/db/crop-farming.ts app/db/modules/crop-farm-areas.ts app/db/modules/default.ts app/helpers/latest-revision-cache`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `29c10d9`, 2026-11-12

## Why this matters

Dead exports look like supported API. Readers — and coding agents — spend time
understanding them and keep them compiling through refactors. Four pieces of
`app/` have no production use: three exports that nothing references at all,
and a small cache helper that only its own test imports.

## Current state

- `app/db/crop-farming.ts:151-153` — no reference anywhere:

  ```ts
  export const cropProductResourceIds: ReadonlySet<ResourceId> = new Set(
    Object.values(crops).flatMap((crop) => crop.productId ? [crop.productId] : []),
  );
  ```

- `app/db/modules/crop-farm-areas.ts:44-50` — no reference anywhere:

  ```ts
  export const getCropFarmOwnerZones = (
    entities: readonly CurrentCropFarmEntity[],
  ) => [...new Map(entities.flatMap(entity => {
    const owner = getCropFarmOwnerZone(entity)

    return owner ? [[owner.id, owner] as const] : []
  })).values()]
  ```

  `getCropFarmOwnerZone` (singular, line 36) is still used on line 121 of the
  same file and must stay.
- `app/db/modules/default.ts:58` — no reference anywhere:

  ```ts
  export const unplacedPlannedDefaultBuildings = plannedDefaultBuildings
  ```

  `plannedDefaultBuildings` (line 50) is used by a test and must stay.
- `app/helpers/latest-revision-cache/` contains two files,
  `latest-revision-cache.ts` and `latest-revision-cache.test.ts`. The only
  import of the helper in the whole repository is from its own test.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |
| Tests | `pnpm exec vitest run app/db app/helpers` | all pass |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope**:
- `app/db/crop-farming.ts` (remove one export)
- `app/db/modules/crop-farm-areas.ts` (remove one export)
- `app/db/modules/default.ts` (remove one export)
- `app/helpers/latest-revision-cache/latest-revision-cache.ts` (delete)
- `app/helpers/latest-revision-cache/latest-revision-cache.test.ts` (delete)

**Out of scope** (do NOT touch):
- Exports that are used only by tests but describe real behaviour, such as
  `getComputingZones`, `getSyncedOfficeConfigurations`,
  `plannedDefaultBuiltBuildings` and `defaultArea`. Leave them.
- Any other export you notice with no references. Report it instead.

## Git workflow

- Branch: `advisor/018-remove-unreferenced-exports`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Remove the unused per-save preference hooks and storage keys`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm there are still no references

Run:

- `git grep -n -E "cropProductResourceIds|getCropFarmOwnerZones|unplacedPlannedDefaultBuildings" -- app tests scripts`
- `git grep -n "latest-revision-cache" -- app tests scripts`

**Verify**: the first prints exactly three lines, each a definition (one per
file named in "Current state"). The second prints only the import inside
`latest-revision-cache.test.ts`. Anything else is a STOP condition.

### Step 2: Remove them

1. Delete the `cropProductResourceIds` export from `app/db/crop-farming.ts`,
   with one of the blank lines around it.
2. Delete the `getCropFarmOwnerZones` export from
   `app/db/modules/crop-farm-areas.ts`, with one of the blank lines around it.
3. Delete the `unplacedPlannedDefaultBuildings` line from
   `app/db/modules/default.ts`.
4. `git rm -r app/helpers/latest-revision-cache`

**Verify**: `pnpm ts` and `pnpm lint` exit 0. If either reports an import or
type that became unused in one of the three edited files, remove that import
only and run again.

### Step 3: Full checks

**Verify**: `pnpm exec vitest run app/db app/helpers` passes and `pnpm build`
exits 0. Both greps from step 1 now print nothing.

## Test plan

No new tests. One test file is deleted together with the helper it tests.
Everything else must keep passing.

## Done criteria

- [ ] `git grep -n -E "cropProductResourceIds|getCropFarmOwnerZones|unplacedPlannedDefaultBuildings" -- app tests scripts` prints nothing
- [ ] `git ls-files app/helpers/latest-revision-cache` prints nothing
- [ ] `pnpm ts`, `pnpm lint`, `pnpm build` exit 0
- [ ] `pnpm exec vitest run app/db app/helpers` passes
- [ ] `git status --short` lists only the five in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds a reference outside the definitions.
- After a removal, `pnpm ts` or `pnpm lint` reports a problem in a file that
  is not in scope.
- Removing `getCropFarmOwnerZones` makes `getCropFarmOwnerZone` unused (it
  should not — line 121 uses it).

## Maintenance notes

- `app/helpers/latest-revision-cache` was written for a caching approach the
  app no longer uses. If a "newest revision wins" cache is needed again, it is
  in git history at `29c10d9`.
