import { Button, Tooltip } from '@carbonid1/design-system'
import { CircleMinus, CirclePause, CirclePlus, Hammer, Play, RefreshCw } from 'lucide-react'

import {
  type BuildingAttention,
  type BuildingDiagnostic,
} from '../helpers/building-diagnostics/building-diagnostics'
import { KeepReadyMenu, type KeepReadyChange } from './KeepReadyMenu'

interface Props {
  diagnostics: BuildingDiagnostic[]
  onOpenBuilding: (diagnostic: BuildingDiagnostic) => void
  onKeepReadyChange?: KeepReadyChange
}

type ActionableDiagnostic = BuildingDiagnostic & { attention: BuildingAttention }

const labels = {
  build: 'Build',
  'can-pause': 'Can pause',
  'rebalance-farms': 'Rebalance farms',
  upgrade: 'Upgrade',
  unpause: 'Unpause',
} as const

const icons = {
  'add-animals': CirclePlus,
  build: Hammer,
  'can-pause': CirclePause,
  'rebalance-farms': RefreshCw,
  'remove-animals': CircleMinus,
  upgrade: Hammer,
  unpause: Play,
} as const

// Nuclear power dispatch and steam routing are deliberately monitored in-game.
// Their average calculator load is not reliable enough to drive build/pause advice.
const normalizeBuildingName = (name: string) => name.trim().toLocaleLowerCase('en-US')
const steamChainBuildings = new Set(
  [
    'Cooling Tower (Large)',
    'Fast Breeder Reactor',
    'High-Pressure Turbine II',
    'Hydrogen Reformer',
    'Low-Pressure Turbine II',
    'Power Generator II',
    'Super-Pressure Turbine',
    'Thermal Desalinator',
  ].map(normalizeBuildingName),
)

const formatCount = (value: number) => parseFloat(value.toFixed(2))
const getDiagnosticDetail = (diagnostic: BuildingDiagnostic) =>
  diagnostic.recipeName === diagnostic.buildingName ? diagnostic.moduleName : diagnostic.recipeName

const getTooltip = (diagnostic: BuildingDiagnostic) => {
  const affected =
    diagnostic.affectedResources.length > 0
      ? ` Affects ${diagnostic.affectedResources.join(', ')}.`
      : ''

  if (diagnostic.level) {
    const action = diagnostic.attention === 'build' ? 'Build' : 'Upgrade'

    return `Running Research Lab IV buildings need more Space Research Points. ${action} the Space Station to level ${diagnostic.level.target}.`
  }

  if (diagnostic.attention === 'add-animals' && diagnostic.animalPopulation) {
    const { additionalBuildings, label } = diagnostic.animalPopulation
    const capacityNote =
      additionalBuildings > 0
        ? ` Also requires ${additionalBuildings} more ${diagnostic.buildingName}${additionalBuildings === 1 ? '' : 's'}.`
        : ''

    return `Direct output demand requires ${diagnostic.attentionCount.toLocaleString()} more ${label}.${affected}${capacityNote}`
  }
  if (diagnostic.attention === 'remove-animals' && diagnostic.animalPopulation) {
    return `Every direct output remains covered with ${diagnostic.attentionCount.toLocaleString()} fewer ${diagnostic.animalPopulation.label}.`
  }
  if (diagnostic.attention === 'rebalance-farms') {
    return `Fixed crop rotations no longer cover ${diagnostic.affectedResources.join(', ')}. Rebalance the schedules before adding Greenhouse capacity.`
  }
  if (diagnostic.attention === 'can-pause') {
    return `Current average load fits in fewer active buildings.${affected}`
  }
  if (diagnostic.attention === 'unpause') {
    return `Current capacity is constrained, but paused capacity is already built.${affected}`
  }

  return `Current capacity is constrained and every built building is active.${affected}`
}

const getAttentionLabel = (diagnostic: ActionableDiagnostic) => {
  if (diagnostic.level) {
    return diagnostic.attention === 'build'
      ? `Build level ${diagnostic.level.target}`
      : `Upgrade to level ${diagnostic.level.target}`
  }

  if (diagnostic.attention === 'add-animals' || diagnostic.attention === 'remove-animals') {
    const verb = diagnostic.attention === 'add-animals' ? 'Add' : 'Remove'
    const label = diagnostic.animalPopulation?.label ?? 'animals'

    return `${verb} ${diagnostic.attentionCount.toLocaleString()} ${label}`
  }

  return `${labels[diagnostic.attention]}${
    diagnostic.attentionCount > 0 ? ` ${diagnostic.attentionCount}` : ''
  }`
}

const isAttentionNotice = (attention: BuildingAttention) =>
  attention === 'can-pause' || attention === 'rebalance-farms' || attention === 'remove-animals'

const getAttentionStatus = (diagnostic: BuildingDiagnostic) => {
  if (diagnostic.level) {
    return `Level ${diagnostic.level.current} / ${diagnostic.level.target}`
  }

  if (diagnostic.attention === 'rebalance-farms') {
    return `${diagnostic.affectedResources.join(', ')} short`
  }

  if (diagnostic.animalPopulation) {
    return `${formatCount(diagnostic.animalPopulation.current)} / ${formatCount(diagnostic.animalPopulation.capacity)} ${diagnostic.animalPopulation.label}`
  }

  return `${formatCount(diagnostic.load)} / ${formatCount(diagnostic.active)} active`
}

export const BuildingAttentionView: React.FC<Props> = ({
  diagnostics,
  onOpenBuilding,
  onKeepReadyChange,
}) => {
  const actionable = diagnostics
    .filter(
      (diagnostic): diagnostic is ActionableDiagnostic =>
        !diagnostic.plannedCapacity &&
        diagnostic.attention != null &&
        !steamChainBuildings.has(normalizeBuildingName(diagnostic.buildingName)),
    )
    .toSorted(
      (a, b) =>
        a.moduleName.localeCompare(b.moduleName) || a.buildingName.localeCompare(b.buildingName),
    )

  if (actionable.length === 0) return null

  return (
    <section className="rounded-lg bg-surface-inset p-3 inset-shadow-surface">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        Building attention
      </h4>
      <div className="grid gap-1 md:grid-cols-2">
        {actionable.map(diagnostic => {
          const attention = diagnostic.attention

          const Icon = icons[attention]
          const tooltip = getTooltip(diagnostic)
          const notice = isAttentionNotice(attention)

          return (
            <KeepReadyMenu
              key={diagnostic.key}
              diagnostic={diagnostic}
              onChange={onKeepReadyChange}
            >
              {open => (
                <div className="min-w-0 rounded-lg">
                  <Tooltip label={tooltip} maxWidth={320} className="w-full" disabled={open}>
                    <Button
                      variant="ghost"
                      size="small"
                      fullWidth
                      className="h-auto min-w-0 justify-between gap-2 px-2 py-1.5 text-left"
                      onClick={() => onOpenBuilding(diagnostic)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon
                          aria-hidden="true"
                          className={
                            notice
                              ? 'size-4 shrink-0 text-attention-foreground'
                              : 'size-4 shrink-0 text-destructive'
                          }
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {diagnostic.buildingName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {getDiagnosticDetail(diagnostic)}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={
                            notice
                              ? 'block text-xs font-medium text-attention-foreground'
                              : 'block text-xs font-medium text-destructive'
                          }
                        >
                          {getAttentionLabel(diagnostic)}
                        </span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {getAttentionStatus(diagnostic)}
                        </span>
                      </span>
                    </Button>
                  </Tooltip>
                </div>
              )}
            </KeepReadyMenu>
          )
        })}
      </div>
    </section>
  )
}
