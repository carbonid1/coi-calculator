import { expect, it } from 'vitest'

import { isNativeProducts, normalizeNativeProducts } from './product-state'
import { testProducts } from './test-fixtures/products'

it('retains native product kinds, unknown mod products, and separate stock measures', () => {
  const state = normalizeNativeProducts({ products: testProducts.catalog, unknownIds: [] },
    { products: testProducts.inventory, unknownIds: [] }, testProducts)

  expect(state).toEqual(testProducts)
  expect(state?.inventory.Product_Salt).toEqual({ quantity: 100, stored: 60, storageCapacity: 200 })
})

it('rejects duplicated IDs and inventory outside the captured catalog', () => {
  expect(isNativeProducts({ ...testProducts, catalog: [...testProducts.catalog, testProducts.catalog[0]] })).toBe(false)
  expect(isNativeProducts({ ...testProducts, inventory: { wrongId: testProducts.inventory.Product_Salt } })).toBe(false)
})

it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid inventory %s', quantity => {
  expect(isNativeProducts({ ...testProducts, inventory: {
    Product_Salt: { ...testProducts.inventory.Product_Salt, quantity },
  } })).toBe(false)
})

it('rejects unsupported product kinds and reported unknown products', () => {
  expect(isNativeProducts({ ...testProducts, catalog: [{ ...testProducts.catalog[0], kind: 'unsupported' }] })).toBe(false)
  expect(normalizeNativeProducts({ products: testProducts.catalog, unknownIds: ['unknown'] },
    { products: testProducts.inventory, unknownIds: [] }, testProducts)).toBeNull()
})
