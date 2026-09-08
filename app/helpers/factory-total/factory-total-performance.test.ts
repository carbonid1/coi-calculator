import { expect, it, vi } from 'vitest'

import { type Module } from '../../db/modules/modules'
import * as solver from '../calculate/calculate'
import { calculateFactoryTotal } from './factory-total'

it('solves a factory without contracts once, without repeating contract-planning solves', () => {
  const factoryModule: Module = {
    id: 'test', name: 'Test', description: '', builtBuildings: { water: 1 },
    recipes: [{
      id: 'water', name: 'Water', building: 'Test', group: 'production', balanceBy: 'output',
      inputs: [], outputs: [{ resourceId: 'water', quantity: 10 }],
    }],
    defaultPresetId: 'test',
    presets: [{ id: 'test', name: 'Test', description: '', activeBuildings: {}, fixed: [], fixedDemands: { water: 5 } }],
  }
  const calculate = vi.spyOn(solver, 'calculateNet')

  try {
    const result = calculateFactoryTotal([factoryModule], { recyclingEfficiencyPercent: 0 })

    expect(result.flows.find(flow => flow.resourceId === 'water')).toMatchObject({ produced: 5, consumed: 5, net: 0 })
    expect(result.contractResults).toEqual([])
    expect(result.contractFlows).toEqual([])
    expect(calculate).toHaveBeenCalledTimes(1)
  } finally {
    calculate.mockRestore()
  }
})
