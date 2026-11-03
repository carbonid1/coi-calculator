'use client'

import { type ResourceId } from '../db/resources'
import { getDataSourceSurfaceClassName } from './DataSourceState'
import { useProductState } from './ResourceProducts'

export const ProductInventorySummary = ({ resourceId }: { resourceId: ResourceId }) => {
  const { resources, products, current } = useProductState()
  const productId = resources[resourceId].productId
  const stock = current && productId ? products?.inventory[productId] : undefined

  if (!stock) return <p className="text-xs text-muted-foreground">Island inventory unavailable</p>
  const values = [
    ['Total quantity', stock.quantity],
    ['Stored', stock.stored],
    ['Storage capacity', stock.storageCapacity],
  ] as const

  return (
    <section aria-label="Island inventory" className={getDataSourceSurfaceClassName('synced', {
      className: 'rounded-lg border p-3',
    })}>
      <p className="mb-2 text-xs text-muted-foreground">Island inventory</p>
      <dl className="grid gap-3 sm:grid-cols-3">
        {values.map(([name, quantity]) => (
          <div key={name}>
            <dt className="text-xs text-muted-foreground">{name}</dt>
            <dd className="font-mono text-sm tabular-nums">{quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
