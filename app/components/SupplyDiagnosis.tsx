'use client'

import { Button, Tooltip } from '@carbonid1/design-system'
import { useState } from 'react'

import { resources } from '../db/resources'
import { type SupplyInspector, type SupplyProducer, type SupplyTarget, type SupplyTrace, supplyTargetKey } from '../helpers/resource-supply/supply-diagnosis'

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
  const last = trace.path[trace.path.length - 1]

  if (!last) return 'No input blocker recorded'
  const shortage = Math.max(0, -inspector.getFlow(last).net)

  switch (trace.kind) {
    case 'blocked-increase': return `Blocks more production${shortage > 0.001 ? ` · ${quantity(shortage)} short` : ''}`
    case 'shortage': return `${quantity(shortage)} short`
    case 'exhausted': return 'No remaining supply'
    case 'capacity': return 'Supply fully used · producers at capacity'
    case 'paused': return 'Producers paused'
    case 'cycle': return 'Shared production loop · inspect inputs'
    case 'continue': return 'Continue tracing inputs'
  }
}

export const SupplyDiagnosis = ({ inspector, target, onInspect, getScopeName }: {
  inspector: SupplyInspector
  target: SupplyTarget
  onInspect: (target: SupplyTarget) => void
  getScopeName: (target: SupplyTarget) => string
}) => {
  const [showAllUses, setShowAllUses] = useState(false)
  const flow = inspector.getFlow(target)
  const producers = inspector.getProducers(target)
  const uses = inspector.getUses(target)
  const visibleUses = showAllUses ? uses : uses.slice(0, 8)
  const resourceLink = (next: SupplyTarget, label = resources[next.resourceId].name) => (
    <Button variant="link" size="small" className="h-auto px-0 py-1 text-left whitespace-normal"
      aria-label={`Inspect ${resources[next.resourceId].name}${next.moduleId ? ` in ${getScopeName(next)}` : ''}`}
      onClick={() => onInspect(next)}>
      {label}{next.moduleId && <span className="text-muted-foreground"> · {getScopeName(next)}</span>}
    </Button>
  )

  return (
    <div className="space-y-4" aria-label={`${resources[target.resourceId].name} supply diagnosis`}>
      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
        {[['Supply', flow.produced], ['Demand', flow.consumed], [flow.net < -0.001 ? 'Short by' : 'Remaining', Math.abs(flow.net)]].map(([label, value]) => (
          <div key={label} className="space-y-1">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-mono text-lg tabular-nums text-foreground">{quantity(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Why production stops</h3>
        {producers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {flow.produced > 0.001 ? 'Supply comes from imports or deliveries.' : 'No producer or delivered supply.'}
          </p>
        )}
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {producers.map(producer => {
            const traces = [...new Map(producer.limits.flatMap(limit => inspector.trace(limit))
              .map(trace => [trace.path.map(supplyTargetKey).join('/'), trace])).values()]

            return (
              <article key={producer.key} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h4 className="text-sm font-medium text-foreground">{producer.recipeName}</h4>
                    <p className="text-xs text-muted-foreground">{producer.moduleName} · {producer.building}</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">{quantity(producer.produced)}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>{producerStatus(producer)}</span>
                  {producer.poolUtilization !== null && (
                    <span>{quantity(producer.poolUtilization * 100)}% {producer.sharedCapacity ? 'shared capacity' : 'capacity'} used</span>
                  )}
                </div>
                {traces.length > 0 && (
                  <ul className="space-y-1" aria-label={`${producer.recipeName} blockers`}>
                    {traces.map(trace => (
                      <li key={trace.path.map(supplyTargetKey).join('/')} className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
                        <div className="flex flex-wrap items-center gap-x-2 text-sm">
                          {trace.path.map((next, index) => (
                            <span key={`${supplyTargetKey(next)}:${index}`} className="inline-flex items-center gap-2">
                              {index > 0 && <span aria-hidden="true" className="text-muted-foreground">→</span>}
                              {resourceLink(next)}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{traceReason(trace, inspector)}</p>
                        {trace.additionalQuantity != null && (
                          <Tooltip label="Additional input required by the blocked recipe increase. This is separate from the existing shortage.">
                            <span tabIndex={0} className="mt-1 inline-block text-xs text-muted-foreground">
                              Blocked increase: +{quantity(trace.additionalQuantity)} {resources[trace.path.at(-1)?.resourceId ?? target.resourceId].name}
                            </span>
                          </Tooltip>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {producer.inputs.length > 0 && (
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Uses</span>
                    {producer.inputs.map(input => (
                      <span key={supplyTargetKey(input.target)} className="inline-flex items-baseline gap-1.5">
                        <span className="font-mono tabular-nums text-foreground">{quantity(input.quantity)}</span>
                        {resourceLink(input.target)}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
      {uses.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Demand breakdown</h3>
          <ul className="space-y-1">
            {visibleUses.map(use => (
              <li key={use.key} className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent">
                <span className="min-w-0 text-foreground">{use.name}
                  {use.moduleName && <span className="ml-2 text-xs text-muted-foreground">{use.moduleName}</span>}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-foreground">{quantity(use.quantity)}</span>
              </li>
            ))}
          </ul>
          {uses.length > 8 && (
            <Button variant="ghost" size="small" onClick={() => setShowAllUses(value => !value)} aria-expanded={showAllUses}>
              {showAllUses ? 'Show fewer uses' : `Show all ${uses.length} uses`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
