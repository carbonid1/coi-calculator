import { type ResourceId } from '../../db/resources'
import { type SyncedStorage } from '../../world-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'
import { type WorldCargoResult } from './calculate-world-mines'

/** The connected storage banks on these depot lines, deduplicated across routes. */
export const getWorldMineLocalStock = (routes: WorldCargoResult[], resourceId: ResourceId, storages: SyncedStorage[]) => {
  if (routes.length === 0) return null
  const ids = new Set<number>()

  for (const cargo of routes) {
    const connection = cargo.route.operation.connections?.find(connection => (
      connection.direction === 'import' && resolveSyncedResourceId(connection.product) === resourceId
    ))

    if (!connection || connection.storageEntityIds == null) return null
    for (const id of connection.storageEntityIds) ids.add(id)
  }
  const connected = storages.filter(storage => ids.has(storage.entityId) && resolveSyncedResourceId(storage.product) === resourceId)

  if (connected.length !== ids.size) return null
  return {
    count: connected.length,
    quantity: connected.reduce((total, storage) => total + storage.quantity, 0),
    capacity: connected.reduce((total, storage) => total + storage.capacity, 0),
  }
}
