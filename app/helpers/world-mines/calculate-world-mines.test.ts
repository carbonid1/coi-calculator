import { describe, expect, it } from 'vitest'

import { createWorldMine, createWorldRoute, createWorldState } from '../../test-fixtures/world-mines'
import { calculateWorldMines } from './calculate-world-mines'

describe('world-mine delivery', () => {
  it('follows actual production and shared shipping fuel without demand-capping imports', () => {
    const result = calculateWorldMines(createWorldState())

    expect(result.supplies.sulfur).toBeCloseTo(432)
    expect(result.fuelDemands.hydrogen).toBeCloseTo(432 / 9600 * 800)
    expect(result.workers).toBe(96 + 64 + 20)
    expect(result.mineUnityPerCycle).toBe(1.6)
  })
  it('does not assume mine count, level, product, module count, or fuel type', () => {
    const mine = createWorldMine({ product: { productId: 'Product_Water', name: 'Water' }, outputPerCycle: 75, capacityPerCycle: 75, workers: 7, workersNeeded: 7 })
    const route = createWorldRoute(3)

    route.ship!.fuelProduct = { productId: 'Product_Diesel', name: 'Diesel' }
    route.modules.forEach(module => { module.selectedProduct = mine.product })
    const result = calculateWorldMines(createWorldState(mine, route))

    expect(result.supplies).toEqual({ water: 75 })
    expect(result.fuelDemands).toEqual({ diesel: 75 / 3600 * 800 })
    expect(result.workers).toBe(7 + 24 + 20)
  })
  it('keeps offshore stock finite during an eight-module burst', () => {
    const mine = createWorldMine({ bufferQuantity: 19000 })
    const route = createWorldRoute()

    route.operation.ship!.availableCargo[0]!.quantity = 19000
    const result = calculateWorldMines(createWorldState(mine, route))

    expect(result.supplies.sulfur).toBeCloseTo(2400)
    expect(result.sustainedSupplies.sulfur).toBeCloseTo(432)
    expect(result.routes[0]!.burstCyclesRemaining).toBeCloseTo(19000 / (2400 - 432))
    expect(result.fuelDemands.hydrogen).toBeCloseTo(200)
  })
  it('stops recurring imports independently from mine production', () => {
    const world = createWorldState()

    world.routes[0]!.ship!.running = false
    const result = calculateWorldMines(world)

    expect(result.supplies).toEqual({})
    expect(result.fuelDemands.hydrogen).toBe(0)
    expect(result.mineUnityPerCycle).toBe(1.6)
    expect(result.workers).toBe(180) // Assigned counts are authoritative, including enabled shore modules.
  })
  it('can collect a paused mine buffer but never calls it sustained production', () => {
    const mine = createWorldMine({ running: false, state: 'Paused', outputPerCycle: 0, bufferQuantity: 19000, workers: 0, unityPerCycle: 0 })
    const route = createWorldRoute()

    route.operation.ship!.availableCargo[0]!.quantity = 19000
    const result = calculateWorldMines(createWorldState(mine, route))

    expect(result.supplies.sulfur).toBe(2400)
    expect(result.sustainedSupplies.sulfur).toBe(0)
    expect(result.routes[0]!.burstCyclesRemaining).toBeCloseTo(19000 / 2400)
  })
  it('preserves cargo already aboard when the ship is paused', () => {
    const world = createWorldState()

    world.routes[0]!.ship!.running = false
    world.routes[0]!.operation.modules[0]!.onboardQuantity = 1200
    const result = calculateWorldMines(world)

    expect(result.routes[0]!.onboard.sulfur).toBe(1200)
    expect(result.supplies).toEqual({})
  })
  it('shares production and buffers between depots instead of duplicating them', () => {
    const world = createWorldState()

    world.routes.push(createWorldRoute(4, 200))
    expect(calculateWorldMines(world).supplies.sulfur).toBeCloseTo(432)
  })
  it('does not invent first-voyage timing', () => {
    const world = createWorldState()

    world.routes[0]!.ship!.journeyDurationSeconds = null
    const result = calculateWorldMines(world)

    expect(result.supplies).toEqual({})
    expect(result.fuelComplete).toBe(false)
    expect(result.routes[0]!.fuelPerCycle).toBeNull()
  })
  it('charges one voyage for a manual partial pickup', () => {
    const world = createWorldState(createWorldMine({ running: false, state: 'Paused', outputPerCycle: 0, bufferQuantity: 500 }))

    world.routes[0]!.operation.ship!.availableCargo[0]!.quantity = 500
    world.routes[0]!.operation.ship!.departureRequested = true
    const result = calculateWorldMines(world)

    expect(result.supplies.sulfur).toBe(125)
    expect(result.fuelDemands.hydrogen).toBe(200)
    expect(result.routes[0]!.burstCyclesRemaining).toBe(4)
  })
  it('uses a smaller enabled mine buffer to size recurring pickups', () => {
    const world = createWorldState(createWorldMine({ bufferCapacity: 1000, outputPerCycle: 250, capacityPerCycle: 250 }), createWorldRoute(1))
    const result = calculateWorldMines(world)

    expect(result.supplies.sulfur).toBe(250)
    expect(result.fuelDemands.hydrogen).toBe(200)
  })
  it('shares one voyage between mixed resources, including a partial second product', () => {
    const world = createWorldState(createWorldMine({ bufferQuantity: 19000 }))
    const water = createWorldMine({ entityId: 2, product: { productId: 'Product_Water', name: 'Water' }, outputPerCycle: 25, capacityPerCycle: 25, bufferQuantity: 100 })

    world.mines.push(water)
    world.routes[0]!.modules.slice(4).forEach(module => { module.selectedProduct = water.product })
    world.routes[0]!.operation.ship!.availableCargo = [
      { product: world.mines[0]!.product, quantity: 19000, capacity: 19000 },
      { product: water.product, quantity: 100, capacity: 19000 },
    ]
    const result = calculateWorldMines(world)

    expect(result.supplies.sulfur).toBe(1200)
    expect(result.supplies.water).toBe(50)
    expect(result.fuelDemands.hydrogen).toBe(200)
  })
  it('keeps missing-fuel pressure while withholding blocked deliveries', () => {
    const world = createWorldState()

    world.routes[0]!.operation.ship!.state = 'NotEnoughFuel'
    world.routes[0]!.operation.ship!.fuelQuantity = 0
    const result = calculateWorldMines(world)

    expect(result.supplies).toEqual({})
    expect(result.sustainedSupplies).toEqual({})
    expect(result.fuelDemands.hydrogen).toBe(36)
  })
  it('does not charge both full fuel and Unity for a fuel shortfall', () => {
    const world = createWorldState()

    Object.assign(world.routes[0]!.operation.ship!, { fuelQuantity: 400, canUseUnityForFuel: true, unityPerTrip: 3 })
    const result = calculateWorldMines(world)

    expect(result.fuelDemands.hydrogen).toBe(18)
    expect(result.routes[0]!.unityPerCycle).toBeCloseTo(432 / 9600 * 3)
  })
  it('stops further pickups when the ship cannot unload into a full shore buffer', () => {
    const world = createWorldState()

    Object.assign(world.routes[0]!.operation.modules[0]!, { onboardQuantity: 1200, shoreQuantity: 1600, shoreFreeCapacity: 0 })
    const result = calculateWorldMines(world)

    expect(result.routes[0]!.status).toBe('ShoreStorageFull')
    expect(result.supplies).toEqual({})
    expect(result.routes[0]!.onboard.sulfur).toBe(1200)
  })
  it('marks missing trip fuel unavailable instead of crediting zero-cost imports', () => {
    const world = createWorldState()

    world.routes[0]!.ship!.fuelPerTrip = null
    const result = calculateWorldMines(world)

    expect(result.fuelComplete).toBe(false)
    expect(result.supplies).toEqual({})
  })
  it.each(['NotEnoughWorkers', 'NotEnoughUnity', 'ResourceDepleted', 'Paused'])('does not produce from a %s mine', state => {
    const result = calculateWorldMines(createWorldState(createWorldMine({ state, outputPerCycle: 0 })))

    expect(result.supplies.sulfur ?? 0).toBe(0)
  })
})
