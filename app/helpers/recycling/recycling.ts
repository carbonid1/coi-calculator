import { type ResourceId } from '../../db/resources'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'

export interface RecyclingSource {
  productId: string
  name: string
  /** Scrap units, either per consumed product or per recyclable input. */
  quantity: number
}

export interface RecyclingData {
  efficiencyPercent: number
  scrapPerRecyclable: number
  products: { productId: string; name: string; sources: RecyclingSource[] }[]
}

export type RecyclingSources = Partial<Record<ResourceId, number>>

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const product = (value: unknown) => record(value)
  && typeof value.productId === 'string' && value.productId.length > 0
  && typeof value.name === 'string' && value.name.length > 0

export const isRecyclingSources = (value: unknown): value is RecyclingSource[] =>
  Array.isArray(value)
  && value.every(source => product(source) && record(source)
    && typeof source.quantity === 'number' && Number.isFinite(source.quantity) && source.quantity >= 0)
  && new Set(value.map(source => source.productId)).size === value.length

export const isRecyclingData = (value: unknown): value is RecyclingData =>
  record(value)
  && typeof value.efficiencyPercent === 'number' && Number.isFinite(value.efficiencyPercent)
  && value.efficiencyPercent >= 0 && value.efficiencyPercent <= 100
  && typeof value.scrapPerRecyclable === 'number' && Number.isFinite(value.scrapPerRecyclable)
  && value.scrapPerRecyclable > 0
  && Array.isArray(value.products)
  && value.products.every(entry => product(entry) && record(entry) && isRecyclingSources(entry.sources))
  && new Set(value.products.map(entry => entry.productId)).size === value.products.length

export const resolveRecyclingSources = (sources: readonly RecyclingSource[]): RecyclingSources | null => {
  const resolved = sources.map(source => ({ resourceId: resolveSyncedResourceId(source), quantity: source.quantity }))

  if (resolved.some(source => !source.resourceId)) return null
  return Object.fromEntries(resolved.flatMap(source => source.resourceId ? [[source.resourceId, source.quantity] as const] : []))
}

const productSources = new WeakMap<RecyclingData, Map<ResourceId, RecyclingSources>>()

export const getProductRecyclingSources = (data: RecyclingData, resourceId: ResourceId): RecyclingSources | undefined => {
  if (!productSources.has(data)) {
    productSources.set(data, new Map(data.products.flatMap(entry => {
      const id = resolveSyncedResourceId(entry)
      const sources = resolveRecyclingSources(entry.sources)

      return id && sources ? [[id, sources] as const] : []
    })))
  }
  return productSources.get(data)?.get(resourceId)
}
