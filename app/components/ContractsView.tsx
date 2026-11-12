import { cn, Item, Switch, Tooltip } from '@carbonid1/design-system'
import { Check, ChevronRight, CircleAlert, CirclePause, Ship, Unplug } from 'lucide-react'

import { type Contract, type ContractRoute } from '../db/contracts'
import {
  calculateContractWorkerBreakdown,
  type ContractResult,
  type ContractRouteResult,
} from '../helpers/contracts/calculate-contracts'
import { getContractConnectionLimits } from '../helpers/contracts/contract-connection-limits'
import { type ContractFullThrottlePreferences } from '../helpers/contracts/contract-preferences'
import { getContractRouteBlocker } from '../helpers/contracts/contract-route-status'
import { type SyncedContractIssue } from '../helpers/contracts/resolve-synced-contracts'
import { formatInGameDuration } from '../helpers/format-in-game-duration'
import { useResources } from './ResourceProducts'
import { ResourceToken } from './ResourceToken'

interface Props {
  fullThrottlePreferences: ContractFullThrottlePreferences
  onFullThrottleChange?: (contractGameId: string, enabled: boolean) => void
  issues: SyncedContractIssue[]
  results: ContractResult[]
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(3)).toLocaleString()
const connectionReasons: Record<string, string> = {
  'scan-limit': 'The connected network exceeds the local scan limit.',
  'shared-depot': 'The network connects another cargo depot.',
  'unsupported-device': 'The line reaches a device the connection check does not support.',
  'no-transport': 'No connected belt or pipe was found.',
  'direct-connection': 'A direct building connection has no separate belt or pipe capacity.',
  'planned-configuration': 'Sync after configuring and unpausing the cargo modules to measure this line.',
}
const connectionTooltip = (reason?: string | null) => (
  reason ? connectionReasons[reason.split(':')[0] ?? ''] ?? 'Connection capacity could not be measured.'
    : 'Rated belts, pipes and lifts to the first storage, train-station buffer or machine. Trucks and competing traffic are excluded.'
)
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

const ContractState: React.FC<{ routes: readonly ContractRoute[]; fullThrottle?: boolean; lineLimited?: boolean; className?: string }> = ({ routes, fullThrottle, lineLimited, className }) => {
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
      {lineLimited ? <span className="text-attention-foreground">Line limit</span>
        : fullThrottle && <span className="text-muted-foreground">Full throttle</span>}
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

const DataRow: React.FC<{ label: React.ReactNode; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4">
    <dt className="min-w-0 text-xs text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right font-mono text-xs tabular-nums text-foreground">{value}</dd>
  </div>
)

const RouteDetails: React.FC<{
  result: ContractRouteResult
  contract: ContractResult['contract']
  exportSurplus: boolean
  showExchange: boolean
}> = ({ result, contract, exportSurplus, showExchange }) => {
  const resources = useResources()
  const { route } = result
  const fuelResource = resources[route.shipping.fuelResourceId]
  const zoneNames = route.zones.flatMap(zone => zone.name ? [zone.name] : [])
  const dynamicMode = exportSurplus ? 'Surplus exports' : 'Demand-balanced'
  const routeMode = route.importedPerProductionCycle !== null ? 'Fixed' : dynamicMode
  const connections = getContractConnectionLimits(result, contract)
    .toSorted((a, b) => a.direction.localeCompare(b.direction))

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
          {!contract.fullThrottle && <>{' · '}{routeMode}</>}
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
      <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
        <div>
          <h5 className="mb-1 text-xs font-medium text-muted-foreground">Shipping</h5>
          <dl>
            <DataRow label={<span className="inline-flex items-center gap-1"><ResourceToken resourceId={fuelResource.id} named /> / cycle</span>}
              value={result.fuelUnavailable ? 'Not measured' : formatQuantity(result.fuelPerProductionCycle)} />
            {route.ship && (
              <>
                <DataRow label="Round trip" value={route.shipping.roundTripDurationProductionCycles === null
                  ? 'Not measured' : formatInGameDuration(route.shipping.roundTripDurationProductionCycles)} />
                <DataRow label="Save fuel" value={route.shipping.saveFuel ? 'On' : 'Off'} />
              </>
            )}
          </dl>
        </div>
        <div>
          <h5 className="mb-1 text-xs font-medium text-muted-foreground">Capacity</h5>
          <dl>
            <DataRow label="Max import / month" value={result.maxImportedPerProductionCycle === null
              ? 'Not measured' : formatQuantity(result.maxImportedPerProductionCycle)} />
            {connections.map(connection => (
              <DataRow key={`${connection.resourceId}:${connection.direction}`}
                label={`${resources[connection.resourceId].name} ${connection.direction === 'import' ? 'output' : 'input'} / month`}
                value={
                  <Tooltip label={connectionTooltip(connection.unmeasuredReason)} maxWidth={320}>
                    <span tabIndex={0} className="rounded outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                      {connection.capacity === null ? 'Not measured' : formatQuantity(connection.capacity)}
                    </span>
                  </Tooltip>
                } />
            ))}
            {connections.length === 0 && <DataRow label="Connected lines" value="Not measured" />}
          </dl>
        </div>
      </div>
      {connections.filter(connection => connection.limited).map(connection => (
        <p key={`${connection.resourceId}:${connection.direction}`} className="flex items-start gap-1.5 text-xs text-attention-foreground">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {resources[connection.resourceId].name} {connection.direction === 'import' ? 'output' : 'input'} line:
          {' '}{formatQuantity(connection.capacity ?? 0)} capacity &lt; {formatQuantity(connection.planned)} planned / month.
        </p>
      ))}
    </section>
  )
}

const ActiveContractRow: React.FC<{
  result: ContractResult
  fullThrottle: boolean
  onFullThrottleChange?: Props['onFullThrottleChange']
}> = ({ result, fullThrottle, onFullThrottleChange }) => {
  const resources = useResources()
  const { contract, exported, imported } = result
  const exportedResource = resources[contract.exchange.exported.resourceId]
  const importedResource = resources[contract.exchange.imported.resourceId]
  const workers = calculateContractWorkerBreakdown(contract).total
  const unity = contract.unity.perProductionCycle + imported * contract.unity.per100Imported / 100
  const lineLimited = result.routes.some(route => getContractConnectionLimits(route, contract).some(connection => connection.limited))

  return (
    <Item.Root as="details" surface="raised" className="group/contract block p-0" data-contract-id={contract.gameId} data-full-throttle={contract.fullThrottle === true}>
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
        <ContractState routes={contract.routes} fullThrottle={contract.fullThrottle} lineLimited={lineLimited} className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-5 sm:row-start-1" />
        <ChevronRight className="col-start-4 row-start-1 size-4 text-muted-foreground group-open/contract:rotate-90 sm:col-start-6" aria-hidden="true" />
      </Item.Root>
      <div className="max-w-4xl space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Tooltip label="Calculate continuous shipping at route capacity, including export, fuel and Unity costs." maxWidth={320}>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-foreground">
              Full throttle
              <Switch.Root aria-label="Full throttle" checked={fullThrottle} disabled={!onFullThrottleChange}
                onCheckedChange={enabled => onFullThrottleChange?.(contract.gameId, enabled)}>
                <Switch.Thumb />
              </Switch.Root>
            </label>
          </Tooltip>
          <ContractTerms contract={contract} />
        </div>
        {result.routes.length > 0 ? result.routes.map(route => (
          <RouteDetails key={route.route.id} result={route} contract={contract}
            exportSurplus={contract.exportSurplus ?? false} showExchange={result.routes.length > 1} />
        )) : <p className="text-xs text-muted-foreground">No Cargo Depot assigned.</p>}
      </div>
    </Item.Root>
  )
}

export const ContractsView: React.FC<Props> = ({ issues, results, fullThrottlePreferences, onFullThrottleChange }) => {
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
  const hasPlannedRoutes = results.some(result => result.routes.some(({ route }) => route.source === 'planned'))

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
      <section className="space-y-3" aria-labelledby="active-contracts-heading">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 id="active-contracts-heading" className="text-sm font-semibold text-foreground">
            {hasPlannedRoutes ? 'Contracts' : 'Established'} · {results.length}
          </h3>
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
              {results.map(result => <ActiveContractRow key={result.contract.gameId} result={result}
                fullThrottle={fullThrottlePreferences[result.contract.gameId] === true}
                onFullThrottleChange={onFullThrottleChange} />)}
            </div>
          </div>
        ) : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No established contracts.</div>}
      </section>
    </div>
  )
}
