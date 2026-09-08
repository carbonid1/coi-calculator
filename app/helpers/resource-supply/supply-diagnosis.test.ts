import { describe, expect, it } from 'vitest'

import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Module, type Preset } from '../../db/modules/modules'
import { type Recipe } from '../../db/recipes'
import { type ResourceId, resources } from '../../db/resources'
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
    contractsProfitMultiplier: 1, outputModifiers: {}, recyclingEfficiencyPercent: 0, shipsFuelUseMultiplier: 1 })

  Object.assign(calculation.factoryResult.calculation, { regularResults: lines, allResourceFlows: flows, blockedRoutes })
  return { calculation, inspector: createSupplyInspector([], calculation) }
}
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
    contractsProfitMultiplier: 1, outputModifiers: {}, recyclingEfficiencyPercent: 0, shipsFuelUseMultiplier: 1 })

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
  it.each([false, true])('includes planned imports in a balanced local ledger (isolated: %s)', isolated => {
    const food = liveModule('food', [packingRecipe], {
      requestedImports: { water: 5 }, fixedDemands: { foodPack: 5 },
    }, isolated)
    const { inspector } = calculate([food])

    expect(inspector.getFlow({ resourceId: 'water', moduleId: 'food' })).toMatchObject({ produced: 5, consumed: 5, net: 0 })
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
  })
})
