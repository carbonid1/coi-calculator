import { expect, it } from 'vitest'

import { createNuclearModule, plannedNuclearOperation, type NuclearOperationPlan } from '../../db/modules/nuclear'
import { emptyPlanningBaselines } from '../../db/planning-baselines'
import { type SyncedAreaEntity } from '../../game-state'
import { buildModuleLines } from '../../test-fixtures/build-module-lines'
import { calculateNet } from '../calculate/calculate'
import { createLiveAreaModules } from '../live-area-modules/live-area-modules'

const zone = { id: 12, name: 'Nuclear' }
const entity = (id: number, prototypeId: string, recipe: SyncedAreaEntity['recipes'][number], running = true): SyncedAreaEntity => ({
  entityId: id, prototypeId, prototypeName: 'Hydrogen reformer',
  constructed: true, constructionState: 'Constructed', running, tile: { x: id, y: 0 },
  zones: [zone], recipes: [recipe],
})
const reforming = {
  id: 'HydrogenProductionFromSteamSp', name: 'HydrogenProductionFromSteamSp', assigned: true,
  durationSeconds: 15,
  inputs: [{ productId: 'Product_Water', name: 'Water', quantity: 4 }, { productId: 'Product_SteamSp', name: 'Steam (super)', quantity: 3 }],
  outputs: [{ productId: 'Product_Hydrogen', name: 'Hydrogen', quantity: 8 }, { productId: 'Product_Oxygen', name: 'Oxygen', quantity: 8 }],
}
const create = (entities: SyncedAreaEntity[], plan?: NuclearOperationPlan) => {
  const [area] = createLiveAreaModules([zone], entities)
  const inventory = entities.filter(entity => entity.constructed)
    .map(entity => ({ ...entity, recipeIds: entity.recipes.filter(r => r.assigned).map(r => r.id), nuclearReactor: null }))

  return createNuclearModule(emptyPlanningBaselines, plan, inventory, area)
}
const reformerPlan = (count: number): NuclearOperationPlan => ({
  ...plannedNuclearOperation, hydrogenReformerCount: count,
  chlorineProcessingCount: 0, saltProcessingCount: 0, superDesalinatorCount: 0,
})

it('uses exported names, quantities and duration while preserving Nuclear allocation policy and paused inventory', () => {
  const changed = { ...reforming, name: 'Changed game recipe', durationSeconds: 30,
    outputs: [{ productId: 'Product_Hydrogen', name: 'Hydrogen', quantity: 10 }] }
  const nuclear = create([entity(1, 'HydrogenReformer', changed), entity(2, 'HydrogenReformer', changed, false)])
  const lines = buildModuleLines(nuclear, nuclear.presets[0]).lines

  expect(lines).toHaveLength(1)
  expect(lines[0]).toMatchObject({ builtBuildings: 2, activeBuildings: 1, currentActiveBuildings: 1,
    recipe: { id: 'hydrogen-reformer-super', name: 'Changed game recipe', building: 'Hydrogen reformer',
      cycleDurationSeconds: 30, balanceBy: 'output', balanceOutputIds: ['hydrogen', 'oxygen'],
      outputs: [{ resourceId: 'hydrogen', quantity: 20 }],
      inputs: [{ resourceId: 'water', quantity: 8 }, { resourceId: 'steamSuper', quantity: 6 }],
    },
  })
})

it('retains additional synced recipes instead of dropping them from Nuclear', () => {
  const alternate = { ...reforming, id: 'AlternateReforming', name: 'Alternate reforming' }
  const nuclear = create([entity(1, 'HydrogenReformer', reforming), entity(2, 'HydrogenReformer', alternate)])
  const lines = buildModuleLines(nuclear, nuclear.presets[0]).lines

  expect(lines).toHaveLength(2)
  expect(lines.map(line => line.recipe.gameRecipeId).sort()).toEqual(['AlternateReforming', reforming.id])
  expect(lines.reduce((count, line) => count + line.builtBuildings, 0)).toBe(2)
})

it('preserves shared physical capacity when one machine has multiple assigned recipes', () => {
  const machine = entity(1, 'HydrogenReformer', reforming)

  machine.recipes.push({ ...reforming, id: 'AlternateReforming', name: 'Alternate reforming' })
  const nuclear = create([machine])
  const lines = buildModuleLines(nuclear, nuclear.presets[0]).lines

  expect(lines).toHaveLength(2)
  expect(new Set(lines.map(line => line.capacityPoolId)).size).toBe(1)
  expect(lines.every(line => line.capacityPoolBuiltBuildings === 1 && line.capacityPoolActiveBuildings === 1)).toBe(true)
})

it('keeps construction ghosts separate from the current inventory after mapping recipe IDs', () => {
  const ghost = { ...entity(2, 'HydrogenReformer', reforming, false), constructed: false, constructionState: 'NotStarted' }
  const nuclear = create([entity(1, 'HydrogenReformer', reforming), ghost])
  const [line] = buildModuleLines(nuclear, nuclear.presets[0]).lines

  expect(line).toMatchObject({
    activeBuildings: 2, currentActiveBuildings: 1, builtBuildings: 1, constructionGhosts: 1,
    recipe: { id: 'hydrogen-reformer-super' },
  })
})

it.each([
  ['NuclearWasteStorage', 'radioactive-waste-storage'],
  ['TurbineSuperPress', 'turbine-super'],
  ['TurbineHighPressT2', 'turbine-high'],
  ['TurbineLowPressT2', 'turbine-low'],
  ['PowerGeneratorT2', 'power-generator-ii-nuclear'],
])('counts %s construction ghosts even without an ordinary recipe', (prototypeId, recipeId) => {
  const built = { ...entity(1, prototypeId, reforming), recipes: [], availableRecipeCount: 0 }
  const ghost = { ...built, entityId: 2, constructed: false, running: false, constructionState: 'InConstruction' }
  const nuclear = create([built, ghost], {
    ...reformerPlan(0), supportTargets: [{ recipeId, name: prototypeId, target: 2 }],
  })
  const line = buildModuleLines(nuclear, nuclear.presets[0]).lines.find(line => line.recipe.id === recipeId)

  expect(line).toMatchObject({
    builtBuildings: 1, currentActiveBuildings: 1, activeBuildings: 2,
    constructionGhosts: 1, unplacedPlannedBuildings: 0,
  })
  expect(nuclear.presets[0].planMismatches?.filter(mismatch => mismatch.recipeId === recipeId) ?? []).toEqual([])
})

it.each([false, true])('keeps ghost-covered rows synced unless built turbines need configuration (auto-balance: %s)', autoBalance => {
  const members = [
    ['TurbineSuperPress', 'turbine-super', 4],
    ['TurbineHighPressT2', 'turbine-high', 4],
    ['TurbineLowPressT2', 'turbine-low', 4],
    ['PowerGeneratorT2', 'power-generator-ii-nuclear', 8],
  ] as const
  const entities = members.flatMap(([prototypeId, , count], group) => Array.from({ length: count * 2 }, (_, index) => ({
    ...entity(group * 100 + index, prototypeId, reforming, index < count),
    recipes: [], availableRecipeCount: 0,
    constructed: index < count, constructionState: index < count ? 'Constructed' : 'InConstruction',
    turbineAutoBalance: prototypeId.startsWith('Turbine') ? autoBalance : null,
  })))
  const nuclear = create(entities, {
    ...reformerPlan(0), turbineRows: { working: 4, standby: 0 },
    turbineAutoBalanceOff: { 'turbine-super': 8, 'turbine-high': 8, 'turbine-low': 8 },
  })
  const preset = nuclear.presets[0]

  for (const [prototypeId, recipeId] of members) {
    const needsConfiguration = prototypeId.startsWith('Turbine') && autoBalance

    expect(preset.dataSources?.[recipeId]).toBe(needsConfiguration ? 'planned' : 'synced')
    expect(preset.unplacedPlannedBuildings?.[recipeId] ?? 0).toBe(0)
    expect(preset.planMismatches?.some(mismatch => mismatch.recipeId === recipeId) ?? false).toBe(needsConfiguration)
  }
})

it('keeps unsupported-product diagnostics instead of substituting a static recipe', () => {
  const nuclear = create([entity(1, 'HydrogenReformer', { ...reforming,
    outputs: [{ productId: 'UnknownProduct', name: 'Unknown product', quantity: 8 }],
  })])

  expect(buildModuleLines(nuclear, nuclear.presets[0]).lines).toEqual([])
  expect(nuclear.liveArea?.issues).toEqual([expect.objectContaining({ id: `HydrogenReformer:${reforming.id}:products` })])
})

it('preserves spent-fuel-driven reprocessing rather than adopting generic output demand', () => {
  const nuclear = create([entity(1, 'NuclearReprocessingPlant', {
    id: 'CoreFuelReprocessing', name: 'CoreFuelReprocessing', assigned: true, durationSeconds: 60,
    inputs: [{ productId: 'Product_CoreFuelDirty', name: 'Core fuel (spent)', quantity: 16 }],
    outputs: [{ productId: 'Product_CoreFuel', name: 'Core fuel', quantity: 12 },
      { productId: 'Product_FissionProduct', name: 'Fission product', quantity: 2 }],
  })])
  const lines = buildModuleLines(nuclear, nuclear.presets[0]).lines
  const result = calculateNet(lines, { coreFuelSpent: 12 }).regularResults[0]

  expect(result.supplyRatio).toBeCloseTo(0.75)
  expect(result.actualOutputs).toEqual([{ resourceId: 'coreFuel', quantity: 9 }, { resourceId: 'fissionProduct', quantity: 1.5 }])
})

it('counts every recipe configuration toward a reached Nuclear operation target', () => {
  const shared = entity(2, 'HydrogenReformer', reforming)

  shared.recipes.push({ ...reforming, id: 'AlternateReforming', name: 'Alternate reforming' })
  const nuclear = create([entity(1, 'HydrogenReformer', reforming), shared], reformerPlan(2))
  const lines = buildModuleLines(nuclear, nuclear.presets[0]).lines
    .filter(line => line.recipe.gameRecipeId === reforming.id)

  expect(lines.reduce((count, line) => count + line.activeBuildings, 0)).toBe(2)
  expect(nuclear.presets[0].planMismatches).toBeUndefined()
})

it('unpauses the physical shared machine when the Nuclear plan activates its recipe', () => {
  const shared = entity(1, 'HydrogenReformer', reforming, false)

  shared.recipes.push({ ...reforming, id: 'AlternateReforming', name: 'Alternate reforming' })
  const nuclear = create([shared], reformerPlan(1))
  const lines = buildModuleLines(nuclear, nuclear.presets[0]).lines

  expect(lines.filter(line => line.recipe.gameBuildingId === 'HydrogenReformer')).toEqual([
    expect.objectContaining({ activeBuildings: 1, capacityPoolActiveBuildings: 1, currentActiveBuildings: 0 }),
    expect.objectContaining({ activeBuildings: 1, capacityPoolActiveBuildings: 1, currentActiveBuildings: 0 }),
  ])
})

it('retains construction ghosts when the Nuclear operation target is already reached', () => {
  const ghost = { ...entity(2, 'HydrogenReformer', reforming, false), constructed: false, constructionState: 'NotStarted' }
  const nuclear = create([entity(1, 'HydrogenReformer', reforming), ghost], reformerPlan(1))
  const line = buildModuleLines(nuclear, nuclear.presets[0]).lines.find(line => line.recipe.gameRecipeId === reforming.id)

  expect(line).toMatchObject({ activeBuildings: 2, currentActiveBuildings: 1, constructionGhosts: 1 })
})

it('does not resurrect an unsupported exported recipe through a Nuclear operation target', () => {
  const nuclear = create([entity(1, 'HydrogenReformer', { ...reforming,
    outputs: [{ productId: 'UnknownProduct', name: 'Unknown product', quantity: 8 }],
  })], reformerPlan(1))

  expect(buildModuleLines(nuclear, nuclear.presets[0]).lines.filter(line => (
    line.recipe.id === 'hydrogen-reformer-super' || line.recipe.gameBuildingId === 'HydrogenReformer'
  ))).toEqual([])
  expect(nuclear.liveArea?.issues).toEqual([expect.objectContaining({ id: `HydrogenReformer:${reforming.id}:products` })])
})
