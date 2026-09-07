import { type SyncedWorldCargoRoute, type SyncedWorldMine, type SyncedWorldState } from '../world-state'

export const createWorldMine = (overrides: Partial<SyncedWorldMine> = {}): SyncedWorldMine => ({
  entityId: 1, prototypeId: 'SulfurMine', name: 'Sulfur mine VIII', product: { productId: 'Product_Sulfur', name: 'Sulfur' },
  repaired: true, running: true, state: 'Working', level: 8, maxLevel: 8, productionStep: 8,
  outputPerCycle: 432, capacityPerCycle: 432, workers: 96, workersNeeded: 96,
  unityPerCycle: 1.6, maximumUnityPerCycle: 1.6, bufferQuantity: 0, bufferCapacity: 19000, depositQuantity: null,
  ...overrides,
})

export const createWorldRoute = (moduleCount = 8, depotEntityId = 100): SyncedWorldCargoRoute => {
  const modules = Array.from({ length: moduleCount }, (_, slot) => ({
    entityId: depotEntityId + slot + 1, slot, prototypeId: 'CargoDepotModuleLooseT3', prototypeName: 'Loose Module (L)',
    running: true, workers: 8, selectedProduct: { productId: 'Product_Sulfur', name: 'Sulfur' },
    direction: 'import' as const, onboardCapacity: 1200,
  }))

  return {
    depotEntityId, depotPrototypeId: 'CargoDepotT4', depotPrototypeName: 'Cargo Depot (8)', depotCustomTitle: null,
    contractGameId: null, running: true, slotCount: moduleCount, zones: [], modules,
    ship: { entityId: depotEntityId + 50, prototypeId: 'CargoShipT4', prototypeName: 'Cargo Ship (8)', running: true,
      workers: 20, fuelProduct: { productId: 'Product_Hydrogen', name: 'Hydrogen' }, saveFuel: true,
      journeyDurationSeconds: 180, fuelPerTrip: 800 },
    operation: {
      dockBlocked: false,
      modules: modules.map(module => ({ entityId: module.entityId, state: 'Idle', operational: true, workersNeeded: 8,
        shoreQuantity: 0, shoreCapacity: 1600, shoreFreeCapacity: 1600, onboardQuantity: 0,
        onboardFreeCapacity: 1200, transferPerCycle: 1200, electricityKw: 0 })),
      ship: { state: 'NothingToPickUp', docked: true, inTransit: false, workersNeeded: 20, fuelQuantity: 800,
        canUseUnityForFuel: false, unityPerTrip: null, departureRequested: false,
        availableCargo: [{ product: { productId: 'Product_Sulfur', name: 'Sulfur' }, quantity: 0, capacity: 19000 }] },
    },
  }
}

export const createWorldState = (mine = createWorldMine(), route = createWorldRoute()): SyncedWorldState => ({
  mines: [mine], routes: [route], unassignedShipIds: [], unassignedWorkers: 0,
})
