import { cn } from '@carbonid1/design-system'

import { type ValueSource } from '../data-source'
import { resources } from '../db/resources'
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
import { getRecipeDisplayName } from '../helpers/recipe-display/recipe-display'
import { BuildingCount } from './BuildingCount'
import { ProductionCard } from './ProductionCard'

interface Props {
  lines: ProductionLine[]
  dataSource?: ValueSource
  results: (RegularResult | PassiveResult | undefined)[]
  outputModifiers?: RecipeModifierMultipliers
  diagnostic?: BuildingDiagnostic
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2))

export const SharedRecipeCard: React.FC<Props> = ({
  lines,
  dataSource,
  results,
  outputModifiers,
  diagnostic,
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

  return (
    <ProductionCard
      dataSource={dataSource}
      operatingMode={operatingMode}
      inactive={effective === 0}
      className="p-3"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-semibold text-foreground">
          {firstLine.recipe.displayGroup?.label ??
            firstLine.recipe.sharedCapacity?.label ??
            firstLine.recipe.building}
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

      <div className="space-y-1">
        {lines.map((line, index) => {
          const result = results[index]
          const supplyRatio = result?.supplyRatio ?? 0
          const buildingMultiplier = line.activeBuildings * supplyRatio
          const ioMultiplier = buildingMultiplier * line.speedLevel
          const inactive = buildingMultiplier === 0

          return (
            <section
              key={line.recipe.id}
              className={cn(
                'rounded-lg p-2.5',
                inactive
                  ? 'border border-border/50 bg-transparent [&>*]:opacity-40'
                  : 'bg-surface-inset inset-shadow-surface',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-sm font-medium text-foreground">
                  {getRecipeDisplayName(line.recipe)}
                </h4>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatQuantity(supplyRatio * 100)}% load
                  {line.recipe.electricityMultiplier != null &&
                  line.recipe.electricityMultiplier !== 1
                    ? ` · ${formatQuantity(line.recipe.electricityMultiplier)}× power`
                    : ''}
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="min-w-0 space-y-1">
                  {line.recipe.inputs.map(input => (
                    <div key={input.resourceId} className="flex justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">
                        {resources[input.resourceId].name}
                      </span>
                      <span className="shrink-0 font-mono text-destructive">
                        {formatQuantity(
                          getRecipeInputQuantity(input, outputModifiers) * ioMultiplier,
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-xl text-muted-foreground">&rarr;</div>

                <div className="min-w-0 space-y-1">
                  {line.recipe.outputs.map(output => (
                    <div key={output.resourceId} className="flex justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">
                        {resources[output.resourceId].name}
                      </span>
                      <span className="shrink-0 font-mono text-success">
                        {formatQuantity(
                          getRecipeOutputQuantity(line.recipe, output, outputModifiers) *
                            ioMultiplier,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </ProductionCard>
  )
}
