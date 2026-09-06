import { type LiveAreaPlans } from '../../db/live-area-plans'
import { isMaintenanceDepotPrototype } from '../../db/modules/area-maintenance'
import { isSolarPanelPrototype } from '../../db/modules/area-solar'
import {
  isAreaAssignableStaticInfrastructurePrototype,
  isNonProductionAreaInfrastructurePrototype,
} from '../../db/modules/area-static-infrastructure'
import { type Module, type LiveAreaIssue } from '../../db/modules/modules'
import {
  getGameRecipeKey,
  recipes as recipeCatalog,
  type Ingredient,
  type Recipe,
} from '../../db/recipes'
import {
  getLinkedOnlyLiveModuleInputIds,
  getSurplusConsumptionSettings,
} from '../../db/resource-disposition'
import { resources, type ResourceId } from '../../db/resources'
import { runtimeRecipeBehaviors, runtimeRecipePriorities } from '../../db/runtime-recipe-behaviors'
import {
  type SyncedAreaEntity,
  type SyncedAreaRecipe,
  type SyncedLogisticsZoneRef,
  type SyncedMineTower,
} from '../../game-state'
import { inferModuleCapabilities } from '../module-capabilities/module-capabilities'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'

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
const isNonMaterialOutput = (product: SyncedAreaRecipe['outputs'][number]) =>
  environmentalEmissionProductIds.has(product.productId) ||
  product.name.trim().toLocaleLowerCase() === 'research points'
const crusherPrototypeIds = new Set(['Crusher', 'CrusherLarge'])
const oreSortingPlantPrototypeIds = new Set(['OreSortingPlantT1', 'OreSortingPlantT2'])
const incidentalTerrainResourceIds = new Set<ResourceId>(['dirt', 'rock', 'slag', 'waste'])
const terrainMineResourceIds = new Set<ResourceId>([
  'bauxite',
  'coal',
  'copperOre',
  'goldOre',
  'ironOre',
  'limestone',
  'rock',
  'sand',
  'titaniumOre',
])
const fixedAreaRecipeByPrototypeId = new Map<string, Recipe>(
  Object.entries({
    ResearchLab4: 'research-lab-iv',
    ResearchLab5: 'research-lab-iv',
    WasteSortingPlant: 'waste-sorting-recyclables',
  } as const).flatMap(([prototypeId, recipeId]) => {
    const recipe = recipeCatalog.find(candidate => candidate.id === recipeId)

    return recipe ? [[prototypeId, recipe] as const] : []
  }),
)

export const DEFAULT_LIVE_AREA_ZONE_ID = -1
const DEFAULT_LIVE_AREA_MODULE_ID = 'general'

const hasNamedZone = (entity: Pick<SyncedAreaEntity, 'zones'>) =>
  entity.zones.some(zone => Boolean(zone.name))

type OreSorterProduct = NonNullable<SyncedAreaEntity['oreSorter']>['products'][number]

interface ResolvedTerrainProduct {
  priority: number
  product: OreSorterProduct
  resourceId: ResourceId
}

const resolveTerrainSourceProducts = (products: readonly OreSorterProduct[]) => {
  const resolved: ResolvedTerrainProduct[] = products.flatMap((product, priority) => {
    const resourceId = resolveSyncedResourceId(product)

    return resourceId ? [{ priority, product, resourceId }] : []
  })
  const primary = resolved.filter(({ resourceId }) => !incidentalTerrainResourceIds.has(resourceId))

  // Rock is reliable only for a dedicated rock pit. Dirt, Slag, and Waste are
  // incidental terrain/byproducts and never establish mine supply.
  return primary.length > 0 ? primary : resolved.filter(({ resourceId }) => resourceId === 'rock')
}

export const getModeledTerrainSorterEntityIds = (
  entities: readonly SyncedAreaEntity[],
  liveModules: readonly Module[],
): ReadonlySet<number> => {
  const modeledZoneIds = new Set(
    liveModules.flatMap(module => (module.liveArea ? [module.liveArea.zoneId] : [])),
  )
  const modelsDefaultArea = modeledZoneIds.has(DEFAULT_LIVE_AREA_ZONE_ID)

  return new Set(
    entities.flatMap(entity =>
      entity.oreSorter &&
      (entity.zones.some(zone => modeledZoneIds.has(zone.id)) ||
        (modelsDefaultArea && !hasNamedZone(entity))) &&
      resolveTerrainSourceProducts(entity.oreSorter.products).length > 0
        ? [entity.entityId]
        : [],
    ),
  )
}

const toIngredient = (
  product: SyncedAreaRecipe['inputs'][number],
  durationSeconds: number,
): Ingredient | null => {
  const resourceId = resolveSyncedResourceId(product)

  return resourceId ? { resourceId, quantity: (product.quantity * 60) / durationSeconds } : null
}

const isPlannedEntity = (entity: SyncedAreaEntity) =>
  !entity.constructed && plannedConstructionStates.has(entity.constructionState)

const formatSyncedRate = (quantity: number) =>
  parseFloat(quantity.toFixed(2)).toLocaleString('en-US')

const getForestryDisplayName = (entity: SyncedAreaEntity) => {
  const forestry = entity.forestry

  if (!forestry) return entity.prototypeName

  const treeCount = forestry.treeCount.toLocaleString('en-US')

  if (!forestry.cuttingEnabled) return `${treeCount} trees · Cutting off`

  const outputSummary = forestry.outputs
    .filter(output => output.quantityPerCycle > 0)
    .map(output => `${formatSyncedRate(output.quantityPerCycle)} ${output.name}`)
    .join(' + ')

  return `${treeCount} trees · Harvest at ${forestry.targetHarvestPercent}%${
    outputSummary ? ` · Max ${outputSummary} / cycle` : ''
  }`
}

const selectedRecipes = (entity: SyncedAreaEntity) => {
  const assigned = entity.recipes.filter(recipe => recipe.assigned)

  if (assigned.length > 0) return assigned
  if (entity.recipes.length === 1) return entity.recipes

  return []
}

const availableRecipeCount = (entity: SyncedAreaEntity) =>
  entity.availableRecipeCount ?? entity.recipes.length

interface RecipeGroup {
  prototypeId: string
  prototypeName: string
  /** Exact physical-machine configuration shared by every recipe in this group. */
  capacityPoolId?: string
  recipe: SyncedAreaRecipe
  built: number
  running: number
  planned: number
}

interface FixedRecipeGroup {
  prototypeId: string
  prototypeName: string
  recipe: Recipe
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

const moduleIdForZone = (zoneId: number) =>
  zoneId === DEFAULT_LIVE_AREA_ZONE_ID ? DEFAULT_LIVE_AREA_MODULE_ID : `live-area-${zoneId}`

/** Builds isolated calculator modules from unmatched named vehicle areas. */
export const createLiveAreaModules = (
  zones: readonly SyncedLogisticsZoneRef[],
  entities: readonly SyncedAreaEntity[],
  plans: LiveAreaPlans = {},
  mineTowers?: readonly SyncedMineTower[],
): Module[] => {
  const assignedTerrainSorterIds = new Set(
    mineTowers?.flatMap(tower => tower.assignedOreSorterEntityIds) ?? [],
  )

  return zones.flatMap(zone => {
    const isDefaultArea = zone.id === DEFAULT_LIVE_AREA_ZONE_ID

    if (!zone.name) return []

    const plan = plans[zone.id]
    const zoneEntities = entities.filter(
      entity =>
        (isDefaultArea
          ? !hasNamedZone(entity)
          : entity.zones.some(entityZone => entityZone.id === zone.id)) &&
        (entity.constructed || isPlannedEntity(entity)),
    )
    const modeledZoneEntities = zoneEntities.filter(
      entity => !isNonProductionAreaInfrastructurePrototype(entity.prototypeId),
    )
    // Sorting plants only ever receive mixed terrain, whether a mine tower feeds
    // them directly or trucks and stackers deliver it. Their configured products
    // establish the mine supply; the tower link does not.
    const terrainSorterEntities = mineTowers
      ? zoneEntities.filter(
          entity => oreSortingPlantPrototypeIds.has(entity.prototypeId) && entity.oreSorter,
        )
      : []
    const productionEntities = zoneEntities.filter(
      entity =>
        !entity.forestry &&
        !isAreaAssignableStaticInfrastructurePrototype(entity.prototypeId) &&
        !isMaintenanceDepotPrototype(entity.prototypeId) &&
        !isSolarPanelPrototype(entity.prototypeId),
    )
    const issues = new Map<string, LiveAreaIssue>()
    const groups = new Map<string, RecipeGroup>()
    const fixedGroups = new Map<string, FixedRecipeGroup>()
    const capacityPools = new Map<string, { built: number; running: number; planned: number }>()
    const sharedCapacityPools = new Map<
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
      const fixedRecipe =
        recipesForEntity.length === 0
          ? fixedAreaRecipeByPrototypeId.get(entity.prototypeId)
          : undefined
      const sharedCapacityPoolId =
        recipesForEntity.length > 1
          ? `${entity.prototypeId}:${recipesForEntity
              .map(recipe => recipe.id)
              .toSorted()
              .join('+')}`
          : undefined

      if (sharedCapacityPoolId) {
        const sharedCapacityPool = sharedCapacityPools.get(sharedCapacityPoolId) ?? {
          built: 0,
          running: 0,
          planned: 0,
        }

        sharedCapacityPool.built += Number(entity.constructed)
        sharedCapacityPool.running += Number(entity.running)
        sharedCapacityPool.planned += Number(isPlannedEntity(entity))
        sharedCapacityPools.set(sharedCapacityPoolId, sharedCapacityPool)
      }

      if (recipesForEntity.length === 0) {
        if (fixedRecipe) {
          const group = fixedGroups.get(entity.prototypeId) ?? {
            prototypeId: entity.prototypeId,
            prototypeName: entity.prototypeName,
            recipe: fixedRecipe,
            built: 0,
            running: 0,
            planned: 0,
          }

          group.built += Number(entity.constructed)
          group.running += Number(entity.running)
          group.planned += Number(isPlannedEntity(entity))
          fixedGroups.set(entity.prototypeId, group)
          continue
        }
        const recipeCount = availableRecipeCount(entity)

        if (recipeCount > 1) {
          addIssue(
            issues,
            `${entity.prototypeId}:recipe-choice`,
            entity.prototypeName,
            `Choose one of ${recipeCount} recipes in the game before its flows can be projected.`,
          )
        }
        continue
      }

      for (const recipe of recipesForEntity) {
        const key = `${sharedCapacityPoolId ?? entity.prototypeId}:${recipe.id}`
        const group = groups.get(key) ?? {
          prototypeId: entity.prototypeId,
          prototypeName: entity.prototypeName,
          capacityPoolId: sharedCapacityPoolId,
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

      const leftPriority =
        runtimeRecipePriorities[getGameRecipeKey(left.prototypeId, left.recipe.id)] ??
        Number.MAX_SAFE_INTEGER
      const rightPriority =
        runtimeRecipePriorities[getGameRecipeKey(right.prototypeId, right.recipe.id)] ??
        Number.MAX_SAFE_INTEGER

      return (
        leftPriority - rightPriority ||
        right.running - left.running ||
        right.built - left.built ||
        left.recipe.name.localeCompare(right.recipe.name)
      )
    })
    const groupCountByPrototypeRecipe = new Map<string, number>()

    for (const group of orderedGroups) {
      const key = getGameRecipeKey(group.prototypeId, group.recipe.id)

      groupCountByPrototypeRecipe.set(key, (groupCountByPrototypeRecipe.get(key) ?? 0) + 1)
    }

    const liveRecipes: Recipe[] = []
    const terrainCrusherRecipeIds = new Set<string>()
    const builtBuildings: Record<string, number> = {}
    const activeBuildings: Record<string, number> = {}
    const constructionGhosts: Record<string, number> = {}
    const currentActiveBuildings: Record<string, number> = {}
    const dataSources: NonNullable<Module['presets'][number]['dataSources']> = {}
    const presetCapacityPools: NonNullable<Module['presets'][number]['capacityPools']> = {}
    const fixedRecipeIds: string[] = []
    let terrainSorterSourceCount = 0
    let forestrySourceCount = 0

    for (const group of fixedGroups.values()) {
      const recipeId = `${moduleIdForZone(zone.id)}:${group.prototypeId}:${group.recipe.id}`

      liveRecipes.push({
        ...group.recipe,
        id: recipeId,
        gameBuildingId: group.prototypeId,
        gameRecipeId: group.recipe.id,
        name: group.recipe.name,
        building: group.recipe.building,
      })
      builtBuildings[recipeId] = group.built
      activeBuildings[recipeId] = group.running + group.planned
      currentActiveBuildings[recipeId] = group.running
      constructionGhosts[recipeId] = group.planned
      dataSources[recipeId] = 'synced'
      if (group.prototypeId.startsWith('ResearchLab')) {
        fixedRecipeIds.push(recipeId)
      }
    }

    for (const [prototypeId, pool] of capacityPools) {
      presetCapacityPools[prototypeId] = {
        active: pool.running + pool.planned,
        built: pool.built,
        currentActive: pool.running,
        constructionGhosts: pool.planned,
      }
    }
    for (const [capacityPoolId, pool] of sharedCapacityPools) {
      presetCapacityPools[capacityPoolId] = {
        active: pool.running + pool.planned,
        built: pool.built,
        currentActive: pool.running,
        constructionGhosts: pool.planned,
      }
    }

    for (const [priority, group] of orderedGroups.entries()) {
      const materialOutputs = group.recipe.outputs.filter(product => !isNonMaterialOutput(product))
      const inputs = group.recipe.inputs.map(product =>
        toIngredient(product, group.recipe.durationSeconds),
      )
      const outputs = materialOutputs.map(product =>
        toIngredient(product, group.recipe.durationSeconds),
      )
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

      const baseRecipeId = `${moduleIdForZone(zone.id)}:${group.prototypeId}:${group.recipe.id}`
      const recipeId =
        (groupCountByPrototypeRecipe.get(`${group.prototypeId}:${group.recipe.id}`) ?? 0) > 1
          ? `${baseRecipeId}:${group.capacityPoolId ?? 'dedicated'}`
          : baseRecipeId
      const runtimeBehavior =
        runtimeRecipeBehaviors[getGameRecipeKey(group.prototypeId, group.recipe.id)]
      const normalizedInputs = inputs.filter((input): input is Ingredient => Boolean(input))
      const normalizedOutputs = outputs.filter((output): output is Ingredient => Boolean(output))
      const isModuleSeaWaterPump =
        normalizedInputs.length === 0 &&
        normalizedOutputs.length > 0 &&
        normalizedOutputs.every(output => output.resourceId === 'seaWater')

      liveRecipes.push({
        id: recipeId,
        gameBuildingId: group.prototypeId,
        gameRecipeId: group.recipe.id,
        name: group.recipe.name,
        building: group.prototypeName,
        group: isModuleSeaWaterPump ? 'source' : 'production',
        sourceMode: isModuleSeaWaterPump ? 'module-demand-capped' : undefined,
        inputs: normalizedInputs,
        outputs: normalizedOutputs,
        cycleDurationSeconds: group.recipe.durationSeconds,
        ...runtimeBehavior,
        sharedCapacity: group.capacityPoolId
          ? {
              id: group.capacityPoolId,
              label: group.prototypeName,
              priority,
            }
          : undefined,
      })
      if (group.prototypeId.startsWith('ResearchLab')) {
        fixedRecipeIds.push(recipeId)
      }
      if (crusherPrototypeIds.has(group.prototypeId)) {
        terrainCrusherRecipeIds.add(recipeId)
      }
      builtBuildings[recipeId] = group.built
      activeBuildings[recipeId] = group.running + group.planned
      currentActiveBuildings[recipeId] = group.running
      constructionGhosts[recipeId] = group.planned
      dataSources[recipeId] = 'synced'
    }

    for (const entity of zoneEntities.filter(candidate => candidate.forestry)) {
      const forestry = entity.forestry

      if (!forestry) continue

      const outputs = forestry.outputs.flatMap(output => {
        const resourceId = resolveSyncedResourceId(output)

        if (!resourceId) {
          addIssue(
            issues,
            `${entity.prototypeId}:${entity.entityId}:${output.productId}`,
            entity.prototypeName,
            `Forestry output “${output.name}” is not supported.`,
          )
          return []
        }

        return output.quantityPerCycle > 0
          ? [{ resourceId, quantity: output.quantityPerCycle }]
          : []
      })
      const recipeId = `${moduleIdForZone(zone.id)}:forestry:${entity.entityId}`
      const built = Number(entity.constructed)
      const running = Number(
        entity.constructed && entity.running && forestry.cuttingEnabled && outputs.length > 0,
      )
      const planned = Number(isPlannedEntity(entity))

      liveRecipes.push({
        id: recipeId,
        gameBuildingId: entity.prototypeId,
        name: 'Sustainable forestry',
        displayName: getForestryDisplayName(entity),
        building: entity.prototypeName,
        group: 'source',
        inputs:
          forestry.harvestsPerCycle > 0
            ? [{ resourceId: 'treeSapling', quantity: forestry.harvestsPerCycle }]
            : [],
        outputs,
        cycleDurationSeconds: 60,
        sourceMode: 'demand-capped',
      })
      builtBuildings[recipeId] = built
      activeBuildings[recipeId] = running + planned
      currentActiveBuildings[recipeId] = running
      constructionGhosts[recipeId] = planned
      dataSources[recipeId] = 'synced'
      forestrySourceCount++
    }

    for (const sorter of terrainSorterEntities) {
      const configuration = sorter.oreSorter

      if (!configuration) continue

      const sourceProducts = resolveTerrainSourceProducts(configuration.products)

      for (const product of configuration.products) {
        if (!resolveSyncedResourceId(product)) {
          addIssue(
            issues,
            `${sorter.prototypeId}:${sorter.entityId}:${product.productId}`,
            sorter.prototypeName,
            `Configured terrain product “${product.name}” is not supported.`,
          )
        }
      }

      if (sourceProducts.length === 0) continue

      // Supply is projected whether or not a tower feeds the plant, so an
      // unlinked plant that nothing delivers to would balance silently.
      if (!assignedTerrainSorterIds.has(sorter.entityId) && sorter.constructed && sorter.running) {
        addIssue(
          issues,
          `${sorter.prototypeId}:mine-tower`,
          sorter.prototypeName,
          'No mine tower is assigned; supply is projected from the configured throughput.',
        )
      }

      const capacityPoolId = `terrain-sorter:${sorter.entityId}`
      const built = Number(sorter.constructed)
      const running = Number(sorter.constructed && sorter.running)
      const planned = Number(isPlannedEntity(sorter))
      const active = running + planned

      presetCapacityPools[capacityPoolId] = {
        active,
        built,
        currentActive: running,
        constructionGhosts: planned,
      }

      for (const { priority, product, resourceId } of sourceProducts) {
        const outputYield = product.canBeWasted ? 1 - configuration.conversionLossPercent / 100 : 1
        const recipeId = `${moduleIdForZone(zone.id)}:terrain-sorter:${sorter.entityId}:${resourceId}`

        liveRecipes.push({
          id: recipeId,
          gameBuildingId: sorter.prototypeId,
          name: `${resources[resourceId].name} sorting`,
          building: sorter.prototypeName,
          group: 'production',
          balanceBy: 'output',
          balanceOutputIds: [resourceId],
          inputs: [],
          outputs: [
            {
              resourceId,
              quantity: configuration.throughputPerCycle * outputYield,
            },
          ],
          cycleDurationSeconds: 60,
          sourceKind: 'terrain-mine',
          sharedCapacity: {
            id: capacityPoolId,
            label: sorter.prototypeName,
            priority,
          },
        })
        builtBuildings[recipeId] = built
        activeBuildings[recipeId] = active
        currentActiveBuildings[recipeId] = running
        constructionGhosts[recipeId] = planned
        dataSources[recipeId] = 'synced'
        terrainSorterSourceCount++
      }
    }

    const balancedLiveRecipes = liveRecipes.map(recipe => {
      if (recipe.group === 'source') return recipe

      const linkedOnlyInputIds = getLinkedOnlyLiveModuleInputIds(
        recipe.inputs.map(input => input.resourceId),
      )
      const terrainInputIds =
        !mineTowers && terrainCrusherRecipeIds.has(recipe.id)
          ? recipe.inputs
              .map(input => input.resourceId)
              .filter(resourceId => terrainMineResourceIds.has(resourceId))
          : []
      const surplusConsumption = getSurplusConsumptionSettings(
        recipe.inputs.map(input => input.resourceId),
        recipe.gameRecipeId,
        { isDefaultArea },
      )
      const appliesSurplusDisposition = surplusConsumption && recipe.consumeSurplusInputIds == null
      const surplusConsumptionFields =
        surplusConsumption && appliesSurplusDisposition && !surplusConsumption.surplusOnly
          ? {
              consumeSurplusInputIds: surplusConsumption.inputIds,
              consumeSurplusInputScope: surplusConsumption.scope,
              surplusConsumptionPriority: surplusConsumption.priority,
            }
          : {}
      const moduleScopedSurplusInputIds =
        surplusConsumption && appliesSurplusDisposition && surplusConsumption.scope === 'module'
          ? surplusConsumption.inputIds
          : []
      const moduleScopedInputIds = [
        ...new Set([...linkedOnlyInputIds, ...terrainInputIds, ...moduleScopedSurplusInputIds]),
      ]
      const moduleScopedInputFields =
        moduleScopedInputIds.length > 0
          ? {
              balanceInputIds: [
                ...new Set([...(recipe.balanceInputIds ?? []), ...moduleScopedInputIds]),
              ],
              balanceInputScope: 'module' as const,
            }
          : {}

      if (surplusConsumption?.surplusOnly && appliesSurplusDisposition) {
        return {
          ...recipe,
          ...moduleScopedInputFields,
          allocation: recipe.allocation ?? 'fallback',
          allocationPriority: recipe.allocationPriority ?? surplusConsumption.priority,
          balanceBy: 'input' as const,
          balanceOutputIds: undefined,
          inputPriorities: {
            ...recipe.inputPriorities,
            ...Object.fromEntries(
              surplusConsumption.inputIds.map(resourceId => [
                resourceId,
                surplusConsumption.priority,
              ]),
            ),
          },
        }
      }

      if (recipe.balanceBy) {
        return {
          ...recipe,
          ...surplusConsumptionFields,
          ...moduleScopedInputFields,
        }
      }

      if (recipe.outputs.length > 0) {
        return {
          ...recipe,
          ...surplusConsumptionFields,
          ...moduleScopedInputFields,
          balanceBy: 'output' as const,
          balanceOutputIds: recipe.outputs.map(output => output.resourceId),
        }
      }

      if (recipe.inputs.length > 0) {
        return {
          ...recipe,
          ...surplusConsumptionFields,
          ...moduleScopedInputFields,
          balanceBy: 'input' as const,
          balanceInputIds: recipe.inputs.map(input => input.resourceId),
        }
      }

      return recipe
    })
    const terrainSourceResourceIds = [
      ...new Set(
        balancedLiveRecipes
          .filter(recipe => terrainCrusherRecipeIds.has(recipe.id))
          .flatMap(recipe => recipe.inputs)
          .map(input => input.resourceId)
          .filter(resourceId => terrainMineResourceIds.has(resourceId)),
      ),
    ]
    const hasOreSortingPlant = zoneEntities.some(entity =>
      oreSortingPlantPrototypeIds.has(entity.prototypeId),
    )
    const hasOperatingOreSortingPlant = zoneEntities.some(
      entity =>
        oreSortingPlantPrototypeIds.has(entity.prototypeId) && entity.constructed && entity.running,
    )
    const implicitSourceRecipes: Recipe[] =
      !mineTowers && hasOperatingOreSortingPlant
        ? terrainSourceResourceIds.map(resourceId => {
            const recipeId = `${moduleIdForZone(zone.id)}:terrain-source:${resourceId}`

            builtBuildings[recipeId] = 1
            activeBuildings[recipeId] = 1
            currentActiveBuildings[recipeId] = 1
            dataSources[recipeId] = 'synced'

            return {
              id: recipeId,
              name: `${resources[resourceId].name} terrain extraction`,
              building: 'Terrain extraction',
              group: 'source',
              inputs: [],
              outputs: [{ resourceId, quantity: 0 }],
              sourceMode: 'module-demand',
              sourceKind: 'terrain-mine',
              hiddenFromModuleView: true,
            }
          })
        : []
    const requestedImports = plan?.requestedImports
    const requestedExports = plan?.requestedExports
    const usesFactoryPool =
      isDefaultArea ||
      plan?.resourcePool === 'factory' ||
      forestrySourceCount > 0 ||
      (mineTowers
        ? terrainSorterSourceCount > 0
        : hasOreSortingPlant && terrainSourceResourceIds.length > 0)

    const liveModule: Module = {
      id: moduleIdForZone(zone.id),
      name: zone.name,
      description: '',
      gameSynced: true,
      capabilities: inferModuleCapabilities(zoneEntities, { isDefault: isDefaultArea }),
      includedInFactoryTotals: usesFactoryPool,
      builtBuildings,
      recipes: [...balancedLiveRecipes, ...implicitSourceRecipes],
      presets: [
        {
          id: 'live',
          name: 'Live area',
          description: 'Synced completed buildings plus synced construction ghosts.',
          activeBuildings,
          currentActiveBuildings,
          builtBuildings,
          constructionGhosts,
          capacityPools: presetCapacityPools,
          dataSources,
          fixed: fixedRecipeIds,
          outputTargets: usesFactoryPool ? requestedExports : undefined,
          requestedImports,
          requestedExports,
        },
      ],
      defaultPresetId: 'live',
      liveArea: {
        zoneId: zone.id,
        trackedBuildings: modeledZoneEntities.length,
        constructedBuildings: modeledZoneEntities.filter(entity => entity.constructed).length,
        activeBuildings: modeledZoneEntities.filter(entity => entity.constructed && entity.running)
          .length,
        pausedBuildings: modeledZoneEntities.filter(entity => entity.constructed && !entity.running)
          .length,
        constructionGhosts: modeledZoneEntities.filter(isPlannedEntity).length,
        issues: [...issues.values()],
      },
    }

    return [liveModule]
  })
}
