import { describe, expect, it } from 'vitest'

import {
  moduleResourceLinkDefinitions,
  resolveModuleResourceLinks,
  type ModuleResourceLink,
} from '../../db/module-resource-links'
import { type Module } from '../../db/modules/modules'
import { type Recipe } from '../../db/recipes'
import { calculateLinkedModules } from './calculate-linked-modules'

const liveAreaState = {
  zoneId: 1,
  trackedBuildings: 1,
  constructedBuildings: 1,
  activeBuildings: 1,
  pausedBuildings: 0,
  constructionGhosts: 0,
  issues: [],
}

const createModule = (
  id: string,
  name: string,
  recipes: Recipe[],
  fixed: string[] = [],
  requestedExports?: Module['presets'][number]['requestedExports'],
): Module => ({
  id,
  name,
  description: '',
  includedInFactoryTotals: false,
  builtBuildings: Object.fromEntries(recipes.map(recipe => [recipe.id, 1])),
  recipes,
  presets: [{
    id: 'live',
    name: 'Live',
    description: '',
    activeBuildings: Object.fromEntries(recipes.map(recipe => [recipe.id, 1])),
    fixed,
    ...(requestedExports ? { requestedExports } : {}),
  }],
  defaultPresetId: 'live',
  liveArea: liveAreaState,
})

describe('linked live modules', () => {
  it('exposes an isolated planned import as an exact factory boundary', () => {
    const ironSmelting: Recipe = {
      id: 'import-driven-smelting',
      name: 'Import-driven smelting',
      building: 'Arc furnace II',
      group: 'production',
      allocation: 'fallback',
      balanceBy: 'output',
      balanceOutputIds: ['moltenIron'],
      inputs: [{ resourceId: 'ironOreCrushed', quantity: 10 }],
      outputs: [{ resourceId: 'moltenIron', quantity: 10 }],
    }
    const steel = createModule('steel', 'Steel', [ironSmelting])
    const preset = steel.presets[0]

    if (!preset) throw new Error('Missing live preset')

    preset.requestedImports = { ironOreCrushed: 10 }

    const result = calculateLinkedModules({
      links: [],
      modules: [steel],
      recyclingEfficiencyPercent: 100,
    })

    expect(result.boundaryDemands).toEqual({ ironOreCrushed: 10 })
    expect(result.moduleResults.get(steel.id)?.regularResults[0]).toMatchObject({
      supplyRatio: 1,
      actualInputs: [{ resourceId: 'ironOreCrushed', quantity: 10 }],
      actualOutputs: [{ resourceId: 'moltenIron', quantity: 10 }],
    })
  })

  it('does not duplicate a factory-pooled live area through isolated boundaries', () => {
    const copperChain: Recipe = {
      id: 'copper-chain',
      name: 'Copper chain',
      building: 'Copper production',
      group: 'production',
      balanceBy: 'output',
      inputs: [
        { resourceId: 'copperScrap', quantity: 384 },
        { resourceId: 'acid', quantity: 96 },
        { resourceId: 'graphite', quantity: 24 },
      ],
      outputs: [{ resourceId: 'copper', quantity: 384 }],
    }
    const copper = createModule(
      'copper',
      'Copper #1',
      [copperChain],
      [],
      { copper: 384 },
    )

    copper.includedInFactoryTotals = true

    const result = calculateLinkedModules({
      links: [],
      modules: [copper],
      recyclingEfficiencyPercent: 100,
    })

    expect(result.boundaryDemands).toEqual({})
    expect(result.boundarySupplies).toEqual({})
    expect(result.moduleResults.has(copper.id)).toBe(false)
  })

  it('resolves the same name-based link records a future UI can persist', () => {
    const source = createModule('source', 'Source', [])
    const target = createModule('target', 'Target', [])

    expect(resolveModuleResourceLinks([source, target], [{
      id: 'test-link',
      sourceModuleName: 'Source',
      targetModuleName: 'Target',
      resourceId: 'exhaust',
      mode: 'surplus-only',
    }])).toEqual([{
      id: 'test-link',
      sourceModuleName: 'Source',
      sourceModuleId: 'source',
      targetModuleName: 'Target',
      targetModuleId: 'target',
      resourceId: 'exhaust',
      mode: 'surplus-only',
    }])
  })

  it('resolves the dedicated Steel #1 routes from the synced area names', () => {
    const copper = createModule('copper', 'Copper #1', [])
    const steel = createModule('steel', 'Steel #1', [])
    const exhaust = createModule('exhaust', 'Exaust #1', [])
    const links = resolveModuleResourceLinks(
      [copper, steel, exhaust],
      moduleResourceLinkDefinitions,
    )

    expect(links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'copper-1-sea-water-to-steel-1',
        sourceModuleId: copper.id,
        targetModuleId: steel.id,
        resourceId: 'seaWater',
        mode: 'produce-to-demand',
      }),
      expect.objectContaining({
        id: 'steel-1-exhaust-to-exaust-1',
        sourceModuleId: steel.id,
        targetModuleId: exhaust.id,
        resourceId: 'exhaust',
        mode: 'surplus-only',
      }),
    ]))
  })

  it('routes private surplus, starts a named source on demand, and exposes other boundaries globally', () => {
    const exhaustProducer: Recipe = {
      id: 'source-exhaust',
      name: 'Exhaust producer',
      building: 'Source process',
      group: 'production',
      inputs: [],
      outputs: [{ resourceId: 'exhaust', quantity: 10 }],
    }
    const seaWaterPump: Recipe = {
      id: 'source-sea-water',
      name: 'Sea water pump',
      building: 'Pump',
      group: 'source',
      sourceMode: 'module-demand-capped',
      inputs: [],
      outputs: [{ resourceId: 'seaWater', quantity: 10 }],
    }
    const scrubber: Recipe = {
      id: 'target-scrubber',
      name: 'Scrubber',
      building: 'Scrubber',
      group: 'production',
      balanceBy: 'output',
      inputs: [
        { resourceId: 'exhaust', quantity: 10 },
        { resourceId: 'water', quantity: 5 },
        { resourceId: 'limestone', quantity: 2 },
      ],
      outputs: [{ resourceId: 'sulfur', quantity: 1 }],
    }
    const desalinator: Recipe = {
      id: 'target-desalinator',
      name: 'Desalinator',
      building: 'Desalinator',
      group: 'production',
      balanceBy: 'output',
      inputs: [{ resourceId: 'seaWater', quantity: 5 }],
      outputs: [{ resourceId: 'water', quantity: 5 }],
    }
    const source = createModule(
      'source',
      'Source',
      [exhaustProducer, seaWaterPump],
      [exhaustProducer.id],
    )
    const target = createModule('target', 'Target', [scrubber, desalinator])
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
    const result = calculateLinkedModules({
      links,
      modules: [source, target],
      recyclingEfficiencyPercent: 100,
    })
    const sourceResult = result.moduleResults.get(source.id)
    const targetResult = result.moduleResults.get(target.id)

    expect(result.transfers).toEqual([
      expect.objectContaining({ id: 'exhaust-link', quantity: 10 }),
      expect.objectContaining({
        id: 'sea-water-link',
        quantity: 5,
        requestedQuantity: 5,
      }),
    ])
    expect(sourceResult?.sourceResults.find(
      item => item.recipe.id === seaWaterPump.id,
    )?.supplyRatio).toBe(0.5)
    expect(targetResult?.regularResults.find(
      item => item.recipe.id === scrubber.id,
    )?.supplyRatio).toBe(1)
    expect(targetResult?.regularResults.find(
      item => item.recipe.id === desalinator.id,
    )?.supplyRatio).toBe(1)
    expect(result.boundaryDemands).toEqual({ limestone: 2 })
    expect(result.boundarySupplies).toEqual({ sulfur: 1 })
  })

  it('keeps unlinked Steam (Low) and Sea Water inside live module ledgers', () => {
    const producer: Recipe = {
      id: 'local-utility-producer',
      name: 'Local utility producer',
      building: 'Producer',
      group: 'production',
      inputs: [],
      outputs: [
        { resourceId: 'steamLow', quantity: 10 },
        { resourceId: 'seaWater', quantity: 10 },
      ],
    }
    const source = createModule('source', 'Source', [producer], [producer.id])

    const result = calculateLinkedModules({
      links: [],
      modules: [source],
      recyclingEfficiencyPercent: 100,
    })

    expect(result.boundaryDemands).toEqual({})
    expect(result.boundarySupplies).toEqual({})
  })

  it('allocates one target requirement across multiple demand-triggered sources', () => {
    const firstPump: Recipe = {
      id: 'first-water-pump',
      name: 'First water pump',
      building: 'First pump',
      group: 'production',
      balanceBy: 'output',
      inputs: [],
      outputs: [{ resourceId: 'water', quantity: 6 }],
    }
    const secondPump: Recipe = {
      ...firstPump,
      id: 'second-water-pump',
      name: 'Second water pump',
      building: 'Second pump',
      outputs: [{ resourceId: 'water', quantity: 10 }],
    }
    const consumer: Recipe = {
      id: 'water-consumer',
      name: 'Water consumer',
      building: 'Consumer',
      group: 'production',
      inputs: [{ resourceId: 'water', quantity: 10 }],
      outputs: [],
    }
    const first = createModule('first', 'First', [firstPump])
    const second = createModule('second', 'Second', [secondPump])
    const target = createModule('target', 'Target', [consumer], [consumer.id])
    const links: ModuleResourceLink[] = [
      {
        id: 'first-water-link',
        sourceModuleId: first.id,
        sourceModuleName: first.name,
        targetModuleId: target.id,
        targetModuleName: target.name,
        resourceId: 'water',
        mode: 'produce-to-demand',
      },
      {
        id: 'second-water-link',
        sourceModuleId: second.id,
        sourceModuleName: second.name,
        targetModuleId: target.id,
        targetModuleName: target.name,
        resourceId: 'water',
        mode: 'produce-to-demand',
      },
    ]
    const result = calculateLinkedModules({
      links,
      modules: [first, second, target],
      recyclingEfficiencyPercent: 100,
    })

    expect(result.transfers).toEqual([
      expect.objectContaining({
        id: 'first-water-link',
        quantity: 6,
        requestedQuantity: 6,
      }),
      expect.objectContaining({
        id: 'second-water-link',
        quantity: 4,
        requestedQuantity: 4,
      }),
    ])
    expect(result.transfers.reduce((total, transfer) => total + transfer.quantity, 0)).toBe(10)
    expect(result.moduleResults.get(target.id)?.regularResults[0]?.supplyRatio).toBe(1)
  })

  it('preserves the full target request when a demand-triggered source is undersized', () => {
    const pump: Recipe = {
      id: 'limited-water-pump',
      name: 'Limited water pump',
      building: 'Pump',
      group: 'production',
      balanceBy: 'output',
      inputs: [],
      outputs: [{ resourceId: 'water', quantity: 6 }],
    }
    const consumer: Recipe = {
      id: 'water-to-steel',
      name: 'Water consumer',
      building: 'Consumer',
      group: 'production',
      balanceBy: 'output',
      inputs: [{ resourceId: 'water', quantity: 10 }],
      outputs: [{ resourceId: 'steel', quantity: 10 }],
    }
    const source = createModule('limited-source', 'Limited source', [pump])
    const target = createModule(
      'limited-target',
      'Limited target',
      [consumer],
      [],
      { steel: 10 },
    )
    const result = calculateLinkedModules({
      links: [{
        id: 'limited-water-link',
        sourceModuleId: source.id,
        sourceModuleName: source.name,
        targetModuleId: target.id,
        targetModuleName: target.name,
        resourceId: 'water',
        mode: 'produce-to-demand',
      }],
      modules: [source, target],
      recyclingEfficiencyPercent: 100,
    })

    expect(result.transfers).toEqual([
      expect.objectContaining({
        id: 'limited-water-link',
        quantity: 6,
        requestedQuantity: 10,
      }),
    ])
    expect(result.moduleResults.get(target.id)?.regularResults[0]).toMatchObject({
      supplyRatio: 0.6,
      actualInputs: [{ resourceId: 'water', quantity: 6 }],
      actualOutputs: [{ resourceId: 'steel', quantity: 6 }],
    })
  })

  it('keeps an explicit global export when the same resource has a private link', () => {
    const producer: Recipe = {
      id: 'exported-exhaust-producer',
      name: 'Exported exhaust producer',
      building: 'Producer',
      group: 'production',
      inputs: [],
      outputs: [{ resourceId: 'exhaust', quantity: 10 }],
    }
    const consumer: Recipe = {
      id: 'linked-exhaust-consumer',
      name: 'Linked exhaust consumer',
      building: 'Consumer',
      group: 'production',
      balanceBy: 'output',
      inputs: [{ resourceId: 'exhaust', quantity: 10 }],
      outputs: [{ resourceId: 'sulfur', quantity: 1 }],
    }
    const source = createModule(
      'source',
      'Source',
      [producer],
      [producer.id],
      { exhaust: 4 },
    )
    const target = createModule('target', 'Target', [consumer])
    const link: ModuleResourceLink = {
      id: 'linked-export',
      sourceModuleId: source.id,
      sourceModuleName: source.name,
      targetModuleId: target.id,
      targetModuleName: target.name,
      resourceId: 'exhaust',
      mode: 'surplus-only',
    }
    const result = calculateLinkedModules({
      links: [link],
      modules: [source, target],
      recyclingEfficiencyPercent: 100,
    })

    expect(result.transfers[0]).toMatchObject({ quantity: 6 })
    expect(result.boundarySupplies.exhaust).toBe(4)
    expect(result.moduleResults.get(target.id)?.regularResults[0]?.supplyRatio).toBe(0.6)
  })

  it('passes a privately supplied resource through an intermediate module', () => {
    const pump: Recipe = {
      id: 'chain-water-pump',
      name: 'Chain water pump',
      building: 'Pump',
      group: 'production',
      balanceBy: 'output',
      inputs: [],
      outputs: [{ resourceId: 'water', quantity: 10 }],
    }
    const consumer: Recipe = {
      id: 'chain-water-consumer',
      name: 'Chain water consumer',
      building: 'Consumer',
      group: 'production',
      inputs: [{ resourceId: 'water', quantity: 5 }],
      outputs: [],
    }
    const source = createModule('source', 'Source', [pump])
    const middle = createModule('middle', 'Middle', [])
    const target = createModule('target', 'Target', [consumer], [consumer.id])
    const links: ModuleResourceLink[] = [
      {
        id: 'source-to-middle',
        sourceModuleId: source.id,
        sourceModuleName: source.name,
        targetModuleId: middle.id,
        targetModuleName: middle.name,
        resourceId: 'water',
        mode: 'produce-to-demand',
      },
      {
        id: 'middle-to-target',
        sourceModuleId: middle.id,
        sourceModuleName: middle.name,
        targetModuleId: target.id,
        targetModuleName: target.name,
        resourceId: 'water',
        mode: 'produce-to-demand',
      },
    ]
    const result = calculateLinkedModules({
      links,
      modules: [source, middle, target],
      recyclingEfficiencyPercent: 100,
    })

    expect(result.transfers).toEqual([
      expect.objectContaining({ id: 'source-to-middle', quantity: 5 }),
      expect.objectContaining({ id: 'middle-to-target', quantity: 5 }),
    ])
    expect(result.boundaryDemands).toEqual({})
    expect(result.boundarySupplies).toEqual({})
  })
})
