import { type SyncedProductionEntity } from '../../game-state'
import { type CurrentValueSource } from '../../helpers/resolve-layered-value/resolve-layered-value'
import { recipes } from '../recipes'
import { type ResourceId } from '../resources'
import { type Module, type Preset } from './modules'

interface MaintenanceDemand {
  maintenanceI: number
  maintenanceII: number
  maintenanceIII: number
}

const emptyMaintenanceDemand = {
  maintenanceI: 0,
  maintenanceII: 0,
  maintenanceIII: 0,
} as const satisfies MaintenanceDemand & Partial<Record<ResourceId, number>>

const maintenanceResourceIds = [
  'maintenanceI',
  'maintenanceII',
  'maintenanceIII',
] as const satisfies readonly ResourceId[]

type MaintenanceResourceId = (typeof maintenanceResourceIds)[number]

interface MaintenanceDepotDefinition {
  prototypeId: string
  resourceId: MaintenanceResourceId
  standardRecipeId: string
  recyclingGameRecipeId?: string
  recyclingRecipeId?: string
}

const maintenanceDepots: readonly MaintenanceDepotDefinition[] = [
  {
    prototypeId: 'MaintenanceDepotT0',
    resourceId: 'maintenanceI',
    standardRecipeId: 'maintenance-i-basic',
  },
  {
    prototypeId: 'MaintenanceDepotT1',
    resourceId: 'maintenanceI',
    standardRecipeId: 'maintenance-i',
    recyclingGameRecipeId: 'MaintenanceT1Recycling',
    recyclingRecipeId: 'maintenance-i-recycling',
  },
  {
    prototypeId: 'MaintenanceDepotT2',
    resourceId: 'maintenanceII',
    standardRecipeId: 'maintenance-ii',
    recyclingGameRecipeId: 'MaintenanceT2Recycling',
    recyclingRecipeId: 'maintenance-ii-recycling',
  },
  {
    prototypeId: 'MaintenanceDepotT3',
    resourceId: 'maintenanceIII',
    standardRecipeId: 'maintenance-iii',
    recyclingGameRecipeId: 'MaintenanceT3Recycling',
    recyclingRecipeId: 'maintenance-iii-recycling',
  },
]

const depotByPrototypeId = new Map(
  maintenanceDepots.map(definition => [definition.prototypeId, definition]),
)

export const isMaintenanceDepotPrototype = (prototypeId: string) => (
  depotByPrototypeId.has(prototypeId)
)
const maintenanceResourceByRecipeId = new Map<string, MaintenanceResourceId>(
  maintenanceDepots.flatMap(definition => [
    [definition.standardRecipeId, definition.resourceId] as const,
    ...(definition.recyclingRecipeId
      ? [[definition.recyclingRecipeId, definition.resourceId] as const]
      : []),
  ]),
)
const recipeById = new Map(recipes.map(recipe => [recipe.id, recipe]))

export const selectMaintenanceDepotLines = <T extends { recipe: { id: string } }>(
  lines: readonly T[],
): T[] => lines.filter(line => maintenanceResourceByRecipeId.has(line.recipe.id))

export interface MaintenanceDepotModuleAssignment {
  builtBuildings: Record<string, number>
  activeBuildings: Record<string, number>
  recipeOutputTargets: NonNullable<Preset['recipeOutputTargets']>
}

interface ResolveMaintenanceDepotModuleAssignmentsOptions {
  defaultModuleId: string
  demand?: MaintenanceDemand
  modules: readonly Pick<Module, 'id' | 'name' | 'liveArea'>[]
  productionEntities?: readonly SyncedProductionEntity[]
}

const createAssignment = (): MaintenanceDepotModuleAssignment => ({
  builtBuildings: {},
  activeBuildings: {},
  recipeOutputTargets: {},
})

const getCalculatorRecipeId = (
  entity: SyncedProductionEntity,
  definition: MaintenanceDepotDefinition,
) =>
  definition.recyclingGameRecipeId &&
  definition.recyclingRecipeId &&
  entity.recipeIds.includes(definition.recyclingGameRecipeId)
    ? definition.recyclingRecipeId
    : definition.standardRecipeId

/**
 * Assigns each physical maintenance depot to its exact synced area ID. Depots
 * outside named areas belong to the game's immutable Default area.
 */
export const resolveMaintenanceDepotModuleAssignments = ({
  defaultModuleId,
  demand = emptyMaintenanceDemand,
  modules,
  productionEntities,
}: ResolveMaintenanceDepotModuleAssignmentsOptions): Record<
  string,
  MaintenanceDepotModuleAssignment
> => {
  const assignments = Object.fromEntries(
    modules.map(moduleDefinition => [moduleDefinition.id, createAssignment()]),
  )
  const defaultAssignment = assignments[defaultModuleId]

  if (!defaultAssignment) {
    throw new Error(`Missing default maintenance owner module: ${defaultModuleId}`)
  }

  if (productionEntities !== undefined) {
    const moduleIdByZoneId = new Map<number, string>()

    for (const moduleDefinition of modules) {
      if (moduleDefinition.id === defaultModuleId) continue
      if (moduleDefinition.liveArea) {
        moduleIdByZoneId.set(moduleDefinition.liveArea.zoneId, moduleDefinition.id)
      }
    }

    for (const entity of productionEntities) {
      const definition = depotByPrototypeId.get(entity.prototypeId)

      if (!definition) continue

      const matchingModuleIds = new Set(entity.zones.flatMap(zone => {
        const moduleId = moduleIdByZoneId.get(zone.id)

        return moduleId ? [moduleId] : []
      }))
      const ownerId = matchingModuleIds.size === 1 ? [...matchingModuleIds][0] : defaultModuleId
      const owner = ownerId ? assignments[ownerId] : undefined

      if (!owner) continue

      const recipeId = getCalculatorRecipeId(entity, definition)

      owner.builtBuildings[recipeId] = (owner.builtBuildings[recipeId] ?? 0) + 1
      owner.activeBuildings[recipeId] =
        (owner.activeBuildings[recipeId] ?? 0) + Number(entity.running)
    }
  }

  for (const resourceId of maintenanceResourceIds) {
    const capacityEntries = Object.entries(assignments).flatMap(([, assignment]) =>
      Object.entries(assignment.activeBuildings).flatMap(([recipeId, activeBuildings]) => {
        if (maintenanceResourceByRecipeId.get(recipeId) !== resourceId) return []

        const recipe = recipeById.get(recipeId)
        const output = recipe?.outputs.find(candidate => candidate.resourceId === resourceId)
        const capacity = (output?.quantity ?? 0) * activeBuildings

        return capacity > 0 ? [{ assignment, capacity, recipeId }] : []
      }),
    )
    const totalCapacity = capacityEntries.reduce((total, entry) => total + entry.capacity, 0)

    if (totalCapacity <= 0) continue

    for (const entry of capacityEntries) {
      entry.assignment.recipeOutputTargets[entry.recipeId] = {
        ...entry.assignment.recipeOutputTargets[entry.recipeId],
        [resourceId]: (Math.max(0, demand[resourceId]) * entry.capacity) / totalCapacity,
      }
    }
  }

  return assignments
}

/** Adds live maintenance depots and their observed demand to an area module. */
export const attachMaintenanceDepotsToModule = (
  module: Module,
  assignment: MaintenanceDepotModuleAssignment,
  currentSource: CurrentValueSource,
): Module => {
  const recipeIds = Object.keys(assignment.builtBuildings)

  if (recipeIds.length === 0) return module

  const dataSources = Object.fromEntries(recipeIds.map(recipeId => [recipeId, currentSource]))

  return {
    ...module,
    builtBuildings: {
      ...module.builtBuildings,
      ...assignment.builtBuildings,
    },
    presets: module.presets.map(preset => ({
      ...preset,
      builtBuildings: preset.builtBuildings
        ? { ...preset.builtBuildings, ...assignment.builtBuildings }
        : undefined,
      activeBuildings: {
        ...preset.activeBuildings,
        ...assignment.activeBuildings,
      },
      dataSources: {
        ...preset.dataSources,
        ...dataSources,
      },
      fixed: [...new Set([...preset.fixed, ...recipeIds])],
      recipeOutputTargets: {
        ...preset.recipeOutputTargets,
        ...assignment.recipeOutputTargets,
      },
    })),
    localResources: [...new Set([...(module.localResources ?? []), ...maintenanceResourceIds])],
  }
}
