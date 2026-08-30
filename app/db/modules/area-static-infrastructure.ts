import {
  type SyncedAreaEntity,
  type SyncedProductionEntity,
  type SyncedTrainStationConfiguration,
} from '../../game-state'
import { syncedBuildingPrototypeIds } from '../../helpers/area-building-sync/area-building-sync'
import { type CurrentValueSource } from '../../helpers/resolve-layered-value/resolve-layered-value'
import { recipes, type Recipe } from '../recipes'
import {
  normalizeStaticInfrastructureConfig,
  staticInfrastructureItems,
  type StaticInfrastructureConfig,
} from '../static-infrastructure'
import { type Module, type Preset } from './modules'

const plannedConstructionStates = new Set([
  'NotStarted',
  'InConstruction',
  'PreparingUpgrade',
  'BeingUpgraded',
])

const globallyOwnedInfrastructureIds = new Set([
  'electricLocomotiveII',
  'vehicles',
])
const nonProductionInfrastructurePrototypeIds = new Set([
  // The station root owns no selectable recipe or separately modeled load.
  'TrainStationRoot_ELEC',
])

const definitionByPrototypeId = new Map(
  staticInfrastructureItems.flatMap(item => {
    if (item.id === 'vehicles' || globallyOwnedInfrastructureIds.has(item.id)) return []

    return [[syncedBuildingPrototypeIds[item.id], item] as const]
  }),
)

const recipeIds = new Set<string>(staticInfrastructureItems.map(item => item.recipeId))
const recipeById = new Map(recipes.map(recipe => [recipe.id, recipe]))
const stationRecipeIds = new Set([
  'static-fluid-station-module-electrified',
  'static-loose-station-module-electrified',
  'static-molten-station-module-electrified',
  'static-unit-station-module-electrified',
])

export type StationCardRole = 'input' | 'unconfigured' | 'export'

const isStationRecipeId = (recipeId: string) => [...stationRecipeIds].some(
  stationRecipeId => (
    recipeId === stationRecipeId || recipeId.startsWith(`${stationRecipeId}:product:`)
  ),
)

const isStaticInfrastructureRecipeId = (recipeId: string) => (
  recipeIds.has(recipeId) || [...stationRecipeIds].some(stationRecipeId => (
    recipeId.startsWith(`${stationRecipeId}:product:`)
  ))
)

export const isAreaAssignableStaticInfrastructurePrototype = (prototypeId: string) => (
  definitionByPrototypeId.has(prototypeId) || nonProductionInfrastructurePrototypeIds.has(prototypeId)
)

export const selectStaticInfrastructureLines = <T extends { recipe: { id: string } }>(
  lines: readonly T[],
): T[] => lines.filter(line => isStaticInfrastructureRecipeId(line.recipe.id))

export const getStationCardRole = (recipe: {
  id: string
  stationRole?: Recipe['stationRole']
}): StationCardRole | null => {
  if (!isStationRecipeId(recipe.id)) return null

  return recipe.stationRole ?? 'unconfigured'
}

export const partitionStationLines = <T extends {
  recipe: { id: string; stationRole?: Recipe['stationRole'] }
}>(lines: readonly T[]) => {
  const input: T[] = []
  const unconfigured: T[] = []
  const content: T[] = []
  const exported: T[] = []

  for (const line of lines) {
    const role = getStationCardRole(line.recipe)

    if (role === 'input') input.push(line)
    else if (role === 'unconfigured') unconfigured.push(line)
    else if (role === 'export') exported.push(line)
    else content.push(line)
  }

  return { input, unconfigured, content, export: exported }
}

export interface StaticInfrastructureModuleAssignment {
  builtBuildings: Record<string, number>
  activeBuildings: Record<string, number>
  currentActiveBuildings: Record<string, number>
  constructionGhosts: Record<string, number>
  recipes: Record<string, Recipe>
}

interface ResolveStaticInfrastructureModuleAssignmentsOptions {
  areaEntities?: readonly SyncedAreaEntity[]
  builtConfig: StaticInfrastructureConfig
  defaultModuleId: string
  modules: readonly Pick<Module, 'id' | 'name' | 'liveArea'>[]
  productionEntities?: readonly SyncedProductionEntity[]
  runningConfig: StaticInfrastructureConfig
}

const createAssignment = (): StaticInfrastructureModuleAssignment => ({
  builtBuildings: {},
  activeBuildings: {},
  currentActiveBuildings: {},
  constructionGhosts: {},
  recipes: {},
})

const add = (record: Record<string, number>, recipeId: string, amount: number) => {
  record[recipeId] = Math.max(0, (record[recipeId] ?? 0) + amount)
}

const isConstructionGhost = (entity: SyncedAreaEntity) => (
  !entity.constructed && plannedConstructionStates.has(entity.constructionState)
)

const createStationRecipe = (
  baseRecipeId: string,
  trainStation: SyncedTrainStationConfiguration | null | undefined,
): Recipe | undefined => {
  const product = trainStation?.selectedProduct
  const baseRecipe = recipeById.get(baseRecipeId)

  if (!trainStation || !baseRecipe) return undefined

  const direction = trainStation.isForLoading ? 'loading' : 'unloading'
  const stationRole = trainStation.isForLoading ? 'export' : 'input'
  const productKey = product
    ? encodeURIComponent(product.productId)
    : 'unassigned'
  const displayName = `${product?.name ?? 'No product selected'} · ${direction}`

  return {
    ...baseRecipe,
    id: `${baseRecipeId}:product:${direction}:${productKey}`,
    name: `${baseRecipe.building} — ${displayName}`,
    displayName,
    showConfigurationSummary: true,
    stationRole,
  }
}

/**
 * Assigns stationary infrastructure to its one exact calculator-area match.
 * Unzoned or ambiguous buildings, moving locomotives, and the vehicle workforce
 * remain in Default.
 */
export const resolveStaticInfrastructureModuleAssignments = ({
  areaEntities,
  builtConfig,
  defaultModuleId,
  modules,
  productionEntities,
  runningConfig,
}: ResolveStaticInfrastructureModuleAssignmentsOptions): Record<
  string,
  StaticInfrastructureModuleAssignment
> => {
  const assignments = Object.fromEntries(
    modules.map(module => [module.id, createAssignment()]),
  )
  const defaultAssignment = assignments[defaultModuleId]

  if (!defaultAssignment) {
    throw new Error(`Missing default infrastructure owner module: ${defaultModuleId}`)
  }

  const normalizedBuilt = normalizeStaticInfrastructureConfig(builtConfig)
  const normalizedRunning = normalizeStaticInfrastructureConfig(runningConfig)

  for (const item of staticInfrastructureItems) {
    defaultAssignment.builtBuildings[item.recipeId] = normalizedBuilt[item.id]
    defaultAssignment.activeBuildings[item.recipeId] = Math.min(
      normalizedBuilt[item.id],
      normalizedRunning[item.id],
    )
    defaultAssignment.currentActiveBuildings[item.recipeId] =
      defaultAssignment.activeBuildings[item.recipeId] ?? 0
    defaultAssignment.constructionGhosts[item.recipeId] = 0
  }

  const moduleIdsByAreaName = new Map<string, string[]>()
  const moduleIdByZoneId = new Map<number, string>()

  for (const moduleDefinition of modules) {
    if (moduleDefinition.id === defaultModuleId) continue
    if (moduleDefinition.liveArea) {
      moduleIdByZoneId.set(moduleDefinition.liveArea.zoneId, moduleDefinition.id)
    }
    const moduleIds = moduleIdsByAreaName.get(moduleDefinition.name) ?? []

    moduleIds.push(moduleDefinition.id)
    moduleIdsByAreaName.set(moduleDefinition.name, moduleIds)
  }

  const assignEntity = (
    prototypeId: string,
    zones: readonly { id: number; name: string | null }[],
    constructed: boolean,
    running: boolean,
    constructionGhost: boolean,
    trainStation: SyncedTrainStationConfiguration | null | undefined,
  ) => {
    const definition = definitionByPrototypeId.get(prototypeId)

    if (!definition) return

    const matchingModuleIds = new Set(zones.flatMap(zone => {
      const moduleId = moduleIdByZoneId.get(zone.id)

      return moduleId ? [moduleId] : (moduleIdsByAreaName.get(zone.name ?? '') ?? [])
    }))
    const ownerId = matchingModuleIds.size === 1
      ? [...matchingModuleIds][0]
      : defaultModuleId
    const owner = ownerId ? assignments[ownerId] : undefined

    if (!owner) return

    const stationRecipe = createStationRecipe(definition.recipeId, trainStation)
    const assignedRecipeId = stationRecipe?.id ?? definition.recipeId

    if (stationRecipe) {
      owner.recipes[stationRecipe.id] = stationRecipe
    }

    if (constructed && (owner !== defaultAssignment || assignedRecipeId !== definition.recipeId)) {
      add(defaultAssignment.builtBuildings, definition.recipeId, -1)
      add(defaultAssignment.activeBuildings, definition.recipeId, -Number(running))
      add(defaultAssignment.currentActiveBuildings, definition.recipeId, -Number(running))
    }

    if (owner !== defaultAssignment || assignedRecipeId !== definition.recipeId) {
      add(owner.builtBuildings, assignedRecipeId, Number(constructed))
      add(owner.currentActiveBuildings, assignedRecipeId, Number(running))
      add(
        owner.activeBuildings,
        assignedRecipeId,
        Number(running) + Number(constructionGhost),
      )
      add(owner.constructionGhosts, assignedRecipeId, Number(constructionGhost))
    } else if (constructionGhost) {
      add(defaultAssignment.activeBuildings, definition.recipeId, 1)
      add(defaultAssignment.constructionGhosts, definition.recipeId, 1)
    }
  }

  if (productionEntities !== undefined) {
    for (const entity of productionEntities) {
      assignEntity(
        entity.prototypeId,
        entity.zones,
        true,
        entity.running,
        false,
        entity.trainStation,
      )
    }
  } else if (areaEntities !== undefined) {
    for (const entity of areaEntities.filter(entity => entity.constructed)) {
      assignEntity(
        entity.prototypeId,
        entity.zones,
        true,
        entity.running,
        false,
        entity.trainStation,
      )
    }
  }

  if (areaEntities !== undefined) {
    for (const entity of areaEntities.filter(isConstructionGhost)) {
      assignEntity(
        entity.prototypeId,
        entity.zones,
        false,
        false,
        true,
        entity.trainStation,
      )
    }
  }

  return assignments
}

/** Adds synced stationary infrastructure cards to their owning area module. */
export const attachStaticInfrastructureToModule = (
  module: Module,
  assignment: StaticInfrastructureModuleAssignment,
  currentSource: CurrentValueSource,
): Module => {
  const assignedRecipeIds = [...new Set([
    ...Object.keys(assignment.builtBuildings),
    ...Object.keys(assignment.activeBuildings),
    ...Object.keys(assignment.constructionGhosts),
  ])].filter(recipeId => (
    (assignment.builtBuildings[recipeId] ?? 0) > 0
    || (assignment.activeBuildings[recipeId] ?? 0) > 0
    || (assignment.constructionGhosts[recipeId] ?? 0) > 0
  ))

  if (assignedRecipeIds.length === 0) return module

  const assignedBuiltBuildings = Object.fromEntries(assignedRecipeIds.map(recipeId => [
    recipeId,
    assignment.builtBuildings[recipeId] ?? 0,
  ]))
  const assignedActiveBuildings = Object.fromEntries(assignedRecipeIds.map(recipeId => [
    recipeId,
    assignment.activeBuildings[recipeId] ?? 0,
  ]))
  const assignedCurrentActiveBuildings = Object.fromEntries(assignedRecipeIds.map(recipeId => [
    recipeId,
    assignment.currentActiveBuildings[recipeId] ?? 0,
  ]))
  const assignedConstructionGhosts = Object.fromEntries(assignedRecipeIds.map(recipeId => [
    recipeId,
    assignment.constructionGhosts[recipeId] ?? 0,
  ]))
  const dataSources: NonNullable<Preset['dataSources']> = Object.fromEntries(
    assignedRecipeIds.map(recipeId => [recipeId, currentSource]),
  )

  return {
    ...module,
    recipes: [...new Map([
      ...(module.recipes ?? []),
      ...Object.values(assignment.recipes),
    ].map(recipe => [recipe.id, recipe])).values()],
    builtBuildings: {
      ...module.builtBuildings,
      ...assignedBuiltBuildings,
    },
    presets: module.presets.map(preset => ({
      ...preset,
      builtBuildings: preset.builtBuildings
        ? { ...preset.builtBuildings, ...assignedBuiltBuildings }
        : undefined,
      activeBuildings: {
        ...preset.activeBuildings,
        ...assignedActiveBuildings,
      },
      currentActiveBuildings: {
        ...preset.currentActiveBuildings,
        ...assignedCurrentActiveBuildings,
      },
      constructionGhosts: {
        ...preset.constructionGhosts,
        ...assignedConstructionGhosts,
      },
      dataSources: {
        ...preset.dataSources,
        ...dataSources,
      },
      fixed: [...new Set([...preset.fixed, ...assignedRecipeIds])],
    })),
  }
}
