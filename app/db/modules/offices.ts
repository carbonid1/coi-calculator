import {
  type SyncedAreaEntity,
  type SyncedProductionEntity,
} from '../../game-state'
import {
  defaultOfficePlan,
  getOfficeRecipeId,
  officeCatalog,
  type OfficeBoostStep,
  type OfficeConfigurationCount,
  type OfficePlan,
  type OfficeTierId,
} from '../offices'
import { recipes } from '../recipes'
import { type Module, type Preset } from './modules'

export const FOCUS_DASHBOARD_ID = 'focus'
const defaultAreaZoneId = -1

const officePrototypeIdByTier: Record<OfficeTierId, string> = {
  officeI: 'OfficeBuildingT1',
  officeII: 'OfficeBuildingT2',
  officeIII: 'OfficeBuildingT3',
}
const officeTierIds: readonly OfficeTierId[] = ['officeI', 'officeII', 'officeIII']
const officeBoostSteps: readonly OfficeBoostStep[] = [0, 1, 2]
const officeRecipeIds = new Set(officeTierIds.flatMap(tierId => (
  officeBoostSteps.map(boostStep => getOfficeRecipeId(tierId, boostStep))
)))

const officeBuildingPrototypeIds = new Set(
  Object.values(officePrototypeIdByTier),
)

const isOfficeBuildingPrototype = (prototypeId: string) => (
  officeBuildingPrototypeIds.has(prototypeId)
)

export const getOfficeAreaZoneIds = (
  entities: readonly SyncedAreaEntity[],
) => new Set(entities.flatMap(entity => (
  isOfficeBuildingPrototype(entity.prototypeId)
    ? (() => {
        const namedZoneIds = entity.zones
          .filter(zone => Boolean(zone.name))
          .map(zone => zone.id)

        return namedZoneIds.length > 0 ? namedZoneIds : [defaultAreaZoneId]
      })()
    : []
)))

const getOfficeOwnerZoneId = (entity: SyncedAreaEntity) => (
  entity.zones
    .filter(zone => Boolean(zone.name))
    .map(zone => zone.id)
    .toSorted((left, right) => left - right)[0]
  ?? defaultAreaZoneId
)

const withoutOfficeNoRecipeIssues = (module: Module) => (
  module.liveArea
    ? {
        ...module.liveArea,
        issues: module.liveArea.issues.filter(issue => (
          ![...officeBuildingPrototypeIds].some(prototypeId => (
            issue.id === `${prototypeId}:no-recipe`
          ))
        )),
      }
    : undefined
)

export const hasAttachedOfficeRecipes = (module: Module) => (
  module.recipes?.some(recipe => officeRecipeIds.has(recipe.id)) ?? false
)

/** Uses running synced offices for the factory-wide Focus budget. */
export const applySyncedOfficeInventory = (
  plan: OfficePlan,
  entities: readonly SyncedProductionEntity[],
  inventory: 'built' | 'running' = 'running',
): OfficePlan => {
  const isIncluded = (entity: SyncedProductionEntity) => (
    inventory === 'built' || entity.running
  )
  const countRunning = (tierId: OfficeTierId) => entities.filter(entity => (
    entity.prototypeId === officePrototypeIdByTier[tierId] && isIncluded(entity)
  )).length

  return {
    ...plan,
    officeSuppliesAssemblyVCount: entities.filter(entity => (
      entity.prototypeId === 'AssemblyRoboticT2'
      && entity.recipeIds.includes('OfficeSuppliesAssembly')
      && isIncluded(entity)
    )).length,
    offices: {
      officeI: {
        ...plan.offices.officeI,
        count: countRunning('officeI'),
      },
      officeII: {
        ...plan.offices.officeII,
        count: countRunning('officeII'),
      },
      officeIII: {
        ...plan.offices.officeIII,
        count: countRunning('officeIII'),
      },
    },
  }
}

export const getSyncedOfficeConfigurations = (
  entities: readonly SyncedAreaEntity[],
  inventory: 'built' | 'running' = 'running',
): OfficeConfigurationCount[] => officeTierIds.flatMap(tierId => (
  officeBoostSteps.flatMap(computingBoostStep => {
    const count = entities.filter(entity => (
      entity.prototypeId === officePrototypeIdByTier[tierId]
      && entity.constructed
      && (inventory === 'built' || entity.running)
      && entity.office?.computingBoostStep === computingBoostStep
    )).length

    return count > 0 ? [{ tierId, computingBoostStep, count }] : []
  })
))

/** Planned fallback used when no generated area can own the Office inventory. */
export const createPlannedOfficeModule = (
  plan: OfficePlan,
  builtPlan: OfficePlan = defaultOfficePlan,
  currentPlan: OfficePlan = builtPlan,
): Module => {
  const normalizeCount = (count: number) => Math.max(0, Math.trunc(count))
  const officeEntries = officeCatalog.map(office => ({
    count: normalizeCount(plan.offices[office.id].count),
    built: normalizeCount(builtPlan.offices[office.id].count),
    current: normalizeCount(currentPlan.offices[office.id].count),
    recipeId: getOfficeRecipeId(
      office.id,
      plan.offices[office.id].computingBoostStep,
    ),
  }))
  const assemblyRecipeId = 'assembly-v-office-supplies'
  const assemblyCount = normalizeCount(plan.officeSuppliesAssemblyVCount)
  const assemblyBuilt = normalizeCount(builtPlan.officeSuppliesAssemblyVCount)
  const assemblyCurrent = normalizeCount(currentPlan.officeSuppliesAssemblyVCount)
  const activeBuildings = {
    [assemblyRecipeId]: assemblyCount,
    ...Object.fromEntries(officeEntries.map(entry => [entry.recipeId, entry.count])),
  }
  const builtBuildings = {
    [assemblyRecipeId]: assemblyBuilt,
    ...Object.fromEntries(officeEntries.map(entry => [entry.recipeId, entry.built])),
  }
  const currentActiveBuildings = {
    [assemblyRecipeId]: assemblyCurrent,
    ...Object.fromEntries(officeEntries.map(entry => [entry.recipeId, entry.current])),
  }
  const dataSources: NonNullable<Preset['dataSources']> = {
    [assemblyRecipeId]: 'planned',
    ...Object.fromEntries(officeEntries.map(entry => [entry.recipeId, 'planned' as const])),
  }

  return {
    id: 'office-plan',
    name: 'Office plan',
    description: 'Planned Office settings without a synced owning area',
    builtBuildings,
    presets: [{
      id: 'planned-offices',
      name: 'Office configuration',
      description: 'Planned Office buildings and recurring supplies',
      activeBuildings,
      currentActiveBuildings,
      builtBuildings,
      dataSources,
      fixed: officeEntries.map(entry => entry.recipeId),
    }],
    defaultPresetId: 'planned-offices',
  }
}

/** Adds non-recipe Office buildings to their generated owning area. */
export const createOfficeAreaModule = (
  generatedArea: Module,
  entities: readonly SyncedAreaEntity[],
  plan: OfficePlan,
): Module => {
  const zoneId = generatedArea.liveArea?.zoneId

  if (zoneId === undefined) return generatedArea

  const relatedZoneEntities = entities.filter(entity => (
    getOfficeOwnerZoneId(entity) === zoneId
    && isOfficeBuildingPrototype(entity.prototypeId)
  ))
  const zoneEntities = relatedZoneEntities

  if (zoneEntities.length === 0) {
    return {
      ...generatedArea,
      liveArea: withoutOfficeNoRecipeIssues(generatedArea),
    }
  }

  const builtBuildings = { ...generatedArea.builtBuildings }
  const officeRecipes = []
  const officeActiveBuildings: Record<string, number> = {}
  const officeCurrentActiveBuildings: Record<string, number> = {}
  const officeConstructionGhosts: Record<string, number> = {}
  const officeDataSources: NonNullable<Preset['dataSources']> = {}
  const officeRecipeIds: string[] = []

  for (const tierId of officeTierIds) {
    const prototypeId = officePrototypeIdByTier[tierId]
    const matchingEntities = zoneEntities.filter(entity => entity.prototypeId === prototypeId)
    const entitiesByBoostStep = new Map<OfficeBoostStep, SyncedAreaEntity[]>()

    for (const entity of matchingEntities) {
      const computingBoostStep = entity.office?.computingBoostStep
        ?? plan.offices[tierId].computingBoostStep
      const groupedEntities = entitiesByBoostStep.get(computingBoostStep) ?? []

      groupedEntities.push(entity)
      entitiesByBoostStep.set(computingBoostStep, groupedEntities)
    }

    for (const [computingBoostStep, configuredEntities] of entitiesByBoostStep) {
      const built = configuredEntities.filter(entity => entity.constructed).length
      const running = configuredEntities.filter(entity => (
        entity.constructed && entity.running
      )).length
      const constructionGhosts = configuredEntities.filter(entity => !entity.constructed).length

      if (built + constructionGhosts === 0) continue

      const recipeId = getOfficeRecipeId(tierId, computingBoostStep)
      const recipe = recipes.find(candidate => candidate.id === recipeId)

      if (!recipe) throw new Error(`Missing Office recipe: ${recipeId}`)

      officeRecipeIds.push(recipeId)
      officeRecipes.push(recipe)
      builtBuildings[recipeId] = built
      officeActiveBuildings[recipeId] = running + constructionGhosts
      officeCurrentActiveBuildings[recipeId] = running
      officeConstructionGhosts[recipeId] = constructionGhosts
      officeDataSources[recipeId] = configuredEntities.every(entity => entity.office)
        ? 'synced'
        : 'planned'
    }
  }

  return {
    ...generatedArea,
    includedInFactoryTotals: true,
    builtBuildings,
    recipes: [...new Map([
      ...(generatedArea.recipes ?? []),
      ...officeRecipes,
    ].map(recipe => [recipe.id, recipe])).values()],
    presets: generatedArea.presets.map(preset => ({
      ...preset,
      builtBuildings: {
        ...preset.builtBuildings,
        ...Object.fromEntries(officeRecipeIds.map(recipeId => [
          recipeId,
          builtBuildings[recipeId] ?? 0,
        ])),
      },
      activeBuildings: {
        ...preset.activeBuildings,
        ...officeActiveBuildings,
      },
      currentActiveBuildings: {
        ...preset.currentActiveBuildings,
        ...officeCurrentActiveBuildings,
      },
      constructionGhosts: {
        ...preset.constructionGhosts,
        ...officeConstructionGhosts,
      },
      dataSources: {
        ...preset.dataSources,
        ...officeDataSources,
      },
      fixed: [...new Set([...preset.fixed, ...officeRecipeIds])],
    })),
    liveArea: withoutOfficeNoRecipeIssues(generatedArea),
  }
}
