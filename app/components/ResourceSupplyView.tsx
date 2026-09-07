'use client'

import { Button, Select, TableScrollRegion, type Column } from '@carbonid1/design-system'
import { useMemo, useState } from 'react'

import { type Module } from '../db/modules/modules'
import { resources, type ResourceId } from '../db/resources'
import { type FactoryCalculation } from '../helpers/factory-calculation/factory-calculation'
import {
  getResourceSupplyAccess,
  getResourceSupplyRows,
  type ResourceSupplyRow,
} from '../helpers/resource-supply/resource-supply'

const formatQuantity = (quantity: number) => quantity.toLocaleString('en-US', {
  maximumFractionDigits: 2,
})
const numeric = (quantity: number) => (
  <span className="font-mono tabular-nums">{quantity > 0.001 ? formatQuantity(quantity) : '—'}</span>
)

export const ResourceSupplyView = ({
  modules,
  calculation,
}: {
  modules: readonly Module[]
  calculation: FactoryCalculation
}) => {
  const [resourceId, setResourceId] = useState<ResourceId>('carbonDioxide')
  const [consumerId, setConsumerId] = useState<string | null>(null)
  const options = useMemo(() => {
    const results = [
      calculation.factoryResult.calculation,
      ...calculation.linkedModulesResult.moduleResults.values(),
    ]
    const resourceIds = new Set<ResourceId>(results.flatMap(result => [
      ...result.regularResults, ...result.sourceResults, ...result.sinkResults,
    ]).flatMap(result => [
      ...result.actualInputs, ...result.actualOutputs,
    ]).filter(ingredient => ingredient.quantity > 0.001).map(ingredient => ingredient.resourceId))

    resourceIds.add('carbonDioxide')
    resourceIds.add('water')
    return [...resourceIds].filter(id => id !== 'electricity' && id !== 'computing')
      .map(id => ({ value: id, label: resources[id].name }))
      .toSorted((left, right) => left.label.localeCompare(right.label))
  }, [calculation])
  const rows = useMemo(() => getResourceSupplyRows(modules, calculation, resourceId), [
    modules, calculation, resourceId,
  ])
  const consumer = rows.find(row => row.moduleId === consumerId && row.used > 0.001)
    ?? rows.toSorted((left, right) => right.used - left.used).find(row => row.used > 0.001)
  const columns: Column<ResourceSupplyRow>[] = [
    { accessorKey: 'moduleName', header: 'Module' },
    { accessorKey: 'produced', header: 'Produces', align: 'end', render: row => numeric(row.produced) },
    {
      accessorKey: 'used', header: 'Uses', align: 'end',
      render: row => row.used > 0.001 ? (
        <Button
          variant="ghost"
          size="small"
          selected={row.moduleId === consumer?.moduleId}
          aria-pressed={row.moduleId === consumer?.moduleId}
          aria-label={`Show ${resources[resourceId].name} use in ${row.moduleName}`}
          onClick={() => setConsumerId(row.moduleId)}
        >
          {numeric(row.used)}
        </Button>
      ) : numeric(0),
    },
    { accessorKey: 'disposed', header: 'Disposes', align: 'end', render: row => numeric(row.disposed) },
    {
      accessorKey: 'boundary', header: 'Supply rule',
      render: row => {
        const factoryAccess = getResourceSupplyAccess(row, resourceId) === 'factory'
        const factoryDemand = row.boundary?.factoryDemand ?? (factoryAccess ? Math.max(0, -row.balance) : 0)
        const factorySupply = row.boundary?.factorySupply ?? (factoryAccess ? Math.max(0, row.balance) : 0)
        const localShortfall = factoryAccess ? 0 : Math.max(
          0, -row.balance - (row.boundary?.rule.requestedImport ?? 0),
        )

        return (
          <div className="space-y-1 text-xs text-muted-foreground">
            {factoryAccess && <div>{row.boundary ? 'Local first · factory pool' : 'Factory pool'}</div>}
            {factoryDemand > 0.001 && <div>Needs {formatQuantity(factoryDemand)} from factory</div>}
            {factorySupply > 0.001 && <div>{formatQuantity(factorySupply)} available to factory</div>}
            {row.incoming.map(transfer => (
              <div key={transfer.id}>
                From {transfer.sourceModuleName}: {formatQuantity(transfer.quantity)}
                {transfer.requestedQuantity - transfer.quantity > 0.001 && (
                  <span> · {formatQuantity(transfer.requestedQuantity - transfer.quantity)} short</span>
                )}
              </div>
            ))}
            {row.outgoing.map(transfer => (
              <div key={transfer.id}>To {transfer.targetModuleName}: {formatQuantity(transfer.quantity)}</div>
            ))}
            {localShortfall > 0.001 && <div>Local supply short by {formatQuantity(localShortfall)}</div>}
            {!factoryAccess && factoryDemand <= 0.001 && factorySupply <= 0.001
              && row.incoming.length === 0 && row.outgoing.length === 0 && (
              <div>Local only</div>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <section className="space-y-4 rounded-lg bg-card p-4 shadow-card" aria-label="Resource supply">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Resource supply</h2>
          <p className="text-xs text-muted-foreground">Calculated per production cycle</p>
        </div>
        <Select
          aria-label="Resource"
          value={resourceId}
          options={options}
          onChange={value => {
            const option = options.find(candidate => candidate.value === value)

            if (option) { setResourceId(option.value); setConsumerId(null) }
          }}
          className="w-56"
        />
      </div>
      <div className={`grid items-start gap-4 ${consumer ? 'lg:grid-cols-[minmax(0,1fr)_18rem]' : ''}`}>
        <TableScrollRegion
          label={`${resources[resourceId].name} supply by module`}
          columns={columns}
          rows={rows}
          rowKey={row => row.moduleId}
          empty="No production or consumption."
        />
        {consumer && (
          <div className="space-y-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface lg:sticky lg:top-4">
            <h3 className="text-sm font-medium text-foreground">{resources[resourceId].name} used in {consumer.moduleName}</h3>
            <div className="space-y-1">
              {consumer.uses.map(use => (
                <div key={use.name} className="flex justify-between gap-3 py-1 text-sm">
                  <span className="text-muted-foreground">{use.name}</span>
                  {numeric(use.quantity)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
