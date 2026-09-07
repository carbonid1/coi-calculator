import { type ResourceId } from '../../db/resources'
import { type SyncedWorldCargoRoute, type SyncedWorldState } from '../../world-state'
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
  let workers = world.unassignedWorkers
  let mineUnityPerCycle = 0
  let electricityKw = 0

  for (const mine of world.mines) {
    workers += mine.workers
    mineUnityPerCycle += mine.unityPerCycle
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
    workers += route.modules.reduce((total, cargoModule) => total + cargoModule.workers, 0) + (route.ship?.workers ?? 0)
    electricityKw += route.operation.modules.reduce((total, cargoModule) => total + cargoModule.electricityKw, 0)
    const capacities: Quantities = {}, pickupLoads: Quantities = {}, onboard: Quantities = {}, onshore: Quantities = {}, offshoreAvailable: Quantities = {}
    let transferCycles = 0
    let shoreBlocked = false

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
      if (operation.shoreFreeCapacity <= 0 && operation.onboardQuantity > 0) shoreBlocked = true
      const capacity = Math.min(cargoModule.onboardCapacity, operation.shoreCapacity)

      if (capacity <= 0 || operation.transferPerCycle <= 0) continue
      add(capacities, id, capacity)
      transferCycles = Math.max(transferCycles, capacity / operation.transferPerCycle)
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
    const cycleDuration = ship?.journeyDurationSeconds ? ship.journeyDurationSeconds / 60 + transferCycles : null
    let status = operation?.state ?? 'NoShip'

    if (!route.running || !ship?.running) status = ship ? 'Paused' : 'NoShip'
    else if (route.operation.dockBlocked) status = 'CannotLeave'
    else if (shoreBlocked) status = 'ShoreStorageFull'
    else if (!entries(capacities).some(([, capacity]) => capacity > 0)) status = 'NoCargoCapacity'
    else if (ship.workers < (operation?.workersNeeded ?? 0)) status = 'NotEnoughWorkers'
    else if (cycleDuration === null) status = 'UnknownJourney'
    else if (ship.fuelPerTrip === null || !fuelResourceId) status = 'UnknownFuel'
    if (status === 'UnknownJourney') issues.push(`${route.depotCustomTitle || route.depotPrototypeName}: waiting for first voyage timing`)
    if (status === 'UnknownFuel') issues.push(`${route.depotCustomTitle || route.depotPrototypeName}: voyage fuel unavailable`)
    if (ship && !fuelResourceId) issues.push(`${route.depotPrototypeName}: unrecognized fuel ${ship.fuelProduct.name}`)
    return { route, capacities, pickupLoads, delivered: {}, sustained: {}, offshoreAvailable, onboard, onshore,
      cycleDuration, fuelResourceId, fuelPerCycle: status === 'UnknownJourney' || status === 'UnknownFuel' ? null : 0,
      unityPerCycle: 0, burstCyclesRemaining: null, status }
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
  let fuelComplete = world.unassignedShipIds.length === 0

  if (!fuelComplete) issues.push('Cargo ships without a depot have no recurring fuel estimate')
  for (const route of routes) {
    let tripsPerCycle = 0

    if (!blocked.has(route.status) && route.cycleDuration !== null) {
      const duration = route.cycleDuration
      const recurringTrips = Math.max(0, ...entries(route.sustained).map(([id, quantity]) => quantity / (route.pickupLoads[id] || Infinity)))
      // Any full product can trigger a mixed-cargo voyage. A manual partial
      // pickup still pays for one complete voyage, regardless of its load.
      const canCollect = entries(route.capacities).some(([id, capacity]) => capacity > 0 && (
        (route.offshoreAvailable[id] ?? 0) >= (route.pickupLoads[id] ?? capacity) - EPSILON
        || Boolean(route.route.operation.ship?.departureRequested && (route.offshoreAvailable[id] ?? 0) > 0)
      ))

      tripsPerCycle = canCollect ? 1 / duration : recurringTrips
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

    if (route.fuelPerCycle === null || (tripsPerCycle > 0 && (fuelPerTrip === null || fuelPerTrip === undefined || !route.fuelResourceId))) {
      route.fuelPerCycle = null
      fuelComplete = false
    } else {
      route.fuelPerCycle = tripsPerCycle * (fuelPerTrip ?? 0)
      const shipOperation = route.route.operation.ship

      if (shipOperation?.docked && shipOperation.canUseUnityForFuel && shipOperation.fuelQuantity < (fuelPerTrip ?? 0)) {
        // Unity covers the shortfall, while the ship still consumes the fuel
        // actually aboard. Do not charge a full tank and Unity for the same trip.
        route.fuelPerCycle = tripsPerCycle * shipOperation.fuelQuantity
        route.unityPerCycle = tripsPerCycle * (shipOperation.unityPerTrip ?? 0)
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
  return { routes, production, offshore, supplies, sustainedSupplies, fuelDemands, fuelComplete,
    workers, electricityKw, mineUnityPerCycle, issues }
}

export type WorldMineResult = ReturnType<typeof calculateWorldMines>
