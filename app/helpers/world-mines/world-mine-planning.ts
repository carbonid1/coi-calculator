import { type ResourceId } from '../../db/resources'
import { type SyncedWorldState } from '../../world-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'
import { typedEntries } from '../typed-entries/typed-entries'
import { type WorldMineResult } from './calculate-world-mines'

export interface WorldMinePlanning {
  world: SyncedWorldState
  /** Native product IDs keep shared mines and mixed cargo in one product pool. Defaults to full throttle. */
  fullThrottle: Readonly<Record<string, boolean>>
}

export const getWorldMinePreferencesStorageKey = (saveId: string | null | undefined) => (
  saveId ? `coi-world-mine-full-throttle-v1:${encodeURIComponent(saveId)}` : null
)

export const getBalancedWorldResources = ({ world, fullThrottle }: WorldMinePlanning) => (
  [...new Set(world.mines.flatMap(mine => {
    const id = resolveSyncedResourceId(mine.product)

    return id && fullThrottle[mine.product.productId] === false ? [id] : []
  }))]
)

/** Limit deliveries, keeping the live enabled crew and mine operating costs intact. */
export const limitWorldMineDeliveries = (full: WorldMineResult, targets: Partial<Record<ResourceId, number>>): WorldMineResult => {
  const supplies: WorldMineResult['supplies'] = {}, sustainedSupplies: WorldMineResult['supplies'] = {}, fuelDemands: WorldMineResult['supplies'] = {}
  const routes = full.routes.map(route => {
    const delivered = { ...route.delivered }, sustained = { ...route.sustained }

    for (const [id, quantity] of typedEntries(delivered)) {
      const target = targets[id]
      const ratio = target === undefined ? 1 : Math.min(1, Math.max(0, target) / (full.supplies[id] || Infinity))

      delivered[id] = quantity * ratio
      sustained[id] = (sustained[id] ?? 0) * ratio
      supplies[id] = (supplies[id] ?? 0) + delivered[id]
      sustainedSupplies[id] = (sustainedSupplies[id] ?? 0) + sustained[id]
    }
    // One mixed-cargo trip serves every product: charge its fuel once, at the largest retained share.
    const share = Object.keys(route.delivered).length === 0 ? 1
      : Math.max(0, ...typedEntries(route.delivered).map(([id, quantity]) => quantity > 0 ? (delivered[id] ?? 0) / quantity : 0))
    const fuelPerCycle = route.fuelPerCycle === null ? null : route.fuelPerCycle * share
    const horizons = typedEntries(delivered).flatMap(([id, quantity]) => {
      const extra = quantity - (sustained[id] ?? 0)

      return extra > 0.000001 ? [(route.offshoreAvailable[id] ?? 0) / extra] : []
    })

    if (fuelPerCycle !== null && route.fuelResourceId) fuelDemands[route.fuelResourceId] = (fuelDemands[route.fuelResourceId] ?? 0) + fuelPerCycle
    return { ...route, delivered, sustained, fuelPerCycle, unityPerCycle: route.unityPerCycle * share,
      burstCyclesRemaining: horizons.length > 0 ? Math.min(...horizons) : null }
  })

  return { ...full, routes, supplies, sustainedSupplies, fuelDemands }
}
