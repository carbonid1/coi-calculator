import { type Recipe, type Ingredient } from '../../db/recipes'
import { getFactoryRecipe, getLabSpacePoints } from '../../factory-definitions'
import { type PlanningDefinitions } from '../../planning-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'

/** Keep solver policy local while the native recipe supplies every physical rate. */
export const withFactoryDefinition = (
  recipe: Recipe,
  definitions?: PlanningDefinitions,
  spaceResearch = false,
): Recipe => {
  const binding = recipe.factoryRecipe
  const buildingId = recipe.gameBuildingId ?? binding?.buildingId

  if (!binding) {
    if (!definitions || !buildingId?.startsWith('ResearchLab')) return recipe
    return {
      ...recipe,
      inputs: [
        ...recipe.inputs.filter(input => input.resourceId !== 'spaceResearchPoints'),
        ...(spaceResearch ||
        recipe.inputs.some(
          input => input.resourceId === 'spaceResearchPoints' && input.quantity > 0,
        )
          ? [
              {
                resourceId: 'spaceResearchPoints' as const,
                quantity: getLabSpacePoints(definitions.factory, buildingId),
              },
            ]
          : []),
      ],
    }
  }
  if (!definitions || !buildingId)
    throw new Error('Factory definitions unavailable for ' + recipe.id)
  if (recipe.groundwaterConstraint) return { ...recipe, factoryRecipe: undefined }
  const native = getFactoryRecipe(definitions.factory, buildingId, binding.recipeId)
  const scale = (60 / native.durationSeconds) * (binding.storage ? native.storageCapacity : 1)
  const convert = (
    products: typeof native.inputs,
    policies: Ingredient[],
    output: boolean,
  ): Ingredient[] =>
    products.flatMap(product => {
      const resourceId = resolveSyncedResourceId({
        productId: product.productId,
        name: product.productId,
      })

      // Turbine mechanical power is converted using the native Generator II ratio.
      if (
        output &&
        native.electricityOutputMw > 0 &&
        product.productId === 'Product_Virtual_MechPower'
      )
        return []
      if (
        ['Product_Virtual_PollutedAir', 'Product_Virtual_PollutedWater'].includes(product.productId)
      )
        return []
      if (!resourceId) throw new Error('Unsupported recipe product: ' + product.productId)
      const policy = policies.find(ingredient => ingredient.resourceId === resourceId)

      return [{ ...policy, resourceId, quantity: product.quantity * scale }]
    })
  const isLab = buildingId.startsWith('ResearchLab')
  const needsSpacePoints =
    spaceResearch ||
    recipe.inputs.some(input => input.resourceId === 'spaceResearchPoints' && input.quantity > 0)

  return {
    ...recipe,
    factoryRecipe: undefined,
    cycleDurationSeconds: native.durationSeconds,
    electricityMultiplier: native.electricityMultiplier,
    recyclesInputs: native.recyclesInputs,
    inputs: [
      ...convert(native.inputs, recipe.inputs, false),
      ...(isLab && needsSpacePoints
        ? [
            {
              resourceId: 'spaceResearchPoints' as const,
              quantity: getLabSpacePoints(definitions.factory, buildingId),
            },
          ]
        : []),
    ],
    outputs: [
      ...convert(native.outputs, recipe.outputs, true),
      ...(native.electricityOutputMw > 0
        ? [{ resourceId: 'electricity' as const, quantity: native.electricityOutputMw }]
        : []),
    ],
    ...(binding.storage
      ? {
          decayStorage: {
            capacity: native.storageCapacity,
            decayCycles: native.durationSeconds / 60,
          },
        }
      : {}),
  }
}
