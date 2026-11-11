import { applyNuclearOperationTargets } from '../../helpers/nuclear-entity-sync/nuclear-operation-targets'
import { withFactoryDefinition } from '../../helpers/planning-recipes/factory-recipes'
import { type PlanningDefinitions } from '../../planning-state'
import { getGameRecipeKey, type Recipe } from '../recipes'
import { runtimeRecipeBehaviors } from '../runtime-recipe-behaviors'
import { type Module } from './modules'

const recoveryRecipes = [
  {
    buildingId: 'IncinerationPlant', recipeId: 'IncinerationOfWaste',
    name: 'Incineration plant', target: 2,
    policy: {
      group: 'waste', balanceBy: 'input', balanceInputIds: ['waste'],
      balanceOutputIds: undefined, balanceOutputScope: undefined,
      backpressureOutputId: 'steamHigh',
    },
  },
  {
    buildingId: 'ThermalDesalinator', recipeId: 'DesalinationFromHP',
    name: 'Thermal desalinator', target: 2,
    policy: {
      group: 'production', balanceBy: 'output', balanceOutputIds: [],
      balanceInputIds: ['steamHigh'], allocation: 'fallback',
      consumeSurplusInputIds: ['steamHigh'], consumeSurplusInputScope: 'module',
      // Ordinary production and Sour Water recovery reserve steam first.
      surplusConsumptionPhase: 'after-fallback', surplusConsumptionPriority: 10,
    },
  },
  {
    buildingId: 'OceanWaterPumpT1', recipeId: 'OceanWaterPumping2x',
    name: 'Seawater pump', target: 2,
    policy: { group: 'source', sourceMode: 'module-demand-capped', configurationLabel: '2× throughput' },
  },
  {
    buildingId: 'ExhaustScrubber', recipeId: 'ExhaustFilteringLime',
    name: 'Exhaust scrubber', target: 1,
    policy: { group: 'waste', balanceInputScope: 'module' },
  },
  {
    buildingId: 'ChemicalPlant2', recipeId: 'GraphiteProductionCo2',
    name: 'Chemical plant II', target: 1,
    policy: { group: 'production', balanceInputScope: 'module' },
  },
] as const satisfies readonly {
  buildingId: string; recipeId: string; name: string; target: number; policy: Partial<Recipe>
}[]

/** Native rates; only operating policy and physical construction targets are planned. */
export const applyWasteRecoveryPlan = (
  definitions: PlanningDefinitions,
  module: Module,
): Module => {
  const configured = { ...module, recipes: [...(module.recipes ?? [])], builtBuildings: { ...module.builtBuildings } }
  const targets = recoveryRecipes.map(target => {
    const existing = configured.recipes.find(recipe => (
      recipe.gameBuildingId === target.buildingId && recipe.gameRecipeId === target.recipeId
    ))
    const id = existing?.id ?? `${module.id}:${target.buildingId}:${target.recipeId}`
    const recipe: Recipe = existing ?? withFactoryDefinition({
      id, name: target.recipeId, building: target.name,
      gameBuildingId: target.buildingId, gameRecipeId: target.recipeId,
      factoryRecipe: { buildingId: target.buildingId, recipeId: target.recipeId },
      group: target.policy.group, inputs: [], outputs: [],
    }, definitions)
    const planned = {
      ...recipe,
      ...runtimeRecipeBehaviors[getGameRecipeKey(target.buildingId, target.recipeId)],
      ...target.policy,
    }

    configured.recipes = [...configured.recipes.filter(candidate => candidate.id !== id), planned]
    configured.builtBuildings[id] ??= 0
    return { recipeId: id, name: target.name, target: target.target }
  })

  return {
    ...configured,
    presets: configured.presets.map(preset => applyNuclearOperationTargets({
      ...preset,
      builtBuildings: { ...configured.builtBuildings, ...preset.builtBuildings },
    }, configured.recipes, targets)),
  }
}
