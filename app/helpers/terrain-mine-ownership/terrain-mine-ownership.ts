import { DEFAULT_MODULE_ID } from '../../db/modules/default'
import { MINES_MODULE_ID } from '../../db/modules/mines'
import { type Module, type Preset } from '../../db/modules/modules'
import { recipes } from '../../db/recipes'
import { type ResourceId } from '../../db/resources'

const crusherBuildings = new Set(['Crusher', 'Crusher (Large)'])

const withoutKeys = <T>(
  values: Record<string, T> | undefined,
  removedIds: ReadonlySet<string>,
) => values
  ? Object.fromEntries(
      Object.entries(values).filter(([recipeId]) => !removedIds.has(recipeId)),
    )
  : undefined

const withoutOwnedRecipes = (preset: Preset, removedIds: ReadonlySet<string>): Preset => ({
  ...preset,
  activeBuildings: withoutKeys(preset.activeBuildings, removedIds) ?? {},
  currentActiveBuildings: withoutKeys(preset.currentActiveBuildings, removedIds),
  dataSources: withoutKeys(preset.dataSources, removedIds),
  fixed: preset.fixed.filter(recipeId => !removedIds.has(recipeId)),
  recipeOutputTargets: withoutKeys(preset.recipeOutputTargets, removedIds),
  builtBuildings: withoutKeys(preset.builtBuildings, removedIds),
  constructionGhosts: withoutKeys(preset.constructionGhosts, removedIds),
  unplacedPlannedBuildings: withoutKeys(preset.unplacedPlannedBuildings, removedIds),
  speedLevels: withoutKeys(preset.speedLevels, removedIds),
  plannedFollowUps: preset.plannedFollowUps?.filter(
    followUp => !removedIds.has(followUp.recipeId),
  ),
  planMismatches: preset.planMismatches?.filter(
    mismatch => !removedIds.has(mismatch.recipeId),
  ),
})

export const getClaimedTerrainResourceIds = (
  liveModules: readonly Module[],
): ReadonlySet<ResourceId> => new Set(
  liveModules.flatMap(module => (
    module.recipes
      ?.filter(recipe => (
        recipe.sourceKind === 'map-mine'
        && recipe.sourceMode === 'module-demand'
      ))
      .flatMap(recipe => recipe.outputs.map(output => output.resourceId))
      ?? []
  )),
)

/**
 * A synced sorter + crusher area owns its selected terrain ore. Retire the
 * matching modeled source and Default-area first-stage crusher so the same
 * mine is never counted twice while other ores keep their legacy fallback.
 */
export const transferTerrainMineOwnership = (
  configuredModules: readonly Module[],
  liveModules: readonly Module[],
): Module[] => {
  const claimedResourceIds = getClaimedTerrainResourceIds(liveModules)

  if (claimedResourceIds.size === 0) return [...configuredModules]

  const legacySourceIds = new Set(
    recipes
      .filter(recipe => (
        recipe.sourceKind === 'map-mine'
        && recipe.outputs.some(output => claimedResourceIds.has(output.resourceId))
      ))
      .map(recipe => recipe.id),
  )
  const legacyCrusherIds = new Set(
    recipes
      .filter(recipe => (
        crusherBuildings.has(recipe.building)
        && recipe.inputs.some(input => claimedResourceIds.has(input.resourceId))
      ))
      .map(recipe => recipe.id),
  )

  return configuredModules.map(module => {
    let removedIds: ReadonlySet<string> | undefined

    if (module.id === MINES_MODULE_ID) removedIds = legacySourceIds
    if (module.id === DEFAULT_MODULE_ID) removedIds = legacyCrusherIds

    if (!removedIds || removedIds.size === 0) return module

    return {
      ...module,
      builtBuildings: withoutKeys(module.builtBuildings, removedIds) ?? {},
      recipes: module.recipes?.filter(recipe => !removedIds.has(recipe.id)),
      presets: module.presets.map(preset => withoutOwnedRecipes(preset, removedIds)),
    }
  })
}
