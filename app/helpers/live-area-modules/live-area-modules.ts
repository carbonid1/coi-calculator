import { type Module, type LiveAreaIssue } from '../../db/modules/modules'
import { type Ingredient, type Recipe } from '../../db/recipes'
import { resources, type ResourceId } from '../../db/resources'
import {
  type SyncedAreaEntity,
  type SyncedAreaRecipe,
  type SyncedLogisticsZoneRef,
} from '../../game-state'

const plannedConstructionStates = new Set([
  'NotStarted',
  'InConstruction',
  'PreparingUpgrade',
  'BeingUpgraded',
])

const normalizeResourceKey = (value: string) => value
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase()
  .replace(/^product(?:virtual)?/, '')

const resourceIdByKey = new Map<string, ResourceId>()

const runtimeRecipeBehaviors: Record<
  string,
  Pick<Recipe, 'appliesRecyclingEfficiency'>
> = {
  'Shredder:ShreddingRetiredWaste': { appliesRecyclingEfficiency: false },
}

for (const resource of Object.values(resources)) {
  resourceIdByKey.set(normalizeResourceKey(resource.id), resource.id)
  resourceIdByKey.set(normalizeResourceKey(resource.name), resource.id)
}

const resolveResourceId = (product: { productId: string; name: string }) => (
  resourceIdByKey.get(normalizeResourceKey(product.name))
  ?? resourceIdByKey.get(normalizeResourceKey(product.productId))
)

const toIngredient = (
  product: SyncedAreaRecipe['inputs'][number],
  durationSeconds: number,
): Ingredient | null => {
  const resourceId = resolveResourceId(product)

  return resourceId
    ? { resourceId, quantity: product.quantity * 60 / durationSeconds }
    : null
}

const isPlannedEntity = (entity: SyncedAreaEntity) => (
  !entity.constructed && plannedConstructionStates.has(entity.constructionState)
)

const selectedRecipes = (entity: SyncedAreaEntity) => {
  const assigned = entity.recipes.filter(recipe => recipe.assigned)

  if (assigned.length > 0) return assigned
  if (entity.recipes.length === 1) return entity.recipes

  return []
}

interface RecipeGroup {
  prototypeId: string
  prototypeName: string
  recipe: SyncedAreaRecipe
  built: number
  running: number
  planned: number
}

const addIssue = (
  issues: Map<string, LiveAreaIssue>,
  id: string,
  building: string,
  message: string,
  count = 1,
) => {
  const current = issues.get(id)

  if (current) {
    current.count += count
    return
  }

  issues.set(id, { id, building, count, message })
}

const moduleIdForZone = (zoneId: number) => `live-area-${zoneId}`

/** Builds planning-only calculator modules from unmatched named vehicle areas. */
export const createLiveAreaModules = (
  zones: readonly SyncedLogisticsZoneRef[],
  entities: readonly SyncedAreaEntity[],
  configuredModules: readonly Module[],
): Module[] => {
  const existingNames = new Set(configuredModules.map(module => module.name))

  return zones.flatMap(zone => {
    if (!zone.name || existingNames.has(zone.name)) return []

    const zoneEntities = entities.filter(entity => (
      entity.zones.some(entityZone => entityZone.id === zone.id)
      && (entity.constructed || isPlannedEntity(entity))
    ))
    const issues = new Map<string, LiveAreaIssue>()
    const groups = new Map<string, RecipeGroup>()
    const capacityPools = new Map<
      string,
      { built: number; running: number; planned: number }
    >()

    for (const entity of zoneEntities) {
      const recipesForEntity = selectedRecipes(entity)

      if (recipesForEntity.length === 0) {
        const message = entity.recipes.length > 1
          ? `Choose one of ${entity.recipes.length} recipes in the game before its flows can be projected.`
          : 'This building does not expose a production recipe.'

        addIssue(
          issues,
          `${entity.prototypeId}:${entity.recipes.length > 1 ? 'recipe-choice' : 'no-recipe'}`,
          entity.prototypeName,
          message,
        )
        continue
      }

      const capacityPool = capacityPools.get(entity.prototypeId) ?? {
        built: 0,
        running: 0,
        planned: 0,
      }

      capacityPool.built += Number(entity.constructed)
      capacityPool.running += Number(entity.running)
      capacityPool.planned += Number(isPlannedEntity(entity))
      capacityPools.set(entity.prototypeId, capacityPool)

      for (const recipe of recipesForEntity) {
        const key = `${entity.prototypeId}:${recipe.id}`
        const group = groups.get(key) ?? {
          prototypeId: entity.prototypeId,
          prototypeName: entity.prototypeName,
          recipe,
          built: 0,
          running: 0,
          planned: 0,
        }

        group.built += Number(entity.constructed)
        group.running += Number(entity.running)
        group.planned += Number(isPlannedEntity(entity))
        groups.set(key, group)
      }
    }

    const orderedGroups = [...groups.values()].sort((left, right) => (
      left.prototypeName.localeCompare(right.prototypeName)
      || left.recipe.name.localeCompare(right.recipe.name)
    ))
    const recipeCountByPrototype = new Map<string, number>()

    for (const group of orderedGroups) {
      recipeCountByPrototype.set(
        group.prototypeId,
        (recipeCountByPrototype.get(group.prototypeId) ?? 0) + 1,
      )
    }

    const liveRecipes: Recipe[] = []
    const builtBuildings: Record<string, number> = {}
    const activeBuildings: Record<string, number> = {}
    const plannedBuildings: Record<string, number> = {}
    const dataSources: NonNullable<Module['presets'][number]['dataSources']> = {}
    const presetCapacityPools: NonNullable<Module['presets'][number]['capacityPools']> = {}

    for (const [prototypeId, pool] of capacityPools) {
      presetCapacityPools[prototypeId] = {
        active: pool.running + pool.planned,
        built: pool.built,
        planned: pool.planned,
      }
    }

    for (const [priority, group] of orderedGroups.entries()) {
      const inputs = group.recipe.inputs.map(product => (
        toIngredient(product, group.recipe.durationSeconds)
      ))
      const outputs = group.recipe.outputs.map(product => (
        toIngredient(product, group.recipe.durationSeconds)
      ))
      const missingProducts = [
        ...group.recipe.inputs.filter((_, index) => !inputs[index]),
        ...group.recipe.outputs.filter((_, index) => !outputs[index]),
      ]

      if (missingProducts.length > 0) {
        addIssue(
          issues,
          `${group.prototypeId}:${group.recipe.id}:products`,
          group.prototypeName,
          `Recipe “${group.recipe.name}” uses unsupported products: ${[
            ...new Set(missingProducts.map(product => product.name)),
          ].join(', ')}.`,
          group.built + group.planned,
        )
        continue
      }

      const recipeId = `${moduleIdForZone(zone.id)}:${group.prototypeId}:${group.recipe.id}`
      const hasSharedCapacity = (recipeCountByPrototype.get(group.prototypeId) ?? 0) > 1
      const runtimeBehavior = runtimeRecipeBehaviors[
        `${group.prototypeId}:${group.recipe.id}`
      ]

      liveRecipes.push({
        id: recipeId,
        displayName: group.recipe.name,
        name: group.recipe.name,
        building: group.prototypeName,
        group: 'production',
        inputs: inputs.filter((input): input is Ingredient => Boolean(input)),
        outputs: outputs.filter((output): output is Ingredient => Boolean(output)),
        cycleDurationSeconds: group.recipe.durationSeconds,
        ...runtimeBehavior,
        sharedCapacity: hasSharedCapacity
          ? {
              id: group.prototypeId,
              label: group.prototypeName,
              priority,
            }
          : undefined,
      })
      builtBuildings[recipeId] = group.built
      activeBuildings[recipeId] = group.running + group.planned
      plannedBuildings[recipeId] = group.planned
      dataSources[recipeId] = group.planned > 0 ? 'planned' : 'synced'
    }

    const liveModule: Module = {
      id: moduleIdForZone(zone.id),
      name: zone.name,
      description: 'Live game area. Construction ghosts are projected as planned capacity; this tab is excluded from the current Factory Total.',
      includedInFactoryTotals: false,
      builtBuildings,
      recipes: liveRecipes,
      presets: [{
        id: 'live',
        name: 'Live area',
        description: 'Synced completed buildings plus planned construction ghosts.',
        activeBuildings,
        builtBuildings,
        plannedBuildings,
        capacityPools: presetCapacityPools,
        dataSources,
        fixed: liveRecipes.map(recipe => recipe.id),
      }],
      defaultPresetId: 'live',
      liveArea: {
        zoneId: zone.id,
        trackedBuildings: zoneEntities.length,
        constructedBuildings: zoneEntities.filter(entity => entity.constructed).length,
        plannedBuildings: zoneEntities.filter(isPlannedEntity).length,
        issues: [...issues.values()],
      },
    }

    return [liveModule]
  })
}
