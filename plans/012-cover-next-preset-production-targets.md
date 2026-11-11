# Plan 012: The recorded-factory smoke tests check the Next preset's production targets and household-appliance demand

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6a6d24..HEAD -- tests/factory.smoke.test.ts app/db/live-area-plans.ts app/db/factory-presets.ts app/db/modules/production-targets.ts`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (test-only)
- **Depends on**: plans/005-stabilise-test-discovery-and-timeouts.md (it edits the same test file; run 005 first)
- **Category**: tests
- **Planned at**: commit `e6a6d24`, 2026-11-11

## Why this matters

The calculator offers two factory presets: "Baseline" and "Next". "Next" is the
plan the player actually works from. Its newest layer, `household-appliances`,
adds per-area production targets (how many machines of a recipe should run)
and switches on household-appliance supply for the settlement. No test
mentions `productionTargets` or `householdAppliances`. Most recorded-factory
scenarios instead replay two older presets that can no longer be selected. A
wrong recipe id, area id or target in the live plan would ship with every test
green.

This plan adds assertions for that layer to the recorded-factory smoke tests.
The assertions are derived from the plan data itself, not copied from solver
output, so they stay correct when the plan's numbers change.

## Current state

- `app/db/factory-presets.ts:12-15`:

  ```ts
  export const factoryPresets = [
    { id: 'baseline', name: 'Baseline', layers: baselineLayers },
    { id: 'next', name: 'Next', layers: [...baselineLayers, 'construction', 'waste-recovery', 'household-appliances'] },
  ] as const
  ```

  `resolvePlanAreaTargets` (same file, lines 37–57) passes
  `householdAppliances` and `productionTargets` through only when the
  `household-appliances` layer is selected.
- `app/db/live-area-plans.ts` — plans keyed by save name, then by area id.
  Exported reader (lines 88–90):

  ```ts
  export const getLiveAreaPlans = (saveId: string | null | undefined): LiveAreaPlans => (
    saveId ? liveAreaPlansBySave[saveId] ?? {} : {}
  )
  ```

  For the save `'Last-Stop Waters'` the plan has `productionTargets` on areas
  `-1` (six targets), `16` (three targets) and `28` (one target), and
  `householdAppliances: true` on area `14`. One target looks like:

  ```ts
  { buildingId: 'ArcFurnace2', recipeId: 'CopperSmeltingArc', building: 'Arc furnace II',
    product: 'moltenCopper', target: 7 },
  ```

- `app/db/modules/production-targets.ts` — `applyLiveAreaProductionTargets`
  finds the module's recipes whose `gameBuildingId` and `gameRecipeId` match
  the target (adding one if none exists) and raises the preset's
  `activeBuildings` so that the matching recipes together run **at least**
  `target` machines. It never lowers a count.
- `app/helpers/calculator-model/derive-calculator-model.ts:447` and `:511-513`
  apply the targets per module using `module.liveArea.zoneId`. The default
  area is zone `-1` (`DEFAULT_LIVE_AREA_ZONE_ID` in
  `app/helpers/live-area-modules/live-area-modules.ts:71`) and its module id is
  `'general'`.
- The recorded factory, `tests/fixtures/factory.json.gz`, has
  `saveId: 'Last-Stop Waters'`. Its named areas include `14` ("Population")
  and `16` ("Copper #1"). **Area `28` does not exist in the recording**, so
  its target cannot be checked against it.
- `tests/factory.smoke.test.ts` — recorded-factory scenarios. Top of file:

  ```ts
  // Update 4.3 factory with native farm and Rocket II definitions read by Bridge.
  const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/factory.json.gz', import.meta.url))).toString())
  ```

  The scenario to extend starts at line 127:

  ```ts
  it('burns available Waste in Next and recovers residual local steam before importing Water and Brine', () => {
    const snapshot = normalizeGameStateSnapshot(structuredClone(capture))

    if (!snapshot) throw new Error('Recorded factory is incompatible')
    snapshot.areaEntities = snapshot.areaEntities.filter(entity => entity.constructed)
    const run = (presetId: 'baseline' | 'next') => {
      const model = deriveCalculatorModel({ snapshot, presetId, machineZoneAssignments: {}, revision: 'waste-recovery' })
      const result = calculateFactoryCalculation(model.factoryCalculationInput)
      const area = (id: string) => extractModuleResult(id, result.factoryResult.calculation)

      return { model, result, general: area('general'), nuclear: area('live-area-12') }
    }
    const baseline = run('baseline')
    const next = run('next')
    const waste = next.result.factoryResult.flows.find(flow => flow.resourceId === 'waste')!
  ```

  and ends at line 183 with:

  ```ts
    expect(next.result.factoryResult.allLines.filter(line => line.recipe.gameBuildingId?.startsWith('ResearchLab'))
      .reduce((total, line) => total + line.activeBuildings, 0)).toBe(2)
  }, 40_000)
  ```

  `result.factoryResult.flows` is an array of
  `{ resourceId, produced, consumed, net }`.
- This file uses single quotes and no semicolons. Imports at the top are
  sorted by path; `deriveCalculatorModel`, `normalizeGameStateSnapshot` and
  `factoryPresets` are already imported. `getLiveAreaPlans` is not.
- Repository testing policy (`AGENTS.md`): "Prefer a small number of broad
  recorded-factory and browser smoke tests over isolated tests of rendering,
  formatting, or simple arithmetic."
- Rates are "per 60 s", which is one in-game month.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| One scenario | `pnpm exec vitest run tests/factory.smoke.test.ts -t "<part of the test title>"` | that test passes |
| Smoke files | `pnpm exec vitest run tests/` | 2 files pass |
| Lint (check only) | `pnpm lint` | exit 0 |

(`pnpm ts` does not typecheck test files in this repository; vitest still
fails on runtime errors, and `pnpm lint` covers the file.)

## Scope

**In scope**:
- `tests/factory.smoke.test.ts` (one new import, one new test, a few added assertions in one existing test)

**Out of scope** (do NOT touch):
- Any file under `app/` — this plan must not change behaviour. If an
  assertion fails, that is a finding to report, not something to fix here.
- `tests/fixtures/*` — do not re-record or edit the fixtures.
- Existing assertions and existing scenarios for the older presets
  (`science-expansion`, `third-fbr`). Do not delete or convert them.
- Hard-coding machine counts or flow quantities read from a test run.

## Git workflow

- Branch: `advisor/012-cover-next-preset-production-targets`
- Commit message style: imperative sentence case, no prefix, e.g.
  `Guard the pump zone assignment save`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the production-targets scenario

In `tests/factory.smoke.test.ts`:

1. Add this import in path order among the `../app/db/...` imports (after the
   `../app/db/housing` line):

   ```ts
   import { getLiveAreaPlans } from '../app/db/live-area-plans'
   ```

2. Directly after the scenario that ends at line 183 (`}, 40_000)`), add:

   ```ts
   it('raises every recorded area to its Next production targets and leaves Baseline unplanned', () => {
     const snapshot = normalizeGameStateSnapshot(structuredClone(capture))

     if (!snapshot) throw new Error('Recorded factory is incompatible')
     const derive = (presetId: 'baseline' | 'next') => deriveCalculatorModel({
       snapshot, presetId, machineZoneAssignments: {}, revision: 'production-targets',
     })
     const baseline = derive('baseline')
     const next = derive('next')
     const recordedZoneIds = new Set([-1, ...snapshot.logisticsZones.map(zone => zone.id)])
     const planned = Object.entries(getLiveAreaPlans(snapshot.saveId)).flatMap(([zoneId, plan]) => (
       (plan.productionTargets ?? []).map(target => ({ zoneId: Number(zoneId), target }))
     ))
     const recorded = planned.filter(({ zoneId }) => recordedZoneIds.has(zoneId))
     const running = (model: typeof next, zoneId: number, target: typeof planned[number]['target']) => {
       const areaModule = model.configuredModules.find(candidate => candidate.liveArea?.zoneId === zoneId)
       const preset = areaModule?.presets[0]

       return (areaModule?.recipes ?? [])
         .filter(recipe => recipe.gameBuildingId === target.buildingId && recipe.gameRecipeId === target.recipeId)
         .reduce((total, recipe) => total + (preset?.activeBuildings[recipe.id] ?? 0), 0)
     }

     // Areas created after the recording cannot be replayed; everything else must be.
     expect(planned.length).toBeGreaterThan(0)
     expect(recorded.map(({ zoneId }) => zoneId)).toEqual(expect.arrayContaining([-1, 16]))
     for (const { zoneId, target } of recorded) {
       expect(running(next, zoneId, target), `area ${zoneId} ${target.recipeId}`).toBeGreaterThanOrEqual(target.target)
     }
     // The targets belong to the plan: at least one of them is above what Baseline runs.
     expect(recorded.some(({ zoneId, target }) => running(baseline, zoneId, target) < target.target)).toBe(true)
   }, 30_000)
   ```

**Verify**: `pnpm exec vitest run tests/factory.smoke.test.ts -t "Next production targets"`
→ 1 test passes. If it fails, read STOP conditions before changing anything.

### Step 2: Check household-appliance demand in the existing Next scenario

In the scenario that starts at line 127 (`burns available Waste in Next ...`),
add these lines directly before its closing `}, 40_000)`:

```ts
  const appliances = (solved: typeof next) => solved.result.factoryResult.flows
    .find(flow => flow.resourceId === 'householdAppliances')?.consumed ?? 0

  expect(appliances(baseline)).toBe(0)
  expect(appliances(next)).toBeGreaterThan(0)
```

This reuses the two solves the scenario already runs; do not add a new solve.

**Verify**: `pnpm exec vitest run tests/factory.smoke.test.ts -t "burns available Waste"`
→ passes. This scenario is known to run close to its 40-second limit. If it
fails *only* by timeout, run it once more; if it times out again, change its
timeout from `40_000` to `60_000` and say so in your report.

### Step 3: Full smoke run and lint

**Verify**:
- `pnpm exec vitest run tests/` → 2 files pass.
- `pnpm lint` exits 0.

## Test plan

- New scenario in `tests/factory.smoke.test.ts`: for every production target
  in the live plan whose area exists in the recording, the Next model runs at
  least the planned number of machines for that game recipe; and at least one
  target exceeds what Baseline runs, proving the layer is what raised it.
- Extended scenario: the settlement consumes Household Appliances under Next
  and none under Baseline.
- Pattern: the existing scenario at line 60,
  `uses the live factory with two running labs and station crew as the new baseline`,
  which also derives models for two presets and compares module presets.

## Done criteria

- [ ] `git grep -c "getLiveAreaPlans" -- tests/factory.smoke.test.ts` → `2`
- [ ] `git grep -n "householdAppliances" -- tests/factory.smoke.test.ts` → at least one match
- [ ] `pnpm exec vitest run tests/` passes
- [ ] `pnpm lint` exits 0
- [ ] `git status --short` lists only `tests/factory.smoke.test.ts` (plus `plans/README.md`)
- [ ] `git diff --stat e6a6d24 -- app` shows no change from this plan
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise, and do not weaken an assertion to make
it pass) if:

- A `toBeGreaterThanOrEqual(target.target)` assertion fails. Report the area
  id, recipe id, planned target and the count the model runs. This is exactly
  the kind of defect the test exists to catch; a human decides whether the
  plan data or the code is wrong.
- The final assertion of step 1 fails (no target is above Baseline). Report
  the Baseline and Next counts for every recorded target; the recording may
  already satisfy the whole plan, in which case the plan author must choose a
  different proof.
- `appliances(baseline)` is not `0`, or `appliances(next)` is not greater
  than `0`. Report both numbers.
- `module.liveArea`, `module.presets[0].activeBuildings`, `recipe.gameBuildingId`
  or `recipe.gameRecipeId` does not exist on the model (a runtime `undefined`
  where the test expects data). Report which.
- The recording no longer contains areas `14` and `16`.

## Maintenance notes

- When the recorded factory is re-captured from a save that contains area
  `28`, its Household Appliances target is picked up automatically, because
  the test iterates the plan rather than listing areas.
- When a production target is added to `app/db/live-area-plans.ts`, no test
  edit is needed.
- Deferred: most other recorded-factory scenarios still replay the retired
  `science-expansion` and `third-fbr` presets, including the golden report in
  `tests/fixtures/factory-baseline.json`. Deciding which of those still guard
  anything — and moving the rest onto `next` — changes pinned numbers and
  needs the maintainer.
