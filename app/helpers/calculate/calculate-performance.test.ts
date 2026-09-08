import { expect, it, vi } from 'vitest'

import { type Recipe } from '../../db/recipes'
import * as quantities from '../modifiers/recipe-output'
import { calculateNet, type ProductionLine } from './calculate'

it('does not repeatedly size a full producer for every blocked surplus route', () => {
  const producer: Recipe = {
    id: 'water', name: 'Water', building: 'Test', group: 'production', balanceBy: 'output',
    inputs: [], outputs: [{ resourceId: 'water', quantity: 10 }],
  }
  const line = (recipe: Recipe): ProductionLine => ({
    recipe, moduleId: 'test', activeBuildings: 1, builtBuildings: 1,
    speedLevel: 1, operatingMode: 'balanced',
  })
  const consumers = Array.from({ length: 20 }, (_, index) => line({
    id: `consumer-${index}`, name: 'Surplus conversion', building: 'Test', group: 'production',
    balanceBy: 'output', balanceOutputIds: [], consumeSurplusInputIds: ['ethanol'],
    inputs: [{ resourceId: 'ethanol', quantity: 1 }, { resourceId: 'water', quantity: 1 }],
    outputs: [{ resourceId: 'fuelGas', quantity: 1 }],
  }))
  const outputQuantity = vi.spyOn(quantities, 'getRecipeOutputQuantity')

  try {
    const result = calculateNet([line(producer), ...consumers], { ethanol: 100 }, 0, {}, { water: 10 })

    expect(result.regularResults.find(result => result.recipe.id === producer.id)?.actualOutputs)
      .toEqual([{ resourceId: 'water', quantity: 10 }])
    expect(result.blockedRoutes).toHaveLength(20)
    expect(result.allResourceFlows.find(flow => flow.resourceId === 'water')?.net).toBeCloseTo(0, 5)
    expect(outputQuantity.mock.calls.filter(([recipe]) => recipe === producer).length).toBeLessThan(20)
  } finally {
    outputQuantity.mockRestore()
  }
})
