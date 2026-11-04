import { type SyncedContractState } from '../game-state'
import { resolveSyncedResourceId } from '../helpers/synced-resources/synced-resources'
import { type SyncedCargoOperation } from '../world-state'
import { type ResourceId, resources } from './resources'

interface ContractResource {
  resourceId: ResourceId
  quantity: number
}

export interface Contract {
  gameId?: string
  id: string
  name: string
  exchange: {
    exported: ContractResource
    imported: ContractResource
  }
  unity: {
    perProductionCycle: number
    per100Imported: number
    establish: number
  }
  minimumReputation: number
}

export interface ContractCargoModule {
  entityId: number | null
  slot: number
  prototypeId: string
  buildingName: string
  direction: 'export' | 'import' | null
  resourceId: ResourceId | null
  workers: number
  running: boolean
  onboardCapacity: number
}

export interface ContractRoute {
  operation?: SyncedCargoOperation
  id: string
  source: 'synced' | 'planned'
  depotEntityId: number | null
  depotPrototypeId: string
  depotName: string
  depotSize: number
  enabled: boolean
  running: boolean
  zones: readonly { id: number; name: string | null }[]
  cargoModules: readonly ContractCargoModule[]
  ship: {
    entityId: number | null
    prototypeId: string
    name: string
    workers: number
    running: boolean
  } | null
  shipping: {
    fuelResourceId: ResourceId
    saveFuel: boolean
    /** Measured full round trip from the game, expressed in 60-second production cycles. */
    roundTripDurationProductionCycles: number | null
    /** Exact current ship fuel load from the game. Null for planned-only routes. */
    fuelPerTrip: number | null
  }
  /** Fixed route allocation, or null to share the contract's demand-balanced remainder. */
  importedPerProductionCycle: number | null
}

export interface ActiveContract extends Contract {
  gameId: string
  routes: readonly ContractRoute[]
  /** Dynamic routes may exchange spare payment goods beyond factory import demand. */
  exportSurplus?: boolean
}

export const getContractExchangeId = (exported: ResourceId, imported: ResourceId) => {
  const slug = (id: ResourceId) => id.replaceAll(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase()

  return slug(imported) + '-for-' + slug(exported)
}

export const contractFromGame = (
  source: SyncedContractState['established'][number],
): (Contract & { gameId: string }) | null => {
  const exported = resolveSyncedResourceId(source.exportedProduct)
  const imported = resolveSyncedResourceId(source.importedProduct)

  if (!exported || !imported) return null
  return {
    id: getContractExchangeId(exported, imported),
    gameId: source.gameId,
    name: resources[exported].name + ' → ' + resources[imported].name,
    exchange: {
      exported: { resourceId: exported, quantity: source.exportedQuantity },
      imported: { resourceId: imported, quantity: source.importedQuantity },
    },
    unity: {
      perProductionCycle: source.unityPerCycle,
      per100Imported: source.unityPer100Imported,
      establish: source.unityToEstablish,
    },
    minimumReputation: source.minimumReputation,
  }
}

export const getContractCatalog = (sources: SyncedContractState['established']) => {
  const contracts = sources.flatMap(source => {
    const contract = contractFromGame(source)

    return contract ? [contract] : []
  })
  const counts = new Map<string, number>()

  for (const contract of contracts) counts.set(contract.id, (counts.get(contract.id) ?? 0) + 1)
  return contracts.map(contract =>
    (counts.get(contract.id) ?? 0) > 1
      ? { ...contract, id: contract.id + ':' + contract.gameId }
      : contract,
  )
}
