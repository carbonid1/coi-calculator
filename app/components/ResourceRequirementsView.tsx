import { Card, TableScrollRegion, Tooltip } from '@carbonid1/design-system'
import { CloudRain, Droplets, Globe } from 'lucide-react'
import { useMemo } from 'react'

import { type ResourceId } from '../db/resources'
import { type SavedFactoryCalculation } from '../helpers/factory-calculation/factory-calculation-cache'
import { calculateOreRequirements } from '../helpers/resource-requirements/ore-requirements'
import { calculateFreshwaterUse } from '../helpers/water-planning/freshwater-use'
import { useResources } from './ResourceProducts'
import { ResourceToken } from './ResourceToken'

const format = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })

export const ResourceRequirementsView = ({
  current,
  updating = false,
}: {
  current: SavedFactoryCalculation
  updating?: boolean
}) => {
  const resources = useResources()
  const water = useMemo(
    () =>
      calculateFreshwaterUse(
        current.calculation,
        current.model.outputModifiers,
        current.calculation.worldMines ?? current.model.worldMines,
      ),
    [current],
  )
  const ores = useMemo(() => calculateOreRequirements(current.calculation), [current.calculation])
  const requirements: { id: ResourceId; label: string; quantity: number }[] = [
    { id: 'water', label: 'Freshwater', quantity: water.total },
    { id: 'ironOre', label: resources.ironOre.name, quantity: ores.ironOre },
    { id: 'copperOre', label: resources.copperOre.name, quantity: ores.copperOre },
  ]
  const rows = [
    { label: 'Groundwater', quantity: water.groundwater, icon: Droplets },
    { label: 'World-mine deliveries', quantity: water.worldMines, icon: Globe },
  ]

  return (
    <Card.Root className="max-w-3xl" aria-label="Resource requirements" aria-busy={updating}>
      <Card.Content>
        <Card.Header>
          <Card.Title>Consumed per in-game month</Card.Title>
        </Card.Header>
        <TableScrollRegion
          label="Resource consumption"
          rows={requirements}
          rowKey={row => row.id}
          columns={[
            {
              accessorKey: 'label',
              header: 'Resource',
              render: row => <ResourceToken resourceId={row.id} label={row.label} named />,
            },
            {
              accessorKey: 'quantity',
              header: 'Quantity',
              align: 'end',
              render: row => (
                <span
                  data-requirement-value={row.id}
                  aria-live="polite"
                  className="font-mono font-semibold tabular-nums"
                >
                  {format(row.quantity)}
                </span>
              ),
            },
          ]}
        />
        <h3 className="text-sm font-medium">Freshwater sources</h3>
        <TableScrollRegion
          label="Freshwater sources"
          rows={rows}
          rowKey={row => row.label}
          columns={[
            {
              accessorKey: 'label',
              header: 'Source',
              render: row => {
                const Icon = row.icon

                return (
                  <span className="inline-flex items-center gap-2">
                    <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                    {row.label}
                  </span>
                )
              },
            },
            {
              accessorKey: 'quantity',
              header: 'Supplied / month',
              align: 'end',
              render: row => <span className="font-mono tabular-nums">{format(row.quantity)}</span>,
            },
          ]}
        />
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CloudRain aria-hidden="true" className="size-3.5" />
            Farm rain · {format(water.farmRain)} irrigation avoided / month
          </span>
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
