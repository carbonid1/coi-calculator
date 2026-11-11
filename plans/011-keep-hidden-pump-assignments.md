# Plan 011: Saving one pump assignment no longer erases stored assignments whose area is temporarily missing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6a6d24..HEAD -- app/calculator.tsx app/helpers/machine-allocation`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. If plan 006 is also open, run 006 first (both edit `app/calculator.tsx`, different lines).
- **Category**: bug
- **Planned at**: commit `e6a6d24`, 2026-11-11

## Why this matters

The player can assign an area's Groundwater Pumps to another area's water
claim. The choice is stored in the browser per save, as a map from area id to
claim id. When the page loads the map, it drops every entry whose claim the
current factory does not offer — a claim exists only for a *named* area, so
removing an area's name (or deleting and recreating the area) in the game
hides its entries. That filtering is correct for the calculation. The bug is
in saving: the next assignment the player makes writes the *filtered* map back
to storage, permanently deleting the hidden entries. When the area gets its
name back, its assignments are gone.

The fix is to keep two things apart: what is stored (everything well-formed)
and what is active (only entries whose claim exists now). The parsing also
moves out of the component into a small tested helper.

## Current state

- `app/calculator.tsx` — root client component. Line 86:
  `const MACHINE_ZONE_ASSIGNMENTS_KEY = 'coi-machine-zone-assignments-v1'`.
  Line 58: `import { type MachineZoneAssignments } from './helpers/machine-allocation/machine-allocation'`.
  Lines 125–126:

  ```ts
    const [machineZoneAssignments, setMachineZoneAssignments] = useState<MachineZoneAssignments>({})
    const [loadedAssignmentsKey, setLoadedAssignmentsKey] = useState<string | null>(null)
  ```

  Lines 160–225 (load effect and save function):

  ```ts
    useEffect(() => {
      if (!machineZoneAssignmentsStorageKey) {
        const animationFrame = window.requestAnimationFrame(() => {
          setMachineZoneAssignments({})
          setLoadedAssignmentsKey(null)
        })

        return () => window.cancelAnimationFrame(animationFrame)
      }

      const animationFrame = window.requestAnimationFrame(() => {
        try {
          const validGroundwaterPumpClaimIds = new Set(
            groundwaterPumpClaimIds.split('|').filter(Boolean),
          )
          const stored: unknown = JSON.parse(
            window.localStorage.getItem(machineZoneAssignmentsStorageKey) ?? '{}',
          )

          if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
            setMachineZoneAssignments({})
            return
          }

          const assignments: Record<number, string> = {}

          for (const [zoneId, claimId] of Object.entries(stored)) {
            if (
              /^-?\d+$/.test(zoneId) &&
              typeof claimId === 'string' &&
              validGroundwaterPumpClaimIds.has(claimId)
            ) {
              assignments[Number(zoneId)] = claimId
            }
          }

          setMachineZoneAssignments(assignments)
        } catch {
          setMachineZoneAssignments({})
        } finally {
          setLoadedAssignmentsKey(machineZoneAssignmentsStorageKey)
        }
      })

      return () => window.cancelAnimationFrame(animationFrame)
    }, [machineZoneAssignmentsStorageKey, groundwaterPumpClaimIds])

    const assignMachineZone = (zoneId: number, claimId: string | null) => {
      const next = { ...machineZoneAssignments }

      if (claimId) {
        next[zoneId] = claimId
      } else {
        delete next[zoneId]
      }

      if (machineZoneAssignmentsStorageKey) {
        try {
          window.localStorage.setItem(machineZoneAssignmentsStorageKey, JSON.stringify(next))
        } catch {
          toast.error('Could not save pump assignment. Check browser storage and try again.')
          return
        }
      }
      setMachineZoneAssignments(next)
    }
  ```

- `app/helpers/machine-allocation/machine-allocation.ts:15`:
  `export type MachineZoneAssignments = Readonly<Record<number, string | undefined>>;`
  Files in this folder use double quotes and semicolons.
- Exemplar for a storage parser and its test:
  `app/helpers/keep-ready-preferences/keep-ready-preferences.ts:15-27`

  ```ts
  export const parseKeepReadyPreferences = (value: string | null): KeepReadyPreferences => {
    try {
      const parsed: unknown = JSON.parse(value ?? "{}");

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

      return Object.fromEntries(Object.entries(parsed)
        .filter(([, enabled]) => typeof enabled === "boolean")
        .map(([key, enabled]) => [getKeepReadyPreferenceKey(key), enabled]));
    } catch {
      return {};
    }
  };
  ```

  and `app/helpers/keep-ready-preferences/keep-ready-preferences.test.ts`
  (plain `it` / `expect` from vitest, double quotes, semicolons).
- Exemplar for "re-read storage, then merge" on save:
  `app/hooks/use-keep-ready-preferences.ts:45`

  ```ts
      const next = { ...readPreferences(storageKey), [getKeepReadyPreferenceKey(key)]: enabled };
  ```

- Product rule from the maintainer: no new UI elements. This plan changes
  stored data handling only.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Focused tests | `pnpm exec vitest run app/helpers/machine-allocation` | all pass |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope**:
- `app/helpers/machine-allocation/machine-zone-assignments.ts` (create)
- `app/helpers/machine-allocation/machine-zone-assignments.test.ts` (create)
- `app/calculator.tsx` (one import, the load effect and `assignMachineZone` only)

**Out of scope** (do NOT touch):
- `app/helpers/machine-allocation/machine-allocation.ts` and how assignments
  are used by the solver.
- The storage key name and the stored JSON shape (area id → claim id).
- The toast wording.
- Turning this into a React hook or merging it with other preference code.
- `tests/browser.smoke.mjs`.

## Git workflow

- Branch: `advisor/011-keep-hidden-pump-assignments`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Guard the pump zone assignment save`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the helper

Create `app/helpers/machine-allocation/machine-zone-assignments.ts`:

```ts
import { type MachineZoneAssignments } from "./machine-allocation";

/** Stored pump choices for one save: area id to claim id. Malformed entries are dropped. */
export const parseStoredMachineZoneAssignments = (value: string | null): Record<number, string> => {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const assignments: Record<number, string> = {};

    for (const [zoneId, claimId] of Object.entries(parsed)) {
      if (/^-?\d+$/.test(zoneId) && typeof claimId === "string") assignments[Number(zoneId)] = claimId;
    }
    return assignments;
  } catch {
    return {};
  }
};

/**
 * Only claims the current factory offers take effect. The rest stay in
 * storage, so an area that loses its name for a while keeps its choice.
 */
export const selectActiveMachineZoneAssignments = (
  stored: Readonly<Record<number, string>>,
  availableClaimIds: ReadonlySet<string>,
): MachineZoneAssignments => Object.fromEntries(
  Object.entries(stored).filter(([, claimId]) => availableClaimIds.has(claimId)),
);

/** The stored map after one choice; `null` clears the area's choice. */
export const withMachineZoneAssignment = (
  stored: Readonly<Record<number, string>>,
  zoneId: number,
  claimId: string | null,
): Record<number, string> => {
  const next = { ...stored };

  if (claimId) {
    next[zoneId] = claimId;
  } else {
    delete next[zoneId];
  }
  return next;
};
```

**Verify**: `pnpm ts` exits 0.

### Step 2: Test the helper

Create `app/helpers/machine-allocation/machine-zone-assignments.test.ts`:

```ts
import { expect, it } from "vitest";

import {
  parseStoredMachineZoneAssignments,
  selectActiveMachineZoneAssignments,
  withMachineZoneAssignment,
} from "./machine-zone-assignments";

it("keeps well-formed stored choices and drops malformed ones", () => {
  expect(parseStoredMachineZoneAssignments(JSON.stringify({
    10: "claim-a", "-1": "claim-b", area: "claim-c", 12: 7, 13: null,
  }))).toEqual({ 10: "claim-a", "-1": "claim-b" });
});

it.each([null, "{", "null", "[]", "true"])("recovers from invalid stored choices: %s", value => {
  expect(parseStoredMachineZoneAssignments(value)).toEqual({});
});

it("activates only choices whose claim the factory offers now", () => {
  expect(selectActiveMachineZoneAssignments({ 10: "claim-a", 11: "claim-gone" }, new Set(["claim-a"])))
    .toEqual({ 10: "claim-a" });
});

it("keeps a choice whose claim is missing when another area's choice is saved or cleared", () => {
  const stored = parseStoredMachineZoneAssignments(JSON.stringify({ 10: "claim-a", 11: "claim-gone" }));

  expect(withMachineZoneAssignment(stored, 12, "claim-a")).toEqual({ 10: "claim-a", 11: "claim-gone", 12: "claim-a" });
  expect(withMachineZoneAssignment(stored, 10, null)).toEqual({ 11: "claim-gone" });
  expect(stored).toEqual({ 10: "claim-a", 11: "claim-gone" });
});
```

**Verify**: `pnpm exec vitest run app/helpers/machine-allocation` → all pass,
including 8 new test cases (the `it.each` counts as 5).

### Step 3: Use the helper in `app/calculator.tsx`

1. Add an import directly after the existing line 58 import
   (`import { type MachineZoneAssignments } from './helpers/machine-allocation/machine-allocation'`):

   ```ts
   import {
     parseStoredMachineZoneAssignments,
     selectActiveMachineZoneAssignments,
     withMachineZoneAssignment,
   } from './helpers/machine-allocation/machine-zone-assignments'
   ```

   If `pnpm lint` then reports an import-order error, move the import to
   where the rule asks; do not disable the rule.

2. In the load effect, replace the whole `try { ... } catch { ... } finally { ... }`
   statement (lines 171–201) with:

   ```ts
         try {
           const validGroundwaterPumpClaimIds = new Set(
             groundwaterPumpClaimIds.split('|').filter(Boolean),
           )

           setMachineZoneAssignments(selectActiveMachineZoneAssignments(
             parseStoredMachineZoneAssignments(window.localStorage.getItem(machineZoneAssignmentsStorageKey)),
             validGroundwaterPumpClaimIds,
           ))
         } catch {
           setMachineZoneAssignments({})
         } finally {
           setLoadedAssignmentsKey(machineZoneAssignmentsStorageKey)
         }
   ```

   (The `try` stays because `localStorage.getItem` can throw when storage is
   blocked.)

3. Replace the body of `assignMachineZone` (lines 207–225) with:

   ```ts
     const assignMachineZone = (zoneId: number, claimId: string | null) => {
       if (machineZoneAssignmentsStorageKey) {
         try {
           // Merge into what is stored, not into the active subset, so choices
           // for an area that is missing right now survive this save.
           const stored = parseStoredMachineZoneAssignments(
             window.localStorage.getItem(machineZoneAssignmentsStorageKey),
           )

           window.localStorage.setItem(
             machineZoneAssignmentsStorageKey,
             JSON.stringify(withMachineZoneAssignment(stored, zoneId, claimId)),
           )
         } catch {
           toast.error('Could not save pump assignment. Check browser storage and try again.')
           return
         }
       }
       setMachineZoneAssignments(current => {
         const next = { ...current }

         if (claimId) {
           next[zoneId] = claimId
         } else {
           delete next[zoneId]
         }
         return next
       })
     }
   ```

**Verify**:
- `git grep -n "JSON.stringify(next)" -- app/calculator.tsx` prints nothing.
- `git grep -c "MachineZoneAssignment" -- app/calculator.tsx` prints a count of at least 8.
- `pnpm ts`, `pnpm lint` and `pnpm build` exit 0.
- `pnpm exec vitest run app/helpers/machine-allocation app/hooks` → all pass.

## Test plan

- New file `app/helpers/machine-allocation/machine-zone-assignments.test.ts`,
  modelled on `app/helpers/keep-ready-preferences/keep-ready-preferences.test.ts`:
  parsing keeps valid and drops malformed entries; invalid JSON yields an
  empty map; activation filters by available claims; and the regression —
  saving or clearing one area's choice keeps another area's choice whose claim
  is currently missing.
- No component test: repository policy (`AGENTS.md`) prefers pure regressions
  and broad smoke tests over isolated rendering tests.

## Done criteria

- [ ] `pnpm exec vitest run app/helpers/machine-allocation` passes with 8 new test cases
- [ ] `git grep -n "JSON.stringify(next)" -- app/calculator.tsx` prints nothing
- [ ] `git grep -n "withMachineZoneAssignment(stored, zoneId, claimId)" -- app/calculator.tsx` → one match
- [ ] `pnpm ts`, `pnpm lint`, `pnpm build` exit 0
- [ ] `git status --short` lists only the three in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Lines 160–225 of `app/calculator.tsx` do not match the excerpt.
- `pnpm ts` rejects the return type of `selectActiveMachineZoneAssignments`
  or the `setMachineZoneAssignments(current => ...)` updater. Report the exact
  error; do not add `as` casts or `any`.
- `pnpm lint` reports a React hooks rule violation in the edited code.

## Maintenance notes

- Entries for areas that are deleted for good now stay in storage forever.
  They are tiny (one id pair each) and never take effect; no cleanup is
  planned.
- If pump assignments ever move into the factory preset record
  (`app/hooks/use-factory-preset.ts`), keep the same stored-versus-active
  split: filter only for the model, never before writing.
- A reviewer should check in the running app that assigning a pump still
  updates the Planned builds view immediately and survives a reload.
