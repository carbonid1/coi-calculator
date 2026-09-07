import { typedEntries } from '../helpers/typed-entries/typed-entries'
import { type ResourceId } from './resources'

/** Calculator routing assumptions, independent of production/disposal preferences. */
export const resourceSupplyRules: Partial<Record<ResourceId, 'connections'>> = {
  seaWater: 'connections',
  steamSuper: 'connections',
  steamHigh: 'connections',
  steamLow: 'connections',
  steamDepleted: 'connections',
}

export const getConnectionOnlyResourceIds = (resourceIds: readonly ResourceId[]) => (
  resourceIds.filter(resourceId => resourceSupplyRules[resourceId] === 'connections')
)

/** Utility fluids need a named source/target; a generic pool request cannot open that route. */
export const getFactoryResourceRequests = (
  requests: Partial<Record<ResourceId, number>> | undefined,
): Partial<Record<ResourceId, number>> => (
  Object.fromEntries(typedEntries(requests ?? {}).filter(([resourceId]) => (
    resourceSupplyRules[resourceId] !== 'connections'
  )))
)
