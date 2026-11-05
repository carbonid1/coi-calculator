import { expect, it } from 'vitest'

import { type Recipe } from '../../db/recipes'
import { testRecycling } from '../../test-fixtures/recycling'
import { testRecipes as recipes } from '../../test-fixtures/solver-recipes'
import { extractModuleResult } from '../module-result/module-result'
import { calculateNet } from './calculate'

const fixedLine = (recipe: typeof recipes[number]) => ({
  recipe, moduleId: 'test', activeBuildings: 1, builtBuildings: 1,
  speedLevel: 1, operatingMode: 'fixed' as const,
})

it('compresses recovered scrap into recyclables at two scrap per recyclable', () => {
  const recipe = recipes.find(candidate => candidate.id === 'maintenance-i-recycling')!
  const result = calculateNet([fixedLine(recipe)], {}, 50, { recycling: testRecycling })
  const flow = result.allResourceFlows.find(candidate => candidate.resourceId === 'recyclables')!

  expect(flow.produced).toBeGreaterThan(0)
  expect(flow.produced).toBeCloseTo(9)
  expect(flow.recyclableSourceValueProduced).toBeCloseTo(18)
  expect(flow.produced * 2).toBeCloseTo(flow.recyclableSourceValueProduced!, 8)
})

it('applies recycling efficiency to settlement collection', () => {
  const recipe = recipes.find(candidate => candidate.building.includes('Housing')
    && candidate.outputs.some(output => output.resourceId === 'recyclables'))!

  expect(recipe).toBeDefined()
  const zero = calculateNet([fixedLine(recipe)], {}, 0, { recycling: testRecycling })
  const full = calculateNet([fixedLine(recipe)], {}, 100, { recycling: testRecycling })
  const recyclables = (result: ReturnType<typeof calculateNet>) => result.allResourceFlows
    .find(flow => flow.resourceId === 'recyclables')?.produced ?? 0

  expect(recyclables(full)).toBeGreaterThan(0)
  expect(recyclables(zero)).toBe(0)
})

it('retains each receiving plant\'s observed fallback for imports without material provenance', () => {
  const sorter = (id: string, resource: 'ironScrap' | 'copperScrap'): Recipe => ({
    id, name: id, building: 'Sorter', group: 'production', balanceBy: 'input',
    inputs: [{ resourceId: 'recyclables', quantity: 5 }],
    outputs: [{ resourceId: 'ironScrap', quantity: 0 }, { resourceId: 'copperScrap', quantity: 0 }],
    sortsRecyclableSources: true, recyclingInputSources: { [resource]: 2 },
  })
  const result = calculateNet([
    fixedLine(sorter('iron-sorter', 'ironScrap')), fixedLine(sorter('copper-sorter', 'copperScrap')),
  ], { recyclables: 10 }, 100, { recycling: testRecycling })
  const output = (id: string, resource: string) => result.regularResults.find(line => line.recipe.id === id)
    ?.actualOutputs.find(row => row.resourceId === resource)?.quantity ?? 0

  expect(output('iron-sorter', 'ironScrap')).toBeCloseTo(10)
  expect(output('iron-sorter', 'copperScrap')).toBe(0)
  expect(output('copper-sorter', 'copperScrap')).toBeCloseTo(10)
  expect(output('copper-sorter', 'ironScrap')).toBe(0)
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'recyclables')?.net).toBeCloseTo(0)
})

it('does not invent recyclable yield when product provenance is unavailable', () => {
  const recipe = recipes.find(candidate => candidate.id === 'maintenance-i-recycling')!
  const result = calculateNet([fixedLine(recipe)], {}, 100)

  expect(result.allResourceFlows.find(flow => flow.resourceId === 'recyclables')?.produced).toBe(0)
})

it('carries source composition through pressing and sorting without another collection loss', () => {
  const producer: Recipe = {
    id: 'producer', name: 'Producer', building: 'Producer', group: 'production',
    inputs: [{ resourceId: 'mechanicalParts', quantity: 20 }],
    outputs: [{ resourceId: 'recyclables', quantity: 0 }], recyclesInputs: true,
  }
  const press: Recipe = {
    id: 'press', name: 'Press', building: 'Press', group: 'production', balanceBy: 'input',
    inputs: [{ resourceId: 'recyclables', quantity: 5 }],
    outputs: [{ resourceId: 'recyclablesPressed', quantity: 1 }], recyclesInputs: false,
    recyclingInputSources: { ironScrap: 2 },
  }
  const sorter: Recipe = {
    id: 'sorter', name: 'Sorter', building: 'Sorter', group: 'production', balanceBy: 'input',
    inputs: [{ resourceId: 'recyclablesPressed', quantity: 1 }],
    outputs: [{ resourceId: 'ironScrap', quantity: 10 }], sortsRecyclableSources: true,
    recyclingInputSources: { ironScrap: 10 },
  }
  const result = calculateNet([fixedLine(producer), fixedLine(press), fixedLine(sorter)],
    {}, 50, { recycling: testRecycling })
  const flow = (id: string) => result.allResourceFlows.find(row => row.resourceId === id)

  expect(flow('recyclables')).toMatchObject({ produced: 5, consumed: 5, net: 0, recyclableSourceValueProduced: 10 })
  expect(flow('recyclablesPressed')).toMatchObject({ produced: 1, consumed: 1, net: 0, recyclableSourceValueProduced: 10 })
  expect(flow('ironScrap')?.produced).toBeCloseTo(10)
})

it('sorts the projected mixture through loose or pressed inputs while retaining material identity and plant capacity', () => {
  const recycling = { ...testRecycling, products: [...testRecycling.products, {
    productId: 'microchips', name: 'Microchip',
    sources: [{ productId: 'goldScrap', name: 'Gold scrap', quantity: 1 }],
  }] }
  const producer: Recipe = {
    id: 'producer', name: 'Producer', building: 'Producer', group: 'production',
    inputs: [{ resourceId: 'mechanicalParts', quantity: 10 }, { resourceId: 'electronicsI', quantity: 6 },
      { resourceId: 'microchips', quantity: 4 }],
    outputs: [{ resourceId: 'recyclables', quantity: 0 }], recyclesInputs: true,
  }
  const press: Recipe = {
    id: 'press', name: 'Press', building: 'Press', group: 'production', balanceBy: 'input',
    inputs: [{ resourceId: 'recyclables', quantity: 10 }],
    outputs: [{ resourceId: 'recyclablesPressed', quantity: 2 }], recyclesInputs: false,
    recyclingInputSources: { ironScrap: 2 },
  }

  for (const pressed of [false, true]) for (const secondRunning of [false, true]) {
    const resourceId = pressed ? 'recyclablesPressed' : 'recyclables'
    const compaction = pressed ? 5 : 1
    const sorter: Recipe = {
      id: 'sorter', name: 'Sorter', building: 'Sorter', group: 'production', balanceBy: 'input',
      inputs: [{ resourceId, quantity: 6 / compaction }],
      // The old observed batch contained only iron; the planned batch also has copper and gold.
      outputs: [{ resourceId: 'ironScrap', quantity: 12 }], sortsRecyclableSources: true,
      recyclingInputSources: { ironScrap: 2 * compaction },
    }
    const result = calculateNet([fixedLine(producer), ...(pressed ? [fixedLine(press)] : []),
      fixedLine(sorter), { ...fixedLine({ ...sorter, id: 'second-sorter' }), activeBuildings: Number(secondRunning) }],
    {}, 100, { recycling })
    const processed = secondRunning ? 10 : 6
    const flow = (id: string) => result.allResourceFlows.find(row => row.resourceId === id)

    expect(flow(resourceId)?.consumed).toBeCloseTo(processed / compaction)
    expect(flow(resourceId)?.net).toBeCloseTo((10 - processed) / compaction)
    for (const [id, quantity] of [['ironScrap', 10], ['copperScrap', 6], ['goldScrap', 4]] as const)
      expect(flow(id)?.produced).toBeCloseTo(quantity * processed / 10)
    for (const line of result.regularResults.filter(line => line.recipe.sortsRecyclableSources)) {
      expect(line.actualInputs[0].quantity).toBeLessThanOrEqual(6 / compaction)
      expect(line.actualOutputs.reduce((sum, output) => sum + output.quantity, 0))
        .toBeCloseTo(line.actualInputs[0].quantity * 2 * compaction)
    }
  }
})

it('uses the receiving sorter mix for explicit recyclable imports', () => {
  const sorter: Recipe = {
    id: 'sorter', name: 'Sorter', building: 'Sorter', group: 'production', balanceBy: 'input',
    inputs: [{ resourceId: 'recyclables', quantity: 5 }],
    outputs: [{ resourceId: 'ironScrap', quantity: 2.5 }, { resourceId: 'copperScrap', quantity: 7.5 }],
    sortsRecyclableSources: true, recyclingInputSources: { ironScrap: 0.5, copperScrap: 1.5 },
  }
  const result = calculateNet([fixedLine(sorter)], { recyclables: 5 })

  expect(result.regularResults[0]?.actualOutputs).toEqual(sorter.outputs)
})

it('does not fabricate sorter output without an observed mix', () => {
  const sorter = recipes.find(recipe => recipe.id === 'waste-sorting-recyclables')!
  const result = calculateNet([fixedLine(sorter)], { recyclables: 100 })

  expect(result.regularResults[0]?.supplyRatio).toBe(0)
  expect(result.regularResults[0]?.actualOutputs.every(output => output.quantity === 0)).toBe(true)
})

it('keeps loose and pressed source totals separate in a module result', () => {
  const producer: Recipe = {
    id: 'producer', name: 'Producer', building: 'Producer', group: 'production',
    inputs: [{ resourceId: 'mechanicalParts', quantity: 40 }],
    outputs: [{ resourceId: 'recyclables', quantity: 0 }], recyclesInputs: true,
  }
  const press: Recipe = {
    id: 'press', name: 'Press', building: 'Press', group: 'production', balanceBy: 'input',
    inputs: [{ resourceId: 'recyclables', quantity: 5 }],
    outputs: [{ resourceId: 'recyclablesPressed', quantity: 1 }], recyclesInputs: false,
    recyclingInputSources: { ironScrap: 2 },
  }
  const calculation = calculateNet([fixedLine(producer), fixedLine(press)], {}, 50, { recycling: testRecycling })
  const moduleResult = extractModuleResult('test', calculation)

  expect(moduleResult.resourceFlows.find(flow => flow.resourceId === 'recyclables')?.recyclableSourceValueProduced).toBe(20)
  expect(moduleResult.resourceFlows.find(flow => flow.resourceId === 'recyclablesPressed')?.recyclableSourceValueProduced).toBe(10)
})
