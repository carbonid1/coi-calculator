'use client'

import { Button, Tooltip } from '@carbonid1/design-system'
import { useId, useState } from 'react'

import { type ModuleResourceTransfer } from '../db/module-resource-links'
import { resources } from '../db/resources'
import { formatDiagnosticMessages } from '../helpers/diagnostic-display/diagnostic-display'
import { type RecipePresentation } from '../helpers/recipe-display/recipe-display'
import { type RecipePriorityNote } from '../helpers/resource-supply/recipe-priorities'
import { type ContractSupplyRow } from '../helpers/resource-supply/resource-supply'
import { type ModuleSupply, type SupplyInspector, type SupplyProducer, type SupplyTarget, type SupplyTrace, type SupplyUse, supplyTargetKey } from '../helpers/resource-supply/supply-diagnosis'
import { RecipeLabel } from './RecipeLabel'
import { useResourceNavigation } from './ResourceNavigation'
import { ResourceToken } from './ResourceToken'

const quantity = (value: number) => {
  if (Math.abs(value) <= 0.001) return '0'
  if (Math.abs(value) < 0.01) return value.toPrecision(1)
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
const producerStatus = (producer: SupplyProducer) => {
  switch (producer.status) {
    case 'capacity': return 'At capacity'
    case 'paused': return 'Paused'
    case 'fixed': return 'Fixed production'
    case 'byproduct': return `Production follows ${producer.mainProducts.map(id => resources[id].name).join(', ')}`
    case 'inputs': return 'Input supply limits production'
    case 'unexplained': return 'No input blocker recorded'
  }
}
const traceReason = (trace: SupplyTrace, inspector: SupplyInspector) => {
  const last = trace.path.at(-1)

  if (!last) return 'No input blocker recorded'
  const shortage = Math.max(0, -inspector.getFlow(last).net)

  switch (trace.kind) {
    case 'blocked-increase': return shortage > 0.001 ? `${quantity(shortage)} short` : 'Blocks more production'
    case 'shortage': return `${quantity(shortage)} short`
    case 'exhausted': return 'Supply fully used'
    case 'capacity': return 'At capacity'
    case 'paused': return 'Producers paused'
    case 'cycle': return 'Shared production loop'
    case 'continue': return 'Continue tracing inputs'
  }
}
const TraceReason = ({ trace, inspector }: { trace: SupplyTrace; inspector: SupplyInspector }) => {
  const last = trace.path.at(-1)

  if (trace.additionalQuantity != null && last) {
    return (
      <Tooltip label={`Blocked increase: +${quantity(trace.additionalQuantity)} ${resources[last.resourceId].name} / cycle`}>
        <span tabIndex={0} className="text-muted-foreground">· {traceReason(trace, inspector)}</span>
      </Tooltip>
    )
  }
  return <span className="text-muted-foreground">· {traceReason(trace, inspector)}</span>
}

interface InspectionProps {
  onInspect: (target: SupplyTarget) => void
  getScopeName: (target: SupplyTarget) => string
}
const ResourceLink = ({ target, onInspect, getScopeName }: InspectionProps & { target: SupplyTarget }) => (
  <Button variant="link" size="small" className="h-auto justify-start p-1.5 text-left whitespace-normal"
    aria-label={`Inspect ${resources[target.resourceId].name}${target.moduleId ? ` in ${getScopeName(target)}` : ''}`}
    onClick={() => onInspect(target)}>
    <ResourceToken resourceId={target.resourceId} named />
    {target.moduleId && <span className="text-muted-foreground"> · {getScopeName(target)}</span>}
  </Button>
)
const RecipePriorities = ({ notes }: { notes: RecipePriorityNote[] }) => (
  <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Calculator recipe priorities">
    {notes.map(note => (
      <li key={note.label}>
        {note.detail ? <Tooltip label={note.detail}><span tabIndex={0}>{note.label}</span></Tooltip> : note.label}
      </li>
    ))}
  </ul>
)
const SupplyRecipeLabel = ({ recipe, inputTargets, onInspect }: {
  recipe: RecipePresentation
  inputTargets: SupplyTarget[]
  onInspect: InspectionProps['onInspect']
}) => {
  const inspectResource = useResourceNavigation()

  return <RecipeLabel recipe={recipe} onInspectInput={resourceId => {
    if (resourceId === 'electricity' || resourceId === 'computing') {
      inspectResource?.(resourceId)
    } else {
      onInspect(inputTargets.find(target => target.resourceId === resourceId) ?? { resourceId })
    }
  }} />
}
const SupplyRecipe = ({ producer, inspector, showPriorities, ...inspection }: InspectionProps & {
  producer: SupplyProducer
  inspector: SupplyInspector
  showPriorities: boolean
}) => {
  const traces = [...new Map(producer.limits.flatMap(limit => inspector.trace(limit))
    .map(trace => [trace.path.map(supplyTargetKey).join('/'), trace])).values()].filter(trace => trace.kind !== 'exhausted')
  const status = producer.status !== 'inputs' && producer.status !== 'unexplained' ? producerStatus(producer) : undefined

  return (
    <div className="space-y-1 rounded-lg py-2 hover:bg-accent">
      <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-3">
        <h4 aria-label={producer.recipeName} className="flex min-w-0 items-center text-sm font-medium text-foreground">
          <SupplyRecipeLabel recipe={producer.recipe} inputTargets={producer.inputs.map(input => input.target)} onInspect={inspection.onInspect} />
        </h4>
        <span className="text-right font-mono text-sm tabular-nums whitespace-nowrap text-foreground">{quantity(producer.produced)}</span>
      </div>
      {showPriorities && <RecipePriorities notes={producer.priorities.filter(note => note.label !== producerStatus(producer))} />}
      {traces.length > 0 ? (
        <ul className="space-y-1" aria-label={`${producer.recipeName} blockers`}>
          {traces.map(trace => (
            <li key={trace.path.map(supplyTargetKey).join('/')} className="flex flex-wrap items-center gap-x-2 text-xs">
              {trace.path.map((next, index) => (
                <span key={`${supplyTargetKey(next)}:${index}`} className="inline-flex items-center gap-2">
                  {index > 0 && <span aria-hidden="true" className="text-muted-foreground">→</span>}
                  <ResourceLink target={next} {...inspection} />
                </span>
              ))}
              <TraceReason trace={trace} inspector={inspector} />
            </li>
          ))}
        </ul>
      ) : status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  )
}
const ContractFlow = ({ contract, amount, label }: { contract: ContractSupplyRow; amount: number; label: string }) => {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const details = [
    { label: 'Imports', values: contract.imports },
    { label: 'Exports', values: contract.exports },
    { label: 'Ship fuel', values: contract.fuel },
  ]

  return (
    <li className="rounded-lg px-3 py-2 hover:bg-accent">
      <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-3 text-sm">
        <span className="flex min-w-0 items-center text-foreground">
          <RecipeLabel recipe={{ name: contract.contractName,
            inputs: contract.exports.map(value => value.resourceId),
            outputs: contract.imports.map(value => value.resourceId),
            amounts: { inputs: contract.exports, outputs: contract.imports } }} />
        </span>
        <span className="text-right font-mono tabular-nums whitespace-nowrap text-foreground">{quantity(amount)}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
        <span>{label}</span>
        <Button variant="ghost" size="small" className="h-auto px-0 py-1 text-xs text-muted-foreground"
          aria-label={`${expanded ? 'Hide' : 'Show'} ${contract.contractName} ${label.toLowerCase()} details`}
          aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>
          {expanded ? 'Hide details' : 'Details'}
        </Button>
      </div>
      {contract.importLimits.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatDiagnosticMessages(contract.importLimits.map(limit => ({ kind: 'contract-limit', limit })))}
        </p>
      )}
      {expanded && (
        <dl id={detailsId} className="space-y-1 pt-2 text-xs">
          {details.flatMap(detail => detail.values.filter(value => value.quantity > 0.001).map(value => (
            <div key={`${detail.label}:${value.resourceId}`} className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-3">
              <dt className="flex flex-wrap items-center gap-2 text-muted-foreground">{detail.label} <ResourceToken resourceId={value.resourceId} /></dt>
              <dd className="text-right font-mono tabular-nums whitespace-nowrap text-foreground">{quantity(value.quantity)}</dd>
            </div>
          )))}
        </dl>
      )}
    </li>
  )
}

interface SupplyModuleGroup {
  target: SupplyTarget
  name: string
  quantity: number
  pools: SupplyProducer[][]
  supplies: ModuleSupply[]
}
const SupplyModule = ({ group, inspector, showPriorities, ...inspection }: InspectionProps & {
  group: SupplyModuleGroup; inspector: SupplyInspector; showPriorities: boolean
}) => {
  const [expanded, setExpanded] = useState(false)
  const pools = expanded ? group.pools : group.pools.slice(0, 2)

  return (
    <article className="space-y-2 rounded-lg bg-surface-inset p-3 inset-shadow-surface" aria-label={`${group.name} supply`}>
      <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-baseline gap-3 text-sm">
        <Button variant="link" size="small" className="h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal"
          aria-label={`Inspect ${resources[group.target.resourceId].name} in ${group.name}`} onClick={() => inspection.onInspect(group.target)}>
          {group.name}
        </Button>
        <span className="text-right font-mono tabular-nums whitespace-nowrap text-foreground">{quantity(group.quantity)}</span>
      </div>
      {pools.map(pool => {
        const lead = pool[0]

        if (!lead) return null
        return (
          <div key={lead.capacityPoolKey} className="space-y-1 pt-1">
            <p className="text-xs text-muted-foreground">{lead.building}</p>
            {pool.map(producer => <SupplyRecipe key={producer.key} producer={producer} inspector={inspector} showPriorities={showPriorities} {...inspection} />)}
          </div>
        )
      })}
      {group.pools.length > 2 && (
        <Button variant="ghost" size="small" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
          aria-label={`${expanded ? 'Show fewer' : 'Show all'} sources in ${group.name}`}>
          {expanded ? 'Show fewer sources' : `Show all ${group.pools.length} sources`}
        </Button>
      )}
      {group.supplies.map(supply => (
        <div key={supply.name} className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-3 py-2 text-sm text-foreground">
          <span>{supply.name}</span><span className="text-right font-mono tabular-nums whitespace-nowrap">{quantity(supply.quantity)}</span>
        </div>
      ))}
    </article>
  )
}
const ModuleDemand = ({ target, uses, showPriorities, ...inspection }: InspectionProps & {
  target: SupplyTarget; uses: SupplyUse[]; showPriorities: boolean
}) => {
  const [expanded, setExpanded] = useState(false)
  const moduleName = inspection.getScopeName(target)
  const visible = expanded ? uses : uses.slice(0, 3)

  return (
    <article className="space-y-2 rounded-lg bg-surface-inset p-3 inset-shadow-surface" aria-label={`${moduleName} demand`}>
      <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-baseline gap-3 text-sm">
        <Button variant="link" size="small" className="h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal"
          aria-label={`Inspect ${resources[target.resourceId].name} in ${moduleName}`} onClick={() => inspection.onInspect(target)}>
          {moduleName}
        </Button>
        <span className="text-right font-mono tabular-nums whitespace-nowrap text-foreground">{quantity(uses.reduce((sum, use) => sum + use.quantity, 0))}</span>
      </div>
      <ul className="space-y-1">
        {visible.map(use => (
          <li key={use.key} className="space-y-1 rounded-lg py-2 text-sm hover:bg-accent">
            <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-3">
              <span className="flex min-w-0 items-center text-foreground">{use.recipe
                ? <SupplyRecipeLabel recipe={use.recipe} inputTargets={use.inputTargets ?? []} onInspect={inspection.onInspect} />
                : use.name}</span>
              <span className="text-right font-mono tabular-nums whitespace-nowrap text-foreground">{quantity(use.quantity)}</span>
            </div>
            {showPriorities && use.priorities && <RecipePriorities notes={use.priorities} />}
          </li>
        ))}
      </ul>
      {uses.length > 3 && (
        <Button variant="ghost" size="small" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
          aria-label={`${expanded ? 'Show fewer' : 'Show all'} uses in ${moduleName}`}>
          {expanded ? 'Show fewer uses' : `Show all ${uses.length} uses`}
        </Button>
      )}
    </article>
  )
}

export const SupplyDiagnosis = ({ inspector, target, contracts = [], deliveries = [], factoryAccess = false, ...inspection }: InspectionProps & {
  inspector: SupplyInspector
  target: SupplyTarget
  contracts?: ContractSupplyRow[]
  deliveries?: ModuleResourceTransfer[]
  factoryAccess?: boolean
}) => {
  const [showAllUses, setShowAllUses] = useState(false)
  const [showPriorities, setShowPriorities] = useState(false)
  const flow = inspector.getFlow(target)
  const producers = inspector.getProducers(target)
  const uses = inspector.getUses(target, showPriorities)
  const otherUses = uses.filter(use => !use.moduleId)
  const visibleUses = showAllUses ? otherUses : otherUses.slice(0, 8)
  const moduleUses = new Map<string, SupplyUse[]>()

  for (const use of uses) {
    if (!use.moduleId) continue
    const group = moduleUses.get(use.moduleId) ?? []

    group.push(use)
    moduleUses.set(use.moduleId, group)
  }
  const demandModules = [...moduleUses.entries()].toSorted(([, left], [, right]) => (
    right.reduce((sum, use) => sum + use.quantity, 0) - left.reduce((sum, use) => sum + use.quantity, 0)
  ))
  const groups = new Map<string, SupplyProducer[]>()

  for (const producer of producers) {
    const group = groups.get(producer.capacityPoolKey) ?? []

    group.push(producer)
    groups.set(producer.capacityPoolKey, group)
  }
  const sourceGroups = [...groups.values()].toSorted((left, right) => (
    right.reduce((sum, producer) => sum + producer.produced, 0)
    - left.reduce((sum, producer) => sum + producer.produced, 0)
  ))
  const moduleSupplies = inspector.getModuleSupplies(target)
  const supplyModules = new Map<string, SupplyModuleGroup>()

  for (const pool of sourceGroups) {
    const lead = pool[0]

    if (!lead) continue
    const group = supplyModules.get(lead.moduleId) ?? { target: { resourceId: target.resourceId, moduleId: lead.moduleId },
      name: lead.moduleName, quantity: 0, pools: [], supplies: [] }

    group.pools.push(pool)
    group.quantity += pool.reduce((sum, producer) => sum + producer.produced, 0)
    supplyModules.set(lead.moduleId, group)
  }
  for (const supply of moduleSupplies) {
    const group = supplyModules.get(supply.moduleId) ?? { target: { resourceId: target.resourceId, moduleId: supply.moduleId },
      name: supply.moduleName, quantity: 0, pools: [], supplies: [] }

    group.supplies.push(supply)
    group.quantity += supply.quantity
    supplyModules.set(supply.moduleId, group)
  }
  const imports = contracts.flatMap(contract => {
    const imported = contract.imports.find(input => input.resourceId === target.resourceId)

    return imported ? [{ contract, amount: imported.quantity }] : []
  })
  const otherSupply = flow.produced - producers.reduce((sum, producer) => sum + producer.produced, 0)
    - imports.reduce((sum, imported) => sum + imported.amount, 0)
    - deliveries.reduce((sum, delivery) => sum + delivery.quantity, 0)
    - moduleSupplies.reduce((sum, supply) => sum + supply.quantity, 0)
  let balanceLabel = flow.net < -0.001 ? 'Short by' : 'Remaining'

  if (factoryAccess) balanceLabel = flow.net < -0.001 ? 'Needs from factory' : 'Available to factory'

  return (
    <div className="space-y-5" aria-label={`${resources[target.resourceId].name} supply diagnosis`}>
      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
        {[[target.moduleId ? 'Local supply' : 'Supply', flow.produced], ['Demand', flow.consumed], [balanceLabel, Math.abs(flow.net)]].map(([label, value]) => (
          <div key={label} className="space-y-1">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-mono text-lg tabular-nums text-foreground">{quantity(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Largest amounts first{showPriorities && ' · Calculator priorities; lower numbers are preferred'}
        </p>
        <Button variant="ghost" size="small" selected={showPriorities} aria-pressed={showPriorities}
          onClick={() => setShowPriorities(value => !value)}>
          {showPriorities ? 'Hide recipe priorities' : 'Show recipe priorities'}
        </Button>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0 space-y-3" aria-label="Supply sources">
          <h3 className="text-sm font-medium text-foreground">Supply sources</h3>
          {[...supplyModules.values()].toSorted((left, right) => right.quantity - left.quantity).map(group => (
            <SupplyModule key={group.target.moduleId} group={group} inspector={inspector} showPriorities={showPriorities} {...inspection} />
          ))}
          {(imports.length > 0 || deliveries.length > 0) && (
            <ul className="space-y-1">
              {imports.map(({ contract, amount }) => <ContractFlow key={contract.contractId} contract={contract} amount={amount} label="Contract import" />)}
              {deliveries.map(delivery => (
                <li key={delivery.id} className="rounded-lg px-3 py-2 text-sm hover:bg-accent">
                  <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-baseline gap-3">
                    <ResourceLink target={{ resourceId: delivery.resourceId, moduleId: delivery.sourceModuleId }} {...inspection} />
                    <span className="text-right font-mono tabular-nums whitespace-nowrap text-foreground">{quantity(delivery.quantity)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Delivery{delivery.requestedQuantity - delivery.quantity > 0.001 && ` · ${quantity(delivery.requestedQuantity - delivery.quantity)} short`}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {otherSupply > 0.001 && (
            <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-baseline gap-3 px-3 py-2 text-sm text-foreground">
              <span>Other supply</span><span className="text-right font-mono tabular-nums whitespace-nowrap">{quantity(otherSupply)}</span>
            </div>
          )}
          {supplyModules.size === 0 && imports.length === 0 && deliveries.length === 0 && otherSupply <= 0.001 && (
            <p className="text-sm text-muted-foreground">{factoryAccess ? 'No local producer.' : 'No producer or delivered supply.'}</p>
          )}
        </section>
        <section className="min-w-0 space-y-3" aria-label="Resource demand">
          <h3 className="text-sm font-medium text-foreground">Used by</h3>
          {demandModules.map(([moduleId, moduleUses]) => (
            <ModuleDemand key={moduleId} target={{ resourceId: target.resourceId, moduleId }} uses={moduleUses} showPriorities={showPriorities} {...inspection} />
          ))}
          <ul className="space-y-1">
            {visibleUses.map(use => {
              const contract = use.contractId ? contracts.find(contract => contract.contractId === use.contractId) : undefined

              return contract ? <ContractFlow key={use.key} contract={contract} amount={use.quantity} label={use.moduleName ?? 'Contract export'} /> : (
                <li key={use.key} className="rounded-lg px-3 py-2 text-sm hover:bg-accent">
                  <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-baseline gap-3">
                    <span className="min-w-0 text-foreground">{use.name}</span>
                    <span className="text-right font-mono tabular-nums whitespace-nowrap text-foreground">{quantity(use.quantity)}</span>
                  </div>
                  {use.moduleName && <p className="mt-1 text-xs text-muted-foreground">{use.moduleName}</p>}
                </li>
              )
            })}
          </ul>
          {uses.length === 0 && <p className="text-sm text-muted-foreground">No demand.</p>}
          {otherUses.length > 8 && (
            <Button variant="ghost" size="small" onClick={() => setShowAllUses(value => !value)} aria-expanded={showAllUses}>
              {showAllUses ? 'Show fewer uses' : `Show all ${otherUses.length} other uses`}
            </Button>
          )}
        </section>
      </div>
    </div>
  )
}
