import { type ResourceId } from '../../db/resources'
import { type SyncedWorldCargoRoute, type SyncedWorldMine, type SyncedWorldState } from '../../world-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'
import { typedEntries } from '../typed-entries/typed-entries'

type Quantities = Partial<Record<ResourceId, number>>
export interface WorldCargoResult {
  route: SyncedWorldCargoRoute
  capacities: Quantities
  pickupLoads: Quantities
  delivered: Quantities
  sustained: Quantities
  offshoreAvailable: Quantities
  onboard: Quantities
  onshore: Quantities
  cycleDuration: number | null
  fuelResourceId: ResourceId | null
  fuelPerCycle: number | null
  unityPerCycle: number
  burstCyclesRemaining: number | null
  status: string
}

const add = (values: Quantities, id: ResourceId, quantity: number) => {
  values[id] = (values[id] ?? 0) + quantity
}
const entries = (values: Quantities) => typedEntries(values)
const EPSILON = 1e-6

export const getWorldMineWorkers = (mine: SyncedWorldMine) => Math.max(mine.workers, mine.repaired && mine.running ? mine.workersNeeded : 0)
export const getWorldCargoWorkers = (route: SyncedWorldCargoRoute) => (
  route.modules.reduce((total, module) => total + Math.max(module.workers, route.running && module.running
    ? route.operation.modules.find(operation => operation.entityId === module.entityId)?.workersNeeded ?? module.workers : 0), 0)
  + Math.max(route.ship?.workers ?? 0, route.running && route.ship?.running ? route.operation.ship?.workersNeeded ?? route.ship.workers : 0)
)

export const getWorldClaimedEntityIds = (world: SyncedWorldState) => new Set([
  ...world.mines.map(mine => mine.entityId),
  ...world.routes.flatMap(route => [route.depotEntityId, ...route.modules.map(cargoModule => cargoModule.entityId),
    ...(route.ship ? [route.ship.entityId] : [])]),
])

/** Forecasts the current operating configuration. Finite bursts carry an explicit horizon. */
export const calculateWorldMines = (world: SyncedWorldState) => {
  const production: Quantities = {}
  const offshore: Quantities = {}
  const bufferCapacities: Quantities = {}
  const enabledBufferCapacities: Quantities = {}
  const issues: string[] = []
  const costs = { workers: world.unassignedWorkers, mineUnityPerCycle: 0, electricityKw: 0 }

  for (const mine of world.mines) {
    costs.workers += getWorldMineWorkers(mine)
    costs.mineUnityPerCycle += mine.unityPerCycle
    const id = resolveSyncedResourceId(mine.product)

    if (!id) { issues.push(`${mine.name}: unrecognized product ${mine.product.name}`); continue }
    add(offshore, id, mine.bufferQuantity)
    if (mine.repaired) add(bufferCapacities, id, mine.bufferCapacity)
    if (mine.running) add(enabledBufferCapacities, id, mine.bufferCapacity)
    // A full buffer resumes production as cargo is removed. Other blocked states do not.
    if (mine.repaired && mine.running && (mine.state === 'Working' || mine.state === 'FullStorage')) {
      add(production, id, mine.state === 'FullStorage' ? mine.capacityPerCycle : mine.outputPerCycle)
    }
  }
  const routes: WorldCargoResult[] = world.routes.map(route => {
    costs.workers += getWorldCargoWorkers(route)
    costs.electricityKw += route.operation.modules.reduce((total, cargoModule) => total + cargoModule.electricityKw, 0)
    const capacities: Quantities = {}, pickupLoads: Quantities = {}, onboard: Quantities = {}, onshore: Quantities = {}, offshoreAvailable: Quantities = {}
    const loading = { transferCycles: 0, shoreBlocked: false }

    for (const cargoModule of route.modules) {
      const operation = route.operation.modules.find(item => item.entityId === cargoModule.entityId)
      const id = cargoModule.selectedProduct ? resolveSyncedResourceId(cargoModule.selectedProduct) : undefined

      if (!operation || !id) {
        if (cargoModule.selectedProduct && !id) issues.push(`${route.depotPrototypeName}: unrecognized product ${cargoModule.selectedProduct.name}`)
        continue
      }
      add(onboard, id, operation.onboardQuantity)
      add(onshore, id, operation.shoreQuantity)
      if (cargoModule.direction !== 'import' || !cargoModule.running || !operation.operational) continue
      // A ship cannot finish unloading while any of its import buffers is blocked.
      if (operation.shoreFreeCapacity <= 0 && operation.onboardQuantity > 0) loading.shoreBlocked = true
      const capacity = Math.min(cargoModule.onboardCapacity, operation.shoreCapacity)

      if (capacity <= 0 || operation.transferPerCycle <= 0) continue
      add(capacities, id, capacity)
      loading.transferCycles = Math.max(loading.transferCycles, capacity / operation.transferPerCycle)
    }
    for (const [id, capacity] of entries(capacities)) {
      // The game permits departure when an enabled mine buffer is full, even if
      // that buffer is smaller than the ship. The cargo pool bounds each pickup.
      capacities[id] = Math.min(capacity, bufferCapacities[id] ?? 0)
      pickupLoads[id] = Math.min(capacities[id], enabledBufferCapacities[id] || capacities[id])
    }
    for (const item of route.operation.ship?.availableCargo ?? []) {
      const id = resolveSyncedResourceId(item.product)

      if (id) offshoreAvailable[id] = item.quantity
    }
    const ship = route.ship, operation = route.operation.ship
    const fuelResourceId = ship ? resolveSyncedResourceId(ship.fuelProduct) ?? null : null
    const cycleDuration = ship?.journeyDurationSeconds ? ship.journeyDurationSeconds / 60 + loading.transferCycles : null
    const state = { status: operation?.state ?? 'NoShip' }

    if (!route.running || !ship?.running) state.status = ship ? 'Paused' : 'NoShip'
    else if (route.operation.dockBlocked) state.status = 'CannotLeave'
    else if (loading.shoreBlocked) state.status = 'ShoreStorageFull'
    else if (!entries(capacities).some(([, capacity]) => capacity > 0)) state.status = 'NoCargoCapacity'
    else if (ship.workers < (operation?.workersNeeded ?? 0)) state.status = 'NotEnoughWorkers'
    else if (cycleDuration === null) state.status = 'UnknownJourney'
    else if (ship.fuelPerTrip === null || !fuelResourceId) state.status = 'UnknownFuel'
    if (state.status === 'UnknownJourney') issues.push(`${route.depotCustomTitle || route.depotPrototypeName}: waiting for first voyage timing`)
    if (state.status === 'UnknownFuel') issues.push(`${route.depotCustomTitle || route.depotPrototypeName}: voyage fuel unavailable`)
    if (ship && !fuelResourceId) issues.push(`${route.depotPrototypeName}: unrecognized fuel ${ship.fuelProduct.name}`)
    return { route, capacities, pickupLoads, delivered: {}, sustained: {}, offshoreAvailable, onboard, onshore,
      cycleDuration, fuelResourceId, fuelPerCycle: state.status === 'UnknownJourney' || state.status === 'UnknownFuel' ? null : 0,
      unityPerCycle: 0, burstCyclesRemaining: null, status: state.status }
  })
  const blocked = new Set(['Paused', 'NoShip', 'CannotLeave', 'ShoreStorageFull', 'NoModulesBuilt', 'NoCargoCapacity', 'NotEnoughWorkers', 'UnknownJourney', 'UnknownFuel'])
  const candidates = routes.filter((route): route is WorldCargoResult & { cycleDuration: number } => !blocked.has(route.status) && route.cycleDuration !== null)
  const transport: Quantities = {}

  for (const route of candidates) for (const [id, capacity] of entries(route.pickupLoads)) {
    if (capacity > 0) add(transport, id, capacity / route.cycleDuration)
  }

  // Allocate a shared mine pool proportionally to each route's carrying rate.
  // No route receives another copy of the same offshore inventory or production.
  for (const [id, totalCapacity] of entries(transport)) {
    const output = production[id] ?? 0
    const sustainable = Math.min(output, totalCapacity)

    for (const route of candidates) {
      const capacity = route.pickupLoads[id] ?? 0

      if (capacity <= 0) continue
      const rate = capacity / route.cycleDuration
      const share = rate / totalCapacity

      route.sustained[id] = sustainable * share
      const available = Math.min((offshore[id] ?? 0) * share, route.offshoreAvailable[id] ?? 0)

      route.offshoreAvailable[id] = available
    }
  }
  const supplies: Quantities = {}, sustainedSupplies: Quantities = {}, fuelDemands: Quantities = {}
  const fuel = { complete: world.unassignedShipIds.length === 0 }

  if (!fuel.complete) issues.push('Cargo ships without a depot have no recurring fuel estimate')
  for (const route of routes) {
    const trips = { perCycle: 0 }

    if (!blocked.has(route.status) && route.cycleDuration !== null) {
      const duration = route.cycleDuration
      const recurringTrips = Math.max(0, ...entries(route.sustained).map(([id, quantity]) => quantity / (route.pickupLoads[id] || Infinity)))
      // Any full product can trigger a mixed-cargo voyage. A manual partial
      // pickup still pays for one complete voyage, regardless of its load.
      const canCollect = entries(route.capacities).some(([id, capacity]) => capacity > 0 && (
        (route.offshoreAvailable[id] ?? 0) >= (route.pickupLoads[id] ?? capacity) - EPSILON
        || Boolean(route.route.operation.ship?.departureRequested && (route.offshoreAvailable[id] ?? 0) > 0)
      ))

      trips.perCycle = canCollect ? 1 / duration : recurringTrips
      for (const [id, capacity] of entries(route.capacities)) {
        const sustained = route.sustained[id] ?? 0
        const available = route.offshoreAvailable[id] ?? 0
        const delivered = canCollect ? Math.min(capacity / duration, available / duration + sustained) : sustained

        route.delivered[id] = delivered
        const extra = delivered - sustained

        if (extra > EPSILON) route.burstCyclesRemaining = Math.min(route.burstCyclesRemaining ?? Infinity, available / extra)
      }
    }
    const fuelPerTrip = route.route.ship?.fuelPerTrip

    if (route.fuelPerCycle === null || (trips.perCycle > 0 && (fuelPerTrip === null || fuelPerTrip === undefined || !route.fuelResourceId))) {
      route.fuelPerCycle = null
      fuel.complete = false
    } else {
      route.fuelPerCycle = trips.perCycle * (fuelPerTrip ?? 0)
      const shipOperation = route.route.operation.ship

      if (shipOperation?.docked && shipOperation.canUseUnityForFuel && shipOperation.fuelQuantity < (fuelPerTrip ?? 0)) {
        // Unity covers the shortfall, while the ship still consumes the fuel
        // actually aboard. Do not charge a full tank and Unity for the same trip.
        route.fuelPerCycle = trips.perCycle * shipOperation.fuelQuantity
        route.unityPerCycle = trips.perCycle * (shipOperation.unityPerTrip ?? 0)
      }
      if (route.fuelResourceId) add(fuelDemands, route.fuelResourceId, route.fuelPerCycle)
    }
    if (route.status === 'NotEnoughFuel' && !route.route.operation.ship?.canUseUnityForFuel) {
      route.delivered = {}
      route.sustained = {}
      route.burstCyclesRemaining = null
    }
    for (const [id, quantity] of entries(route.delivered)) add(supplies, id, quantity)
    for (const [id, quantity] of entries(route.sustained)) add(sustainedSupplies, id, quantity)
  }
  return { routes, production, offshore, supplies, sustainedSupplies, fuelDemands, fuelComplete: fuel.complete,
    ...costs, issues }
}

export type WorldMineResult = ReturnType<typeof calculateWorldMines>
