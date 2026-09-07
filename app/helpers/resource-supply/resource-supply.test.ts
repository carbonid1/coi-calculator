import { describe, expect, it } from 'vitest'

import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Module } from '../../db/modules/modules'
import { type Recipe } from '../../db/recipes'
import { calculateFactoryCalculation } from '../factory-calculation/factory-calculation'
import { getResourceSupplyAccess, getResourceSupplyRows } from './resource-supply'

const moduleWith = (id: string, recipes: Recipe[], isolated = false): Module => ({
  id, name: id, description: '', recipes,
  includedInFactoryTotals: !isolated,
  builtBuildings: Object.fromEntries(recipes.map(recipe => [recipe.id, 1])),
  defaultPresetId: 'test',
  presets: [{
    id: 'test', name: '', description: '', activeBuildings: {},
    fixed: recipes.filter(recipe => recipe.group === 'production').map(recipe => recipe.id),
  }],
  ...(isolated ? { liveArea: {
    zoneId: 1, trackedBuildings: 1, constructedBuildings: 1, activeBuildings: 1,
    pausedBuildings: 0, constructionGhosts: 0, issues: [],
  } } : {}),
})
const recipe = (id: string, overrides: Partial<Recipe>): Recipe => ({
  id, name: id, building: 'Test plant', group: 'production', inputs: [], outputs: [], ...overrides,
})
const calculate = (modules: Module[], links: ModuleResourceLink[] = []) => calculateFactoryCalculation({
  modules, links, contracts: [], contractsProfitMultiplier: 1, outputModifiers: {},
  recyclingEfficiencyPercent: 100, shipsFuelUseMultiplier: 1,
})

describe('resource supply provenance', () => {
  it('attributes CO2 use to Ethanol and Graphite without raw recipe identifiers', () => {
    const modules = [moduleWith('Chemicals', [
      recipe('co2-source', { outputs: [{ resourceId: 'carbonDioxide', quantity: 100 }] }),
      recipe('EthanolCookingOilReforming', {
        inputs: [{ resourceId: 'carbonDioxide', quantity: 60 }],
        outputs: [{ resourceId: 'ethanol', quantity: 10 }],
      }),
      recipe('GraphiteProductionCo2', {
        inputs: [{ resourceId: 'carbonDioxide', quantity: 20 }],
        outputs: [{ resourceId: 'graphite', quantity: 2 }],
      }),
      recipe('vent', { group: 'sink', inputs: [{ resourceId: 'carbonDioxide', quantity: 100 }] }),
    ])]
    const [row] = getResourceSupplyRows(modules, calculate(modules), 'carbonDioxide')

    expect(row).toMatchObject({ produced: 100, used: 80, disposed: 20, balance: 0 })
    expect(row?.uses).toEqual([{ name: 'Ethanol', quantity: 60 }, { name: 'Graphite', quantity: 20 }])
  })

  it('counts recovered water as production and terminal dumping as disposal', () => {
    const modules = [moduleWith('Nuclear', [
      recipe('steam', { outputs: [{ resourceId: 'steamDepleted', quantity: 10 }] }),
      recipe('recover', {
        group: 'sink', inputs: [{ resourceId: 'steamDepleted', quantity: 10 }],
        outputs: [{ resourceId: 'water', quantity: 8 }],
      }),
      recipe('dump', { group: 'sink', inputs: [{ resourceId: 'water', quantity: 100 }] }),
    ])]
    const calculation = calculate(modules)

    expect(getResourceSupplyRows(modules, calculation, 'water')[0]).toMatchObject({ produced: 8, used: 0, disposed: 8 })
    expect(getResourceSupplyRows(modules, calculation, 'steamDepleted')[0]).toMatchObject({
      used: 10, disposed: 0, uses: [{ name: 'Water', quantity: 10 }],
    })
  })

  it('keeps dedicated quantities out of factory supply and counts each module once', () => {
    const source = moduleWith('Source', [recipe('water', {
      outputs: [{ resourceId: 'water', quantity: 10 }],
    })], true)
    const target = moduleWith('Food', [recipe('food', {
      inputs: [{ resourceId: 'water', quantity: 4 }],
      outputs: [{ resourceId: 'meat', quantity: 1 }],
    })], true)
    const modules = [source, target]
    const calculation = calculate(modules, [{
      id: 'dedicated-water', resourceId: 'water', mode: 'surplus-only',
      sourceModuleId: source.id, sourceModuleName: source.name,
      targetModuleId: target.id, targetModuleName: target.name,
    }])
    const rows = getResourceSupplyRows(modules, calculation, 'water')
    const producer = rows.find(row => row.moduleId === source.id)

    expect(rows).toHaveLength(2)
    expect(producer).toMatchObject({ produced: 10, balance: 6, exported: 4, boundary: { factorySupply: 0 } })
    expect(producer?.outgoing[0]?.quantity).toBe(4)
    expect(getResourceSupplyAccess(producer!, 'water')).toBe('connections')
    expect(rows.find(row => row.moduleId === target.id)).toMatchObject({ used: 4, balance: 0 })
  })

  it('keeps fixed demand separate from factory deliveries', () => {
    const consumer = moduleWith('Food', [])

    consumer.presets[0]!.fixedDemands = { water: 4 }
    const [row] = getResourceSupplyRows([consumer], calculate([consumer]), 'water')

    expect(row).toMatchObject({ used: 4, produced: 0, balance: -4, incoming: [] })
  })

  it('reports a pooled producer once when it supplies a private link', () => {
    const source = moduleWith('Source', [recipe('water', {
      outputs: [{ resourceId: 'water', quantity: 10 }],
    })], true)

    source.includedInFactoryTotals = true
    const target = moduleWith('Food', [recipe('food', {
      inputs: [{ resourceId: 'water', quantity: 4 }],
      outputs: [{ resourceId: 'meat', quantity: 1 }],
    })], true)
    const modules = [source, target]
    const calculation = calculate(modules, [{
      id: 'pooled-water', resourceId: 'water', mode: 'surplus-only',
      sourceModuleId: source.id, sourceModuleName: source.name,
      targetModuleId: target.id, targetModuleName: target.name,
    }])
    const rows = getResourceSupplyRows(modules, calculation, 'water')
    const producer = rows.find(row => row.moduleId === source.id)

    expect(rows).toHaveLength(2)
    expect(producer).toMatchObject({ produced: 10, balance: 6, exported: 10, boundary: null })
    expect(producer?.outgoing[0]?.quantity).toBe(4)
    expect(calculation.linkedModulesResult.boundaries.some(boundary => boundary.moduleId === source.id)).toBe(false)
    expect(getResourceSupplyAccess(producer!, 'water')).toBe('factory')
  })

  it('shows shared Water in Export but keeps unused Steam local', () => {
    const modules = [moduleWith('Nuclear', [recipe('outputs', {
      outputs: [
        { resourceId: 'water', quantity: 10 },
        { resourceId: 'steamSuper', quantity: 20 },
      ],
    })])]
    const result = calculate(modules)

    expect(getResourceSupplyRows(modules, result, 'water')[0]).toMatchObject({ exported: 10 })
    expect(getResourceSupplyRows(modules, result, 'steamSuper')[0]).toMatchObject({ balance: 20, exported: 0 })
  })
})
