import { getLabSpacePoints, type FactoryDefinitions } from '../../factory-definitions'
import { type GroundwaterSourceConstraint } from '../../helpers/groundwater/calculate-groundwater-production'
import { type SharedMachineClaimResolution } from '../../helpers/machine-allocation/machine-allocation'
import { applyNuclearOperationTargets } from '../../helpers/nuclear-entity-sync/nuclear-operation-targets'
import { baseConfig, type ResearchMode } from '../config'
import {
  createGroundwaterPumpRecipe,
  matchesGameRecipe,
  recipes,
  type Recipe,
} from '../recipes'
import { type Module, type PlanMismatchAction } from './modules'
import {
  createAtLeastBuildingActions,
  createAtMostBuildingActions,
} from './plan-mismatch'

/** Stable internal ID retained so existing deep links and saved UI state keep working. */
export const DEFAULT_MODULE_ID = 'general'
export const DEFAULT_GROUNDWATER_RECIPE_ID = 'groundwater-pump-factory-reserve'

const cookingOilDieselRecipeId = 'chemical-plant-ii-cooking-oil-diesel'
const cookingOilDieselGameBuildingId = 'ChemicalPlant2'
const cookingOilDieselGameRecipeId = 'EthanolCookingOilReforming'
const cookingOilDieselTarget = 1
const crackingUnitDieselRecipeId = 'cracking-unit-fuel-gas-diesel'
const crackingUnitDieselGameBuildingId = 'HydroCrackerT1'
const crackingUnitDieselGameRecipeId = 'FuelGasReforming'

export const plannedCrackingUnitDieselTarget = 3

export const plannedResearchLabTarget = 2


const cookingOilDieselRecipe = recipes.find(recipe => recipe.id === cookingOilDieselRecipeId)
const crackingUnitDieselRecipe = recipes.find(recipe => recipe.id === crackingUnitDieselRecipeId)

if (!cookingOilDieselRecipe) {
  throw new Error(`Missing Default plan recipe: ${cookingOilDieselRecipeId}`)
}

if (!crackingUnitDieselRecipe) {
  throw new Error(`Missing Default plan recipe: ${crackingUnitDieselRecipeId}`)
}

export const plannedNewDefaultBuildings = {
  [cookingOilDieselRecipeId]: cookingOilDieselTarget,
} as const

export const plannedDefaultBuildings = {
  ...plannedNewDefaultBuildings,
  [crackingUnitDieselRecipeId]: plannedCrackingUnitDieselTarget,
} as const
export const plannedDefaultBuiltBuildings = {
  [cookingOilDieselRecipeId]: 0,
  [crackingUnitDieselRecipeId]: 0,
} as const

const getDefaultPlanRecipe = (module: Module) => (
  module.recipes?.find(recipe => matchesGameRecipe(
    recipe,
    cookingOilDieselGameBuildingId,
    cookingOilDieselGameRecipeId,
  ))
  ?? cookingOilDieselRecipe
)

const getCrackingUnitDieselPlanRecipe = (module: Module) => (
  module.recipes?.find(recipe => matchesGameRecipe(
    recipe,
    crackingUnitDieselGameBuildingId,
    crackingUnitDieselGameRecipeId,
  ))
  ?? crackingUnitDieselRecipe
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

const applyCrackingUnitDieselPlan = (module: Module, target: number): Module => {
  const sourcePreset = getPreset(module)

  if (!sourcePreset) return module

  const planRecipe = getCrackingUnitDieselPlanRecipe(module)
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
  const planSatisfied = projected === target
  const direction = projected < target
    ? 'at-least' as const
    : 'at-most' as const
  const excess = Math.max(0, projected - target)
  const cancelBuildCount = Math.min(constructionGhosts, excess)
  const pauseCount = excess - cancelBuildCount
  const unplaced = Math.max(
    0,
    target - built - constructionGhosts,
  )
  const planMismatch = planSatisfied
    ? []
    : [{
        recipeId,
        current: projected,
        target,
        direction,
        format: 'count' as const,
        currentLabel: constructionGhosts > 0
          ? `${running} running · ${constructionGhosts} under construction`
          : undefined,
        actions: direction === 'at-least'
          ? createAtLeastBuildingActions({
              built: built + constructionGhosts,
              running: projected,
              target,
              name: 'Cracking Unit',
            })
          : [
              ...(cancelBuildCount > 0
                ? [{
                    type: 'cancel-build' as const,
                    label: `Cancel construction of ${cancelBuildCount} Cracking Unit${
                      cancelBuildCount === 1 ? '' : 's'
                    }`,
                  }]
                : []),
              ...(pauseCount > 0
                ? createAtMostBuildingActions({
                    running,
                    target: running - pauseCount,
                    name: 'Cracking Unit',
                  })
                : []),
            ],
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
        [recipeId]: target,
      },
      dataSources: {
        ...preset.dataSources,
        [recipeId]: 'planned',
      },
      fixed: [...new Set([...preset.fixed, recipeId])],
      nonActionablePlanRecipeIds: [
        ...new Set([...(preset.nonActionablePlanRecipeIds ?? []), recipeId]),
      ],
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

export const applyResearchLabPlan = (
  definitions: FactoryDefinitions | undefined,
  module: Module,
  researchMode: ResearchMode,
  target = plannedResearchLabTarget,
  recipe = module.recipes?.find(isResearchLabRecipe),
  exact = false,
): Module => {
  const sourcePreset = getPreset(module)

  if (!sourcePreset || !recipe) return module
  if (!definitions) throw new Error('Research Lab definitions are unavailable')

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
  const planSatisfied = exact ? running === target : projected >= target
  const unplaced = planSatisfied
    ? 0
    : Math.max(0, target - built - constructionGhosts)
  const plannedActive = exact ? target : Math.max(projected, target)
  const planMismatch = planSatisfied
    ? []
    : [{
        recipeId,
        current: running,
        target,
        direction: exact && running > target ? 'at-most' as const : 'at-least' as const,
        format: 'count' as const,
        actions: exact && running > target ? createAtMostBuildingActions({
          name: recipe.building, running, target,
        }) : createPlanActions({
          buildingName: recipe.building,
          built: built + constructionGhosts,
          running: exact ? running : projected,
          target,
        }),
      }]
  const plannedRecipe: Recipe = {
    ...recipe,
    inputs: [
      ...recipe.inputs.filter(input => input.resourceId !== 'spaceResearchPoints'),
      ...(researchMode === 'with-space'
        ? [{ resourceId: 'spaceResearchPoints' as const, quantity: getLabSpacePoints(definitions, recipe.gameBuildingId ?? 'ResearchLab5') }]
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

const applyThirdFbrSupplyPlan = (module: Module): Module => {
  const targets = [
    { buildingId: 'SettlingTank', gameRecipeId: 'UraniumLeaching', name: 'Settling tank', target: 3 },
    { buildingId: 'CrusherLarge', gameRecipeId: 'UraniumCrushing', name: 'Crusher (large)', target: 2 },
    { buildingId: 'ArcFurnace2', gameRecipeId: 'GlassSmeltingArc', name: 'Arc furnace II', target: 3 },
    { buildingId: 'GlassMakerT2', gameRecipeId: 'GlassCastingT2', name: 'Glass maker II', target: 5 },
    { buildingId: 'ChemicalPlant2', gameRecipeId: 'FertilizerProductionFromOrganic', name: 'Chemical plant II', target: 2 },
    { buildingId: 'PolymerizationPlant', gameRecipeId: 'PlasticMakingEthanol', name: 'Polymerization plant', target: 4 },
    { buildingId: 'SiliconReactor', gameRecipeId: 'SiliconTreatment', name: 'Silicon reactor', target: 7 },
    // Each physical machine cycles through four enabled stages. Raise each of
    // the three native recipe pools once, adding one complete group of three.
    { buildingId: 'MicrochipMachineT2', gameRecipeId: 'MicrochipMachineT2_MicrochipProdStage1A', name: 'Microchip machine II', target: 4 },
    { buildingId: 'MicrochipMachineT2', gameRecipeId: 'MicrochipMachineT2_MicrochipProdStage2A', name: 'Microchip machine II', target: 4 },
    { buildingId: 'MicrochipMachineT2', gameRecipeId: 'MicrochipMachineT2_MicrochipProdStage3A', name: 'Microchip machine II', target: 4 },
  ].flatMap(target => {
    const recipe = module.recipes?.find(recipe => matchesGameRecipe(recipe, target.buildingId, target.gameRecipeId))

    return recipe ? [{ recipeId: recipe.id, name: target.name, target: target.target }] : []
  })

  return { ...module, presets: module.presets.map(preset => applyNuclearOperationTargets(
    preset, module.recipes ?? [], targets,
  )) }
}

const applyFoodProcessingPlan = (module: Module): Module => {
  const targets = [
    { buildingId: 'BakingUnit', gameRecipeId: 'BreadProduction', name: 'Baking unit', target: 5 },
    { buildingId: 'FoodMill', gameRecipeId: 'WheatMilling', name: 'Mill', target: 7 },
    { buildingId: 'FoodMill', gameRecipeId: 'CanolaMilling', name: 'Mill', target: 2 },
    { buildingId: 'FoodProcessor', gameRecipeId: 'MeatProcessing', name: 'Food processor', target: 3 },
    { buildingId: 'FoodProcessor', gameRecipeId: 'TofuProduction', name: 'Food processor', target: 2 },
  ].flatMap(target => {
    const recipe = module.recipes?.find(recipe => matchesGameRecipe(recipe, target.buildingId, target.gameRecipeId))

    return recipe ? [{ recipeId: recipe.id, name: target.name, target: target.target }] : []
  })

  const meatRecipe = module.recipes?.find(recipe => matchesGameRecipe(recipe, 'FoodProcessor', 'MeatProcessing'))

  return { ...module, presets: module.presets.map(preset => {
    const planned = applyNuclearOperationTargets(preset, module.recipes ?? [], targets)

    // Reserve Meat for housing and the planned egg/meat food-pack split.
    return meatRecipe ? { ...planned, recipeOutputTargets: {
      ...planned.recipeOutputTargets, [meatRecipe.id]: { meat: 32.773 },
    } } : planned
  }) }
}

/** Applies calculator-owned Default plans over the current synced inventory. */
export const applyDefaultAreaPlan = (
  definitions: FactoryDefinitions | undefined,
  module: Module,
  researchMode: ResearchMode = baseConfig.researchMode,
  plans: { science: boolean; refining: boolean; crackingUnitTarget?: number; uranium?: boolean; food?: boolean } = {
    science: true, refining: true, crackingUnitTarget: plannedCrackingUnitDieselTarget,
  },
) => {
  const supplies = plans.uranium ? applyThirdFbrSupplyPlan(module) : module
  const food = plans.food ? applyFoodProcessingPlan(supplies) : supplies
  const production = plans.refining ? applyCookingOilDieselPlan(food) : food

  return applyResearchLabPlan(
    definitions,
    plans.crackingUnitTarget === undefined ? production : applyCrackingUnitDieselPlan(production, plans.crackingUnitTarget),
    researchMode,
    plans.science ? plannedResearchLabTarget : 0,
  )
}

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
  definitions: FactoryDefinitions | undefined = undefined,
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
    definitions,
    withGroundwater,
    researchMode,
  )
}

export const defaultArea = createDefaultModule()
