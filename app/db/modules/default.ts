import { type GroundwaterSourceConstraint } from '../../helpers/groundwater/calculate-groundwater-production'
import { type SharedMachineClaimResolution } from '../../helpers/machine-allocation/machine-allocation'
import { baseConfig, type ResearchMode } from '../config'
import {
  createGroundwaterPumpRecipe,
  matchesGameRecipe,
  recipes,
  type Recipe,
} from '../recipes'
import { type Module, type PlanMismatchAction } from './modules'

/** Stable internal ID retained so existing deep links and saved UI state keep working. */
export const DEFAULT_MODULE_ID = 'general'
export const DEFAULT_GROUNDWATER_RECIPE_ID = 'groundwater-pump-factory-reserve'

const cookingOilDieselRecipeId = 'chemical-plant-ii-cooking-oil-diesel'
const cookingOilDieselGameBuildingId = 'ChemicalPlant2'
const cookingOilDieselGameRecipeId = 'EthanolCookingOilReforming'
const cookingOilDieselTarget = 1
const railPartsGameBuildingId = 'AssemblyRoboticT2'
const railPartsGameRecipeId = 'RailPartsAssembly'

// Last 1,000 years: 7,618 produced and 7,366 consumed. Their rough midpoint is
// 0.62 Rail Parts per production cycle, or about 0.01 Assembly V load.
const modeledRailPartsDemandPerCycle = 0.62

export const plannedResearchLabTarget = 2

export const spaceResearchPointsPerLab = 48

const cookingOilDieselRecipe = recipes.find(recipe => recipe.id === cookingOilDieselRecipeId)

if (!cookingOilDieselRecipe) {
  throw new Error(`Missing Default plan recipe: ${cookingOilDieselRecipeId}`)
}

export const plannedNewDefaultBuildings = {
  [cookingOilDieselRecipeId]: cookingOilDieselTarget,
} as const

export const plannedDefaultBuildings = plannedNewDefaultBuildings
export const plannedDefaultBuiltBuildings = {
  [cookingOilDieselRecipeId]: 0,
} as const
export const unplacedPlannedDefaultBuildings = plannedNewDefaultBuildings

const getDefaultPlanRecipe = (module: Module) => (
  module.recipes?.find(recipe => matchesGameRecipe(
    recipe,
    cookingOilDieselGameBuildingId,
    cookingOilDieselGameRecipeId,
  ))
  ?? cookingOilDieselRecipe
)

const getPreset = (module: Module) => (
  module.presets.find(preset => preset.id === module.defaultPresetId)
  ?? module.presets[0]
)

const createPlanActions = ({
  buildingName,
  built,
  running,
  target,
}: {
  buildingName: string
  built: number
  running: number
  target: number
}): PlanMismatchAction[] => {
  const unpause = Math.min(Math.max(0, built - running), Math.max(0, target - running))
  const build = Math.max(0, target - running - unpause)

  return [
    ...(unpause > 0
      ? [{ type: 'unpause' as const, label: `Unpause ${unpause} ${buildingName}` }]
      : []),
    ...(build > 0
      ? [{ type: 'build' as const, label: `Build ${build} ${buildingName}` }]
      : []),
  ]
}

const applyCookingOilDieselPlan = (module: Module): Module => {
  const sourcePreset = getPreset(module)

  if (!sourcePreset) return module

  const planRecipe = getDefaultPlanRecipe(module)
  const recipeId = planRecipe.id
  const built = sourcePreset.builtBuildings?.[recipeId]
    ?? module.builtBuildings[recipeId]
    ?? 0
  const running = sourcePreset.currentActiveBuildings?.[recipeId]
    ?? sourcePreset.activeBuildings[recipeId]
    ?? 0
  const constructionGhosts = sourcePreset.constructionGhosts?.[recipeId] ?? 0
  const projected = Math.max(
    sourcePreset.activeBuildings[recipeId] ?? 0,
    running + constructionGhosts,
  )
  const planSatisfied = projected >= cookingOilDieselTarget
  const unplaced = planSatisfied
    ? 0
    : Math.max(0, cookingOilDieselTarget - built - constructionGhosts)
  const plannedActive = planSatisfied
    ? projected
    : Math.max(projected, cookingOilDieselTarget)
  const planMismatch = planSatisfied
    ? []
    : [{
        recipeId,
        current: running,
        currentSource: 'synced' as const,
        target: cookingOilDieselTarget,
        direction: 'at-least' as const,
        format: 'count' as const,
        actions: createPlanActions({
          buildingName: 'Chemical Plant II',
          built: built + constructionGhosts,
          running: projected,
          target: cookingOilDieselTarget,
        }),
      }]
  const planRecipeIsRuntime = module.recipes?.some(recipe => recipe.id === recipeId) ?? false
  const recipesWithPlan = planRecipeIsRuntime
    ? module.recipes
    : [...(module.recipes ?? []), planRecipe]

  return {
    ...module,
    recipes: recipesWithPlan,
    builtBuildings: {
      ...module.builtBuildings,
      [recipeId]: built,
    },
    presets: module.presets.map(preset => ({
      ...preset,
      builtBuildings: {
        ...preset.builtBuildings,
        [recipeId]: built,
      },
      activeBuildings: {
        ...preset.activeBuildings,
        [recipeId]: plannedActive,
      },
      dataSources: {
        ...preset.dataSources,
        [recipeId]: planSatisfied ? 'synced' : 'planned',
      },
      unplacedPlannedBuildings: {
        ...Object.fromEntries(
          Object.entries(preset.unplacedPlannedBuildings ?? {})
            .filter(([plannedRecipeId]) => plannedRecipeId !== recipeId),
        ),
        ...(unplaced > 0 ? { [recipeId]: unplaced } : {}),
      },
      planMismatches: [
        ...(preset.planMismatches ?? []).filter(mismatch => mismatch.recipeId !== recipeId),
        ...planMismatch,
      ],
    })),
  }
}

const isResearchLabRecipe = (recipe: Recipe) => (
  recipe.gameBuildingId?.startsWith('ResearchLab') ?? false
)

const applyResearchLabPlan = (
  module: Module,
  researchMode: ResearchMode,
): Module => {
  const sourcePreset = getPreset(module)
  const recipe = module.recipes?.find(isResearchLabRecipe)

  if (!sourcePreset || !recipe) return module

  const recipeId = recipe.id
  const built = sourcePreset.builtBuildings?.[recipeId]
    ?? module.builtBuildings[recipeId]
    ?? 0
  const running = sourcePreset.currentActiveBuildings?.[recipeId]
    ?? sourcePreset.activeBuildings[recipeId]
    ?? 0
  const constructionGhosts = sourcePreset.constructionGhosts?.[recipeId] ?? 0
  const projected = Math.max(
    sourcePreset.activeBuildings[recipeId] ?? 0,
    running + constructionGhosts,
  )
  const planSatisfied = projected >= plannedResearchLabTarget
  const unplaced = planSatisfied
    ? 0
    : Math.max(0, plannedResearchLabTarget - built - constructionGhosts)
  const plannedActive = planSatisfied
    ? projected
    : Math.max(projected, plannedResearchLabTarget)
  const planMismatch = planSatisfied
    ? []
    : [{
        recipeId,
        current: running,
        currentSource: 'synced' as const,
        target: plannedResearchLabTarget,
        direction: 'at-least' as const,
        format: 'count' as const,
        actions: createPlanActions({
          buildingName: 'Research Lab IV',
          built: built + constructionGhosts,
          running: projected,
          target: plannedResearchLabTarget,
        }),
      }]
  const plannedRecipe: Recipe = {
    ...recipe,
    inputs: [
      ...recipe.inputs.filter(input => input.resourceId !== 'spaceResearchPoints'),
      ...(researchMode === 'with-space'
        ? [{ resourceId: 'spaceResearchPoints' as const, quantity: spaceResearchPointsPerLab }]
        : []),
    ],
  }

  return {
    ...module,
    recipes: module.recipes?.map(candidate => (
      candidate.id === recipeId ? plannedRecipe : candidate
    )),
    presets: module.presets.map(preset => ({
      ...preset,
      builtBuildings: {
        ...preset.builtBuildings,
        [recipeId]: built,
      },
      activeBuildings: {
        ...preset.activeBuildings,
        [recipeId]: plannedActive,
      },
      dataSources: {
        ...preset.dataSources,
        [recipeId]: planSatisfied ? 'synced' : 'planned',
      },
      fixed: [...new Set([...preset.fixed, recipeId])],
      unplacedPlannedBuildings: {
        ...Object.fromEntries(
          Object.entries(preset.unplacedPlannedBuildings ?? {})
            .filter(([plannedRecipeId]) => plannedRecipeId !== recipeId),
        ),
        ...(unplaced > 0 ? { [recipeId]: unplaced } : {}),
      },
      planMismatches: [
        ...(preset.planMismatches ?? []).filter(mismatch => mismatch.recipeId !== recipeId),
        ...planMismatch,
      ],
    })),
  }
}

const applyObservedRailPartsLoad = (module: Module): Module => {
  const hasRailPartsRecipe = module.recipes?.some(recipe => matchesGameRecipe(
    recipe,
    railPartsGameBuildingId,
    railPartsGameRecipeId,
  )) ?? false

  if (!hasRailPartsRecipe) return module

  return {
    ...module,
    presets: module.presets.map(preset => ({
      ...preset,
      fixedDemands: {
        railParts: modeledRailPartsDemandPerCycle,
        ...preset.fixedDemands,
      },
    })),
  }
}

/** Applies calculator-owned Default plans over the current synced inventory. */
export const applyDefaultAreaPlan = (
  module: Module,
  researchMode: ResearchMode = baseConfig.researchMode,
) => applyResearchLabPlan(
  applyCookingOilDieselPlan(applyObservedRailPartsLoad(module)),
  researchMode,
)

const emptyDefaultModule = (): Module => ({
  id: DEFAULT_MODULE_ID,
  name: 'Default',
  description: '',
  capabilities: ['default'],
  gameSynced: true,
  includedInFactoryTotals: true,
  builtBuildings: {},
  recipes: [],
  presets: [{
    id: 'current',
    name: 'Default',
    description: '',
    activeBuildings: {},
    currentActiveBuildings: {},
    builtBuildings: {},
    dataSources: {},
    fixed: [],
  }],
  defaultPresetId: 'current',
})

/** Empty compatibility shell used until the exporter provides Default entities. */
export const createDefaultModule = (
  groundwaterPumpResolution?: SharedMachineClaimResolution,
  groundwaterConstraint?: GroundwaterSourceConstraint,
  researchMode: ResearchMode = baseConfig.researchMode,
): Module => {
  const base = emptyDefaultModule()
  const built = groundwaterPumpResolution?.built ?? 0
  const running = groundwaterPumpResolution?.running ?? 0
  const groundwaterRecipe = groundwaterPumpResolution && groundwaterConstraint
    ? createGroundwaterPumpRecipe(DEFAULT_GROUNDWATER_RECIPE_ID, groundwaterConstraint)
    : null
  const withGroundwater: Module = groundwaterRecipe
    ? {
        ...base,
        builtBuildings: { [groundwaterRecipe.id]: built },
        recipes: [groundwaterRecipe],
        presets: base.presets.map(preset => ({
          ...preset,
          activeBuildings: { [groundwaterRecipe.id]: running },
          currentActiveBuildings: { [groundwaterRecipe.id]: running },
          builtBuildings: { [groundwaterRecipe.id]: built },
          dataSources: { [groundwaterRecipe.id]: 'synced' },
        })),
      }
    : base

  return applyDefaultAreaPlan(
    withGroundwater,
    researchMode,
  )
}

export const defaultArea = createDefaultModule()
