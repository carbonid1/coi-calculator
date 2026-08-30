import { type ResourceId } from './resources'

export interface MinimizeSurplusPolicy {
  /** Surplus can be consumed only by recipes installed in the same physical module. */
  scope: 'module'
  /** Fallback priority for any compatible synced recipe. Lower values run first. */
  defaultConsumerPriority: number
  /** Exact game recipe IDs can override the fallback route priority. */
  consumerPriorities?: Readonly<Record<string, number>>
}

export interface ResourceDispositionPolicy {
  /** Synced live modules may receive this resource only through their own production or an explicit link. */
  liveModuleInput?: 'linked-only'
  minimizeSurplus?: MinimizeSurplusPolicy
}

export interface SurplusConsumptionSettings {
  inputIds: ResourceId[]
  priority: number
  scope: 'module'
}

/**
 * Calculator-owned preferences for residual resources in synced live modules.
 * Recipes remain demand-driven first; these policies use only their remaining
 * installed capacity after ordinary output demand has been satisfied.
 */
export const resourceDispositionPolicies: Partial<Record<ResourceId, ResourceDispositionPolicy>> = {
  moltenIron: {
    minimizeSurplus: {
      scope: 'module',
      defaultConsumerPriority: 100,
      consumerPriorities: {
        SteelSmeltingT2: 10,
      },
    },
  },
  seaWater: {
    liveModuleInput: 'linked-only',
  },
  steamLow: {
    liveModuleInput: 'linked-only',
    minimizeSurplus: {
      scope: 'module',
      defaultConsumerPriority: 100,
      consumerPriorities: {
        DesalinationFromLP: 10,
      },
    },
  },
}

export const getLinkedOnlyLiveModuleInputIds = (
  inputIds: readonly ResourceId[],
) => inputIds.filter(resourceId => (
  resourceDispositionPolicies[resourceId]?.liveModuleInput === 'linked-only'
))

export const getSurplusConsumptionSettings = (
  inputIds: readonly ResourceId[],
  gameRecipeId?: string,
): SurplusConsumptionSettings | null => {
  const matches = inputIds.flatMap(resourceId => {
    const policy = resourceDispositionPolicies[resourceId]?.minimizeSurplus

    if (!policy) return []

    return [{
      resourceId,
      priority: gameRecipeId
        ? (policy.consumerPriorities?.[gameRecipeId] ?? policy.defaultConsumerPriority)
        : policy.defaultConsumerPriority,
      scope: policy.scope,
    }]
  })

  if (matches.length === 0) return null

  return {
    inputIds: matches.map(match => match.resourceId),
    priority: Math.min(...matches.map(match => match.priority)),
    scope: 'module',
  }
}
