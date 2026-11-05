import { expect, it } from 'vitest'
import { type Module } from '../../db/modules/modules'
import { createReservesModule } from '../../db/modules/reserves'
import { resolvePlanningBaselines } from '../../db/planning-baselines'
import { activeContracts } from '../../test-fixtures/active-contracts'
import { calculateFactoryTotal } from '../../test-fixtures/factory-total'
import { createWorldState } from '../../test-fixtures/world-mines'
import { calculateFactoryCalculation } from '../factory-calculation/factory-calculation'
import { calculateReserveRunway, getReserveDrawPerProductionCycle } from '../reserves/reserves'
import { calculateWorldMines } from './calculate-world-mines'
import { limitWorldMineDeliveries } from './world-mine-planning'
import { getWorldMineLocalStock } from './world-mine-storage'

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

it('balances world cargo against demand, retains enabled crews and mine costs, and persists a full-throttle alternative', () => {
  const world = createWorldState()
  const run = (sulfur: number, fullThrottle: boolean) => calculateFactoryCalculation({
    contracts: [], contractsProfitMultiplier: 1, links: [], outputModifiers: {}, recyclingEfficiencyPercent: 90,
    modules: [{ ...demand, presets: [{ ...demand.presets[0]!, fixedDemands: { sulfur } }] },
      createReservesModule({ sulfur: 250123, gold: 0, fuelGas: 0 })],
    worldMinePlanning: { world, fullThrottle: { Product_Sulfur: fullThrottle } },
  })
  const balanced = run(100, false)

  expect(balanced.worldMines?.supplies.sulfur).toBeCloseTo(100)
  expect(balanced.worldMines?.fuelDemands.hydrogen).toBeCloseTo(100 / 9600 * 800)
  expect(balanced.worldMines?.workers).toBe(180)
  expect(balanced.worldMines?.mineUnityPerCycle).toBe(1.6)
  expect(balanced.factoryResult.flows.find(flow => flow.resourceId === 'sulfur')?.net).toBeCloseTo(0)
  expect(run(0, false).worldMines?.fuelDemands.hydrogen ?? 0).toBe(0)
  const full = run(100, true)

  expect(full.worldMines?.supplies.sulfur).toBeCloseTo(432)
  expect(full.factoryResult.flows.find(flow => flow.resourceId === 'sulfur')?.net).toBeCloseTo(332)
  world.routes[0]!.ship!.running = false
  const paused = run(100, false)

  expect(paused.worldMines?.supplies.sulfur ?? 0).toBe(0)
  expect(getReserveDrawPerProductionCycle(paused.factoryResult.calculation.sourceResults, 'sulfur-virtual-provision', 'sulfur')).toBeCloseTo(100)
})

it('counts only verified depot storage, deduplicates shared buffers, and withholds incomplete evidence', () => {
  const world = createWorldState()
  const first = world.routes[0]!

  first.operation.connections = [{ product: world.mines[0]!.product, direction: 'import', capacityPerCycle: 450, storageEntityIds: [500, 501] }]
  const result = calculateWorldMines(world)
  const routes = [result.routes[0]!, { ...result.routes[0]!, route: { ...first, depotEntityId: 200 } }]
  const storages = [500, 501, 999].map(entityId => ({
    entityId, product: world.mines[0]!.product, quantity: entityId === 999 ? 100000 : 10,
    capacity: 200000, trainLinked: false, hasAssignedInputs: false,
  }))

  expect(getWorldMineLocalStock(routes, 'sulfur', storages)).toEqual({ count: 2, quantity: 20, capacity: 400000 })
  expect(getWorldMineLocalStock(routes, 'sulfur', storages.slice(1))).toBeNull()
  first.operation.connections[0]!.storageEntityIds = null
  expect(getWorldMineLocalStock(routes, 'sulfur', storages)).toBeNull()
})

it('keeps a shared voyage cost and recalculates finite stock horizons when balancing mixed cargo', () => {
  const world = createWorldState()

  world.mines[0]!.bufferQuantity = 19000
  world.mines.push({ ...world.mines[0]!, entityId: 2, product: { productId: 'Product_Water', name: 'Water' }, outputPerCycle: 25, capacityPerCycle: 25, bufferQuantity: 100 })
  const route = world.routes[0]!

  route.modules.slice(4).forEach(module => { module.selectedProduct = world.mines[1]!.product })
  route.operation.ship!.availableCargo = world.mines.map(mine => ({ product: mine.product, quantity: mine.bufferQuantity, capacity: mine.bufferCapacity }))
  const full = calculateWorldMines(world)
  const balanced = limitWorldMineDeliveries(full, { sulfur: 10 })

  expect(balanced.supplies.sulfur).toBeCloseTo(10)
  expect(balanced.supplies.water).toBe(full.supplies.water)
  expect(balanced.fuelDemands.hydrogen).toBe(full.fuelDemands.hydrogen)
  expect(balanced.routes[0]!.burstCyclesRemaining).toBeCloseTo(100 / ((balanced.routes[0]!.delivered.water ?? 0) - (balanced.routes[0]!.sustained.water ?? 0)))
})

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
