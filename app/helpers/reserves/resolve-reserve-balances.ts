import { mapReserveResources } from '../../db/reserve-resources'
import { type SyncedStorage } from '../../world-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'

/** Inventory is captured once; reserve eligibility belongs to the resource catalog. */
export const resolveReserveBalances = (storages: readonly SyncedStorage[]) => {
  const uniqueStorages = [...new Map(storages.map(storage => [storage.entityId, storage])).values()]

  return mapReserveResources(definition => uniqueStorages.reduce((total, storage) => {
    if (resolveSyncedResourceId(storage.product) !== definition.resourceId) return total
    if (definition.storageScope === 'standalone' && (storage.trainLinked || storage.hasAssignedInputs)) return total
    return total + storage.quantity
  }, 0))
}
