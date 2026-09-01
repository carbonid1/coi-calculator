import { resources, type ResourceId } from '../../db/resources'

const normalizeResourceKey = (value: string) => value
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase()
  .replace(/^product(?:virtual)?/, '')

const resourceIdByKey = new Map<string, ResourceId>()

for (const resource of Object.values(resources)) {
  resourceIdByKey.set(normalizeResourceKey(resource.id), resource.id)
  resourceIdByKey.set(normalizeResourceKey(resource.name), resource.id)
}

export const resolveSyncedResourceId = (
  product: { productId: string; name: string },
): ResourceId | undefined => (
  resourceIdByKey.get(normalizeResourceKey(product.name))
  ?? resourceIdByKey.get(normalizeResourceKey(product.productId))
)
