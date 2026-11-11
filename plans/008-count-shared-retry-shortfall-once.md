# Plan 008: Dispatch counts a shortfall shared by several refused routes once, not once per route

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6a6d24..HEAD -- app/helpers/factory-total/factory-total.ts app/helpers/factory-total/latent-route-demand.ts app/helpers/factory-total/latent-route-demand.test.ts app/helpers/calculate/calculate.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (only changes one input to dispatch, and only when several refused routes share one shortfall)
- **Depends on**: plans/005-stabilise-test-discovery-and-timeouts.md (so the smoke tests run reliably). Run after plan 007 if both are open, because both touch `app/helpers/calculate/calculate.ts`.
- **Category**: bug
- **Planned at**: commit `e6a6d24`, 2026-11-11

## Why this matters

The solver can refuse a "surplus route" (a recipe that would consume a surplus)
because running it would leave some other resource short. Each refused route
records which resource blocked it and by how much (`deficitIncrease`). Later,
the dispatch loop treats those amounts as hidden demand ("latent demand") and
raises a prioritized producer of the blocking resource so the route can be
accepted next pass.

There is one case where several routes carry the *same* shortfall: after a
failed retry, the solver stamps one factory-wide shortfall object onto every
route that took part in the retry. Dispatch then sums it once per route. With
two such routes and a real shortfall of 5 per 60 s, dispatch sees 10 and runs
the producer above need.

## Current state

- `app/helpers/calculate/calculate.ts:86-98` — the route type:

  ```ts
  export interface BlockedSurplusRoute {
    recipe: Recipe;
    moduleId: string;
    activeBuildings: number;
    // ... ratios ...
    blockedBy: { resourceId: ResourceId; deficitIncrease: number } | null;
    /** All supporting shortages, including those smaller than the displayed reason. */
    blockingResources?: { resourceId: ResourceId; deficitIncrease: number }[];
  }
  ```

- `app/helpers/calculate/calculate.ts:2902-2913` — where one shortfall object
  is shared by every retried route:

  ```ts
      const retryShortfall = shortfall2.leftShorter;

      if (retryShortfall) {
        restoreAllocationState(firstRun);
        finalization.finalized = firstFinalized;
        // The routes that drew on the allowance are what made the factory
        // shorter, so that trade-off is the reason they stay refused, not the
        // input the first pass named.
        blockedRoutes.splice(0, blockedRoutes.length, ...firstRunRoutes.map((route) => (
          retryableRoutes.includes(route) ? { ...route, blockedBy: retryShortfall, blockingResources: [retryShortfall] } : route
        )));
      }
  ```

  `retryShortfall` is one object; every retried route's `blockedBy` and
  `blockingResources[0]` point at that same object. Routes refused in the
  ordinary way get their own freshly built objects (from
  `findBlockingResources`), one set per route.

  The solver returns the `blockedRoutes` array itself (line 3003,
  `result: { ..., blockedRoutes }`), so object identity survives into the
  caller.

- `app/helpers/factory-total/factory-total.ts:372-382` — where dispatch sums
  them, inside the function `calculateWithDispatch`:

  ```ts
            // A surplus route the solver refused for this output is demand the
            // flows do not show yet. Dispatching for it lets the next pass
            // accept the route instead of settling on the refusal.
            const latentDemand = currentCalculation.blockedRoutes.reduce((total, route) => (
              total + ((route.blockingResources ?? (route.blockedBy ? [route.blockedBy] : []))
                .find(shortage => shortage.resourceId === output.resourceId)?.deficitIncrease ?? 0)
            ), 0);

            return [
              Math.max(0, flow.consumed + latentDemand - (flow.produced - currentProduced)) / capacity,
            ];
  ```

- Conventions: helpers live in `app/helpers/<name>/<name>.ts` with the test
  beside them as `<name>.test.ts`. `factory-total.ts` uses double quotes and
  semicolons; match that in files under `app/helpers/factory-total/`. Rates
  are "per 60 s", which is one in-game month.
- Test style exemplar, `app/helpers/calculate/calculate-performance.test.ts:1-5`:

  ```ts
  import { expect, it, vi } from 'vitest'

  import { type Recipe } from '../../db/recipes'
  import * as quantities from '../modifiers/recipe-output'
  import { calculateNet, type ProductionLine } from './calculate'
  ```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Focused tests | `pnpm exec vitest run app/helpers/factory-total` | all pass |
| Solver and data tests | `pnpm exec vitest run app/helpers app/db` | all pass |
| Recorded-factory smoke | `pnpm exec vitest run tests/` | 2 files pass |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `app/helpers/factory-total/latent-route-demand.ts` (create)
- `app/helpers/factory-total/latent-route-demand.test.ts` (create)
- `app/helpers/factory-total/factory-total.ts` (replace the `latentDemand` expression only)
- `app/helpers/calculate/calculate.ts` (one added comment line at 2907–2909 only)

**Out of scope** (do NOT touch):
- What the retry writes onto the routes (`blockedBy`, `blockingResources`).
  The diagnosis views read those fields; changing them changes what the player
  sees.
- `app/helpers/resource-supply/supply-diagnosis.ts`,
  `app/helpers/surplus-root-cause/`, `app/helpers/deficit-root-cause/`.
- Any other part of the dispatch loop.

## Git workflow

- Branch: `advisor/008-count-shared-retry-shortfall-once`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Guard the pump zone assignment save`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the helper

Create `app/helpers/factory-total/latent-route-demand.ts`:

```ts
import { type ResourceId } from "../../db/resources";
import { type BlockedSurplusRoute } from "../calculate/calculate";

/**
 * Demand for a resource that refused surplus routes would add if accepted.
 * A failed retry stamps one shared shortfall object onto every retried route;
 * that shortfall is factory-wide, so it counts once however many routes carry it.
 */
export const getLatentRouteDemand = (
  blockedRoutes: readonly BlockedSurplusRoute[],
  resourceId: ResourceId,
): number => {
  const counted = new Set<object>();
  const demand = { total: 0 };

  for (const route of blockedRoutes) {
    const shortages = route.blockingResources ?? (route.blockedBy ? [route.blockedBy] : []);
    const shortage = shortages.find(candidate => candidate.resourceId === resourceId);

    if (!shortage || counted.has(shortage)) continue;
    counted.add(shortage);
    demand.total += shortage.deficitIncrease;
  }

  return demand.total;
};
```

(This codebase keeps mutable counters as a property of a `const` object rather
than using `let` — for example `const allocation = { result: run(full), iteration: 0 }`
in `app/helpers/factory-calculation/factory-calculation.ts`. Keep that shape.)

**Verify**: `pnpm ts` exits 0.

### Step 2: Test the helper

Create `app/helpers/factory-total/latent-route-demand.test.ts`:

```ts
import { expect, it } from "vitest";

import { type Recipe } from "../../db/recipes";
import { type BlockedSurplusRoute } from "../calculate/calculate";
import { getLatentRouteDemand } from "./latent-route-demand";

const recipe: Recipe = {
  id: "test-route", name: "Test Route", building: "Test", group: "production",
  inputs: [], outputs: [],
};
const route = (overrides: Partial<BlockedSurplusRoute>): BlockedSurplusRoute => ({
  recipe, moduleId: "test", activeBuildings: 1, surplusResourceIds: [],
  wantedRatio: 1, appliedRatio: 0, blockedBy: null, ...overrides,
});

it("adds each route's own shortage of the resource", () => {
  const routes = [
    route({ blockedBy: { resourceId: "water", deficitIncrease: 2 }, blockingResources: [
      { resourceId: "salt", deficitIncrease: 9 }, { resourceId: "water", deficitIncrease: 2 },
    ] }),
    route({ blockedBy: { resourceId: "water", deficitIncrease: 3 } }),
  ];

  expect(getLatentRouteDemand(routes, "water")).toBe(5);
  expect(getLatentRouteDemand(routes, "salt")).toBe(9);
  expect(getLatentRouteDemand(routes, "coal")).toBe(0);
});

it("counts a shortfall object shared by several retried routes once", () => {
  const shared = { resourceId: "water" as const, deficitIncrease: 5 };
  const routes = [
    route({ blockedBy: shared, blockingResources: [shared] }),
    route({ blockedBy: shared, blockingResources: [shared] }),
    route({ blockedBy: { resourceId: "water", deficitIncrease: 1 } }),
  ];

  expect(getLatentRouteDemand(routes, "water")).toBe(6);
});
```

The repository's lint rules forbid `as` type assertions (`as const` is
allowed), so `route(...)` builds a complete `BlockedSurplusRoute`.

**Verify**: `pnpm exec vitest run app/helpers/factory-total/latent-route-demand.test.ts` → 2 tests pass.

### Step 3: Use the helper in dispatch

In `app/helpers/factory-total/factory-total.ts`:

1. Add the import next to the other relative imports at the top of the file
   (keep the list alphabetical by path, as it is now):

   ```ts
   import { getLatentRouteDemand } from "./latent-route-demand";
   ```

2. Replace the five-line `const latentDemand = currentCalculation.blockedRoutes.reduce(...)`
   expression (lines 375–378) with:

   ```ts
            const latentDemand = getLatentRouteDemand(currentCalculation.blockedRoutes, output.resourceId);
   ```

   Keep the three-line comment above it unchanged.

**Line-ending hazard**: `app/helpers/calculate/calculate.ts` has mixed line
endings (about 2,100 CRLF lines and 900 LF lines). Editing tools that rewrite
the whole file normalise them and turn a one-line change into a 900-line diff,
which fails review. Add the comment line with a small script that reads the
file as a raw string, inserts the new line using the same line ending as the
line above it, and writes it back. Afterwards
`git diff --stat -- app/helpers/calculate/calculate.ts` must show exactly
1 insertion and 0 deletions.

In `app/helpers/calculate/calculate.ts`, extend the existing comment at lines
2907–2909 with one more line, directly above `blockedRoutes.splice(`:

```ts
      // All of them share this one object; dispatch counts it once by identity.
```

**Verify**:
- `git grep -n "getLatentRouteDemand" -- app` → three matches outside the test
  file: the definition, the import, and the call.
- `pnpm exec vitest run app/helpers app/db` → all pass.
- `pnpm exec vitest run tests/` → 2 files pass (the test `burns available
  Waste in Next and recovers residual local steam before importing Water and
  Brine` is known to sit at its 40-second limit; a timeout on that test alone
  is not caused by this plan).
- `pnpm ts` and `pnpm lint` exit 0.

## Test plan

- New file `app/helpers/factory-total/latent-route-demand.test.ts` with two
  tests: separate shortages add up; one shared shortage object counts once.
- Existing coverage that must keep passing: `app/helpers/factory-total`,
  `app/db/canola-disposal.test.ts` and `app/db/carcass-food-pack.test.ts`
  (they exercise refused routes), and the recorded-factory smoke tests.

## Done criteria

- [ ] `pnpm exec vitest run app/helpers/factory-total` passes, including 2 new tests
- [ ] `git grep -n "blockedRoutes.reduce" -- app/helpers/factory-total/factory-total.ts` prints nothing
- [ ] `pnpm exec vitest run app/helpers app/db` passes
- [ ] `pnpm exec vitest run tests/` passes (known 40-second timeout excepted)
- [ ] `pnpm ts` and `pnpm lint` exit 0
- [ ] `git status --short` lists only the four in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any existing test fails with a changed number after step 3, including a
  recorded-factory assertion. Do NOT edit expected values; report the test
  name with expected and received values.
- The code at `calculate.ts:2902-2913` no longer assigns the same
  `retryShortfall` object to every retried route (for example it now copies
  it). The identity-based count would then do nothing; report it.
- `pnpm lint` rejects the helper for a reason other than formatting. Report
  the rule name.

## Maintenance notes

- The fix relies on object identity between `calculate.ts` and
  `factory-total.ts`. If routes are ever cloned or serialised between the two
  (for example moved across a worker boundary before dispatch), replace the
  identity check with an explicit marker field on the shared shortfall.
- Not changed here: the supply diagnosis still shows the full shared shortfall
  as the "additional requirement" on each retried route
  (`app/helpers/resource-supply/supply-diagnosis.ts:169-176`). Whether that
  should be split per route is a product decision.
