import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

import { testProducts } from '../test-fixtures/products'
import { ProductInventorySummary } from './ProductInventorySummary'
import { ResourceProductsProvider } from './ResourceProducts'

vi.mock('@carbonid1/design-system', () => ({
  cn: (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' '),
}))

it('shows native global quantities separately from stored stock and capacity', () => {
  const html = renderToStaticMarkup(<ResourceProductsProvider products={testProducts} current>
    <ProductInventorySummary resourceId="salt" />
  </ResourceProductsProvider>)

  expect(html).toContain('Total quantity')
  expect(html).toContain('Stored')
  expect(html).toContain('Storage capacity')
  expect(html).toContain('>100</dd>')
  expect(html).toContain('>60</dd>')
  expect(html).toContain('>200</dd>')
  expect(html).toContain('Synced')
})

it('keeps zero stock distinct from missing data', () => {
  const products = { ...testProducts, inventory: { Product_Salt: { quantity: 0, stored: 0, storageCapacity: 0 } } }
  const empty = renderToStaticMarkup(<ResourceProductsProvider products={products} current>
    <ProductInventorySummary resourceId="salt" />
  </ResourceProductsProvider>)
  const missing = renderToStaticMarkup(<ResourceProductsProvider products={products} current>
    <ProductInventorySummary resourceId="maintenanceI" />
  </ResourceProductsProvider>)

  expect(empty).toContain('>0</dd>')
  expect(empty).toContain('Synced')
  expect(missing).toContain('Island inventory unavailable')
  expect(missing).not.toContain('Synced')
})

it('does not show cached stock as current inventory while disconnected', () => {
  const html = renderToStaticMarkup(<ResourceProductsProvider products={testProducts} current={false}>
    <ProductInventorySummary resourceId="salt" />
  </ResourceProductsProvider>)

  expect(html).toContain('Island inventory unavailable')
  expect(html).not.toContain('>100</dd>')
  expect(html).not.toContain('Synced')
})
