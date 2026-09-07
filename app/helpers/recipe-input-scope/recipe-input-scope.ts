import { type Recipe } from '../../db/recipes'
import { type ResourceId } from '../../db/resources'

export const getModuleInputIds = (recipe: Recipe): ResourceId[] => [
  ...new Set([
    ...(recipe.moduleInputIds ?? []),
    ...(recipe.balanceInputScope === 'module'
      ? recipe.balanceInputIds ?? recipe.inputs.map(input => input.resourceId)
      : []),
  ]),
]

export const isModuleInput = (recipe: Recipe, resourceId: ResourceId) => (
  recipe.moduleInputIds?.includes(resourceId) === true
  || (recipe.balanceInputScope === 'module'
    && (recipe.balanceInputIds == null || recipe.balanceInputIds.includes(resourceId)))
)

/** Adding a local utility must not change where the recipe's other inputs come from. */
export const withModuleInputLimits = (recipe: Recipe, resourceIds: ResourceId[]): Recipe => {
  if (resourceIds.length === 0) return recipe

  return {
    ...recipe,
    moduleInputIds: [...new Set([...getModuleInputIds(recipe), ...resourceIds])],
    balanceInputScope: undefined,
    balanceInputIds: [...new Set([
      ...(recipe.balanceInputIds ?? (recipe.balanceBy !== 'output'
        ? recipe.inputs.map(input => input.resourceId)
        : [])),
      ...resourceIds,
    ])],
  }
}
