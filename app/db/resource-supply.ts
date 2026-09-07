import { type ResourceId } from './resources'

/** Calculator routing assumptions, independent of production/disposal preferences. */
export const resourceSupplyRules: Partial<Record<ResourceId, 'connections'>> = {
  seaWater: 'connections',
  steamLow: 'connections',
}

export const getConnectionOnlyResourceIds = (resourceIds: readonly ResourceId[]) => (
  resourceIds.filter(resourceId => resourceSupplyRules[resourceId] === 'connections')
)
