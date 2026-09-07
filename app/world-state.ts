import { type SyncedContractRoute } from './game-state'

export interface SyncedWorldMine {
  entityId: number
  prototypeId: string
  name: string
  product: { productId: string; name: string }
  repaired: boolean
  running: boolean
  state: string
  level: number
  maxLevel: number
  productionStep: number
  outputPerCycle: number
  capacityPerCycle: number
  workers: number
  workersNeeded: number
  unityPerCycle: number
  maximumUnityPerCycle: number
  bufferQuantity: number
  bufferCapacity: number
  depositQuantity: number | null
}

export interface SyncedCargoModuleOperation {
  entityId: number
  state: string
  operational: boolean
  workersNeeded: number
  shoreQuantity: number
  shoreCapacity: number
  shoreFreeCapacity: number
  onboardQuantity: number
  onboardFreeCapacity: number
  transferPerCycle: number
  electricityKw: number
}

export interface SyncedCargoOperation {
  dockBlocked: boolean
  modules: SyncedCargoModuleOperation[]
  ship: {
    state: string
    docked: boolean
    inTransit: boolean
    workersNeeded: number
    fuelQuantity: number
    canUseUnityForFuel: boolean
    unityPerTrip: number | null
    departureRequested: boolean
    availableCargo: { product: { productId: string; name: string }; quantity: number; capacity: number }[]
  } | null
}

export interface SyncedWorldCargoRoute extends Omit<SyncedContractRoute, 'contractGameId' | 'operation'> {
  contractGameId: null
  operation: SyncedCargoOperation
}

export interface SyncedWorldState {
  mines: SyncedWorldMine[]
  routes: SyncedWorldCargoRoute[]
  /** Active ships without a depot cannot be assigned a recurring route cost. */
  unassignedShipIds: number[]
  unassignedWorkers: number
}

export interface SyncedStorage {
  entityId: number
  product: { productId: string; name: string }
  quantity: number
  capacity: number
  trainLinked: boolean
  hasAssignedInputs: boolean
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const integer = (v: unknown): v is number => number(v) && Number.isInteger(v)
const string = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const product = (v: unknown) => record(v) && string(v.productId) && string(v.name)
const unique = (ids: number[]) => new Set(ids).size === ids.length

export const isCargoOperation = (value: unknown): value is SyncedCargoOperation => {
  if (!record(value) || typeof value.dockBlocked !== 'boolean' || !Array.isArray(value.modules)) return false
  if (!value.modules.every(m => record(m) && integer(m.entityId) && string(m.state)
    && typeof m.operational === 'boolean' && integer(m.workersNeeded)
    && number(m.shoreQuantity) && number(m.shoreCapacity) && m.shoreQuantity <= m.shoreCapacity
    && number(m.shoreFreeCapacity) && m.shoreFreeCapacity <= m.shoreCapacity
    && number(m.onboardQuantity) && number(m.onboardFreeCapacity)
    && number(m.transferPerCycle) && number(m.electricityKw))) return false
  if (!unique(value.modules.map(m => m.entityId))) return false
  const ship = value.ship

  return ship === null || (record(ship) && string(ship.state)
    && typeof ship.docked === 'boolean' && typeof ship.inTransit === 'boolean'
    && ship.docked !== ship.inTransit
    && integer(ship.workersNeeded) && number(ship.fuelQuantity)
    && typeof ship.canUseUnityForFuel === 'boolean'
    && (ship.unityPerTrip === null || number(ship.unityPerTrip))
    && typeof ship.departureRequested === 'boolean'
    && Array.isArray(ship.availableCargo) && ship.availableCargo.every(c => record(c)
      && product(c.product) && number(c.quantity) && number(c.capacity))
    && new Set(ship.availableCargo.map(c => c.product.productId)).size === ship.availableCargo.length)
}

export const normalizeStorages = (value: unknown): SyncedStorage[] | null => {
  if (!Array.isArray(value)) return null
  const storages = value.filter((s): s is SyncedStorage => record(s) && integer(s.entityId)
    && product(s.product) && number(s.quantity) && number(s.capacity) && s.quantity <= s.capacity
    && typeof s.trainLinked === 'boolean' && typeof s.hasAssignedInputs === 'boolean')

  return storages.length === value.length && unique(storages.map(s => s.entityId)) ? storages : null
}

export const normalizeWorldMines = (value: unknown): SyncedWorldMine[] | null => {
  if (!Array.isArray(value)) return null
  const mines = value.filter((m): m is SyncedWorldMine => record(m) && integer(m.entityId)
    && string(m.prototypeId) && string(m.name) && product(m.product)
    && typeof m.repaired === 'boolean' && typeof m.running === 'boolean' && string(m.state)
    && integer(m.level) && integer(m.maxLevel) && m.level <= m.maxLevel
    && integer(m.productionStep) && m.productionStep <= m.level
    && number(m.outputPerCycle) && number(m.capacityPerCycle) && m.outputPerCycle <= m.capacityPerCycle
    && integer(m.workers) && integer(m.workersNeeded)
    && number(m.unityPerCycle) && number(m.maximumUnityPerCycle)
    && number(m.bufferQuantity) && number(m.bufferCapacity) && m.bufferQuantity <= m.bufferCapacity
    && (m.depositQuantity === null || number(m.depositQuantity)))

  return mines.length === value.length && unique(mines.map(m => m.entityId)) ? mines : null
}
