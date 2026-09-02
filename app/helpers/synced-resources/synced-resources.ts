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

const gameProductAliases = new Map<string, ResourceId>([
  ['electronics', 'electronicsI'],
  ['labequipment', 'labEquipmentI'],
  ['vehicleparts', 'vehiclePartsI'],
  ['railparts', 'railParts'],
  ['slagcrushed', 'slagCrushed'],
  ['microchipsstage1a', 'microchipStage1A'],
  ['microchipsstage1b', 'microchipStage1B'],
  ['microchipsstage1c', 'microchipStage1C'],
  ['microchipsstage2a', 'microchipStage2A'],
  ['microchipsstage2b', 'microchipStage2B'],
  ['microchipsstage2c', 'microchipStage2C'],
  ['microchipsstage3a', 'microchipStage3A'],
  ['microchipsstage3b', 'microchipStage3B'],
  ['microchipsstage3c', 'microchipStage3C'],
  ['microchipsstage4a', 'microchipStage4A'],
  ['microchipsstage4b', 'microchipStage4B'],
])

export const resolveSyncedResourceId = (
  product: { productId: string; name: string },
): ResourceId | undefined => (
  gameProductAliases.get(normalizeResourceKey(product.productId))
  ?? resourceIdByKey.get(normalizeResourceKey(product.name))
  ?? resourceIdByKey.get(normalizeResourceKey(product.productId))
)
