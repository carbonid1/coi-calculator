import { cn } from '@carbonid1/design-system'

import { type ValueSource } from '../data-source'
import { type BuildingDiagnostic } from '../helpers/building-diagnostics/building-diagnostics'
import {
  type PassiveResult,
  type ProductionLine,
  type RegularResult,
} from '../helpers/calculate/calculate'
import {
  getRecipeInputQuantity,
  getRecipeOutputQuantity,
  type RecipeModifierMultipliers,
} from '../helpers/modifiers/recipe-output'
import { calculateProductionCardLoad } from '../helpers/production-card-groups/production-card-groups'
import { getRecipeDisplayName, getRecipePresentation } from '../helpers/recipe-display/recipe-display'
import { BuildingCount } from './BuildingCount'
import { KeepReadyMenu, KeepReadyNote, type KeepReadyChange } from './KeepReadyMenu'
import { ProcessingChainButton } from './ProcessingChain'
import { ProductionCard } from './ProductionCard'
import { RecipeFlow } from './RecipeFlow'
import { RecipeTitle } from './RecipeTitle'

interface Props {
  lines: ProductionLine[]
  wide?: boolean
  dataSource?: ValueSource
  results: (RegularResult | PassiveResult | undefined)[]
  outputModifiers?: RecipeModifierMultipliers
  diagnostic?: BuildingDiagnostic
  onKeepReadyChange?: KeepReadyChange
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2))

export const SharedRecipeCard: React.FC<Props> = ({
  lines,
  wide = false,
  dataSource,
  results,
  outputModifiers,
  diagnostic,
  onKeepReadyChange,
}) => {
  const firstLine = lines[0]

  if (!firstLine) return null

  const effective = calculateProductionCardLoad(lines, results)
  const totalBuildings = firstLine.capacityPoolBuiltBuildings
    ?? Math.max(...lines.map(line => line.builtBuildings))
  const activeBuildings = firstLine.capacityPoolActiveBuildings
    ?? Math.max(...lines.map(line => line.activeBuildings))
  const currentActiveBuildings = firstLine.capacityPoolCurrentActiveBuildings
    ?? Math.max(...lines.map(line => line.currentActiveBuildings ?? Math.min(
      line.builtBuildings,
      line.activeBuildings
        - (line.constructionGhosts ?? 0)
        - (line.unplacedPlannedBuildings ?? 0),
    )))
  const constructionGhosts = firstLine.capacityPoolConstructionGhosts
    ?? Math.max(...lines.map(line => line.constructionGhosts ?? 0))
  const unplacedPlannedBuildings = firstLine.capacityPoolUnplacedPlannedBuildings
    ?? Math.max(...lines.map(line => line.unplacedPlannedBuildings ?? 0))
  const operatingMode = results.every(
    result => result && 'operatingMode' in result && result.operatingMode === 'fixed',
  )
    ? 'fixed'
    : 'balanced'

  const card = (
    <ProductionCard
      dataSource={dataSource}
      operatingMode={operatingMode}
      inactive={effective === 0 && !diagnostic?.keepReady && diagnostic?.attention !== 'can-pause'}
      className="p-3"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-semibold text-foreground">
          <RecipeTitle title={firstLine.recipe.displayGroup?.label ??
            firstLine.recipe.sharedCapacity?.label ??
            firstLine.recipe.building} descriptions={lines.map(line => getRecipeDisplayName(line.recipe))} />
        </h3>
        <BuildingCount
          load={effective}
          active={activeBuildings}
          currentActive={currentActiveBuildings}
          built={totalBuildings}
          ghosts={constructionGhosts}
          planned={unplacedPlannedBuildings}
          attention={diagnostic?.attention}
          attentionCount={diagnostic?.attentionCount}
          level={diagnostic?.level}
        />
      </div>

      <KeepReadyNote enabled={diagnostic?.keepReady} />
      <div className={cn('grid grid-cols-1 gap-1', wide && 'md:grid-cols-2',
        wide && lines.length % 3 === 0 && 'xl:grid-cols-3')}>
        {lines.map((line, index) => {
          const result = results[index]
          const supplyRatio = result?.supplyRatio ?? 0
          const buildingMultiplier = line.activeBuildings * supplyRatio
          const ioMultiplier = buildingMultiplier * line.speedLevel
          const inactive = buildingMultiplier === 0
          const presentation = getRecipePresentation(line.recipe)
          const powerMultiplier = line.recipe.electricityMultiplier
          const showsPowerMultiplier = powerMultiplier != null && powerMultiplier !== 1

          return (
            <section
              key={line.recipe.id}
              className={cn(
                'group/recipe relative rounded-lg p-2.5 pr-9',
                inactive && !diagnostic?.keepReady
                  ? 'border border-border/50 bg-transparent [&>*]:opacity-40'
                  : 'bg-surface-inset inset-shadow-surface',
              )}
            >
              <h4 className={cn('text-sm font-medium text-foreground [overflow-wrap:anywhere]',
                presentation.configuration ? 'mb-2' : 'sr-only')}>
                {presentation.configuration ?? presentation.name}
              </h4>
              <div className="absolute right-1 top-1"><ProcessingChainButton moduleId={line.moduleId} recipe={line.recipe} /></div>

              <RecipeFlow name={presentation.name}
                inputs={line.recipe.inputs.map(input => ({
                  resourceId: input.resourceId,
                  quantity: getRecipeInputQuantity(input, outputModifiers) * ioMultiplier,
                }))}
                outputs={line.recipe.outputs.map(output => ({
                  resourceId: output.resourceId,
                  quantity: getRecipeOutputQuantity(line.recipe, output, outputModifiers) * ioMultiplier,
                }))}
              />
              {showsPowerMultiplier && <p className="mt-1 text-right text-xs text-muted-foreground">
                {formatQuantity(powerMultiplier)}× power
              </p>}
            </section>
          )
        })}
      </div>
    </ProductionCard>
  )

  return <KeepReadyMenu diagnostic={diagnostic} onChange={onKeepReadyChange}>{card}</KeepReadyMenu>
}
