import { expect, it } from 'vitest'

import { resources } from '../../db/resources'
import { testProducts } from '../../test-fixtures/products'
import { getProductIconUrl, getResourceProducts } from './products'

it('uses native names and IDs without mutating fallback labels or another game', () => {
  const native = getResourceProducts(testProducts)
  const other = getResourceProducts({ ...testProducts, catalog: testProducts.catalog.map(product => ({ ...product, name: 'Localized' })) })

  expect(native.salt).toMatchObject({ id: 'salt', name: 'Salt from the game', productId: 'Product_Salt' })
  expect(native.electronicsI).toMatchObject({ name: 'Electronics', productId: 'Product_Electronics' })
  expect(native.constructionPartsI).toMatchObject({ productId: 'Product_ConstructionParts' })
  expect(other.salt.name).toBe('Localized')
  expect(resources.salt.name).toBe('Salt')
  expect(native.maintenanceIII.name).toBe('Maintenance III')
})

it('versions icon requests by game session and encodes native IDs', () => {
  expect(getProductIconUrl('Product_Mod:Salt', '456')).toBe('/api/game-icons/Product_Mod%3ASalt?v=456')
  expect(getProductIconUrl('Product_Salt', '789')).not.toBe(getProductIconUrl('Product_Salt', '456'))
  expect(getProductIconUrl(undefined, '456')).toBeUndefined()
})
