import { type Module } from '../../db/modules/modules'
import { getGameRecipeKey, recipes as recipeCatalog, type Recipe } from '../../db/recipes'
import { nuclearRecipeBindings, nuclearSpecialPrototypeIds } from './nuclear-entity-sync'

const policies = new Map(nuclearRecipeBindings.flatMap(binding => {
  const recipe = recipeCatalog.find(recipe => recipe.id === binding.recipeId)

  return recipe ? [[getGameRecipeKey(binding.prototypeId, binding.gameRecipeId), recipe] as const] : []
}))

export const nuclearOrdinaryRecipeIds = new Set(nuclearRecipeBindings.map(binding => binding.recipeId))

/** Reuse the generated recipe data and physical pools, adding only Nuclear's calculation policy. */
export const resolveNuclearAreaRecipes = (area: Module) => {
  const idMap = new Map<string, string>()
  const usedIds = new Set<string>()
  const recipes: Recipe[] = []
  const recipeIdsByPolicyId = new Map<string, string[]>()
  const unavailableRecipeIds = new Set(nuclearRecipeBindings.filter(binding => (
    area.liveArea?.issues.some(issue => issue.id.startsWith(`${binding.prototypeId}:${binding.gameRecipeId}:`))
  )).map(binding => binding.recipeId))

  for (const live of area.recipes ?? []) {
    if (live.gameBuildingId && nuclearSpecialPrototypeIds.has(live.gameBuildingId)) continue

    const policy = live.gameBuildingId && live.gameRecipeId
      ? policies.get(getGameRecipeKey(live.gameBuildingId, live.gameRecipeId)) : undefined
    const id = policy && !usedIds.has(policy.id) ? policy.id : live.id

    usedIds.add(id)
    idMap.set(live.id, id)
    if (policy) recipeIdsByPolicyId.set(policy.id, [...(recipeIdsByPolicyId.get(policy.id) ?? []), id])
    recipes.push(policy ? {
      ...policy,
      factoryRecipe: undefined,
      id,
      gameBuildingId: live.gameBuildingId,
      gameRecipeId: live.gameRecipeId,
      name: live.name,
      displayName: live.displayName,
      configurationLabel: live.configurationLabel ?? policy.configurationLabel,
      building: live.building,
      inputs: live.inputs,
      outputs: live.outputs,
      cycleDurationSeconds: live.cycleDurationSeconds,
      electricityMultiplier: live.electricityMultiplier,
      sharedCapacity: live.sharedCapacity,
    } : live)
  }

  const remap = <Value>(values: Record<string, Value> | undefined): Record<string, Value> => (
    Object.fromEntries(Object.entries(values ?? {}).flatMap(([id, value]) => {
      const mappedId = idMap.get(id)

      return mappedId ? [[mappedId, value]] : []
    }))
  )
  const preset = area.presets.find(preset => preset.id === area.defaultPresetId) ?? area.presets[0]

  return {
    recipes,
    recipeIdsByPolicyId,
    unavailableRecipeIds,
    builtBuildings: remap(preset?.builtBuildings ?? area.builtBuildings),
    preset: {
      ...preset,
      activeBuildings: remap(preset?.activeBuildings),
      currentActiveBuildings: remap(preset?.currentActiveBuildings),
      constructionGhosts: remap(preset?.constructionGhosts),
      dataSources: remap(preset?.dataSources),
      speedLevels: remap(preset?.speedLevels),
      fixed: (preset?.fixed ?? []).flatMap(id => {
        const mappedId = idMap.get(id)

        return mappedId ? [mappedId] : []
      }),
    },
  }
}
