import { Card } from '@carbonid1/design-system'
import { TriangleAlert } from 'lucide-react'

import {
  calculateFocusPointsCost,
  focusCatalog,
  type OfficePlanCalculation,
} from '../db/offices'
import { type FocusAllocations } from '../focus-state'
import { getDataSourceSurfaceClassName } from './DataSourceState'

interface Props {
  calculation: OfficePlanCalculation
  allocations: FocusAllocations
}

const formatNumber = (value: number) => parseFloat(value.toFixed(2)).toLocaleString('en-US')
const formatSignedPercent = (value: number) => (
  `${value > 0 ? '+' : ''}${formatNumber(value)}%`
)
const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-foreground">
      {value}
    </p>
  </div>
)

export const FocusView: React.FC<Props> = ({ calculation, allocations }) => (
  <div className="space-y-5">
    <section className="max-w-2xl space-y-2" aria-label="Focus budget">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Capacity" value={formatNumber(calculation.focusPointsCapacity)} />
        <Metric label="Allocated" value={formatNumber(calculation.focusPointsRequired)} />
        <Metric label="Available" value={formatNumber(calculation.focusPointsAvailable)} />
      </div>

      {!calculation.isAffordable && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Allocation exceeds capacity by
          {` ${formatNumber(calculation.focusPointsRequired - calculation.focusPointsCapacity)} points`}.
        </p>
      )}
    </section>

    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Allocation
      </h2>
      {Object.values(allocations).some(allocation => !allocation.synced) && (
        <p className="text-sm text-muted-foreground">Focus allocations have not synced yet.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {focusCatalog.map((focus) => {
          const { step, source, synced } = allocations[focus.id]
          const active = step !== null && step > 0
          const effect = active ? formatSignedPercent(calculation.bonuses[focus.id]) : 'Off'

          return (
            <Card.Root
              key={focus.id}
              data-source={source ?? undefined}
              className={source ? getDataSourceSurfaceClassName(source, {
                inactive: !active,
                className: step === 0 ? '[&>*]:opacity-40 shadow-none' : undefined,
              }) : undefined}
            >
              <Card.Content className="gap-3 p-3">
                <Card.Header>
                  <Card.Title className="text-sm">{focus.name}</Card.Title>
                  <Card.Description className="text-xs">
                    {focus.effectPerStep}
                  </Card.Description>
                  <Card.Action>
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {step ?? '—'} / {focus.maxStep}
                    </span>
                  </Card.Action>
                </Card.Header>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Effect
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {step === null ? '—' : effect}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Focus cost</p>
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {step === null ? '—' : formatNumber(calculateFocusPointsCost(focus, step))}
                    </p>
                  </div>
                </div>
                {synced && synced.activeStep !== synced.targetStep && (
                  <p className="text-xs text-muted-foreground">
                    Active {synced.activeStep} / {synced.targetStep}
                  </p>
                )}
                {!focus.modeledInCalculator && active && (
                  <p className="text-xs text-muted-foreground">
                    Not included in calculator totals.
                  </p>
                )}
              </Card.Content>
            </Card.Root>
          )
        })}
      </div>
    </section>
  </div>
)
