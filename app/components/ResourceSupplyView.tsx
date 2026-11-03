'use client'

import { Button, Select, TableScrollRegion, Tooltip, type Column } from '@carbonid1/design-system'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { type Module } from '../db/modules/modules'
import { resourceSupplyRules, type ResourceProcessingPriority } from '../db/resource-supply'
import { type ResourceId } from '../db/resources'
import { type FactoryCalculation } from '../helpers/factory-calculation/factory-calculation'
import { canPrioritizeProcessing, isResourceProcessingPriority } from '../helpers/resource-priorities/resource-priorities'
import {
  getResourceSupplyAccess,
  getResourceSupplyRows,
  getContractSupplyRows,
  type ResourceSupplyRow,
} from '../helpers/resource-supply/resource-supply'
import { createSupplyInspector, supplyTargetKey, type SupplyTarget } from '../helpers/resource-supply/supply-diagnosis'
import { ProductInventorySummary } from './ProductInventorySummary'
import { ResourceNavigationProvider, useResourceNavigation } from './ResourceNavigation'
import { ResourcePicker } from './ResourcePicker'
import { useResources } from './ResourceProducts'
import { SupplyDiagnosis } from './SupplyDiagnosis'

const formatQuantity = (quantity: number) => quantity.toLocaleString('en-US', {
  maximumFractionDigits: 2,
})
const numeric = (quantity: number) => (
  <span className="font-mono tabular-nums">{quantity > 0.001 ? formatQuantity(quantity) : '—'}</span>
)

export const ResourceSupplyView = ({
  modules,
  calculation,
  priorityModules = modules,
  onProcessingPriorityChange,
  initialResourceId = 'carbonDioxide',
}: {
  modules: readonly Module[]
  calculation: FactoryCalculation
  priorityModules?: readonly Module[]
  onProcessingPriorityChange?: (zoneId: number, resourceId: ResourceId, priority: ResourceProcessingPriority) => void
  initialResourceId?: ResourceId
}) => {
  const inspectFactoryResource = useResourceNavigation()
  const resources = useResources()
  const [trail, setTrail] = useState<SupplyTarget[]>([{ resourceId: initialResourceId }])
  const target = trail[trail.length - 1] ?? { resourceId: initialResourceId }
  const { resourceId } = target
  const [showRouting, setShowRouting] = useState(false)
  const routingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusAfterInspect = useRef(true)

  useEffect(() => {
    if (focusAfterInspect.current) {
      headingRef.current?.focus()
      focusAfterInspect.current = false
    }
  }, [trail])
  const inspector = useMemo(() => createSupplyInspector(modules, calculation), [modules, calculation])
  const inspect = (next: SupplyTarget) => {
    focusAfterInspect.current = true
    setTrail(current => {
      const index = current.findIndex(step => supplyTargetKey(step) === supplyTargetKey(next))

      return index >= 0 ? current.slice(0, index + 1) : [...current, next]
    })
  }
  const getScopeName = (next: SupplyTarget) => modules.find(module => module.id === next.moduleId)?.name ?? 'Factory'
  const options = useMemo(() => {
    const results = [
      calculation.factoryResult.calculation,
      ...calculation.linkedModulesResult.moduleResults.values(),
    ]
    const resourceIds = new Set<ResourceId>(results.flatMap(result => [
      ...result.regularResults, ...result.sourceResults, ...result.sinkResults,
    ]).flatMap(result => [
      ...result.recipe.inputs, ...result.recipe.outputs,
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
  }, [calculation, resources])
  const rows = useMemo(() => getResourceSupplyRows(modules, calculation, resourceId)
    .filter(row => !target.moduleId || row.moduleId === target.moduleId), [
    modules, calculation, resourceId, target.moduleId,
  ])
  const contractRows = useMemo(() => getContractSupplyRows(calculation.factoryResult.contractFlows, resourceId), [
    calculation, resourceId,
  ])
  const columns: Column<ResourceSupplyRow>[] = [
    { accessorKey: 'moduleName', header: 'Module' },
    { accessorKey: 'produced', header: 'Produces', align: 'end', render: row => numeric(row.produced) },
    { accessorKey: 'used', header: 'Uses', align: 'end', render: row => numeric(row.used) },
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
        const priorityModule = priorityModules.find(module => module.id === row.moduleId)
        const priorityPreset = priorityModule?.presets.find(preset => preset.id === priorityModule.defaultPresetId)
        const priority = priorityPreset?.resourceProcessingPriorities?.[resourceId] ?? 'factory'
        const localResult = calculation.linkedModulesResult.moduleResults.get(row.moduleId)
          ?? calculation.factoryResult.calculation
        const canPrioritize = priorityModule?.includedInFactoryTotals !== false
          && factoryAccess && resourceSupplyRules[resourceId] !== 'connections'
          && localResult.regularResults.some(result => (
            result.moduleId === row.moduleId && !priorityPreset?.fixed.includes(result.recipe.id)
            && canPrioritizeProcessing(result.recipe, resourceId)
          ))
        const zoneId = priorityModule?.liveArea?.zoneId

        return (
          <div className="space-y-1 text-xs text-muted-foreground">
            {canPrioritize && zoneId != null && onProcessingPriorityChange && (
              <Select
                aria-label={`${resources[resourceId].name} processing priority in ${row.moduleName}`}
                value={priority}
                options={[
                  { value: 'factory', label: 'Factory priorities' },
                  { value: 'local-first', label: 'Process here first' },
                ]}
                onChange={value => {
                  if (isResourceProcessingPriority(value)) onProcessingPriorityChange(zoneId, resourceId, value)
                }}
              />
            )}
            {priority === 'local-first' && <div className="text-highlight-foreground">Planned</div>}
            {factoryAccess && <div>{row.boundary ? 'Local first · factory pool' : 'Factory pool'}</div>}
            {factoryDemand > 0.001 && <div>Needs {formatQuantity(factoryDemand)} from factory</div>}
            {row.incoming.map(transfer => (
              <div key={transfer.id}>
                From{' '}
                <Button variant="link" size="small" className="h-auto px-0 py-1 text-left whitespace-normal"
                  aria-label={`Inspect ${resources[resourceId].name} in ${transfer.sourceModuleName}`}
                  onClick={() => inspect({ resourceId, moduleId: transfer.sourceModuleId })}>
                  {transfer.sourceModuleName}
                </Button>: {formatQuantity(transfer.quantity)}
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

  const content = (
    <section className="space-y-4 rounded-lg bg-card p-4 shadow-card" aria-label="Resource supply">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 ref={headingRef} tabIndex={-1} className="font-semibold text-foreground outline-hidden">{getScopeName(target)}</h3>
          <p className="text-xs text-muted-foreground">Calculated per production cycle</p>
        </div>
        <ResourcePicker
          value={resourceId}
          options={options}
          onChange={value => {
            setTrail([{ resourceId: value }])
          }}
        />
      </div>
      {trail.length > 1 && <nav aria-label="Supply trail" className="flex flex-wrap items-center gap-1 text-sm">
        {trail.map((step, index) => (
          <span key={supplyTargetKey(step)} className="inline-flex items-center gap-1">
            {index > 0 && <span aria-hidden="true" className="text-muted-foreground">→</span>}
            <Button variant="ghost" size="small" selected={index === trail.length - 1}
              aria-current={index === trail.length - 1 ? 'page' : undefined} onClick={() => inspect(step)}>
              {resources[step.resourceId].name}{step.moduleId ? ` · ${getScopeName(step)}` : ''}
            </Button>
          </span>
        ))}
      </nav>}
      <ProductInventorySummary resourceId={resourceId} />
      <SupplyDiagnosis key={supplyTargetKey(target)} inspector={inspector} target={target}
        factoryAccess={Boolean(target.moduleId) && rows.some(row => getResourceSupplyAccess(row, resourceId) === 'factory')}
        contracts={target.moduleId ? [] : contractRows}
        deliveries={target.moduleId ? rows.flatMap(row => row.incoming) : []}
        onInspect={inspect} getScopeName={getScopeName} />
      <div className="space-y-3">
        <Button variant="ghost" size="small" aria-expanded={showRouting} aria-controls={routingId}
          onClick={() => setShowRouting(value => !value)}>
          {showRouting ? 'Hide supply rules' : 'Supply rules & priorities'}
        </Button>
        {showRouting && (
          <div id={routingId}>
            <TableScrollRegion
              label={`${resources[resourceId].name} supply by module`}
              columns={columns}
              rows={rows}
              rowKey={row => row.moduleId}
              empty="No production or consumption."
            />
          </div>
        )}
      </div>
    </section>
  )

  return (
    <ResourceNavigationProvider onInspectResource={nextResourceId => {
      if (nextResourceId === 'electricity' || nextResourceId === 'computing') {
        inspectFactoryResource?.(nextResourceId)
      } else {
        inspect({ resourceId: nextResourceId, moduleId: target.moduleId })
      }
    }}>{content}</ResourceNavigationProvider>
  )
}
