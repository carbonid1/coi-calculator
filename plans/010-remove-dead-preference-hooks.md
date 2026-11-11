# Plan 010: The three unused per-save preference hooks and their storage-key helpers are gone

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6a6d24..HEAD -- app/hooks app/helpers/contracts app/helpers/resource-priorities app/helpers/world-mines/world-mine-planning.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `e6a6d24`, 2026-11-11

## Why this matters

Contract, world-mine and resource-priority choices used to be stored under
their own browser-storage keys, each with its own React hook. They now live
inside the factory preset record (`app/hooks/use-factory-preset.ts`), and
nothing imports the old hooks any more. The dead hooks still look like live
code: an earlier audit counted them as "five drifted copies" of one pattern
to consolidate, when only two are in use. Removing them shrinks that job and
stops tests from guarding storage keys nothing reads or writes.

## Current state

Dead files (no importer anywhere in `app/`, `tests/` or `scripts/`):

- `app/hooks/use-resource-priorities.ts` — exports `useResourcePriorities`.
- `app/hooks/use-contract-preferences.ts` — exports `useContractPreferences`;
  its whole body is:

  ```ts
  import { getContractPreferencesStorageKey } from '../helpers/contracts/contract-preferences'
  import { useOperatingPreferences } from './use-operating-preferences'

  export const useContractPreferences = (saveId: string | null | undefined) => (
    useOperatingPreferences(getContractPreferencesStorageKey(saveId))
  )
  ```

- `app/hooks/use-operating-preferences.ts` — exports `useOperatingPreferences`;
  imported only by `use-contract-preferences.ts`.

Storage-key helpers used only by those hooks and by two test assertions:

- `app/helpers/contracts/contract-preferences.ts:3-5`:

  ```ts
  export const getContractPreferencesStorageKey = (saveId: string | null | undefined) => (
    saveId ? `coi-contract-full-throttle-v1:${encodeURIComponent(saveId)}` : null
  )
  ```

- `app/helpers/resource-priorities/resource-priorities.ts:8-10`:

  ```ts
  export const getResourcePriorityStorageKey = (saveId: string | null | undefined) => (
    saveId ? `coi-resource-priorities-v1:${encodeURIComponent(saveId)}` : null
  )
  ```

  The comment on line 5 above the type reads
  `/** Browser overrides are scoped to a save, then stable game area IDs. */`
  and stays.
- `app/helpers/world-mines/world-mine-planning.ts:13-15` (no references at all):

  ```ts
  export const getWorldMinePreferencesStorageKey = (saveId: string | null | undefined) => (
    saveId ? `coi-world-mine-full-throttle-v1:${encodeURIComponent(saveId)}` : null
  )
  ```

Test assertions on those helpers:

- `app/helpers/contracts/resolve-synced-contracts.test.ts:4` imports
  `getContractPreferencesStorageKey`; line 75 is:

  ```ts
      expect(getContractPreferencesStorageKey('save-a')).not.toBe(getContractPreferencesStorageKey('save-b'))
  ```

- `app/helpers/resource-priorities/resource-priorities.test.ts:3` imports
  `getResourcePriorityStorageKey`; lines 6–7 are:

  ```ts
    expect(getResourcePriorityStorageKey(null)).toBeNull()
    expect(getResourcePriorityStorageKey('One / two')).not.toBe(getResourcePriorityStorageKey('One'))
  ```

Still in use — do NOT remove:

- `parseContractPreferences` and the type `ContractFullThrottlePreferences`
  (`app/helpers/contracts/contract-preferences.ts`).
- `parseResourcePriorityOverrides`, `isResourceProcessingPriority`,
  `allocateProcessingSupply` and the type `ResourcePriorityOverrides`
  (`app/helpers/resource-priorities/resource-priorities.ts`).
- Everything else in `world-mine-planning.ts`.
- `app/hooks/use-factory-preset.ts` and `app/hooks/use-keep-ready-preferences.ts`
  (the two live hooks).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |
| Focused tests | `pnpm exec vitest run app/helpers/contracts app/helpers/resource-priorities app/helpers/world-mines app/hooks` | all pass |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope**:
- `app/hooks/use-resource-priorities.ts` (delete)
- `app/hooks/use-contract-preferences.ts` (delete)
- `app/hooks/use-operating-preferences.ts` (delete)
- `app/helpers/contracts/contract-preferences.ts`
- `app/helpers/contracts/resolve-synced-contracts.test.ts`
- `app/helpers/resource-priorities/resource-priorities.ts`
- `app/helpers/resource-priorities/resource-priorities.test.ts`
- `app/helpers/world-mines/world-mine-planning.ts`

**Out of scope** (do NOT touch):
- `app/hooks/use-factory-preset.ts`, `app/hooks/use-keep-ready-preferences.ts`,
  `app/calculator.tsx` — the live preference code. Consolidating them is a
  separate job.
- Migrating data stored under the old keys. See maintenance notes.
- Any other unused export you notice. Report it instead.

## Git workflow

- Branch: `advisor/010-remove-dead-preference-hooks`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Guard the pump zone assignment save`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm nothing imports the hooks

Run:

`git grep -n -E "use-(resource-priorities|contract-preferences|operating-preferences)|useResourcePriorities|useContractPreferences|useOperatingPreferences" -- app tests scripts`

**Verify**: every match is inside one of the three hook files themselves
(`app/hooks/use-resource-priorities.ts`, `app/hooks/use-contract-preferences.ts`,
`app/hooks/use-operating-preferences.ts`). Any match elsewhere is a STOP
condition.

### Step 2: Delete the three hook files

`git rm app/hooks/use-resource-priorities.ts app/hooks/use-contract-preferences.ts app/hooks/use-operating-preferences.ts`

**Verify**: `pnpm ts` exits 0.

### Step 3: Remove the storage-key helpers and their assertions

1. `app/helpers/contracts/contract-preferences.ts`: delete the
   `getContractPreferencesStorageKey` export (lines 3–5) and one of the blank
   lines around it.
2. `app/helpers/contracts/resolve-synced-contracts.test.ts`: remove
   `getContractPreferencesStorageKey` from the import on line 4 (keep
   `parseContractPreferences`) and delete line 75.
3. `app/helpers/resource-priorities/resource-priorities.ts`: delete the
   `getResourcePriorityStorageKey` export (lines 8–10) and one adjacent blank
   line. Change the comment on line 5 to
   `/** Overrides are scoped to stable game area IDs within a save's preset. */`
4. `app/helpers/resource-priorities/resource-priorities.test.ts`: remove
   `getResourcePriorityStorageKey` from the import on line 3 and delete lines
   6–7. Rename the test title from
   `scopes persisted overrides to a save and rejects invalid settings` to
   `rejects invalid persisted overrides`.
5. `app/helpers/world-mines/world-mine-planning.ts`: delete the
   `getWorldMinePreferencesStorageKey` export (lines 13–15) and one adjacent
   blank line.

**Verify**:
- `git grep -n -E "get(ResourcePriority|ContractPreferences|WorldMinePreferences)StorageKey" -- app tests scripts` prints nothing.
- `pnpm ts` and `pnpm lint` exit 0.
- The focused test command passes.

### Step 4: Build

**Verify**: `pnpm build` exits 0.

## Test plan

No new tests. Two assertions on deleted helpers are removed; the remaining
assertions in both test files (parsing and rejecting invalid stored values)
stay and must pass.

## Done criteria

- [ ] The three hook files do not exist (`git ls-files app/hooks` lists none of them)
- [ ] `git grep -n -E "get(ResourcePriority|ContractPreferences|WorldMinePreferences)StorageKey" -- app tests scripts` prints nothing
- [ ] `git grep -n -E "useResourcePriorities|useContractPreferences|useOperatingPreferences" -- app tests scripts` prints nothing
- [ ] `pnpm ts`, `pnpm lint`, `pnpm build` exit 0
- [ ] Focused test command passes
- [ ] `git status --short` lists only the eight in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds an importer outside the three hook files.
- After a deletion, `pnpm ts` or `pnpm lint` reports a newly unused import or
  variable in a file that is NOT in scope.
- `pnpm lint` reports a newly unused import in an in-scope file: remove that
  import only, then re-run. If it reports anything else, stop.

## Maintenance notes

- Choices a player saved before presets existed, under the browser-storage
  keys `coi-resource-priorities-v1:*`, `coi-contract-full-throttle-v1:*` and
  `coi-world-mine-full-throttle-v1:*`, were already being ignored before this
  plan. Nothing migrates them. If that data matters, a one-time read of those
  keys belongs in `app/hooks/use-factory-preset.ts`.
- Two live copies of the per-save storage pattern remain:
  `app/hooks/use-factory-preset.ts` and `app/hooks/use-keep-ready-preferences.ts`,
  plus the pump-assignment code in `app/calculator.tsx`. Consolidating those
  is the remaining work.
- `app/hooks/use-factory-preset.ts` still calls `parseContractPreferences` and
  `parseResourcePriorityOverrides` with `JSON.stringify(value)` because those
  parsers take a string. That is harmless; changing the parsers to accept
  `unknown` is optional follow-up.
