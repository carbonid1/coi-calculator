import { cn, Item } from '@carbonid1/design-system'
import { Check, ChevronRight, CircleAlert, CirclePause, Ship, Unplug } from 'lucide-react'

import { type Contract, type ContractRoute } from '../db/contracts'
import {
  calculateContractWorkerBreakdown,
  type ContractResult,
  type ContractRouteResult,
} from '../helpers/contracts/calculate-contracts'
import { getContractRouteBlocker } from '../helpers/contracts/contract-route-status'
import { type SyncedContractIssue } from '../helpers/contracts/resolve-synced-contracts'
import { useResources } from './ResourceProducts'
import { ResourceToken } from './ResourceToken'

interface Props {
  issues: SyncedContractIssue[]
  results: ContractResult[]
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(3)).toLocaleString()
const rowColumns = 'grid grid-cols-[minmax(0,1.4fr)_1rem_minmax(0,1.1fr)_1rem] gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1.4fr)_1rem_minmax(0,1.1fr)_6rem_6.5rem_1rem]'
const stateDefinitions = {
  Running: { Icon: Check, className: 'text-success-foreground' },
  Partial: { Icon: CircleAlert, className: 'text-attention-foreground' },
  'Depot paused': { Icon: CirclePause, className: 'text-attention-foreground' },
  'Ship paused': { Icon: CirclePause, className: 'text-attention-foreground' },
  'Routes paused': { Icon: CirclePause, className: 'text-attention-foreground' },
  'No ship': { Icon: Ship, className: 'text-attention-foreground' },
  Off: { Icon: Unplug, className: 'text-muted-foreground' },
  'No depot': { Icon: CircleAlert, className: 'text-attention-foreground' },
}

const getContractState = (routes: readonly ContractRoute[]) => {
  if (routes.length === 0) return 'No depot'
  const blockers = routes.map(getContractRouteBlocker)
  const operating = blockers.filter(blocker => blocker === null).length

  if (operating === routes.length) return 'Running'
  if (operating > 0) return 'Partial'
  if (blockers.every(blocker => blocker === 'disabled')) return 'Off'
  if (blockers.includes('no-ship')) return 'No ship'
  const enabledRoutes = routes.filter(route => route.enabled)
  const depotPaused = enabledRoutes.some(route => !route.running)
  const shipPaused = enabledRoutes.some(route => route.running && route.ship && !route.ship.running)

  if (depotPaused && shipPaused) return 'Routes paused'
  return depotPaused ? 'Depot paused' : 'Ship paused'
}

const ContractState: React.FC<{ routes: readonly ContractRoute[]; className?: string }> = ({ routes, className }) => {
  const state = getContractState(routes)
  const planned = routes.some(route => route.source === 'planned')
  const { Icon, className: stateClassName } = stateDefinitions[state]

  return (
    <span className={cn('flex flex-col items-start text-xs', className)}>
      <span className={cn('inline-flex items-center gap-1', planned ? 'text-foreground' : stateClassName)}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {state}
      </span>
      {planned && <span className="text-highlight-foreground">Planned</span>}
    </span>
  )
}

const ContractTerms: React.FC<{ contract: Contract }> = ({ contract }) => {
  const resources = useResources()
  const importedResource = resources[contract.exchange.imported.resourceId]

  return (
    <p className="text-xs text-muted-foreground">
      {formatQuantity(contract.unity.perProductionCycle)} Unity/month
      {' + '}
      {formatQuantity(contract.unity.per100Imported)}/100 {importedResource.name}
      {' · '}
      Rep {contract.minimumReputation}
    </p>
  )
}

const DataRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-right font-mono text-xs tabular-nums text-foreground">{value}</dd>
  </div>
)

const RouteDetails: React.FC<{
  result: ContractRouteResult
  contract: Contract
  exportSurplus: boolean
  showExchange: boolean
}> = ({ result, contract, exportSurplus, showExchange }) => {
  const resources = useResources()
  const { route } = result
  const fuelResource = resources[route.shipping.fuelResourceId]
  const zoneNames = route.zones.flatMap(zone => zone.name ? [zone.name] : [])
  const dynamicMode = exportSurplus ? 'Surplus exports' : 'Demand-balanced'
  const mode = route.importedPerProductionCycle !== null ? 'Fixed' : dynamicMode

  return (
    <section className="space-y-2 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-foreground">{route.depotName}</h4>
          {zoneNames.length > 0 && <p className="text-xs text-muted-foreground">{zoneNames.join(', ')}</p>}
        </div>
        <span className="text-xs text-muted-foreground">
          <span className={route.source === 'planned' ? 'text-highlight-foreground' : undefined}>
            {route.source === 'planned' ? 'Planned' : 'Synced'}
          </span>
          {' · '}{mode}
        </span>
      </div>
      {showExchange && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs tabular-nums text-foreground">
            {formatQuantity(result.exported)} <ResourceToken resourceId={contract.exchange.exported.resourceId} named />
            {' → '}{formatQuantity(result.imported)} <ResourceToken resourceId={contract.exchange.imported.resourceId} named /> / month
          </p>
          <ContractState routes={[route]} />
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
        <DataRow label="Ship fuel / cycle" value={result.fuelUnavailable
          ? 'Voyage estimate unavailable'
          : <span className="inline-flex items-center gap-1.5">
              {formatQuantity(result.fuelPerProductionCycle)} <ResourceToken resourceId={fuelResource.id} named />
            </span>} />
        <DataRow label="Max import / month" value={result.maxImportedPerProductionCycle === null
          ? 'Not measured' : formatQuantity(result.maxImportedPerProductionCycle)} />
      </dl>
    </section>
  )
}

const ActiveContractRow: React.FC<{ result: ContractResult }> = ({ result }) => {
  const resources = useResources()
  const { contract, exported, imported } = result
  const exportedResource = resources[contract.exchange.exported.resourceId]
  const importedResource = resources[contract.exchange.imported.resourceId]
  const workers = calculateContractWorkerBreakdown(contract).total
  const unity = contract.unity.perProductionCycle + imported * contract.unity.per100Imported / 100

  return (
    <Item.Root as="details" surface="raised" className="group/contract block p-0" data-contract-id={contract.gameId}>
      <Item.Root as="summary" interactive className={cn(rowColumns, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
        <span className="min-w-0">
          <ResourceToken resourceId={exportedResource.id} named layout="stacked" amount={formatQuantity(exported)} />
          <span className="sr-only">exported per month</span>
        </span>
        <span className="text-muted-foreground" aria-hidden="true">→</span>
        <span className="min-w-0">
          <ResourceToken resourceId={importedResource.id} named layout="stacked" amount={formatQuantity(imported)} />
          <span className="sr-only">imported per month</span>
        </span>
        <span className="col-span-2 col-start-3 row-start-2 text-right text-xs tabular-nums sm:col-span-1 sm:col-start-4 sm:row-start-1">
          <span>{formatQuantity(unity)}<span className="sm:sr-only"> Unity<span className="sr-only"> per month</span></span></span>
          <span className="block text-muted-foreground">{workers.toLocaleString()} workers</span>
        </span>
        <ContractState routes={contract.routes} className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-5 sm:row-start-1" />
        <ChevronRight className="col-start-4 row-start-1 size-4 text-muted-foreground group-open/contract:rotate-90 sm:col-start-6" aria-hidden="true" />
      </Item.Root>
      <div className="space-y-2 px-3 pb-3">
        {result.routes.length > 0 ? result.routes.map(route => (
          <RouteDetails key={route.route.id} result={route} contract={contract}
            exportSurplus={contract.exportSurplus ?? false} showExchange={result.routes.length > 1} />
        )) : <p className="text-xs text-muted-foreground">No Cargo Depot assigned.</p>}
        <ContractTerms contract={contract} />
      </div>
    </Item.Root>
  )
}

export const ContractsView: React.FC<Props> = ({ issues, results }) => {
  const stateCounts = new Map<string, number>()

  for (const result of results) {
    const state = getContractState(result.contract.routes).toLowerCase()

    stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1)
  }
  const stateSummary = Object.keys(stateDefinitions).flatMap(label => {
    const state = label.toLowerCase()
    const count = stateCounts.get(state)

    return count ? [`${count} ${state}`] : []
  }).join(' · ')

  return (
    <div className="space-y-4">
      {issues.length > 0 && (
        <section className="space-y-2" aria-labelledby="contract-issues-heading">
          <h3 id="contract-issues-heading" className="text-sm font-semibold text-foreground">
            Needs attention · {issues.length}
          </h3>
          <div className="space-y-1 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
            {issues.map((issue, index) => (
              <p key={`${issue.gameId}-${index}`} className="text-sm text-muted-foreground">{issue.message}</p>
            ))}
          </div>
        </section>
      )}
      <section className="space-y-3" aria-labelledby="established-contracts-heading">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 id="established-contracts-heading" className="text-sm font-semibold text-foreground">Established · {results.length}</h3>
          {stateSummary && <p className="text-xs text-muted-foreground">{stateSummary}</p>}
        </div>
        {results.length > 0 ? (
          <div>
            <div className={cn(rowColumns, 'items-center px-3 pb-2 text-xs text-muted-foreground')} aria-hidden="true">
              <span>Export / month</span><span /><span>Import / month</span>
              <span className="hidden text-right sm:block">Unity / month<br />Workers</span>
              <span className="hidden sm:block">State</span><span />
            </div>
            <div className="space-y-1">
              {results.map(result => <ActiveContractRow key={result.contract.gameId} result={result} />)}
            </div>
          </div>
        ) : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No established contracts.</div>}
      </section>
    </div>
  )
}
