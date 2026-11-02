import { resources, type Resource, type ResourceId } from '../../db/resources'
import { type NativeProducts } from '../../product-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'

export interface ResourceProduct extends Resource {
  productId?: string
}

export const getResourceProducts = (products: Pick<NativeProducts, 'catalog'> | undefined): Record<ResourceId, ResourceProduct> => {
  const resolved: Record<ResourceId, ResourceProduct> = { ...resources }

  for (const product of products?.catalog ?? []) {
    const id = resolveSyncedResourceId({ productId: product.id, name: product.name })

    if (id) resolved[id] = { id, name: product.name, productId: product.id }
  }
  return resolved
}

export const getProductIconUrl = (productId: string | undefined, sessionId: string | undefined) => (
  productId && sessionId ? `/api/game-icons/${encodeURIComponent(productId)}?v=${encodeURIComponent(sessionId)}` : undefined
)
