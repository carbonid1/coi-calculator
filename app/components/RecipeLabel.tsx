import { resources, type ResourceId } from '../db/resources'
import { type RecipePresentation } from '../helpers/recipe-display/recipe-display'
import { ResourceToken, ResourceTooltip } from './ResourceToken'

const amountText = (quantity: number) => (
  quantity !== 0 && Math.abs(quantity) < 0.01
    ? quantity.toPrecision(1)
    : quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })
)
const resourceAmount = (recipe: RecipePresentation, side: 'inputs' | 'outputs', resourceId: ResourceId) => (
  recipe.amounts?.[side].filter(value => value.resourceId === resourceId).reduce((sum, value) => sum + value.quantity, 0) ?? 0
)
const amountDetail = (recipe: RecipePresentation, side: 'inputs' | 'outputs', resourceId: ResourceId) => (
  recipe.amounts ? `${side === 'inputs' ? 'Input' : 'Output'} · ${amountText(resourceAmount(recipe, side, resourceId))}` : undefined
)
const configurationDetail = (recipe: RecipePresentation) => (
  recipe.amounts ? (['inputs', 'outputs'] as const).flatMap(side => recipe[side].map(resourceId => (
    `${resources[resourceId].name} · ${amountDetail(recipe, side, resourceId)}`
  ))).join('\n') : undefined
)
const ConfigurationLabel = ({ recipe }: { recipe: RecipePresentation }) => (
  recipe.amounts ? <ResourceTooltip label={recipe.configuration ?? recipe.name} detail={configurationDetail(recipe)} className="text-left whitespace-normal">
    {recipe.configuration}
  </ResourceTooltip> : <span>{recipe.configuration}</span>
)

/** Resource IDs come from the recipe, never from parsing a display label. */
export const RecipeLabel = ({ recipe, onInspectInput }: {
  recipe: RecipePresentation
  onInspectInput?: (resourceId: ResourceId) => void
}) => (
  <span role="group" aria-label={recipe.name} className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 align-middle">
    {recipe.configuration ? <ConfigurationLabel recipe={recipe} /> : (
      <>
        {recipe.inputs.map((resourceId, index) => (
          <span key={resourceId} className="inline-flex items-center gap-1">
            {index > 0 && <span aria-hidden="true" className="text-muted-foreground">+</span>}
            <ResourceToken resourceId={resourceId} detail={amountDetail(recipe, 'inputs', resourceId)}
              onInspect={onInspectInput ? () => onInspectInput(resourceId) : undefined} />
          </span>
        ))}
        {recipe.outputs.map((resourceId, index) => (
          <span key={resourceId} className="inline-flex items-center gap-1">
            {(index > 0 || recipe.inputs.length > 0) && <span aria-hidden="true" className="text-muted-foreground">{index > 0 ? '+' : '→'}</span>}
            <ResourceToken resourceId={resourceId} detail={amountDetail(recipe, 'outputs', resourceId)} />
          </span>
        ))}
      </>
    )}
  </span>
)
