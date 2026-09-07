import { describe, expect, it } from 'vitest'

import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Module } from '../../db/modules/modules'
import { recipes, type Recipe } from '../../db/recipes'
import { getResourceSupplyRows } from '../resource-supply/resource-supply'
import { calculateFactoryCalculation } from './factory-calculation'

const steamIds = ['steamSuper', 'steamHigh', 'steamLow', 'steamDepleted'] as const
const moduleWith = (id: string, recipes: Recipe[], pooled = true): Module => ({
  id, name: id, description: '', recipes,
  includedInFactoryTotals: pooled,
  liveArea: {
    zoneId: 1, trackedBuildings: 1, constructedBuildings: 1, activeBuildings: 1,
    pausedBuildings: 0, constructionGhosts: 0, issues: [],
  },
  builtBuildings: Object.fromEntries(recipes.map(recipe => [recipe.id, 1])),
  defaultPresetId: 'test',
  presets: [{
    id: 'test', name: '', description: '', activeBuildings: {},
    fixed: recipes.filter(recipe => recipe.inputs.length === 0 && recipe.group !== 'source').map(recipe => recipe.id),
  }],
})
const recipe = (id: string, overrides: Partial<Recipe>): Recipe => ({
  id, name: id, building: 'Test plant', group: 'production', inputs: [], outputs: [], ...overrides,
})
const calculate = (modules: Module[], links: ModuleResourceLink[] = []) => calculateFactoryCalculation({
  modules, links, contracts: [], contractsProfitMultiplier: 1, outputModifiers: {},
  recyclingEfficiencyPercent: 100, shipsFuelUseMultiplier: 1,
})

describe.each(steamIds)('%s routing', resourceId => {
  it.each([true, false])('uses only local Steam regardless of module order (source first: %s)', sourceFirst => {
    const source = moduleWith('Nuclear', [recipe('steam-source', { outputs: [{ resourceId, quantity: 100 }] })])
    const target = moduleWith('Default', [
      recipe('local-steam', { outputs: [{ resourceId, quantity: 2 }] }),
      recipe('steam-use', { inputs: [{ resourceId, quantity: 10 }], outputs: [{ resourceId: 'hydrogen', quantity: 10 }] }),
    ])
    const modules = sourceFirst ? [source, target] : [target, source]
    const result = calculate(modules)
    const rows = getResourceSupplyRows(modules, result, resourceId)

    expect(rows.find(row => row.moduleId === target.id)).toMatchObject({ produced: 2, used: 2, exported: 0 })
    expect(rows.find(row => row.moduleId === source.id)).toMatchObject({ produced: 100, used: 0, balance: 100, exported: 0 })
  })

  it.each([
    { mode: 'surplus-only', sourcePooled: false, targetPooled: false },
    { mode: 'surplus-only', sourcePooled: true, targetPooled: false },
    { mode: 'surplus-only', sourcePooled: false, targetPooled: true },
    { mode: 'surplus-only', sourcePooled: true, targetPooled: true },
    { mode: 'produce-to-demand', sourcePooled: false, targetPooled: false },
    { mode: 'produce-to-demand', sourcePooled: true, targetPooled: false },
    { mode: 'produce-to-demand', sourcePooled: false, targetPooled: true },
    { mode: 'produce-to-demand', sourcePooled: true, targetPooled: true },
  ] as const)('delivers an explicitly linked supply (%j)', ({ mode, sourcePooled, targetPooled }) => {
    const source = moduleWith('Nuclear', [recipe('steam-source', { outputs: [{ resourceId, quantity: 6 }] })], sourcePooled)
    const target = moduleWith('Default', [recipe('steam-use', {
      balanceBy: 'output', inputs: [{ resourceId, quantity: 10 }], outputs: [{ resourceId: 'hydrogen', quantity: 10 }],
    })], targetPooled)

    target.presets[0]!.fixedDemands = { hydrogen: 10 }
    const modules = [source, target]
    const result = calculate(modules, [{
      id: 'steam-link', resourceId, mode,
      sourceModuleId: source.id, sourceModuleName: source.name,
      targetModuleId: target.id, targetModuleName: target.name,
    }])

    expect(result.linkedModulesResult.transfers[0]?.quantity).toBeCloseTo(6)
    expect(getResourceSupplyRows(modules, result, resourceId).find(row => row.moduleId === target.id))
      .toMatchObject({ used: 6, balance: 0, exported: 0 })
    expect(getResourceSupplyRows(modules, result, resourceId).find(row => row.moduleId === source.id))
      .toMatchObject({ exported: 6 })
    expect(result.linkedModulesResult.boundarySupplies[resourceId] ?? 0).toBe(0)
    if (sourcePooled && targetPooled) {
      expect(result.factoryResult.flows.find(flow => flow.resourceId === resourceId)?.produced).toBeCloseTo(6)
    }
  })
})

it.each([true, false])('credits a linked Steam delivery to the receiving cooling tower (pooled target: %s)', pooled => {
  const source = moduleWith('Nuclear', [recipe('steam-source', { outputs: [{ resourceId: 'steamDepleted', quantity: 6 }] })])
  const target = moduleWith('Default', [recipe('cooling', {
    group: 'sink', inputs: [{ resourceId: 'steamDepleted', quantity: 10 }], outputs: [{ resourceId: 'water', quantity: 8 }],
  })], pooled)
  const modules = [source, target]
  const result = calculate(modules, [{
    id: 'steam-link', resourceId: 'steamDepleted', mode: 'surplus-only',
    sourceModuleId: source.id, sourceModuleName: source.name,
    targetModuleId: target.id, targetModuleName: target.name,
  }])

  expect(result.linkedModulesResult.transfers[0]?.quantity).toBeCloseTo(6)
  expect(getResourceSupplyRows(modules, result, 'water').find(row => row.moduleId === target.id)?.produced).toBeCloseTo(4.8)
})

it('does not dispatch a turbine using another module’s Steam', () => {
  const source = moduleWith('Nuclear', [recipe('steam-source', { outputs: [{ resourceId: 'steamSuper', quantity: 96 }] })])
  const target = moduleWith('Default', [recipes.find(recipe => recipe.id === 'turbine-super')!])

  target.presets[0]!.electricityDispatchTargets = { 'fbr-turbines': 15 }
  const modules = [source, target]
  const result = calculate(modules)

  expect(result.factoryResult.calculation.regularResults.find(row => row.moduleId === target.id)?.supplyRatio).toBe(0)
})

it('starts a local Steam producer for a local production chain', () => {
  const localModule = moduleWith('Default', [
    recipe('boiler', { balanceBy: 'output', inputs: [{ resourceId: 'water', quantity: 10 }], outputs: [{ resourceId: 'steamHigh', quantity: 10 }] }),
    recipe('consumer', { balanceBy: 'output', inputs: [{ resourceId: 'steamHigh', quantity: 10 }], outputs: [{ resourceId: 'hydrogen', quantity: 10 }] }),
  ])

  localModule.presets[0]!.fixedDemands = { hydrogen: 10 }
  const result = calculate([localModule])

  expect(result.factoryResult.calculation.regularResults.find(row => row.recipe.id === 'consumer')?.supplyRatio).toBe(1)
  expect(getResourceSupplyRows([localModule], result, 'steamHigh')[0]).toMatchObject({ produced: 10, used: 10, exported: 0 })
})

it.each([
  { sourcePooled: false, targetPooled: false },
  { sourcePooled: true, targetPooled: false },
  { sourcePooled: false, targetPooled: true },
  { sourcePooled: true, targetPooled: true },
])('reserves an explicit Steam link before cooling the rest (%j)', ({ sourcePooled, targetPooled }) => {
  const source = moduleWith('Nuclear', [
    recipe('steam-source', { outputs: [{ resourceId: 'steamDepleted', quantity: 6 }] }),
    recipe('cooling', { group: 'sink', inputs: [{ resourceId: 'steamDepleted', quantity: 10 }], outputs: [{ resourceId: 'water', quantity: 8 }] }),
  ], sourcePooled)
  const target = moduleWith('Default', [recipe('steam-use', {
    balanceBy: 'output', inputs: [{ resourceId: 'steamDepleted', quantity: 4 }], outputs: [{ resourceId: 'hydrogen', quantity: 4 }],
  })], targetPooled)

  target.presets[0]!.fixedDemands = { hydrogen: 4 }
  const modules = [source, target]
  const result = calculate(modules, [{
    id: 'steam-link', resourceId: 'steamDepleted', mode: 'surplus-only',
    sourceModuleId: source.id, sourceModuleName: source.name,
    targetModuleId: target.id, targetModuleName: target.name,
  }])
  const rows = getResourceSupplyRows(modules, result, 'steamDepleted')

  expect(rows.find(row => row.moduleId === source.id)).toMatchObject({ produced: 6, used: 2, exported: 4, balance: 0 })
  expect(rows.find(row => row.moduleId === target.id)).toMatchObject({ used: 4, balance: 0 })
})

it('cools local Steam even when another module has an uncovered Steam demand', () => {
  const source = moduleWith('Nuclear', [
    recipe('steam-source', { outputs: [{ resourceId: 'steamDepleted', quantity: 6 }] }),
    recipe('cooling', { group: 'sink', inputs: [{ resourceId: 'steamDepleted', quantity: 10 }], outputs: [{ resourceId: 'water', quantity: 8 }] }),
  ])
  const target = moduleWith('Default', [recipe('steam-demand', { inputs: [{ resourceId: 'steamDepleted', quantity: 4 }] })])

  target.presets[0]!.fixed = ['steam-demand']
  const modules = [source, target]
  const result = calculate(modules)

  expect(getResourceSupplyRows(modules, result, 'steamDepleted').find(row => row.moduleId === source.id))
    .toMatchObject({ produced: 6, used: 6, exported: 0, balance: 0 })
  expect(result.factoryResult.calculation.allResourceFlows.find(flow => flow.resourceId === 'steamDepleted')?.net).toBe(-4)
})

it.each([true, false])('requires a named Steam link instead of a generic import request (pooled: %s)', pooled => {
  const target = moduleWith('Default', [recipe('steam-use', {
    balanceBy: 'output', inputs: [{ resourceId: 'steamSuper', quantity: 4 }], outputs: [{ resourceId: 'hydrogen', quantity: 4 }],
  })], pooled)

  target.presets[0]!.requestedImports = { steamSuper: 4 }
  target.presets[0]!.fixedDemands = { hydrogen: 4 }
  const result = calculate([target])
  const calculation = result.linkedModulesResult.moduleResults.get(target.id) ?? result.factoryResult.calculation

  expect(calculation.regularResults[0]?.supplyRatio).toBe(0)
})

it('keeps fixed Steam demand local instead of starting an unlinked boiler', () => {
  const source = moduleWith('Nuclear', [recipe('boiler', {
    balanceBy: 'output', inputs: [{ resourceId: 'water', quantity: 10 }], outputs: [{ resourceId: 'steamHigh', quantity: 10 }],
  })])
  const target = moduleWith('Default', [])

  target.presets[0]!.fixedDemands = { steamHigh: 4 }
  const result = calculate([source, target])

  expect(result.factoryResult.calculation.regularResults[0]?.supplyRatio).toBe(0)
  expect(result.factoryResult.calculation.allResourceFlows.find(flow => flow.resourceId === 'steamHigh')?.net).toBe(-4)
})

it('uses factory Sour Water while keeping the stripper’s Steam local', () => {
  const source = moduleWith('Refining', [recipe('sour-water-source', {
    outputs: [{ resourceId: 'sourWater', quantity: 36 }],
  })])
  const target = moduleWith('Chemistry', [
    recipe('steam-source', { outputs: [{ resourceId: 'steamHigh', quantity: 3 }] }),
    recipes.find(recipe => recipe.id === 'sour-water-stripper')!,
  ])
  const result = calculate([source, target])

  expect(result.factoryResult.calculation.regularResults.find(row => row.recipe.id === 'sour-water-stripper')?.supplyRatio).toBe(1)
  expect(getResourceSupplyRows([source, target], result, 'ammonia').find(row => row.moduleId === target.id)?.produced).toBe(9)
})

it('counts alternative Steam recipes against their shared building capacity once', () => {
  const localModule = moduleWith('Default', [
    ...['boiler-a', 'boiler-b'].map(id => recipe(id, {
      balanceBy: 'output', sharedCapacity: { id: 'boilers', priority: 0 },
      inputs: [{ resourceId: 'water', quantity: 100 }],
      outputs: [{ resourceId: 'steamLow', quantity: 100 }],
    })),
    recipe('consumer', {
      balanceBy: 'output', inputs: [{ resourceId: 'steamLow', quantity: 150 }],
      outputs: [{ resourceId: 'hydrogen', quantity: 150 }],
    }),
  ])

  localModule.presets[0]!.capacityPools = { boilers: { activeBuildings: 1, builtBuildings: 1 } }
  localModule.presets[0]!.fixedDemands = { hydrogen: 150 }
  const result = calculate([localModule])

  expect(getResourceSupplyRows([localModule], result, 'steamLow')[0]).toMatchObject({ produced: 100, used: 100 })
  expect(result.factoryResult.flows.find(flow => flow.resourceId === 'hydrogen')?.net).toBeCloseTo(-50)
})

it.each([true, false])('starts linked Steam production within one shared machine pool (pooled target: %s)', pooled => {
  const source = moduleWith('Boilers', [10, 20].map((quantity, priority) => recipe(`boiler-${priority}`, {
    balanceBy: 'output', sharedCapacity: { id: 'boilers', priority },
    inputs: [{ resourceId: 'water', quantity: 10 }],
    outputs: [{ resourceId: 'steamHigh', quantity }],
  })))

  source.presets[0]!.capacityPools = { boilers: { activeBuildings: 1, builtBuildings: 1 } }
  const target = moduleWith('Chemistry', [recipe('consumer', {
    balanceBy: 'output', inputs: [{ resourceId: 'steamHigh', quantity: 30 }],
    outputs: [{ resourceId: 'hydrogen', quantity: 30 }],
  })], pooled)

  target.presets[0]!.fixedDemands = { hydrogen: 30 }
  const result = calculate([source, target], [{
    id: 'steam', resourceId: 'steamHigh', mode: 'produce-to-demand',
    sourceModuleId: source.id, sourceModuleName: source.name,
    targetModuleId: target.id, targetModuleName: target.name,
  }])

  expect(result.linkedModulesResult.transfers[0]?.quantity).toBeCloseTo(10)
  const rows = getResourceSupplyRows([source, target], result, 'steamHigh')

  expect(rows.find(row => row.moduleId === source.id)).toMatchObject({ produced: 10, exported: 10 })
  expect(rows.find(row => row.moduleId === target.id)?.used).toBeCloseTo(10)
})

it('sizes a pooled target’s link against factory demand and its own Steam production', () => {
  const source = moduleWith('Boiler', [recipe('steam-source', {
    group: 'source', sourceMode: 'module-demand-capped', outputs: [{ resourceId: 'steamHigh', quantity: 10 }],
  })])
  const target = moduleWith('Chemistry', [
    recipe('local-steam', { outputs: [{ resourceId: 'steamHigh', quantity: 2 }] }),
    recipe('consumer', {
      balanceBy: 'output', inputs: [{ resourceId: 'steamHigh', quantity: 10 }],
      outputs: [{ resourceId: 'hydrogen', quantity: 10 }],
    }),
  ])
  const demand = moduleWith('Factory demand', [])

  demand.presets[0]!.fixedDemands = { hydrogen: 6 }
  const result = calculate([source, target, demand], [{
    id: 'steam', resourceId: 'steamHigh', mode: 'produce-to-demand',
    sourceModuleId: source.id, sourceModuleName: source.name,
    targetModuleId: target.id, targetModuleName: target.name,
  }])

  expect(result.linkedModulesResult.transfers[0]?.quantity).toBeCloseTo(4)
  expect(result.factoryResult.flows.find(flow => flow.resourceId === 'hydrogen')).toMatchObject({ produced: 6, consumed: 6 })
  expect(getResourceSupplyRows([source, target, demand], result, 'steamHigh')
    .find(row => row.moduleId === target.id)).toMatchObject({ produced: 2, used: 6, balance: 0 })
})
