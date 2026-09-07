import { expect, it } from 'vitest'
import { type Module } from '../../db/modules/modules'
import { createReservesModule } from '../../db/modules/reserves'
import { resolvePlanningBaselines } from '../../db/planning-baselines'
import { activeContracts } from '../../test-fixtures/active-contracts'
import { createWorldState } from '../../test-fixtures/world-mines'
import { calculateFactoryTotal } from '../factory-total/factory-total'
import { calculateReserveRunway, getReserveDrawPerProductionCycle } from '../reserves/reserves'
import { calculateWorldMines } from './calculate-world-mines'

const demand: Module = {
  id: 'test-demand', name: 'Test demand', description: '', builtBuildings: {},
  presets: [{ id: 'current', name: 'Current', description: '', activeBuildings: {}, fixed: [], fixedDemands: { sulfur: 600 } }],
  defaultPresetId: 'current',
}
const solve = (world = createWorldState(), balance = 250123) => {
  const mining = calculateWorldMines(world)
  const result = calculateFactoryTotal([demand, createReservesModule({ sulfur: balance, gold: 0, fuelGas: 0 })], {
    recyclingEfficiencyPercent: 90, externalSupplies: mining.supplies, externalDemands: mining.fuelDemands,
  })
  const draw = getReserveDrawPerProductionCycle(result.calculation.sourceResults, 'sulfur-virtual-provision', 'sulfur')

  return { result, draw, mining }
}

it('moves sulfur demand to and from real reserves on off/on transitions', () => {
  const world = createWorldState()

  expect(solve(world).draw).toBeCloseTo(168)
  world.routes[0]!.ship!.running = false
  const off = solve(world)

  expect(off.draw).toBe(600)
  expect(off.result.flows.find(flow => flow.resourceId === 'hydrogen')?.consumed ?? 0).toBe(0)
  expect(calculateReserveRunway(250123, off.draw).inGameYearsRemaining).toBeCloseTo(250123 / 600 / 12)
  world.routes[0]!.ship!.running = true
  const on = solve(world)

  expect(on.draw).toBeCloseTo(168)
  expect(on.result.flows.find(flow => flow.resourceId === 'hydrogen')?.consumed).toBeCloseTo(36)
})

it('preserves stockpile growth from a burst above factory demand', () => {
  const world = createWorldState()

  world.mines[0]!.bufferQuantity = 19000
  world.routes[0]!.operation.ship!.availableCargo[0]!.quantity = 19000
  const { result, draw } = solve(world)

  expect(draw).toBe(0)
  expect(result.flows.find(flow => flow.resourceId === 'sulfur')?.net).toBeCloseTo(1800)
})

it('shows a deficit when both imports and reserves are unavailable', () => {
  const world = createWorldState()

  world.routes[0]!.ship!.running = false
  const { result, draw } = solve(world, 0)

  expect(draw).toBe(0)
  expect(result.flows.find(flow => flow.resourceId === 'sulfur')?.net).toBe(-600)
})

it('replaces historical cargo fuel in the same averaging window', () => {
  const empty = { averagePerCycle: 0, sampleMonths: 0 }
  const baseline = resolvePlanningBaselines({ history: {
    electricityGeneration: { byType: [] },
    hydrogenFuel: {
      total: { averagePerCycle: 120, sampleMonths: 120 },
      byUse: { vehicles: empty, cargoShips: { averagePerCycle: 200, sampleMonths: 60 },
        battleShip: empty, powerGenerators: empty, trains: empty },
    },
  } }, true)

  expect(baseline.hydrogenFuelDemandPerCycle).toBe(20)
})

it('includes world-cargo and contract fuel in the same factory exactly once', () => {
  const mining = calculateWorldMines(createWorldState())
  const result = calculateFactoryTotal([demand, createReservesModule({ sulfur: 250123, gold: 0, fuelGas: 0 })], {
    recyclingEfficiencyPercent: 90, contracts: activeContracts.slice(0, 1),
    externalSupplies: mining.supplies, externalDemands: mining.fuelDemands,
  })

  expect(result.flows.find(flow => flow.resourceId === 'hydrogen')?.consumed).toBeCloseTo(36 + 9.75375)
  expect(getReserveDrawPerProductionCycle(result.calculation.sourceResults, 'sulfur-virtual-provision', 'sulfur')).toBeCloseTo(168)
})
