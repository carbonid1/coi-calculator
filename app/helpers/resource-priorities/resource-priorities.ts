import { type Recipe } from '../../db/recipes'
import { type ResourceProcessingPriorities, type ResourceProcessingPriority } from '../../db/resource-supply'
import { resources, type ResourceId } from '../../db/resources'

/** Browser overrides are scoped to a save, then stable game area IDs. */
export type ResourcePriorityOverrides = Readonly<Record<number, ResourceProcessingPriorities>>

export const getResourcePriorityStorageKey = (saveId: string | null | undefined) => (
  saveId ? `coi-resource-priorities-v1:${encodeURIComponent(saveId)}` : null
)

export const isResourceProcessingPriority = (value: unknown): value is ResourceProcessingPriority => (
  value === 'factory' || value === 'local-first'
)

export const parseResourcePriorityOverrides = (value: string | null): ResourcePriorityOverrides => {
  try {
    const parsed: unknown = JSON.parse(value ?? '{}')

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([zoneId, values]) => {
      if (!/^(?:-1|\d+)$/.test(zoneId) || !values || typeof values !== 'object' || Array.isArray(values)) return []
      const priorities = Object.fromEntries(Object.entries(values).filter(([id, priority]) => (
        Object.hasOwn(resources, id) && isResourceProcessingPriority(priority)
      )))

      return Object.keys(priorities).length > 0 ? [[zoneId, priorities]] : []
    }))
  } catch {
    return {}
  }
}

/** Optional surplus processing keeps its later phase; priority never creates output demand. */
export const canPrioritizeProcessing = (recipe: Recipe, resourceId: ResourceId) => (
  recipe.group !== 'source' && recipe.group !== 'sink'
  && recipe.inputs.some(input => input.resourceId === resourceId)
  && (recipe.inputPriorities?.[resourceId] != null
    || (recipe.balanceBy === 'output' && recipe.allocation !== 'fallback'
      && recipe.allocation !== 'surplus' && !recipe.consumeSurplusInputIds?.length))
)

interface ProcessingRequest {
  id: string
  moduleId: string
  desired: number
  localFirst: boolean
}

/** Requests arrive in the existing recipe-priority order. Reserve useful local
 * processing from each module's output, then spend the remaining shared supply.
 * Unprioritized consumers run later and see what these reservations leave. */
export const allocateProcessingSupply = (
  requests: readonly ProcessingRequest[],
  localSupply: ReadonlyMap<string, number>,
  globalSupply: number,
  preemptibleSupply: number,
) => {
  const remainingLocal = new Map(localSupply)
  const allocated = new Map<string, number>()
  let localBudget = Math.max(0, preemptibleSupply)
  let remainingGlobal = Math.max(0, globalSupply)

  for (const request of requests) {
    if (!request.localFirst) continue
    const available = Math.max(0, remainingLocal.get(request.moduleId) ?? 0)
    const quantity = Math.min(Math.max(0, request.desired), available, localBudget)

    allocated.set(request.id, quantity)
    remainingLocal.set(request.moduleId, available - quantity)
    localBudget -= quantity
    remainingGlobal = Math.max(0, remainingGlobal - quantity)
  }
  for (const request of requests) {
    const local = allocated.get(request.id) ?? 0
    const quantity = Math.min(Math.max(0, request.desired - local), remainingGlobal)

    allocated.set(request.id, local + quantity)
    remainingGlobal -= quantity
  }
  return allocated
}
