import { Item } from '@carbonid1/design-system'

import { type ResourceId, resources } from '../db/resources'
import { resolveSyncedResourceId } from '../helpers/synced-resources/synced-resources'
import { typedEntries } from '../helpers/typed-entries/typed-entries'
import { type WorldMineResult } from '../helpers/world-mines/calculate-world-mines'
import { type SyncedWorldState } from '../world-state'

const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })

export const WorldMinesView = ({ world, result }: { world: SyncedWorldState; result: WorldMineResult }) => {
  // World cargo is pooled by product; do not repeat that delivery for each mine.
  const products = new Map<string, { name: string; resourceId: ResourceId | undefined }>()

  for (const mine of world.mines) {
    if (!mine.repaired || !mine.running) continue
    const resourceId = resolveSyncedResourceId(mine.product)

    products.set(resourceId ?? mine.product.productId, {
      name: resourceId ? resources[resourceId].name : mine.product.name,
      resourceId,
    })
  }

  if (products.size === 0) return <p className="text-sm text-muted-foreground">No active world mines.</p>

  const shipping = result.routes.filter(cargo => cargo.route.running && cargo.route.ship?.running
    && cargo.route.modules.some(module => {
      const resourceId = module.selectedProduct ? resolveSyncedResourceId(module.selectedProduct) : undefined

      return module.running && module.direction === 'import' && resourceId && products.has(resourceId)
    }))
  const fuel: Partial<Record<ResourceId, number>> = {}

  for (const cargo of shipping) {
    if (cargo.fuelResourceId && cargo.fuelPerCycle !== null) {
      fuel[cargo.fuelResourceId] = (fuel[cargo.fuelResourceId] ?? 0) + cargo.fuelPerCycle
    }
  }
  const fuelText = shipping.some(cargo => cargo.fuelPerCycle === null)
    ? 'Unmeasured'
    : typedEntries(fuel).map(([id, quantity]) => `${format(quantity)} ${resources[id].name}`).join(' · ') || '0'

  return (
    <section className="max-w-xl space-y-1" aria-label="Active world mines">
      <div className="flex justify-between gap-4 px-3 pb-1 text-xs text-muted-foreground">
        <span>Active mines</span>
        <span>Delivery / cycle</span>
      </div>
      <dl className="space-y-1">
        {Array.from(products, ([key, { name, resourceId }]) => {
          const unmeasured = !resourceId || shipping.some(cargo => cargo.fuelPerCycle === null
            && cargo.route.modules.some(module => module.selectedProduct
              && resolveSyncedResourceId(module.selectedProduct) === resourceId))

          return (
            <Item.Root key={key} surface="raised" className="justify-between px-3 py-2 text-sm">
              <dt className="font-medium">{name}</dt>
              <dd className="font-mono tabular-nums">{unmeasured ? 'Unmeasured' : format(result.supplies[resourceId] ?? 0)}</dd>
            </Item.Root>
          )
        })}
      </dl>
      {shipping.length > 0 && (
        <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-3 pt-2 text-xs text-muted-foreground">
          <span>Shipping fuel / cycle</span>
          <span className="font-mono tabular-nums">{fuelText}</span>
        </p>
      )}
    </section>
  )
}
