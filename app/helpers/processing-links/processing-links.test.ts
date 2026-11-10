import { expect, it } from 'vitest'

import { type Recipe } from '../../db/recipes'
import { calculateNet, type ProductionLine } from '../calculate/calculate'
import { canAddProcessingLink, getProcessingEndpoint, parseProcessingLinks, resolveProcessingLinks, type ProcessingLink } from './processing-links'

const line = (id: string, inputs: Recipe['inputs'], outputs: Recipe['outputs'], extra: Partial<ProductionLine> = {}): ProductionLine => ({
  recipe: { id, name: id, building: id, group: 'production', inputs, outputs, balanceBy: 'output', balanceOutputIds: [outputs[0].resourceId] },
  moduleId: 'general', activeBuildings: 1, builtBuildings: 1, speedLevel: 1, operatingMode: 'balanced', ...extra,
})
const lines = () => [
  line('titanium', [], [{ resourceId: 'titaniumSlag', quantity: 10 }, { resourceId: 'moltenIron', quantity: 12 }]),
  line('furnace', [{ resourceId: 'moltenIron', quantity: 12 }, { resourceId: 'oxygen', quantity: 2 }], [{ resourceId: 'moltenSteel', quantity: 10 }], {
    processingInput: { id: 'iron', sourceRecipeId: 'titanium', resourceId: 'moltenIron' },
  }),
  line('caster', [{ resourceId: 'moltenSteel', quantity: 10 }, { resourceId: 'water', quantity: 2 }], [{ resourceId: 'steel', quantity: 10 }], {
    processingInput: { id: 'steel', sourceRecipeId: 'furnace', resourceId: 'moltenSteel' },
  }),
]

it('processes only selected titanium output through steel without steel demand or synthetic supplies', () => {
  const result = calculateNet(lines(), { oxygen: 2, water: 2 }, undefined, {}, { titaniumSlag: 5 })

  expect(result.regularResults.map(result => result.supplyRatio)).toEqual([0.5, 0.5, 0.5])
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'moltenIron')).toMatchObject({ produced: 6, consumed: 6, net: 0 })
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'steel')).toMatchObject({ produced: 5, consumed: 0 })
})

it('does not use unrelated pooled iron to drive a chain with an idle root', () => {
  const result = calculateNet(lines(), { oxygen: 2, water: 2, moltenIron: 100 })

  expect(result.regularResults.map(result => result.supplyRatio)).toEqual([0, 0, 0])
})

it('preserves ordinary steel production above the linked throughput and displaces primary iron correctly', () => {
  const input = lines()
  const iron = line('ordinary-iron', [], [{ resourceId: 'moltenIron', quantity: 120 }])
  const steel = line('ordinary-steel', [{ resourceId: 'moltenIron', quantity: 120 }], [{ resourceId: 'moltenSteel', quantity: 100 }])
  const cast = line('ordinary-caster', [{ resourceId: 'moltenSteel', quantity: 100 }], [{ resourceId: 'steel', quantity: 100 }])

  for (const [index, item] of [input[1], input[2], iron, steel, cast].entries()) {
    item.recipe = { ...item.recipe, allocation: 'fallback', allocationPriority: index, balanceInputIds: [] }
  }
  const result = calculateNet([...input, iron, steel, cast], { oxygen: 2, water: 2 }, undefined, {}, { titaniumSlag: 5, steel: 30 })

  expect(result.regularResults[1].supplyRatio).toBeCloseTo(1)
  expect(result.regularResults[2].supplyRatio).toBeCloseTo(1)
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'steel')?.net).toBeCloseTo(0)
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'moltenIron')?.net).toBeCloseTo(0)
  expect(result.regularResults[1].processingQuantity).toBeCloseTo(6)
  expect(result.regularResults[2].processingQuantity).toBeCloseTo(5)
})

it('replaces broad local-surplus rules without dropping ordinary consumers from the material ledger', () => {
  const input = lines()

  input[1].recipe = { ...input[1].recipe, balanceInputIds: ['moltenIron'], moduleInputIds: ['moltenIron'], consumeSurplusInputIds: ['moltenIron'] }
  const consumer = line('ordinary-iron-use', [{ resourceId: 'moltenIron', quantity: 10 }], [{ resourceId: 'iron', quantity: 10 }])
  const producer = line('ordinary-iron-source', [], [{ resourceId: 'moltenIron', quantity: 20 }])
  const result = calculateNet([...input, consumer, producer], { oxygen: 2, water: 2 }, undefined, {}, { titaniumSlag: 5, iron: 10 })

  expect(result.regularResults[1].processingQuantity).toBeCloseTo(6)
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'moltenIron')?.net).toBeCloseTo(0)
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'iron')?.net).toBeCloseTo(0)
})

it('shares physical capacity across chain steps, including an explicit target already using the pool', () => {
  const input = lines()

  for (const item of input.slice(1)) {
    item.capacityPoolId = 'shared'
    item.capacityPoolActiveBuildings = 1
    item.capacityPoolBuiltBuildings = 1
  }
  const result = calculateNet(input, { oxygen: 2, water: 2 }, undefined, {}, { titaniumSlag: 10 })

  expect(result.regularResults[1].supplyRatio + result.regularResults[2].supplyRatio).toBeCloseTo(1)
  expect(result.regularResults[2].processingBlockedBy).toBe('capacity')
  input[1].allocationRatio = 0.5
  const committed = calculateNet(input, { oxygen: 2, water: 2 }, undefined, {}, { titaniumSlag: 5 })

  expect(committed.regularResults[1].processingQuantity).toBeCloseTo(6)
  expect(committed.regularResults[2].processingBlockedBy).toBeUndefined()
})

it('rejects branching/cycles and keeps unresolved or ambiguous semantic endpoints out of calculations', () => {
  const input = lines()
  const source = getProcessingEndpoint('general', { ...input[0].recipe, gameBuildingId: 'ArcFurnace2', gameRecipeId: 'Ilmenite' })
  const target = getProcessingEndpoint('general', { ...input[1].recipe, gameBuildingId: 'OxygenFurnace', gameRecipeId: 'Steel' })
  const link: ProcessingLink = { id: 'iron', source, target, resourceId: 'moltenIron' }

  expect(canAddProcessingLink([link], { ...link, id: 'cycle', source: target, target: source })).toBe(false)
  expect(canAddProcessingLink([link], { ...link, id: 'branch', target: getProcessingEndpoint('general', input[2].recipe) })).toBe(false)
  expect(parseProcessingLinks(JSON.stringify([link, { ...link, id: 'duplicate' }, { ...link, id: 'invalid', resourceId: 'not-a-resource' }]))).toEqual([link])
  expect(resolveProcessingLinks([link], [])).toEqual([])
  const recipes = [
    { ...input[0].recipe, id: 'new:dedicated', gameBuildingId: 'ArcFurnace2', gameRecipeId: 'Ilmenite' },
    { ...input[1].recipe, gameBuildingId: 'OxygenFurnace', gameRecipeId: 'Steel' },
  ]
  const owner = { id: 'general', name: 'Default', description: '', builtBuildings: {}, presets: [], defaultPresetId: null, recipes }

  expect(resolveProcessingLinks([link], [owner])[0]?.sourceRecipeId).toBe('new:dedicated')
  expect(resolveProcessingLinks([link], [{ ...owner, recipes: [...recipes, { ...recipes[0], id: 'ambiguous' }] }])).toEqual([])
  const downstream: ProcessingLink = { id: 'downstream', source: target, target: getProcessingEndpoint('general', input[2].recipe), resourceId: 'moltenSteel' }

  expect(resolveProcessingLinks([link, downstream], [{ ...owner, recipes: [recipes[1], input[2].recipe] }])).toEqual([])
})

it('bounds the whole route by supporting inputs and downstream capacity, keeping blocked workload visible', () => {
  for (const [supplies, active, blocker] of [
    [{ oxygen: 0, water: 2 }, 1, 'oxygen'],
    [{ oxygen: 2, water: 0.5 }, 1, 'water'],
    [{ oxygen: 2, water: 2 }, 0, 'capacity'],
  ] as const) {
    const input = lines()

    input[2].activeBuildings = active
    const result = calculateNet(input, supplies, undefined, {}, { titaniumSlag: 5 })
    const furnace = result.regularResults[1]
    const caster = result.regularResults[2]

    expect(furnace.supplyRatio).toBeCloseTo(blocker === 'water' ? 0.25 : 0, 4)
    expect(caster.processingRequiredBuildings).toBeCloseTo(0.5)
    expect(caster.processingBlockedBy).toBe(blocker)
    expect(result.allResourceFlows.every(flow => flow.net >= -0.001)).toBe(true)
  }
})
