import { expect, it } from 'vitest'
import { normalizeGameStateSnapshot } from './game-state'
import { createCacheTestModel } from './test-fixtures/factory-calculation-cache'
import { createWorldState } from './test-fixtures/world-mines'

const snapshot = () => ({ ...createCacheTestModel().snapshot, world: createWorldState(), storages: [{
  entityId: 500, product: { productId: 'Product_Sulfur', name: 'Sulfur' }, quantity: 250123, capacity: 300000,
  trainLinked: true, hasAssignedInputs: true,
}] })

it('normalizes world cargo and derives linked sulfur reserves from inventory', () => {
  const normalized = normalizeGameStateSnapshot(snapshot())

  expect(normalized?.world.routes[0]?.operation.modules).toHaveLength(8)
  expect(normalized?.reserves.sulfur).toBe(250123)
})

it('rejects duplicate inventories and invalid operating data', () => {
  const value = snapshot()

  expect(normalizeGameStateSnapshot({ ...value, storages: [...value.storages, ...value.storages] })).toBeNull()
  expect(normalizeGameStateSnapshot({ ...value, world: { ...value.world, mines: [...value.world.mines, ...value.world.mines] } })).toBeNull()
  value.world.routes[0]!.operation.modules[0]!.transferPerCycle = NaN
  expect(normalizeGameStateSnapshot(value)).toBeNull()
})

it('rejects cargo operation records that do not belong to the route', () => {
  const value = snapshot()

  value.world.routes[0]!.operation.modules[0]!.entityId = 9999
  expect(normalizeGameStateSnapshot(value)).toBeNull()
})

it('rejects missing world state instead of reviving the old sulfur source', () => {
  expect(normalizeGameStateSnapshot({ ...snapshot(), world: undefined })).toBeNull()
})
