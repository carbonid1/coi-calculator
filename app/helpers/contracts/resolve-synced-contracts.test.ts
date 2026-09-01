import { describe, expect, it } from 'vitest'

import { type SyncedContractRoute, type SyncedContractState } from '../../game-state'
import {
  getContractClaimedEntityIds,
  resolveSyncedContracts,
} from './resolve-synced-contracts'

const contractGameId = 'Contract_Product_UraniumOre_For_Product_FoodPack'
const established = {
  gameId: contractGameId,
  exportedProduct: { productId: 'Product_FoodPack', name: 'Food Pack' },
  exportedQuantity: 40,
  importedProduct: { productId: 'Product_UraniumOre', name: 'Uranium Ore' },
  importedQuantity: 60,
  unityPerCycle: 0.3,
  unityPer100Imported: 0.1,
  unityToEstablish: 18,
  minimumReputation: 1,
}

const createRoute = (depotEntityId: number): SyncedContractRoute => ({
  depotEntityId,
  depotPrototypeId: 'CargoDepotT2',
  depotPrototypeName: 'Cargo Depot (4)',
  depotCustomTitle: `Depot ${depotEntityId}`,
  running: true,
  slotCount: 4,
  contractGameId,
  zones: [{ id: 4, name: 'Harbor' }],
  modules: [{
    entityId: depotEntityId + 1,
    slot: 0,
    prototypeId: 'CargoDepotModuleUnitT3',
    prototypeName: 'Unit Module (L)',
    running: true,
    workers: 5,
    selectedProduct: { productId: 'Product_FoodPack', name: 'Food Pack' },
    direction: 'export',
    onboardCapacity: 800,
  }, {
    entityId: depotEntityId + 2,
    slot: 1,
    prototypeId: 'CargoDepotModuleLooseT3',
    prototypeName: 'Loose Module (L)',
    running: true,
    workers: 5,
    selectedProduct: { productId: 'Product_UraniumOre', name: 'Uranium Ore' },
    direction: 'import',
    onboardCapacity: 800,
  }],
  ship: {
    entityId: depotEntityId + 3,
    prototypeId: 'CargoShipT2',
    prototypeName: 'Cargo Ship (4)',
    running: true,
    workers: 22,
    fuelProduct: { productId: 'Product_Hydrogen', name: 'Hydrogen' },
    saveFuel: true,
    journeyDurationSeconds: 427,
    fuelPerTrip: 289,
  },
})

describe('synced contract resolution', () => {
  it('builds depot-identified routes and applies a route Plan', () => {
    const state: SyncedContractState = {
      established: [established],
      routes: [createRoute(1_000)],
    }
    const resolution = resolveSyncedContracts(state, {
      1_000: { importedPerProductionCycle: 54 },
    })

    expect(resolution.issues).toEqual([])
    expect(resolution.contracts).toMatchObject([{
      id: 'uranium-ore-for-food-pack',
      gameId: contractGameId,
      routes: [{
        id: 'contract-route-1000',
        source: 'planned',
        depotEntityId: 1_000,
        importedPerProductionCycle: 54,
        shipping: {
          fuelResourceId: 'hydrogen',
          roundTripDurationProductionCycles: 427 / 60,
          fuelPerTrip: 289,
        },
      }],
    }])
    expect([...resolution.claimedEntityIds]).toEqual([1_000, 1_001, 1_002, 1_003])
  })

  it('keeps an established contract that has no Cargo Depot', () => {
    const resolution = resolveSyncedContracts({
      established: [established],
      routes: [],
    })

    expect(resolution.contracts).toMatchObject([{
      id: 'uranium-ore-for-food-pack',
      routes: [],
    }])
  })

  it('claims unsupported routes before reporting them', () => {
    const route = createRoute(2_000)
    const state: SyncedContractState = {
      established: [established],
      routes: [{
        ...route,
        modules: route.modules.map((module, index) => index === 0
          ? {
              ...module,
              selectedProduct: { productId: 'Product_Unknown', name: 'Unknown' },
            }
          : module),
      }],
    }

    expect([...getContractClaimedEntityIds(state)]).toEqual([2_000, 2_001, 2_002, 2_003])
    const resolution = resolveSyncedContracts(state)

    expect(resolution.contracts[0]?.routes).toEqual([])
    expect(resolution.issues).toHaveLength(1)
  })

  it('keeps unconfigured Cargo Depot modules in route worker totals', () => {
    const route = createRoute(3_000)
    const resolution = resolveSyncedContracts({
      established: [established],
      routes: [{
        ...route,
        modules: [{
          ...route.modules[0],
          selectedProduct: null,
          direction: null,
        }, route.modules[1]],
      }],
    })

    expect(resolution.issues).toEqual([])
    expect(resolution.contracts[0]?.routes[0]?.cargoModules[0]).toMatchObject({
      direction: null,
      resourceId: null,
      workers: 5,
      running: true,
    })
  })
})
