# Plan 007: A global source no longer supplies demand that a module's own source already covers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e6a6d24..HEAD -- app/helpers/calculate/calculate.ts app/helpers/calculate/calculate.test.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (changes reported output of source lines; recorded-factory baselines may move)
- **Depends on**: plans/005-stabilise-test-discovery-and-timeouts.md (so the smoke tests run reliably)
- **Category**: bug
- **Planned at**: commit `e6a6d24`, 2026-11-11

## Why this matters

The solver has two kinds of "source" lines (raw supply such as terrain
extraction, groundwater pumps, or stored reserves):

- **module-scoped** sources (`sourceMode` `'module-demand'` or
  `'module-demand-capped'`) supply only the demand inside their own module;
- **global** sources (`'demand'`, `'demand-capped'`) supply whatever the whole
  factory still needs.

When the final output of each source is decided, sources are processed in list
order. The factory-wide remaining demand includes the demand that a
module-scoped source is about to cover, and it is only reduced by module
sources that were processed *earlier*. So when a global source appears in the
list before a module-scoped source of the same resource, both are charged for
the same demand: the resource is reported as produced twice.

This order occurs in the real model: the Reserves module (stored Rock, a
global `'demand'` source) is placed before every live area, and live areas have
a module-scoped terrain source for Rock. The effect is that the reserve is
reported as being drawn down for demand the area's own mine already meets, so
the Reserves view can show stock draining when it is not.

## Current state

- `app/helpers/calculate/calculate.ts` — the solver. The relevant block is
  inside the function `finalizeAllocation` (a closure inside
  `calculateNetCore`). Lines 2416–2496:

  ```ts
      // Sources are fallback streams: internal production is retained first, then
      // sources are allocated in declaration order to cover only what remains.
      const remainingSourceDemand = new Map<ResourceId, number>();
      const remainingModuleSourceDemand = new Map<string, number>();

      for (const line of sourceLines) {
        if (!isModuleScopedSourceMode(line.recipe.sourceMode)) continue;

        for (const output of line.recipe.outputs) {
          const key = moduleResourceKey(line.moduleId, output.resourceId);

          if (remainingModuleSourceDemand.has(key)) continue;
          // ... computes moduleConsumed and moduleProduced from regularResults ...
          remainingModuleSourceDemand.set(
            key,
            Math.max(0, moduleConsumed - moduleProduced),
          );
        }
      }

      for (const line of sourceLines) {
        for (const output of line.recipe.outputs) {
          if (remainingSourceDemand.has(output.resourceId)) continue;

          const flow = getFlow(output.resourceId);
          const totalSourceCapacity = sourceLines.reduce((total, source) => {
            return total + (sourceOutputCapacities.get(source)?.get(output.resourceId) ?? 0);
          }, 0);
          const internallyProduced = flow.produced - totalSourceCapacity;

          remainingSourceDemand.set(
            output.resourceId,
            Math.max(0, flow.consumed - internallyProduced),
          );
        }
      }

      const sourceResults: PassiveResult[] = sourceLines.map((line) => {
        const actualOutputs = line.recipe.outputs.map((output) => {
          const flow = getFlow(output.resourceId, true);
          const capacity = sourceOutputCapacities.get(line)?.get(output.resourceId) ?? 0;
          const moduleKey = moduleResourceKey(line.moduleId, output.resourceId);
          const moduleScoped = isModuleScopedSourceMode(line.recipe.sourceMode);
          const remaining = moduleScoped
            ? remainingModuleSourceDemand.get(moduleKey) ?? 0
            : remainingSourceDemand.get(output.resourceId) ?? 0;
          const actualUsed = Math.min(capacity, remaining);

          flow.produced -= capacity - actualUsed;
          getActualModuleFlow(line.moduleId, output.resourceId, true).produced -= capacity - actualUsed;
          if (moduleScoped) {
            remainingModuleSourceDemand.set(moduleKey, remaining - actualUsed);
            remainingSourceDemand.set(
              output.resourceId,
              Math.max(
                0,
                (remainingSourceDemand.get(output.resourceId) ?? 0) - actualUsed,
              ),
            );
          } else {
            remainingSourceDemand.set(output.resourceId, remaining - actualUsed);
          }

          return { resourceId: output.resourceId, quantity: actualUsed };
        });
  ```

- `isModuleScopedSourceMode` is imported from `app/db/recipes.ts:59-61`:

  ```ts
  export const isModuleScopedSourceMode = (mode: SourceMode | undefined) => (
    mode === 'module-demand' || mode === 'module-demand-capped'
  )
  ```

- `app/helpers/calculate/calculate.test.ts` — solver unit tests. Helpers at
  the top of the file (lines 16–32):

  ```ts
  const fixedLine = (recipe: Recipe, moduleId: string, activeBuildings = 1) => ({
    recipe, moduleId, activeBuildings, builtBuildings: activeBuildings,
    speedLevel: 1, operatingMode: "fixed" as const,
  });
  const balancedLine = (recipe: Recipe, moduleId: string, activeBuildings = 1) => ({
    recipe, moduleId, activeBuildings, builtBuildings: activeBuildings,
    speedLevel: 1, operatingMode: "balanced" as const,
  });
  ```

  The existing test to model the new one on is at lines 1098–1147,
  `keeps module-scoped source capacity out of other modules`. It defines a
  module-scoped terrain source and a crusher in the same module:

  ```ts
  const terrainSource: Recipe = {
    id: "test-module-terrain-source",
    name: "Test Module Terrain Source",
    building: "Terrain extraction",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "titaniumOre", quantity: 100 }],
    sourceMode: "module-demand",
    sourceKind: "terrain-mine",
  };
  const mineCrusher: Recipe = {
    id: "test-mine-crusher",
    name: "Test Mine Crusher",
    building: "Crusher (Large)",
    group: "production",
    balanceBy: "output",
    balanceInputIds: ["titaniumOre"],
    balanceInputScope: "module",
    inputs: [{ resourceId: "titaniumOre", quantity: 100 }],
    outputs: [{ resourceId: "titaniumOreCrushed", quantity: 100 }],
  };
  ```

  and calls the solver as
  `calculateNet(lines, { titaniumOre: 40 }, undefined, {}, { titaniumOreCrushed: 140 })`.
  The last argument is a fixed demand per resource.

- Conventions: this file uses double quotes and semicolons; keep that style in
  both in-scope files. Rates are "per 60 s", which is one in-game month.
  Repository policy (`AGENTS.md`): "For solver bugs, isolate the failure in a
  small regression test before experimenting with allocation changes, then
  verify the fix against a saved factory snapshot while checking that existing
  priorities still hold."

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Focused tests | `pnpm exec vitest run app/helpers/calculate` | all pass |
| Solver and data tests | `pnpm exec vitest run app/helpers app/db` | all pass |
| Recorded-factory smoke | `pnpm exec vitest run tests/` | 2 files pass |
| Typecheck | `pnpm ts` | exit 0 |
| Lint (check only) | `pnpm lint` | exit 0 |

## Scope

**In scope**:
- `app/helpers/calculate/calculate.ts` (only the block quoted above)
- `app/helpers/calculate/calculate.test.ts` (one new test)

**Out of scope** (do NOT touch):
- The function `reservePlannedSourceInputs` in the same file (around lines
  2230–2320). It has a similar loop but decides input reservations, not
  reported output. Leave it alone.
- `displaceDemandSources` and everything after `sourceResults` is built.
- `tests/fixtures/factory-baseline.json` and any expected number in
  `tests/factory.smoke.test.ts` — see STOP conditions.
- Any recipe or module definition under `app/db/`.

## Git workflow

- Branch: `advisor/007-allocate-module-sources-before-global-sources`
- Two commits: the failing test first is NOT required; commit the test and
  the fix together. Message style: imperative sentence case, no prefix, e.g.
  `Guard the pump zone assignment save`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the regression test and watch it fail

In `app/helpers/calculate/calculate.test.ts`, directly after the test
`keeps module-scoped source capacity out of other modules` (which ends at line
1147), add:

```ts
it("does not draw a global source for demand a module-scoped source covers, whatever the line order", () => {
  const globalSource: Recipe = {
    id: "test-global-ore-reserve",
    name: "Test Global Ore Reserve",
    building: "Reserve",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "titaniumOre", quantity: 100 }],
    sourceMode: "demand",
  };
  const terrainSource: Recipe = {
    id: "test-ordered-terrain-source",
    name: "Test Ordered Terrain Source",
    building: "Terrain extraction",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "titaniumOre", quantity: 100 }],
    sourceMode: "module-demand",
    sourceKind: "terrain-mine",
  };
  const mineCrusher: Recipe = {
    id: "test-ordered-mine-crusher",
    name: "Test Ordered Mine Crusher",
    building: "Crusher (Large)",
    group: "production",
    balanceBy: "output",
    balanceInputIds: ["titaniumOre"],
    balanceInputScope: "module",
    inputs: [{ resourceId: "titaniumOre", quantity: 100 }],
    outputs: [{ resourceId: "titaniumOreCrushed", quantity: 100 }],
  };
  const solve = (globalFirst: boolean) => {
    const sources = globalFirst
      ? [fixedLine(globalSource, "reserves"), fixedLine(terrainSource, "mine")]
      : [fixedLine(terrainSource, "mine"), fixedLine(globalSource, "reserves")];
    const result = calculateNet(
      [...sources, balancedLine(mineCrusher, "mine")],
      {}, undefined, {}, { titaniumOreCrushed: 100 },
    );
    const drawn = (recipeId: string) => result.sourceResults
      .find(candidate => candidate.recipe.id === recipeId)?.actualOutputs[0]?.quantity;
    const ore = result.allResourceFlows.find(flow => flow.resourceId === "titaniumOre");

    return { terrain: drawn(terrainSource.id), reserve: drawn(globalSource.id), net: ore?.net };
  };

  expect(solve(false)).toEqual({ terrain: 100, reserve: 0, net: 0 });
  expect(solve(true)).toEqual(solve(false));
});
```

**Verify**: `pnpm exec vitest run app/helpers/calculate/calculate.test.ts -t "whatever the line order"`
→ the test FAILS, and the failure is on the last `expect` (the
`globalFirst: true` result differs, typically `reserve: 100`). If the first
`expect` fails instead, or the test passes, see STOP conditions.

### Step 2: Reduce the global demand by module coverage up front

**Line-ending hazard**: `app/helpers/calculate/calculate.ts` has mixed line
endings (about 2,100 CRLF lines and 900 LF lines). Editing tools that rewrite
the whole file normalise them and produce a 900-line diff, which fails review.
Apply the edits with a small script that works on the raw file string and
reuses the neighbouring line's ending; afterwards
`git diff --stat -- app/helpers/calculate/calculate.ts` must show about 22
insertions and 8 deletions.

In `app/helpers/calculate/calculate.ts`, between the loop that fills
`remainingSourceDemand` (ends at line 2470) and the line
`const sourceResults: PassiveResult[] = sourceLines.map((line) => {`
(line 2472), insert:

```ts
    // A module-scoped source covers its own module whatever the line order,
    // so take that coverage out of the factory-wide remainder before any
    // global source is sized.
    const moduleCoverage = new Map(remainingModuleSourceDemand);

    for (const line of sourceLines) {
      if (!isModuleScopedSourceMode(line.recipe.sourceMode)) continue;

      for (const output of line.recipe.outputs) {
        const key = moduleResourceKey(line.moduleId, output.resourceId);
        const capacity = sourceOutputCapacities.get(line)?.get(output.resourceId) ?? 0;
        const covered = Math.min(capacity, moduleCoverage.get(key) ?? 0);

        moduleCoverage.set(key, (moduleCoverage.get(key) ?? 0) - covered);
        remainingSourceDemand.set(
          output.resourceId,
          Math.max(0, (remainingSourceDemand.get(output.resourceId) ?? 0) - covered),
        );
      }
    }
```

Then, inside the `sourceResults` map, replace the `if (moduleScoped) { ... }
else { ... }` block (lines 2485–2496) with:

```ts
        if (moduleScoped) {
          remainingModuleSourceDemand.set(moduleKey, remaining - actualUsed);
        } else {
          remainingSourceDemand.set(output.resourceId, remaining - actualUsed);
        }
```

(The module branch no longer subtracts from `remainingSourceDemand`, because
the new loop already did.) Also update the comment above
`remainingSourceDemand` so it no longer says only "in declaration order": make
the second line read
`// module-scoped sources cover their own module, then the rest are allocated in declaration order.`

**Verify**: `pnpm exec vitest run app/helpers/calculate` → all pass, including
the new test.

### Step 3: Check the wider solver and the recorded factory

**Verify**:
- `pnpm exec vitest run app/helpers app/db` → all pass.
- `pnpm exec vitest run tests/` → 2 files pass. (One test,
  `burns available Waste in Next and recovers residual local steam before
  importing Water and Brine`, is known to sit at its 40-second limit; a
  timeout on that test alone is not caused by this plan.)
- `pnpm ts` and `pnpm lint` exit 0.

## Test plan

- One new test in `app/helpers/calculate/calculate.test.ts`, modelled on
  `keeps module-scoped source capacity out of other modules`. It solves the
  same three lines twice — module source first, then global source first — and
  requires identical results: the module source supplies 100, the global source
  supplies 0, and the resource nets to 0.
- Existing coverage that must keep passing: all of `app/helpers/calculate`,
  `app/helpers/factory-total`, `app/db/modules`, and the recorded-factory
  smoke tests under `tests/`.

## Done criteria

- [ ] `pnpm exec vitest run app/helpers/calculate/calculate.test.ts -t "whatever the line order"` passes
- [ ] `pnpm exec vitest run app/helpers app/db` passes
- [ ] `pnpm exec vitest run tests/` passes (known 40-second timeout excepted)
- [ ] `git grep -n "const moduleCoverage = new Map(remainingModuleSourceDemand)" -- app/helpers/calculate/calculate.ts` → one match
- [ ] `pnpm ts` and `pnpm lint` exit 0
- [ ] `git status --short` lists only the two in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- In step 1 the new test passes before any change to `calculate.ts`. That
  means the double-charging does not reproduce in this small case. Report the
  two results the test printed; do not apply step 2.
- In step 1 the *first* `expect` fails (the module-source-first order does not
  give `{ terrain: 100, reserve: 0, net: 0 }`). Report the actual values; the
  test setup needs adjusting by the plan author.
- After step 2, any existing test fails with a changed number — including an
  assertion in `tests/factory.smoke.test.ts` or a mismatch against
  `tests/fixtures/factory-baseline.json`. Do NOT edit expected values. Report
  each failing test name with its expected and received values; a human must
  decide whether the old number was the bug.
- The code at lines 2416–2496 does not match the excerpt.

## Maintenance notes

- `reservePlannedSourceInputs` (same file, around lines 2230–2320) has the
  same "processed in list order" shape for input reservations. It was left
  alone deliberately; if a source with inputs ever shows the same
  double-charging, apply the same up-front coverage there.
- A reviewer should check the Reserves view on a real save after this lands:
  reserve draw for Rock (and groundwater from the factory reserve pump) should
  drop where a live area has its own source.
- Module order in `app/helpers/calculator-model/derive-calculator-model.ts`
  no longer affects source output; do not rely on ordering there to steer
  which source is used.
