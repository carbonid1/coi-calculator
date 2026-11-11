import { applyNuclearOperationTargets } from '../../helpers/nuclear-entity-sync/nuclear-operation-targets'
import { withFactoryDefinition } from '../../helpers/planning-recipes/factory-recipes'
import { type PlanningDefinitions } from '../../planning-state'
import { type Recipe, type SourceMode } from '../recipes'
import { resources, type ResourceId } from '../resources'
import { type Module } from './modules'

export interface LiveAreaProductionTarget {
  buildingId: string
  recipeId: string
  building: string
  pluralName?: string
  product: ResourceId
  sourceMode?: SourceMode
  sinkScope?: Recipe['sinkScope']
  target: number
}

export const applyLiveAreaProductionTargets = (
  definitions: PlanningDefinitions,
  module: Module,
  targets: readonly LiveAreaProductionTarget[],
): Module => {
  const recipes = [...(module.recipes ?? [])]
  const matchingRecipeIds = new Map<string, string[]>()
  const operationTargets = targets.map(({ buildingId, recipeId, building, product, sourceMode, sinkScope, target, pluralName }) => {
    const matching = recipes.filter(recipe => (
      recipe.gameBuildingId === buildingId && recipe.gameRecipeId === recipeId
    ))
    const existing = matching[0]
    const id = existing?.id ?? `${module.id}:${buildingId}:${recipeId}`

    if (!existing) recipes.push(withFactoryDefinition({
      id,
      name: resources[product].name,
      building,
      gameBuildingId: buildingId,
      gameRecipeId: recipeId,
      factoryRecipe: { buildingId, recipeId },
      ...(sinkScope ? { group: 'sink', sinkScope } : {
        group: sourceMode ? 'source' : 'production',
        sourceMode,
        balanceBy: 'output',
        balanceOutputIds: [product],
      }),
      inputs: [],
      outputs: [],
    }, definitions))

    matchingRecipeIds.set(id, existing ? matching.map(recipe => recipe.id) : [id])
    return { recipeId: id, name: building, pluralName, target }
  })

  return {
    ...module,
    recipes,
    presets: module.presets.map(preset => applyNuclearOperationTargets(
      preset, recipes, operationTargets, matchingRecipeIds,
    )),
  }
}
