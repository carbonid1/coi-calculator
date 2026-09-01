import { Card } from '@carbonid1/design-system'

import { type Contract, type ContractRoute } from '../db/contracts'
import { resources } from '../db/resources'
import {
  calculateContractWorkerBreakdown,
  type ContractResult,
  type ContractRouteResult,
} from '../helpers/contracts/calculate-contracts'
import { type SyncedContractIssue } from '../helpers/contracts/resolve-synced-contracts'

interface Props {
  contracts: Contract[]
  issues: SyncedContractIssue[]
  results: ContractResult[]
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(3)).toLocaleString()

const ContractTerms: React.FC<{ contract: Contract }> = ({ contract }) => {
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

const DataRow: React.FC<{
  label: string
  value: React.ReactNode
}> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 rounded-lg px-2 py-1.5 hover:bg-accent">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-right font-mono text-sm font-semibold tabular-nums text-foreground">
      {value}
    </dd>
  </div>
)

const getRouteState = (route: ContractRoute) => {
  if (!route.enabled) return 'Planned off'
  if (!route.running || !route.ship?.running) return 'Unavailable'

  return `${route.source === 'planned' ? 'Planned' : 'Synced'} · ${
    route.importedPerProductionCycle === null ? 'Demand-balanced' : 'Fixed'
  }`
}

const RouteCard: React.FC<{
  exportedResourceId: ContractResult['contract']['exchange']['exported']['resourceId']
  importedResourceId: ContractResult['contract']['exchange']['imported']['resourceId']
  result: ContractRouteResult
}> = ({ exportedResourceId, importedResourceId, result }) => {
  const { route } = result
  const exportedResource = resources[exportedResourceId]
  const importedResource = resources[importedResourceId]
  const fuelResource = resources[route.shipping.fuelResourceId]
  const routeEnabled = route.enabled && route.running
  const routeWorkers = route.cargoModules.reduce(
    (total, module) => total + (routeEnabled && module.running ? module.workers : 0),
    0,
  ) + (routeEnabled && route.ship?.running ? route.ship.workers : 0)
  const zoneNames = route.zones.flatMap(zone => zone.name ? [zone.name] : [])

  return (
    <section className="space-y-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{route.depotName}</h4>
          <p className="text-xs text-muted-foreground">
            {route.depotPrototypeId}{zoneNames.length > 0 ? ` · ${zoneNames.join(', ')}` : ''}
          </p>
        </div>
        <span className="text-xs font-medium text-foreground">{getRouteState(route)}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-sm font-semibold text-foreground">
        <span>{formatQuantity(result.exported)} {exportedResource.name}</span>
        <span className="text-muted-foreground" aria-hidden="true">→</span>
        <span>{formatQuantity(result.imported)} {importedResource.name}</span>
        <span className="text-xs font-normal text-muted-foreground">/ month</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <dl className="space-y-1">
          {route.ship && (
            <DataRow
              label={`1× ${route.ship.name}`}
              value={`${routeEnabled && route.ship.running ? route.ship.workers : 0} workers`}
            />
          )}
          {route.cargoModules.map(module => {
            const configuration = module.resourceId && module.direction
              ? `${resources[module.resourceId].name} ${module.direction}`
              : 'Unconfigured'

            return (
              <DataRow
                key={module.entityId ?? module.slot}
                label={`1× ${module.buildingName} · ${configuration}`}
                value={`${routeEnabled && module.running ? module.workers : 0} workers`}
              />
            )
          })}
          <DataRow label="Route workers" value={routeWorkers.toLocaleString()} />
        </dl>

        <dl className="space-y-1">
          <DataRow
            label="Ship fuel"
            value={`${formatQuantity(result.fuelPerProductionCycle)} ${fuelResource.name} / month`}
          />
          <DataRow
            label="Max import"
            value={result.maxImportedPerProductionCycle === null
              ? 'Not measured'
              : `${formatQuantity(result.maxImportedPerProductionCycle)} / month`}
          />
        </dl>
      </div>
    </section>
  )
}

const ActiveContractCard: React.FC<{ result: ContractResult }> = ({ result }) => {
  const { contract, exported, imported } = result
  const exportedResource = resources[contract.exchange.exported.resourceId]
  const importedResource = resources[contract.exchange.imported.resourceId]
  const workerBreakdown = calculateContractWorkerBreakdown(contract)
  const variableUnityPerCycle = imported * contract.unity.per100Imported / 100
  const recurringUnityPerCycle = contract.unity.perProductionCycle + variableUnityPerCycle

  return (
    <Card.Root>
      <Card.Content className="space-y-4">
        <Card.Header>
          <div className="space-y-1">
            <Card.Title>{contract.name}</Card.Title>
            <ContractTerms contract={contract} />
          </div>
          <Card.Action>
            <span className="text-xs font-medium text-foreground">Established</span>
          </Card.Action>
        </Card.Header>

        <div className="rounded-lg bg-surface-inset p-3 inset-shadow-surface">
          <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-base font-semibold text-foreground">
            <span>{formatQuantity(exported)} {exportedResource.name}</span>
            <span className="text-muted-foreground" aria-hidden="true">→</span>
            <span>{formatQuantity(imported)} {importedResource.name}</span>
            <span className="text-xs font-normal text-muted-foreground">/ month</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatQuantity(recurringUnityPerCycle)} Unity/month
            {' · '}
            {workerBreakdown.total.toLocaleString()} workers
          </p>
        </div>

        {result.routes.length > 0 ? (
          <div className="space-y-2">
            {result.routes.map(route => (
              <RouteCard
                key={route.route.id}
                exportedResourceId={contract.exchange.exported.resourceId}
                importedResourceId={contract.exchange.imported.resourceId}
                result={route}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No Cargo Depot assigned.
          </div>
        )}
      </Card.Content>
    </Card.Root>
  )
}

const InactiveContractCard: React.FC<{ contract: Contract }> = ({ contract }) => (
  <Card.Root>
    <Card.Content className="space-y-3">
      <Card.Header>
        <div className="space-y-1">
          <Card.Title>{contract.name}</Card.Title>
          <Card.Description>
            {contract.exchange.exported.quantity.toLocaleString()} for {contract.exchange.imported.quantity.toLocaleString()}
          </Card.Description>
        </div>
        <Card.Action>
          <span className="text-xs text-muted-foreground">Not established</span>
        </Card.Action>
      </Card.Header>
      <ContractTerms contract={contract} />
    </Card.Content>
  </Card.Root>
)

export const ContractsView: React.FC<Props> = ({ contracts, issues, results }) => {
  const activeIdSet = new Set(results.map(result => result.contract.id))
  const inactiveContracts = contracts
    .filter(contract => !activeIdSet.has(contract.id))
    .toSorted((a, b) => {
      const importedComparison = resources[a.exchange.imported.resourceId].name
        .localeCompare(resources[b.exchange.imported.resourceId].name)

      return importedComparison || a.name.localeCompare(b.name)
    })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Contracts</h2>
        <p className="text-sm text-muted-foreground">
          Established contracts and their assigned Cargo Depots.
        </p>
      </div>

      {issues.length > 0 && (
        <section className="space-y-2" aria-labelledby="contract-issues-heading">
          <h3 id="contract-issues-heading" className="text-sm font-semibold text-foreground">
            Needs attention · {issues.length}
          </h3>
          <div className="space-y-1 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
            {issues.map((issue, index) => (
              <p key={`${issue.gameId}-${index}`} className="text-sm text-muted-foreground">
                {issue.message}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="established-contracts-heading">
        <h3 id="established-contracts-heading" className="text-sm font-semibold text-foreground">
          Established · {results.length}
        </h3>
        {results.length > 0 ? (
          <div className="grid gap-3">
            {results.map(result => (
              <ActiveContractCard key={result.contract.gameId} result={result} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No established contracts.
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="available-contracts-heading">
        <h3 id="available-contracts-heading" className="text-sm font-semibold text-foreground">
          Available · {inactiveContracts.length}
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {inactiveContracts.map(contract => (
            <InactiveContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      </section>
    </div>
  )
}
