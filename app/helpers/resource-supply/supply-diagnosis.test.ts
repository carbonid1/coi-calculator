import { describe, expect, it } from 'vitest'

import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Module, type Preset } from '../../db/modules/modules'
import { type Recipe } from '../../db/recipes'
import { type ResourceId, resources } from '../../db/resources'
import { runtimeRecipeBehaviors } from '../../db/runtime-recipe-behaviors'
import { type RegularResult, type BlockedSurplusRoute, type ResourceFlow } from '../calculate/calculate'
import { calculateFactoryCalculation } from '../factory-calculation/factory-calculation'
import { createSupplyInspector } from './supply-diagnosis'

const line = (id: string, inputs: ResourceId[], output: ResourceId, overrides: Partial<Recipe> = {}, ratio = 0.5): RegularResult => ({
  recipe: { id, name: id, building: 'Test building', group: 'production', balanceBy: 'output',
    inputs: inputs.map(resourceId => ({ resourceId, quantity: 10 })),
    outputs: [{ resourceId: output, quantity: 10 }], ...overrides },
  moduleId: 'food', activeBuildings: 1, builtBuildings: 1, operatingMode: 'balanced', speedLevel: 1,
  supplyRatio: ratio, actualInputs: inputs.map(resourceId => ({ resourceId, quantity: 10 * ratio })),
  actualOutputs: [{ resourceId: output, quantity: 10 * ratio }], recyclableSourceValueProduced: 0,
})
const flow = (resourceId: ResourceId, produced: number, consumed = produced): ResourceFlow => ({
  resourceId, name: resources[resourceId].name, produced, consumed, net: produced - consumed,
})
const setup = (lines: RegularResult[], flows: ResourceFlow[], blockedRoutes: BlockedSurplusRoute[] = []) => {
  const calculation = calculateFactoryCalculation({ modules: [], links: [], contracts: [],
    contractsProfitMultiplier: 1, outputModifiers: {}, recyclingEfficiencyPercent: 0, })

  Object.assign(calculation.factoryResult.calculation, { regularResults: lines, allResourceFlows: flows, blockedRoutes })
  return { calculation, inspector: createSupplyInspector([], calculation) }
}

it('carries the same settled input and output amounts into supply and demand recipes', () => {
  const scrubber = line('ExhaustScrubbing', ['exhaust'], 'sulfur', {
    outputs: [{ resourceId: 'sulfur', quantity: 10 }, { resourceId: 'steamLow', quantity: 5 }],
  });

  scrubber.actualInputs = [{ resourceId: 'exhaust', quantity: 86.44 }];
  scrubber.actualOutputs = [{ resourceId: 'sulfur', quantity: 17.288 }, { resourceId: 'steamLow', quantity: 8.644 }];
  const { inspector } = setup([scrubber], [flow('exhaust', 86.44), flow('sulfur', 17.288, 0)]);

  for (const recipe of [inspector.getProducers({ resourceId: 'sulfur' })[0]?.recipe, inspector.getUses({ resourceId: 'exhaust' })[0]?.recipe]) {
    expect(recipe?.amounts).toEqual({ inputs: scrubber.actualInputs, outputs: scrubber.actualOutputs });
  }
});
const liveModule = (id: string, recipes: Recipe[], preset: Partial<Preset> = {}, isolated = false): Module => ({
  id, name: id, description: '', recipes, includedInFactoryTotals: !isolated,
  builtBuildings: Object.fromEntries(recipes.map(recipe => [recipe.id, 1])),
  defaultPresetId: 'live',
  presets: [{ id: 'live', name: 'Live', description: '', activeBuildings: {}, fixed: [], ...preset }],
  liveArea: { zoneId: id === 'source' ? 1 : 2, trackedBuildings: 1, constructedBuildings: 1,
    activeBuildings: 1, pausedBuildings: 0, constructionGhosts: 0, issues: [] },
})
const calculate = (modules: Module[], links: ModuleResourceLink[] = []) => {
  const calculation = calculateFactoryCalculation({ modules, links, contracts: [],
    contractsProfitMultiplier: 1, outputModifiers: {}, recyclingEfficiencyPercent: 0, })

  return { calculation, inspector: createSupplyInspector(modules, calculation) }
}
const waterDelivery: ModuleResourceLink = {
  id: 'water-delivery', resourceId: 'water', mode: 'produce-to-demand',
  sourceModuleId: 'source', sourceModuleName: 'source', targetModuleId: 'food', targetModuleName: 'food',
}
const packingRecipe = line('Packing', ['water'], 'foodPack', {
  balanceInputIds: ['water'], moduleInputIds: ['water'],
}).recipe

describe('supply diagnosis', () => {
  it.each([
    ['primary', 'resource'], ['primary', 'recipe'], ['fallback', 'resource'], ['fallback', 'recipe'],
  ] as const)('identifies a targeted %s recipe before ordinary production (%s target)', (allocation, targetKind) => {
    const primary = line('Meat', ['chickenCarcass'], 'meat').recipe
    const targeted = line('Trimmings', ['chickenCarcass'], 'meatTrimmings', {
      allocation, demandPriority: -1, consumeSurplusInputIds: ['chickenCarcass'],
      surplusConsumptionPhase: 'before-disposal',
    }).recipe
    const food = liveModule('food', [primary, targeted], {
      fixedDemands: { meat: 10 },
      ...(targetKind === 'resource' ? { outputTargets: { meatTrimmings: 5 } }
        : { recipeOutputTargets: { Trimmings: { meatTrimmings: 5 } } }),
    })
    const calculation = calculateFactoryCalculation({ modules: [food], links: [], contracts: [],
      contractsProfitMultiplier: 1, outputModifiers: {}, recyclingEfficiencyPercent: 0,
      externalSupplies: { chickenCarcass: 5 } })
    const inspector = createSupplyInspector([food], calculation)
    const uses = inspector.getUses({ resourceId: 'chickenCarcass' }, true)

    expect(uses.find(use => use.key === 'food:Trimmings')?.quantity).toBeCloseTo(5)
    expect(uses.find(use => use.key === 'food:Meat')?.quantity).toBe(0)
    expect(uses.find(use => use.key === 'food:Trimmings')?.priorities?.map(note => note.label)).toEqual(['Output target'])
    expect(uses.find(use => use.key === 'food:Meat')?.priorities?.map(note => note.label)).toEqual(['Follows demand'])
    expect(inspector.getProducers({ resourceId: 'meatTrimmings' })[0]?.priorities.map(note => note.label)).toEqual(['Output target'])
  })

  it('distinguishes useful recovery from terminal disposal in the settled allocation', () => {
    const source = line('Steam', [], 'steamDepleted').recipe
    const recovery = line('Cooling', ['steamDepleted'], 'water', {
      group: 'sink', sinkPriority: 0,
      inputs: [{ resourceId: 'steamDepleted', quantity: 4 }], outputs: [{ resourceId: 'water', quantity: 3 }],
    }).recipe
    const disposal = { ...recovery, id: 'Disposal', name: 'Disposal', sinkPriority: 1,
      inputs: [{ resourceId: 'steamDepleted' as const, quantity: 10 }], outputs: [] }
    const { inspector } = calculate([liveModule('food', [source, recovery, disposal], { fixed: ['Steam'] })])
    const uses = inspector.getUses({ resourceId: 'steamDepleted' }, true)

    expect(uses.find(use => use.key === 'food:Cooling')?.quantity).toBeCloseTo(4)
    expect(uses.find(use => use.key === 'food:Cooling')?.inputTargets).toEqual([
      { resourceId: 'steamDepleted', moduleId: 'food' },
    ])
    expect(uses.find(use => use.key === 'food:Disposal')?.quantity).toBeCloseTo(6)
    expect(uses.find(use => use.key === 'food:Cooling')?.priorities?.map(note => note.label)).toEqual(['Recovery', 'Excess input priority 1'])
    expect(uses.find(use => use.key === 'food:Disposal')?.priorities?.map(note => note.label)).toEqual(['Disposal', 'Excess input priority 2'])
    expect(inspector.getProducers({ resourceId: 'water' })[0]).toMatchObject({ produced: 3, priorities: [{ label: 'Recovery' }] })
  })

  it('distinguishes carcass demand priority from extra production, regardless of amount used', () => {
    const meat = line('Meat', ['chickenCarcass', 'water', 'salt'], 'meat', runtimeRecipeBehaviors['FoodProcessor:MeatProcessing'], 0.2)
    const trimmings = line('Trimmings', ['chickenCarcass'], 'meatTrimmings', runtimeRecipeBehaviors['FoodProcessor:MeatProcessingTrimmings'], 0.8)
    const { inspector } = setup([trimmings, meat], [flow('chickenCarcass', 10)])
    const uses = inspector.getUses({ resourceId: 'chickenCarcass' })

    expect(uses.map(use => use.quantity)).toEqual([8, 2])
    expect(uses[0]?.priorities?.map(note => note.label)).toEqual(['Demand priority 2', 'Extra after fallbacks'])
    expect(uses[1]?.priorities?.map(note => note.label)).toEqual(['Demand priority 1', 'Extra before fallbacks'])
    expect(uses[1]?.priorities?.[1]?.detail).toContain('Meat must have downstream use')
    // Supporting reagents do not become surplus-driving inputs.
    expect(inspector.getUses({ resourceId: 'salt' })[0]?.priorities?.map(note => note.label)).toEqual(['Follows demand'])
  })

  it('can expose a zero-use preferred recipe without changing demand totals', () => {
    const preferred = line('Meat', ['chickenCarcass'], 'meat', {}, 0)
    const later = line('Trimmings', ['chickenCarcass'], 'meatTrimmings', { demandPriority: 1 })
    const { inspector } = setup([preferred, later], [flow('chickenCarcass', 5)])
    const target = { resourceId: 'chickenCarcass' } as const

    expect(inspector.getUses(target)).toHaveLength(1)
    const uses = inspector.getUses(target, true)

    expect(uses).toHaveLength(2)
    expect(uses.find(use => use.quantity === 0)?.priorities?.[0]?.label).toBe('Demand priority 1')
    expect(uses.reduce((sum, use) => sum + use.quantity, 0)).toBe(inspector.getFlow(target).consumed)
  })

  it('does not rank competing recipes across separate local input supplies', () => {
    const preferred = line('Meat', ['chickenCarcass'], 'meat', { moduleInputIds: ['chickenCarcass'] })
    const later = { ...line('Trimmings', ['chickenCarcass'], 'meatTrimmings', { demandPriority: 1, moduleInputIds: ['chickenCarcass'] }), moduleId: 'other' }
    const { inspector } = setup([preferred, later], [flow('chickenCarcass', 10)])

    expect(inspector.getUses({ resourceId: 'chickenCarcass' }).map(use => use.priorities?.[0]?.label)).toEqual(['Follows demand', 'Follows demand'])
  })

  it('keeps fixed and paused recipes out of ordinary demand priorities', () => {
    const fixed = { ...line('Fixed', ['water'], 'meat', { demandPriority: -1 }), operatingMode: 'fixed' as const }
    const paused = { ...line('Paused', ['water'], 'meat', { demandPriority: -2 }, 0), activeBuildings: 0 }
    const ordinary = line('Ordinary', ['water'], 'meat')
    const { inspector } = setup([fixed, paused, ordinary], [flow('water', 10)])
    const uses = inspector.getUses({ resourceId: 'water' }, true)

    expect(uses.find(use => use.key === 'food:Fixed')?.priorities?.map(note => note.label)).toEqual(['Fixed production'])
    expect(uses.find(use => use.key === 'food:Paused')?.priorities?.map(note => note.label)).toEqual(['Paused'])
    expect(uses.find(use => use.key === 'food:Ordinary')?.priorities?.map(note => note.label)).toEqual(['Follows demand'])
  })

  it('shows shared-machine preferences only among recipes on the same machines', () => {
    const preferred = { ...line('Egg packs', ['bread', 'eggs'], 'foodPack', { allocation: 'fallback', sharedCapacity: { id: 'packing', priority: 1 } }), capacityPoolId: 'food:packing' }
    const later = { ...line('Meat packs', ['bread', 'meat'], 'foodPack', { allocation: 'fallback', sharedCapacity: { id: 'packing', priority: 2 } }), capacityPoolId: 'food:packing' }
    const separate = { ...preferred, moduleId: 'other', capacityPoolId: 'other:packing' }
    const { inspector } = setup([later, preferred, separate], [flow('foodPack', 15)])
    const producers = inspector.getProducers({ resourceId: 'foodPack' })

    expect(producers[0]?.priorities.map(note => note.label)).toEqual(['After primary production', 'Shared machine priority 2'])
    expect(producers[1]?.priorities.map(note => note.label)).toEqual(['After primary production', 'Shared machine priority 1'])
    expect(producers[2]?.priorities.map(note => note.label)).toEqual(['After primary production'])
  })

  it('keeps equal demand preferences tied and separates module processing preference', () => {
    const first = line('First', ['water'], 'meat', {}, 0.1)
    const equal = line('Equal', ['water'], 'bread', {}, 0.6)
    const later = line('Later', ['water'], 'meatTrimmings', { demandPriority: 10 }, 0.3)
    const { calculation } = setup([first, equal, later], [flow('water', 10)])
    const area = liveModule('food', [first.recipe, equal.recipe, later.recipe], {
      resourceProcessingPriorities: { water: 'local-first' },
    })
    const inspector = createSupplyInspector([area], calculation)
    const uses = inspector.getUses({ resourceId: 'water' })

    expect(uses.map(use => use.priorities?.[0]?.label)).toEqual(['Demand priority 1', 'Demand priority 2', 'Demand priority 1'])
    expect(uses.every(use => use.priorities?.some(note => note.label === 'Local supply first'))).toBe(true)
  })

  it('keeps demand outside recipes attributed to each module, even when names match', () => {
    const food = liveModule('food', [], { fixedDemands: { water: 2 } })
    const housing = liveModule('housing', [], { fixedDemands: { water: 3 } })

    food.name = housing.name = 'Area'
    const { inspector } = calculate([food, housing])
    const uses = inspector.getUses({ resourceId: 'water' })

    expect(uses).toEqual([
      expect.objectContaining({ moduleId: 'housing', moduleName: 'Area', name: 'Demand outside recipes', quantity: 3 }),
      expect.objectContaining({ moduleId: 'food', moduleName: 'Area', name: 'Demand outside recipes', quantity: 2 }),
    ])
    expect(uses.reduce((sum, use) => sum + use.quantity, 0)).toBe(inspector.getFlow({ resourceId: 'water' }).consumed)
    expect(inspector.getUses({ resourceId: 'water', moduleId: 'food' })).toEqual([
      expect.objectContaining({ moduleId: 'food', quantity: 2 }),
    ])
  })

  it('attributes isolated factory demand once while retaining the local recipe breakdown', () => {
    const food = liveModule('food', [packingRecipe], { requestedImports: { water: 5 }, fixedDemands: { foodPack: 5 } }, true)
    const { inspector } = calculate([food])
    const uses = inspector.getUses({ resourceId: 'water' })

    expect(uses).toEqual([expect.objectContaining({ moduleId: 'food', name: 'Factory supply', quantity: 5 })])
    expect(inspector.getUses({ resourceId: 'water', moduleId: 'food' })).toEqual([
      expect.objectContaining({ moduleId: 'food', name: 'Food Pack', recipeName: 'Packing', quantity: 5 }),
    ])
  })

  it.each([false, true])('includes planned imports in a balanced local ledger (isolated: %s)', isolated => {
    const food = liveModule('food', [packingRecipe], {
      requestedImports: { water: 5 }, fixedDemands: { foodPack: 5 },
    }, isolated)
    const { inspector } = calculate([food])

    expect(inspector.getFlow({ resourceId: 'water', moduleId: 'food' })).toMatchObject({ produced: 5, consumed: 5, net: 0 })
    expect(inspector.getModuleSupplies({ resourceId: 'water', moduleId: 'food' })).toEqual([
      { moduleId: 'food', moduleName: 'food', name: 'Planned imports', quantity: 5 },
    ])
    expect(inspector.getModuleSupplies({ resourceId: 'water' })).toHaveLength(isolated ? 0 : 1)
    expect(inspector.getProducers({ resourceId: 'foodPack', moduleId: 'food' })[0]?.limits)
      .toEqual([{ target: { resourceId: 'water', moduleId: 'food' }, kind: 'exhausted' }])
  })

  it('uses the same preset fallback and connection-only import rules as the calculation', () => {
    const food = liveModule('food', [packingRecipe], {
      requestedImports: { water: 5, steamHigh: 5 }, fixedDemands: { foodPack: 5 },
    })

    food.defaultPresetId = 'missing'
    const { inspector } = calculate([food])

    expect(inspector.getFlow({ resourceId: 'water', moduleId: 'food' }).produced).toBe(5)
    expect(inspector.getFlow({ resourceId: 'steamHigh', moduleId: 'food' }).produced).toBe(0)
    expect(inspector.getModuleSupplies({ resourceId: 'steamHigh' })).toEqual([])
  })

  it.each([false, true])('traces a partial delivery to source capacity and keeps its unmet demand (isolated: %s)', isolated => {
    const sourceRecipe = line('Water', [], 'water', { outputs: [{ resourceId: 'water', quantity: 5 }] }).recipe
    const source = liveModule('source', [sourceRecipe], {}, isolated)
    const food = liveModule('food', [packingRecipe], { fixedDemands: { foodPack: 10 } }, isolated)
    const { calculation, inspector } = calculate([source, food], [waterDelivery])
    const limit = inspector.getProducers({ resourceId: 'foodPack', moduleId: 'food' })[0]!.limits[0]!

    expect(calculation.linkedModulesResult.transfers[0]).toMatchObject({ quantity: 5, requestedQuantity: 10 })
    expect(inspector.getFlow({ resourceId: 'water', moduleId: 'food' })).toMatchObject({ produced: 5, consumed: 5, net: 0 })
    expect(inspector.trace(limit)).toEqual([{
      path: [{ resourceId: 'water', moduleId: 'food' }, { resourceId: 'water', moduleId: 'source' }], kind: 'capacity',
    }])
    expect(inspector.getFlow({ resourceId: 'water', moduleId: 'source' })).toMatchObject({ produced: 5, consumed: 10, net: -5 })
  })

  it('counts imports and actual incoming deliveries once each', () => {
    const sourceRecipe = line('Water', [], 'water', { outputs: [{ resourceId: 'water', quantity: 5 }] }).recipe
    const source = liveModule('source', [sourceRecipe])
    const food = liveModule('food', [packingRecipe], { requestedImports: { water: 2 }, fixedDemands: { foodPack: 10 } })
    const { calculation, inspector } = calculate([source, food], [waterDelivery])
    const delivered = calculation.linkedModulesResult.transfers[0]!.quantity

    expect(delivered).toBeGreaterThan(0)
    expect(inspector.getFlow({ resourceId: 'water', moduleId: 'food' }).produced).toBeCloseTo(2 + delivered)
  })

  it('follows a requested delivery even when a paused source delivers nothing', () => {
    const source = liveModule('source', [line('Water', [], 'water').recipe], { activeBuildings: { Water: 0 } })
    const food = liveModule('food', [packingRecipe], { fixedDemands: { foodPack: 10 } })
    const { calculation, inspector } = calculate([source, food], [waterDelivery])

    expect(calculation.linkedModulesResult.transfers[0]).toMatchObject({ quantity: 0, requestedQuantity: 10 })
    const limit = inspector.getProducers({ resourceId: 'foodPack', moduleId: 'food' })[0]!.limits[0]!

    expect(inspector.trace(limit)).toEqual([{
      path: [{ resourceId: 'water', moduleId: 'food' }, { resourceId: 'water', moduleId: 'source' }], kind: 'paused',
    }])
  })

  it('continues through a delivery source to its limiting input', () => {
    const sourceRecipe = line('Water', ['coal'], 'water', { balanceInputIds: ['coal'], moduleInputIds: ['coal'] }).recipe
    const source = liveModule('source', [sourceRecipe], { requestedImports: { coal: 5 } })
    const food = liveModule('food', [packingRecipe], { fixedDemands: { foodPack: 10 } })
    const { inspector } = calculate([source, food], [waterDelivery])
    const limit = inspector.getProducers({ resourceId: 'foodPack', moduleId: 'food' })[0]!.limits[0]!

    expect(inspector.trace(limit)).toEqual([{
      path: [{ resourceId: 'water', moduleId: 'food' }, { resourceId: 'water', moduleId: 'source' },
        { resourceId: 'coal', moduleId: 'source' }], kind: 'exhausted',
    }])
  })

  it('terminates cycles across dedicated deliveries', () => {
    const { calculation } = setup([], [])

    calculation.linkedModulesResult.transfers = [
      { ...waterDelivery, quantity: 0, requestedQuantity: 10 },
      { ...waterDelivery, id: 'return', sourceModuleId: 'food', targetModuleId: 'source', quantity: 0, requestedQuantity: 10 },
    ]
    const inspector = createSupplyInspector([], calculation)

    expect(inspector.trace({ target: { resourceId: 'water', moduleId: 'food' }, kind: 'exhausted' })).toEqual([{
      path: [{ resourceId: 'water', moduleId: 'food' }, { resourceId: 'water', moduleId: 'source' },
        { resourceId: 'water', moduleId: 'food' }], kind: 'cycle',
    }])
  })

  it.each([false, true])('preserves export demand rules in the local ledger (isolated: %s)', isolated => {
    const source = liveModule('source', [line('Water', [], 'water').recipe], {
      fixedDemands: { water: 2 }, requestedExports: { water: 3 },
    }, isolated)
    const { inspector } = calculate([source])

    expect(inspector.getFlow({ resourceId: 'water', moduleId: 'source' }).consumed).toBe(isolated ? 5 : 2)
  })

  it('follows exhausted Meat to the recorded Salt blocker even when Meat and Bread are balanced', () => {
    const meat = line('Meat', ['chickenCarcass', 'salt', 'water'], 'meat', { consumeSurplusInputIds: ['chickenCarcass'] })
    const packing = line('Packing', ['meat', 'bread'], 'foodPack', { balanceInputIds: ['meat'] }, 0)
    const { inspector } = setup([packing, meat], [flow('meat', 5), flow('bread', 10), flow('salt', 2, 3)], [{
      recipe: meat.recipe, moduleId: meat.moduleId, activeBuildings: 1, surplusResourceIds: ['chickenCarcass'],
      wantedRatio: 0.7, appliedRatio: 0.5, blockedBy: { resourceId: 'salt', deficitIncrease: 0.8 },
    }])
    const producer = inspector.getProducers({ resourceId: 'foodPack' })[0]!

    expect(producer.limits).toEqual([{ target: { resourceId: 'meat' }, kind: 'exhausted' }])
    expect(inspector.trace(producer.limits[0]!)).toEqual([{
      path: [{ resourceId: 'meat' }, { resourceId: 'salt' }], kind: 'blocked-increase', additionalQuantity: 0.8,
    }])
    expect(inspector.getFlow({ resourceId: 'salt' }).net).toBe(-1)
  })

  it('preserves all recorded supporting blockers', () => {
    const meat = line('Meat', ['chickenCarcass', 'salt', 'water'], 'meat')
    const { inspector } = setup([meat], [], [{
      recipe: meat.recipe, moduleId: meat.moduleId, activeBuildings: 1, surplusResourceIds: ['chickenCarcass'],
      wantedRatio: 0.7, appliedRatio: 0.5, blockedBy: { resourceId: 'salt', deficitIncrease: 0.8 },
      blockingResources: [{ resourceId: 'salt', deficitIncrease: 0.8 }, { resourceId: 'water', deficitIncrease: 0.2 }],
    }])

    expect(inspector.getProducers({ resourceId: 'meat' })[0]?.limits.map(limit => limit.target.resourceId))
      .toEqual(['salt', 'water'])
  })

  it('counts sibling recipes against shared capacity instead of blaming their balanced inputs', () => {
    const eggs = { ...line('Egg packing', ['eggs'], 'foodPack', { balanceInputIds: ['eggs'] }), capacityPoolId: 'packing' }
    const meat = { ...line('Meat packing', ['meat'], 'foodPack', { balanceInputIds: ['meat'] }), capacityPoolId: 'packing' }
    const { inspector } = setup([eggs, meat], [flow('eggs', 5), flow('meat', 5)])

    expect(inspector.getProducers({ resourceId: 'foodPack' }).map(producer => [producer.status, producer.poolUtilization, producer.limits]))
      .toEqual([['capacity', 1, []], ['capacity', 1, []]])
    expect(new Set(inspector.getProducers({ resourceId: 'foodPack' }).map(producer => producer.capacityPoolKey)).size).toBe(1)
  })

  it('does not blame an on-demand input merely because its balance is zero', () => {
    const { inspector } = setup([line('Packing', ['bread'], 'foodPack')], [flow('bread', 5)])

    expect(inspector.getProducers({ resourceId: 'foodPack' })[0]).toMatchObject({ status: 'unexplained', limits: [] })
  })

  it('keeps module feedstock separate from an unrelated factory surplus', () => {
    const steel = line('Steel', ['moltenIron'], 'moltenSteel', { balanceInputIds: ['moltenIron'], moduleInputIds: ['moltenIron'] })
    const foreign = { ...line('Iron', [], 'moltenIron', {}, 1), moduleId: 'other' }
    const { inspector } = setup([steel, foreign], [flow('moltenIron', 100, 5)])
    const limit = inspector.getProducers({ resourceId: 'moltenSteel' })[0]?.limits[0]

    expect(limit).toEqual({ target: { resourceId: 'moltenIron', moduleId: 'food' }, kind: 'shortage' })
    expect(inspector.getProducers(limit!.target)).toEqual([])
  })

  it('terminates recycling cycles and keeps their inspection targets', () => {
    const { inspector } = setup([
      line('Water recovery', ['steamDepleted'], 'water', { balanceInputIds: ['steamDepleted'] }, 0),
      line('Steam', ['water'], 'steamDepleted', { balanceInputIds: ['water'], moduleInputIds: ['water'] }, 0),
    ], [])
    const trace = inspector.trace({ target: { resourceId: 'water', moduleId: 'food' }, kind: 'exhausted' })

    expect(trace[0]?.kind).toBe('cycle')
    expect(trace[0]?.path).toHaveLength(3)
  })

  it('does not blame one alternative when other upstream production follows another product', () => {
    const { inspector } = setup([
      line('Scrap', ['copperScrap'], 'exhaust', { balanceInputIds: ['copperScrap'] }),
      line('Smelting', ['copperOre'], 'exhaust', { balanceOutputIds: ['moltenCopper'] }),
    ], [flow('exhaust', 10), flow('copperScrap', 5)])

    expect(inspector.trace({ target: { resourceId: 'exhaust' }, kind: 'exhausted' }))
      .toEqual([{ path: [{ resourceId: 'exhaust' }], kind: 'exhausted' }])
  })

  it('retains factory access for ordinary inputs when inspecting a local output', () => {
    const { inspector } = setup([
      line('Steam', ['water'], 'steamDepleted', { balanceInputIds: ['water'] }),
    ], [flow('water', 100, 5)])

    expect(inspector.getProducers({ resourceId: 'steamDepleted', moduleId: 'food' })[0]?.inputs)
      .toEqual([{ target: { resourceId: 'water' }, quantity: 5 }])
    expect(inspector.getProducers({ resourceId: 'steamDepleted', moduleId: 'food' })[0]?.limits).toEqual([])
  })

  it('accounts for contract demand alongside recipe use without double counting it', () => {
    const { calculation } = setup([line('Crew Supplies', ['foodPack'], 'crewSupplies', {}, 0.06)], [flow('foodPack', 26, 31.17)])

    calculation.factoryResult.contractFlows = [{ contractId: 'uranium', contractName: 'Food Pack → Uranium Ore',
      routeId: 'route', routeName: 'Cargo depot', demandBalanced: true, kind: 'export',
      resourceId: 'foodPack', quantity: 30.57, requestedQuantity: 30.57 }]
    const uses = createSupplyInspector([], calculation).getUses({ resourceId: 'foodPack' })

    expect(uses).toHaveLength(2)
    expect(uses.reduce((sum, use) => sum + use.quantity, 0)).toBeCloseTo(31.17)
    expect(uses.find(use => !use.contractId)?.name).toBe('Crew Supplies')
  })

  it('combines contract routes while keeping export and fuel demand distinct', () => {
    const { calculation } = setup([], [flow('hydrogen', 18, 18)])
    const base = { contractId: 'water', contractName: 'Hydrogen → Water', demandBalanced: true, resourceId: 'hydrogen' as const }

    calculation.factoryResult.contractFlows = [
      { ...base, routeId: 'a', routeName: 'A', kind: 'export', quantity: 5, requestedQuantity: 5 },
      { ...base, routeId: 'b', routeName: 'B', kind: 'export', quantity: 10, requestedQuantity: 10 },
      { ...base, routeId: 'a', routeName: 'A', kind: 'fuel', quantity: 1, requestedQuantity: 1 },
      { ...base, routeId: 'b', routeName: 'B', kind: 'fuel', quantity: 2, requestedQuantity: 2 },
    ]
    const uses = createSupplyInspector([], calculation).getUses({ resourceId: 'hydrogen' })

    expect(uses).toHaveLength(2)
    expect(uses).toEqual([
      expect.objectContaining({ contractId: 'water', moduleName: 'Contract export', quantity: 15 }),
      expect.objectContaining({ contractId: 'water', moduleName: 'Ship fuel', quantity: 3 }),
    ])
  })
})
