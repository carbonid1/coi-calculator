import { cn } from '@carbonid1/design-system'

import { type StationCardRole } from '../db/modules/area-static-infrastructure'
import { type BuildingDiagnostic } from '../helpers/building-diagnostics/building-diagnostics'
import {
  type ProductionLine,
  type RegularResult,
} from '../helpers/calculate/calculate'
import { type RecipeModifierMultipliers } from '../helpers/modifiers/recipe-output'
import { calculateStationActivityCounts } from '../helpers/station-activity/station-activity'
import { getBuildingTargetId } from './BuildingCardTarget'
import { BuildingStateCounts } from './BuildingStateCounts'

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
  focusedTargetKey,
  lines,
  role,
}) => {
  if (lines.length === 0) return null

  const headingId = `${lines[0]?.moduleId ?? 'module'}-${role}-stations-heading`
  const targetKeys = new Set(lines.map(
    line => line.capacityPoolId ?? `${line.moduleId}:${line.recipe.id}`,
  ))
  const focused = focusedTargetKey !== undefined && targetKeys.has(focusedTargetKey)
  const counts = calculateStationActivityCounts(lines)

  return (
    <section className="space-y-1" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
      >
        {labels[role]}
      </h2>
      <div
        className={cn(
          'w-fit scroll-mt-4 rounded-lg px-2 py-1 outline-none transition-shadow',
          focused && 'ring-2 ring-primary/40',
        )}
        id={focusedTargetKey && focused
          ? getBuildingTargetId(focusedTargetKey)
          : undefined}
        tabIndex={focused ? -1 : undefined}
      >
        <BuildingStateCounts
          active={counts.active}
          paused={counts.paused}
          ghosts={counts.ghosts}
          planned={counts.planned}
          className="text-sm"
        />
      </div>
    </section>
  )
}
