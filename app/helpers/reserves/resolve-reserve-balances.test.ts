import { expect, it } from 'vitest'
import { type SyncedStorage } from '../../world-state'
import { resolveReserveBalances } from './resolve-reserve-balances'

const storage = (entityId: number, name: string, quantity: number, linked = false): SyncedStorage => ({
  entityId, product: { name, productId: `Product_${name.replaceAll(' ', '')}` }, quantity,
  capacity: quantity, trainLinked: linked, hasAssignedInputs: linked,
})

it('counts 200k+ of linked sulfur once while preserving other reserve policies', () => {
  const sulfur = storage(1, 'Sulfur', 250123, true)

  expect(resolveReserveBalances([sulfur, sulfur, storage(2, 'Sulfur', 5000),
    storage(3, 'Gold', 1000, true), storage(4, 'Gold', 10), storage(5, 'Fuel Gas', 50)]))
    .toEqual({ sulfur: 255123, gold: 10, fuelGas: 50 })
})

it('follows storage reassignment without a saved list of entity IDs', () => {
  expect(resolveReserveBalances([storage(1, 'Water', 250123, true)]).sulfur).toBe(0)
})
