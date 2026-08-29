import { type StationCardRole } from '../db/modules/area-static-infrastructure'
import { type BuildingDiagnostic } from '../helpers/building-diagnostics/building-diagnostics'
import {
  type ProductionLine,
  type RegularResult,
} from '../helpers/calculate/calculate'
import { type RecipeModifierMultipliers } from '../helpers/modifiers/recipe-output'
import { getRecipeDisplayName } from '../helpers/recipe-display/recipe-display'
import { BuildingCardTarget } from './BuildingCardTarget'
import { RecipeCard } from './RecipeCard'

interface Props {
  diagnostics: readonly BuildingDiagnostic[]
  focusedTargetKey?: string
  lines: readonly ProductionLine[]
  outputModifiers?: RecipeModifierMultipliers
  results: readonly RegularResult[]
  role: StationCardRole
}

const labels: Record<StationCardRole, string> = {
  input: 'Input stations',
  unconfigured: 'Unconfigured stations',
  export: 'Export stations',
}

export const StationCardGroup: React.FC<Props> = ({
  diagnostics,
  focusedTargetKey,
  lines,
  outputModifiers,
  results,
  role,
}) => {
  if (lines.length === 0) return null

  const headingId = `${lines[0]?.moduleId ?? 'module'}-${role}-stations-heading`
  const orderedLines = [...lines].toSorted((left, right) => (
    left.recipe.building.localeCompare(right.recipe.building)
    || getRecipeDisplayName(left.recipe).localeCompare(getRecipeDisplayName(right.recipe))
  ))

  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        {labels[role]}
      </h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {orderedLines.map(line => {
          const targetKey = line.capacityPoolId ?? `${line.moduleId}:${line.recipe.id}`
          const result = results.find(candidate => candidate.recipe.id === line.recipe.id)

          return (
            <BuildingCardTarget
              key={line.recipe.id}
              focused={focusedTargetKey === targetKey}
              targetKey={targetKey}
            >
              <RecipeCard
                dataSource={line.dataSource}
                recipe={line.recipe}
                activeBuildings={line.activeBuildings}
                currentActiveBuildings={line.currentActiveBuildings}
                builtBuildings={line.builtBuildings}
                constructionGhosts={line.constructionGhosts}
                unplacedPlannedBuildings={line.unplacedPlannedBuildings}
                diagnostic={diagnostics.find(candidate => candidate.key === targetKey)}
                supplyRatio={result?.supplyRatio ?? 1}
                operatingMode={result?.operatingMode ?? 'balanced'}
                speedLevel={line.speedLevel}
                actualInputs={result?.actualInputs}
                actualOutputs={result?.actualOutputs}
                outputModifiers={outputModifiers}
              />
            </BuildingCardTarget>
          )
        })}
      </div>
    </section>
  )
}
