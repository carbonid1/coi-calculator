import { type Preset } from '../../db/modules/modules'
import { createAtLeastBuildingActions } from '../../db/modules/plan-mismatch'
import { type Recipe } from '../../db/recipes'

export interface NuclearOperationTarget {
  name: string
  pluralName?: string
  recipeId: string
  target: number
}

/** Raise physical inventory across configured recipe groups without replacing synced counts. */
export const applyNuclearOperationTargets = (
  preset: Preset,
  recipes: readonly Recipe[],
  targets: readonly NuclearOperationTarget[],
  recipeIdsByPolicyId = new Map<string, string[]>(),
  unavailableRecipeIds = new Set<string>(),
): Preset => {
  const activeBuildings = { ...preset.activeBuildings }
  const capacityPools = { ...preset.capacityPools }
  const unplacedPlannedBuildings = { ...preset.unplacedPlannedBuildings }
  const dataSources = { ...preset.dataSources }
  const planMismatches = [...(preset.planMismatches ?? [])]
  const built = (id: string) => preset.builtBuildings?.[id] ?? 0
  const current = (id: string) => preset.currentActiveBuildings?.[id] ?? 0
  const ghosts = (id: string) => preset.constructionGhosts?.[id] ?? 0
  const active = (id: string) => activeBuildings[id] ?? 0
  const activate = (id: string, quantity: number) => {
    if (quantity <= 0) return
    const poolId = recipes.find(recipe => recipe.id === id)?.sharedCapacity?.id
    const pool = poolId ? capacityPools[poolId] : undefined
    const members = pool && poolId
      ? recipes.filter(recipe => recipe.sharedCapacity?.id === poolId).map(recipe => recipe.id)
      : [id]
    const projected = active(id) + quantity

    for (const memberId of members) {
      activeBuildings[memberId] = projected
      unplacedPlannedBuildings[memberId] = Math.max(0, projected - built(memberId) - ghosts(memberId))
      dataSources[memberId] = 'planned'
    }
    if (pool && poolId) {
      capacityPools[poolId] = { ...pool, active: projected,
        unplacedPlanned: Math.max(0, projected - pool.built - pool.constructionGhosts) }
    }
  }

  for (const target of targets) {
    if (unavailableRecipeIds.has(target.recipeId)) continue
    const ids = recipeIdsByPolicyId.get(target.recipeId) ?? [target.recipeId]
    const remaining = {
      needed: Math.max(0, target.target - ids.reduce((sum, id) => sum + active(id), 0)),
    }

    // Reuse paused buildings in any matching configuration before adding new ones.
    for (const id of ids) {
      const reused = Math.min(remaining.needed, Math.max(0, built(id) + ghosts(id) - active(id)))

      activate(id, reused)
      remaining.needed -= reused
    }
    const leadId = ids[0]

    if (leadId) activate(leadId, remaining.needed)
    for (const id of ids) {
      const actions = createAtLeastBuildingActions({
        built: built(id), running: current(id), target: active(id) - ghosts(id),
        name: target.name, pluralName: target.pluralName,
      })

      if (actions.length === 0) continue
      planMismatches.push({ recipeId: id, current: current(id), target: active(id),
        direction: 'at-least', format: 'count', actions })
    }
  }

  return { ...preset, activeBuildings, capacityPools, unplacedPlannedBuildings, dataSources,
    planMismatches: planMismatches.length > 0 ? planMismatches : undefined }
}
