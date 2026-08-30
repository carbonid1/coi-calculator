import { expect, it } from 'vitest'

import { type ModuleResourceLink } from '../../db/module-resource-links'
import { type Module } from '../../db/modules/modules'
import { type Recipe } from '../../db/recipes'
import { calculateNet, type ProductionLine } from '../calculate/calculate'
import {
  createPooledLinkSourceShadows,
  hasPooledLinkSourceConnections,
} from './pooled-link-source-shadows'

const line = (
  recipe: Recipe,
  operatingMode: ProductionLine['operatingMode'],
): ProductionLine => ({
  recipe,
  moduleId: 'copper',
  activeBuildings: 1,
  builtBuildings: 1,
  speedLevel: 1,
  operatingMode,
})

const liveState = {
  zoneId: 1,
  trackedBuildings: 1,
  constructedBuildings: 1,
  activeBuildings: 1,
  pausedBuildings: 0,
  constructionGhosts: 0,
  issues: [],
}

it('exposes pooled surplus and only the remaining demand-driven pump capacity', () => {
  const pump: Recipe = {
    id: 'pump',
    name: 'Pump',
    building: 'Pump',
    group: 'source',
    sourceMode: 'module-demand-capped',
    inputs: [],
    outputs: [{ resourceId: 'seaWater', quantity: 10 }],
  }
  const localConsumer: Recipe = {
    id: 'local-consumer',
    name: 'Local consumer',
    building: 'Consumer',
    group: 'production',
    inputs: [{ resourceId: 'seaWater', quantity: 5 }],
    outputs: [],
  }
  const exhaustProducer: Recipe = {
    id: 'exhaust-producer',
    name: 'Exhaust producer',
    building: 'Producer',
    group: 'production',
    inputs: [],
    outputs: [{ resourceId: 'exhaust', quantity: 8 }],
  }
  const lines = [
    line(pump, 'balanced'),
    line(localConsumer, 'fixed'),
    line(exhaustProducer, 'fixed'),
  ]
  const calculation = calculateNet(lines)
  const source: Module = {
    id: 'copper',
    name: 'Copper #1',
    description: '',
    includedInFactoryTotals: true,
    builtBuildings: {},
    presets: [],
    defaultPresetId: null,
    liveArea: liveState,
  }
  const target: Module = {
    id: 'exhaust',
    name: 'Exaust #1',
    description: '',
    includedInFactoryTotals: false,
    builtBuildings: {},
    presets: [],
    defaultPresetId: null,
    liveArea: { ...liveState, zoneId: 2 },
  }
  const links: ModuleResourceLink[] = [
    {
      id: 'exhaust-link',
      sourceModuleId: source.id,
      sourceModuleName: source.name,
      targetModuleId: target.id,
      targetModuleName: target.name,
      resourceId: 'exhaust',
      mode: 'surplus-only',
    },
    {
      id: 'sea-water-link',
      sourceModuleId: source.id,
      sourceModuleName: source.name,
      targetModuleId: target.id,
      targetModuleName: target.name,
      resourceId: 'seaWater',
      mode: 'produce-to-demand',
    },
  ]
  const result = createPooledLinkSourceShadows({
    calculation,
    lines,
    links,
    modules: [source, target],
  })
  const shadow = result.modules[0]
  const linkedCapacity = (resourceId: 'exhaust' | 'seaWater') => (
    shadow?.recipes?.find(recipe => recipe.outputs[0]?.resourceId === resourceId)
      ?.outputs[0]?.quantity
  )

  expect(result.sourceModuleIds).toEqual(new Set([source.id]))
  expect(linkedCapacity('exhaust')).toBe(8)
  expect(linkedCapacity('seaWater')).toBe(5)
  expect(hasPooledLinkSourceConnections(links, [source, target])).toBe(true)
})

it('counts a shared machine pool once when exposing demand-driven capacity', () => {
  const primaryRecipe: Recipe = {
    id: 'primary-molten-copper',
    name: 'Primary molten copper',
    building: 'Arc furnace II',
    group: 'production',
    balanceBy: 'output',
    balanceOutputIds: ['moltenCopper'],
    sharedCapacity: { id: 'arc-furnace', priority: 1 },
    inputs: [],
    outputs: [{ resourceId: 'moltenCopper', quantity: 10 }],
  }
  const secondaryRecipe: Recipe = {
    ...primaryRecipe,
    id: 'secondary-molten-copper',
    name: 'Secondary molten copper',
    sharedCapacity: { id: 'arc-furnace', priority: 2 },
    outputs: [{ resourceId: 'moltenCopper', quantity: 20 }],
  }
  const sharedLine = (recipe: Recipe): ProductionLine => ({
    ...line(recipe, 'balanced'),
    capacityPoolId: 'copper:arc-furnace',
    capacityPoolActiveBuildings: 1,
  })
  const lines = [sharedLine(primaryRecipe), sharedLine(secondaryRecipe)]
  const calculation = calculateNet(lines)
  const source: Module = {
    id: 'copper',
    name: 'Copper #1',
    description: '',
    includedInFactoryTotals: true,
    builtBuildings: {},
    presets: [],
    defaultPresetId: null,
    liveArea: liveState,
  }
  const target: Module = {
    id: 'consumer',
    name: 'Consumer',
    description: '',
    includedInFactoryTotals: false,
    builtBuildings: {},
    presets: [],
    defaultPresetId: null,
    liveArea: { ...liveState, zoneId: 2 },
  }
  const links: ModuleResourceLink[] = [{
    id: 'molten-copper-link',
    sourceModuleId: source.id,
    sourceModuleName: source.name,
    targetModuleId: target.id,
    targetModuleName: target.name,
    resourceId: 'moltenCopper',
    mode: 'produce-to-demand',
  }]
  const result = createPooledLinkSourceShadows({
    calculation,
    lines,
    links,
    modules: [source, target],
  })

  expect(result.modules[0]?.recipes?.[0]?.outputs[0]?.quantity).toBe(10)
})
