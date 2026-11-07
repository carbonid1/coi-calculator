import { Card, TableScrollRegion, Tooltip } from '@carbonid1/design-system'
import { useMemo } from 'react'

import { type SavedFactoryCalculation } from '../helpers/factory-calculation/factory-calculation-cache'
import { calculateFreshwaterUse } from '../helpers/water-planning/freshwater-use'

const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })

export const ResourceRequirementsView = ({
  current,
  updating = false,
}: {
  current: SavedFactoryCalculation
  updating?: boolean
}) => {
  const water = useMemo(
    () =>
      calculateFreshwaterUse(
        current.calculation,
        current.model.outputModifiers,
        current.calculation.worldMines ?? current.model.worldMines,
      ),
    [current],
  )
  const rows = [
    { label: 'Groundwater', quantity: water.groundwater },
    { label: 'World-mine deliveries', quantity: water.worldMines },
  ]

  return (
    <Card.Root className="max-w-3xl" aria-label="Resource requirements" aria-busy={updating}>
      <Card.Content>
        <Card.Header>
          <Card.Title>Freshwater</Card.Title>
          <Card.Description>Consumed per in-game month</Card.Description>
          <Card.Action>
            <span
              data-requirement-value="total"
              aria-live="polite"
              className="font-mono text-2xl font-semibold tabular-nums"
            >
              {format(water.total)}
            </span>
          </Card.Action>
        </Card.Header>
        <TableScrollRegion
          label="Freshwater sources"
          rows={rows}
          rowKey={row => row.label}
          columns={[
            { accessorKey: 'label', header: 'Source' },
            {
              accessorKey: 'quantity',
              header: 'Supplied / month',
              align: 'end',
              render: row => <span className="font-mono tabular-nums">{format(row.quantity)}</span>,
            },
          ]}
        />
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span>Farm rain · {format(water.farmRain)} irrigation avoided / month</span>
          <Tooltip
            maxWidth={320}
            label="Groundwater + world-mine deliveries − unused supply. Farm rain reduces irrigation; recovered and desalinated water are excluded."
          >
            <span
              data-water-accounting
              tabIndex={0}
              className="rounded outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              What counts
            </span>
          </Tooltip>
        </div>
      </Card.Content>
    </Card.Root>
  )
}
