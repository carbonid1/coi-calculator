'use client'

import { Button, TableScrollRegion, Tooltip, type Column } from '@carbonid1/design-system'
import { useMemo, useState } from 'react'

import { type Module } from '../db/modules/modules'
import { resources, type ResourceId } from '../db/resources'
import { formatDiagnosticMessages } from '../helpers/diagnostic-display/diagnostic-display'
import { type FactoryCalculation } from '../helpers/factory-calculation/factory-calculation'
import {
  getResourceSupplyAccess,
  getResourceSupplyRows,
  getContractSupplyRows,
  type ContractSupplyRow,
  type ResourceSupplyRow,
} from '../helpers/resource-supply/resource-supply'
import { ResourcePicker } from './ResourcePicker'

const formatQuantity = (quantity: number) => quantity.toLocaleString('en-US', {
  maximumFractionDigits: 2,
})
const numeric = (quantity: number) => (
  <span className="font-mono tabular-nums">{quantity > 0.001 ? formatQuantity(quantity) : '—'}</span>
)
const resourceQuantities = (quantities: { resourceId: ResourceId; quantity: number }[]) => (
  <div className="space-y-1">
    {quantities.map(ingredient => (
      <div key={ingredient.resourceId}>
        <span className="font-mono tabular-nums">{formatQuantity(ingredient.quantity)}</span>
        {' '}<span className="text-muted-foreground">{resources[ingredient.resourceId].name}</span>
      </div>
    ))}
  </div>
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

    for (const flow of calculation.factoryResult.calculation.allResourceFlows) {
      if (flow.produced > 0.001 || flow.consumed > 0.001) resourceIds.add(flow.resourceId)
    }
    for (const flow of calculation.factoryResult.contractFlows) {
      if (flow.quantity > 0.001 || flow.requestedQuantity > 0.001) resourceIds.add(flow.resourceId)
    }

    resourceIds.add('carbonDioxide')
    resourceIds.add('water')
    return [...resourceIds].filter(id => id !== 'electricity' && id !== 'computing')
      .toSorted((left, right) => resources[left].name.localeCompare(resources[right].name))
  }, [calculation])
  const rows = useMemo(() => getResourceSupplyRows(modules, calculation, resourceId), [
    modules, calculation, resourceId,
  ])
  const contractRows = useMemo(() => getContractSupplyRows(calculation.factoryResult.contractFlows, resourceId), [
    calculation, resourceId,
  ])
  const factoryBalance = calculation.factoryResult.calculation.allResourceFlows
    .find(flow => flow.resourceId === resourceId)?.net ?? 0
  const contractColumns: Column<ContractSupplyRow>[] = [
    {
      accessorKey: 'contractName', header: 'Contract',
      render: row => (
        <div className="space-y-1">
          <div>{row.contractName}</div>
          {row.importLimits.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {formatDiagnosticMessages(row.importLimits.map(limit => ({ kind: 'contract-limit', limit })))}
            </div>
          )}
        </div>
      ),
    },
    { accessorKey: 'imports', header: 'Imports', align: 'end', render: row => resourceQuantities(row.imports) },
    { accessorKey: 'exports', header: 'Exports', align: 'end', render: row => resourceQuantities(row.exports) },
    { accessorKey: 'fuel', header: 'Ship fuel', align: 'end', render: row => resourceQuantities(row.fuel) },
  ]
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
      accessorKey: 'exported',
      header: (
        <Tooltip label="Available to the factory, or delivered through a module link." position="bottom">
          <span aria-label="Export" tabIndex={0}>Export</span>
        </Tooltip>
      ),
      align: 'end', render: row => numeric(row.exported),
    },
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
        <ResourcePicker
          value={resourceId}
          options={options}
          onChange={value => {
            setResourceId(value)
            setConsumerId(null)
          }}
        />
      </div>
      {contractRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <h3 className="font-medium text-foreground">Contracts</h3>
            <span className="text-muted-foreground">
              Factory balance{' '}
              <span className="font-mono tabular-nums text-foreground">
                {Math.abs(factoryBalance) <= 0.001 ? '0' : `${factoryBalance > 0 ? '+' : ''}${formatQuantity(factoryBalance)}`}
              </span>
            </span>
          </div>
          <TableScrollRegion
            label={`${resources[resourceId].name} contracts`}
            columns={contractColumns}
            rows={contractRows}
            rowKey={row => row.contractId}
          />
        </div>
      )}
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
