import { liveAreaPlans, type LiveAreaPlans } from '../../db/live-area-plans'
import { isMaintenanceDepotPrototype } from '../../db/modules/area-maintenance'
import { isSolarPanelPrototype } from '../../db/modules/area-solar'
import { isAreaAssignableStaticInfrastructurePrototype } from '../../db/modules/area-static-infrastructure'
import { type Module, type LiveAreaIssue } from '../../db/modules/modules'
import { type Ingredient, type Recipe } from '../../db/recipes'
import {
  getLinkedOnlyLiveModuleInputIds,
  getSurplusConsumptionSettings,
} from '../../db/resource-disposition'
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

const environmentalEmissionProductIds = new Set([
  'Product_Virtual_PollutedAir',
  'Product_Virtual_PollutedWater',
])

const normalizeResourceKey = (value: string) => value
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase()
  .replace(/^product(?:virtual)?/, '')

const resourceIdByKey = new Map<string, ResourceId>()

const runtimeRecipeBehaviors: Record<
  string,
  Pick<
    Recipe,
    | 'appliesRecyclingEfficiency'
    | 'balanceBy'
    | 'balanceInputIds'
    | 'balanceOutputIds'
    | 'consumeSurplusInputIds'
    | 'consumeSurplusInputScope'
    | 'electricityMultiplier'
    | 'surplusConsumptionPriority'
  >
> = {
  'ArcFurnace2:CopperSmeltingArc': {
    balanceBy: 'output',
    balanceOutputIds: ['moltenCopper'],
  },
  'ArcFurnace2:CopperSmeltingArcScrap': {
    balanceBy: 'input',
    balanceInputIds: ['copperScrap'],
    electricityMultiplier: 0.6,
  },
  'ChemicalPlant2:GraphiteProductionCo2': {
    consumeSurplusInputIds: ['carbonDioxide'],
    consumeSurplusInputScope: 'module',
    surplusConsumptionPriority: 10,
  },
  'SmokeStack:SmokeStackCarbonDioxide': {
    consumeSurplusInputIds: ['carbonDioxide'],
    consumeSurplusInputScope: 'module',
    surplusConsumptionPriority: 100,
  },
  'SmokeStack:SmokeStackExhaust': {
    consumeSurplusInputIds: ['exhaust'],
    consumeSurplusInputScope: 'module',
    surplusConsumptionPriority: 100,
  },
  'SmokeStackLarge:SmokeStackCarbonDioxide': {
    consumeSurplusInputIds: ['carbonDioxide'],
    consumeSurplusInputScope: 'module',
    surplusConsumptionPriority: 100,
  },
  'SmokeStackLarge:SmokeStackExhaust': {
    consumeSurplusInputIds: ['exhaust'],
    consumeSurplusInputScope: 'module',
    surplusConsumptionPriority: 100,
  },
  'Shredder:ShreddingRetiredWaste': { appliesRecyclingEfficiency: false },
}

/** Explicit game UI order for selectable recipes whose prototype list is not display-ordered. */
const runtimeRecipePriorities: Readonly<Record<string, number>> = {
  'ArcFurnace2:CopperSmeltingArcScrap': 0,
  'ArcFurnace2:CopperSmeltingArc': 1,
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

type GameSelectableRecipe = Recipe & { gameRecipeId: string }

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

/** Builds isolated calculator modules from unmatched named vehicle areas. */
export const createLiveAreaModules = (
  zones: readonly SyncedLogisticsZoneRef[],
  entities: readonly SyncedAreaEntity[],
  configuredModules: readonly Module[],
  plans: LiveAreaPlans = liveAreaPlans,
): Module[] => {
  const existingNames = new Set(configuredModules.map(module => module.name))

  return zones.flatMap(zone => {
    if (!zone.name || existingNames.has(zone.name)) return []

    const zoneEntities = entities.filter(entity => (
      entity.zones.some(entityZone => entityZone.id === zone.id)
      && (entity.constructed || isPlannedEntity(entity))
    ))
    const productionEntities = zoneEntities.filter(entity => (
      !isAreaAssignableStaticInfrastructurePrototype(entity.prototypeId)
      && !isMaintenanceDepotPrototype(entity.prototypeId)
      && !isSolarPanelPrototype(entity.prototypeId)
    ))
    const issues = new Map<string, LiveAreaIssue>()
    const groups = new Map<string, RecipeGroup>()
    const capacityPools = new Map<
      string,
      { built: number; running: number; planned: number }
    >()

    for (const entity of productionEntities) {
      const capacityPool = capacityPools.get(entity.prototypeId) ?? {
        built: 0,
        running: 0,
        planned: 0,
      }

      capacityPool.built += Number(entity.constructed)
      capacityPool.running += Number(entity.running)
      capacityPool.planned += Number(isPlannedEntity(entity))
      capacityPools.set(entity.prototypeId, capacityPool)

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

    const orderedGroups = [...groups.values()].sort((left, right) => {
      const prototypeOrder = left.prototypeName.localeCompare(right.prototypeName)

      if (prototypeOrder !== 0) return prototypeOrder

      const leftPriority = runtimeRecipePriorities[`${left.prototypeId}:${left.recipe.id}`]
        ?? Number.MAX_SAFE_INTEGER
      const rightPriority = runtimeRecipePriorities[`${right.prototypeId}:${right.recipe.id}`]
        ?? Number.MAX_SAFE_INTEGER

      return leftPriority - rightPriority || left.recipe.name.localeCompare(right.recipe.name)
    })
    const recipeCountByPrototype = new Map<string, number>()

    for (const group of orderedGroups) {
      recipeCountByPrototype.set(
        group.prototypeId,
        (recipeCountByPrototype.get(group.prototypeId) ?? 0) + 1,
      )
    }

    const liveRecipes: GameSelectableRecipe[] = []
    const builtBuildings: Record<string, number> = {}
    const activeBuildings: Record<string, number> = {}
    const constructionGhosts: Record<string, number> = {}
    const currentActiveBuildings: Record<string, number> = {}
    const dataSources: NonNullable<Module['presets'][number]['dataSources']> = {}
    const presetCapacityPools: NonNullable<Module['presets'][number]['capacityPools']> = {}

    for (const [prototypeId, pool] of capacityPools) {
      presetCapacityPools[prototypeId] = {
        active: pool.running + pool.planned,
        built: pool.built,
        currentActive: pool.running,
        constructionGhosts: pool.planned,
      }
    }

    for (const [priority, group] of orderedGroups.entries()) {
      const materialOutputs = group.recipe.outputs.filter(product => (
        !environmentalEmissionProductIds.has(product.productId)
      ))
      const inputs = group.recipe.inputs.map(product => (
        toIngredient(product, group.recipe.durationSeconds)
      ))
      const outputs = materialOutputs.map(product => (
        toIngredient(product, group.recipe.durationSeconds)
      ))
      const missingProducts = [
        ...group.recipe.inputs.filter((_, index) => !inputs[index]),
        ...materialOutputs.filter((_, index) => !outputs[index]),
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
      const normalizedInputs = inputs.filter((input): input is Ingredient => Boolean(input))
      const normalizedOutputs = outputs.filter((output): output is Ingredient => Boolean(output))
      const isModuleSeaWaterPump = normalizedInputs.length === 0
        && normalizedOutputs.length > 0
        && normalizedOutputs.every(output => output.resourceId === 'seaWater')

      liveRecipes.push({
        id: recipeId,
        gameRecipeId: group.recipe.id,
        name: group.recipe.name,
        building: group.prototypeName,
        group: isModuleSeaWaterPump ? 'source' : 'production',
        sourceMode: isModuleSeaWaterPump ? 'module-demand-capped' : undefined,
        inputs: normalizedInputs,
        outputs: normalizedOutputs,
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
      currentActiveBuildings[recipeId] = group.running
      constructionGhosts[recipeId] = group.planned
      dataSources[recipeId] = 'synced'
    }

    const balancedLiveRecipes = liveRecipes.map(recipe => {
      if (recipe.group === 'source') return recipe

      const linkedOnlyInputIds = getLinkedOnlyLiveModuleInputIds(
        recipe.inputs.map(input => input.resourceId),
      )
      const surplusConsumption = getSurplusConsumptionSettings(
        recipe.inputs.map(input => input.resourceId),
        recipe.gameRecipeId,
      )
      const surplusConsumptionFields = surplusConsumption
        ? {
            consumeSurplusInputIds: surplusConsumption.inputIds,
            consumeSurplusInputScope: surplusConsumption.scope,
            surplusConsumptionPriority: surplusConsumption.priority,
          }
        : {}
      const linkedOnlyInputFields = linkedOnlyInputIds.length > 0
        ? {
            balanceInputIds: [...new Set([
              ...(recipe.balanceInputIds ?? []),
              ...linkedOnlyInputIds,
            ])],
            balanceInputScope: 'module' as const,
          }
        : {}

      if (recipe.balanceBy) {
        return {
          ...recipe,
          ...surplusConsumptionFields,
          ...linkedOnlyInputFields,
        }
      }

      if (recipe.outputs.length > 0) {
        return {
          ...recipe,
          ...surplusConsumptionFields,
          ...linkedOnlyInputFields,
          balanceBy: 'output' as const,
          balanceOutputIds: recipe.outputs.map(output => output.resourceId),
        }
      }

      if (recipe.inputs.length > 0) {
        return {
          ...recipe,
          ...surplusConsumptionFields,
          ...linkedOnlyInputFields,
          balanceBy: 'input' as const,
          balanceInputIds: recipe.inputs.map(input => input.resourceId),
        }
      }

      return recipe
    })
    const plan = plans[zone.name]
    const requestedExports = plan?.requestedExports

    const liveModule: Module = {
      id: moduleIdForZone(zone.id),
      name: zone.name,
      description: '',
      includedInFactoryTotals: plan?.resourcePool === 'factory',
      builtBuildings,
      recipes: balancedLiveRecipes,
      presets: [{
        id: 'live',
        name: 'Live area',
        description: 'Synced completed buildings plus synced construction ghosts.',
        activeBuildings,
        currentActiveBuildings,
        builtBuildings,
        constructionGhosts,
        capacityPools: presetCapacityPools,
        dataSources,
        fixed: [],
        outputTargets: plan?.resourcePool === 'factory' ? requestedExports : undefined,
        requestedExports,
      }],
      defaultPresetId: 'live',
      liveArea: {
        zoneId: zone.id,
        trackedBuildings: zoneEntities.length,
        constructedBuildings: zoneEntities.filter(entity => entity.constructed).length,
        activeBuildings: zoneEntities.filter(entity => entity.constructed && entity.running).length,
        pausedBuildings: zoneEntities.filter(entity => entity.constructed && !entity.running).length,
        constructionGhosts: zoneEntities.filter(isPlannedEntity).length,
        issues: [...issues.values()],
      },
    }

    return [liveModule]
  })
}
