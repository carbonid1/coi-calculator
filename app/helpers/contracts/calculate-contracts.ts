import {
  type ActiveContract,
  type ContractRoute,
} from '../../db/contracts'
import { type ResourceId, resources } from '../../db/resources'
import { type ResourceFlow } from '../calculate/calculate'
import { getContractResourceFlows } from './contract-resource-flows'
import { getContractRouteBlocker } from './contract-route-status'

export interface ContractRouteResult {
  route: ContractRoute
  exported: number
  imported: number
  requestedImported: number
  maxImportedPerProductionCycle: number | null
  fuelPerProductionCycle: number
  fuelUnavailable?: true
}

export interface ContractResult {
  contract: ActiveContract
  routes: ContractRouteResult[]
  exported: number
  imported: number
  requestedImported: number
  requiredImported: number
  maxImportedPerProductionCycle: number | null
  fuelPerProductionCycle: number
}

/** v0.8.7 Quantity.ScaledBy(Percent) rounds to the nearest whole unit. */
const scaleQuantityLikeGame = (quantity: number, multiplier: number) => (
  Math.round(quantity * multiplier)
)

const isRouteOperating = (route: ContractRoute) => (
  getContractRouteBlocker(route) === null
)

const calculateContractRouteShipping = (
  contract: ActiveContract,
  route: ContractRoute,
  contractsProfitMultiplier = 1,
) => {
  if (!isRouteOperating(route)) {
    return { importedPerTrip: 0, maxImportedPerProductionCycle: 0, fuelPerTrip: 0 }
  }
  if (route.shipping.fuelPerTrip === null) {
    return { importedPerTrip: 0, maxImportedPerProductionCycle: null, fuelPerTrip: 0 }
  }

  const importCargoCapacity = route.cargoModules.reduce(
    (total, module) => total + (
      module.running &&
      module.direction === 'import' &&
      module.resourceId === contract.exchange.imported.resourceId
        ? module.onboardCapacity
        : 0
    ),
    0,
  )
  const exportCargoCapacity = route.cargoModules.reduce(
    (total, module) => total + (
      module.running &&
      module.direction === 'export' &&
      module.resourceId === contract.exchange.exported.resourceId
        ? module.onboardCapacity
        : 0
    ),
    0,
  )
  const effectiveImportedQuantity = scaleQuantityLikeGame(
    contract.exchange.imported.quantity,
    Math.max(0.01, contractsProfitMultiplier),
  )
  const exchangeLimitedImportedPerTrip = contract.exchange.exported.quantity > 0
    ? exportCargoCapacity
      * effectiveImportedQuantity
      / contract.exchange.exported.quantity
    : 0
  const importedPerTrip = Math.min(importCargoCapacity, exchangeLimitedImportedPerTrip)
  const fuelPerTrip = route.shipping.fuelPerTrip
  const transferDuration = route.operation ? Math.max(0, ...route.cargoModules.map(module => {
    const operation = route.operation?.modules.find(item => item.entityId === module.entityId)

    return operation && operation.transferPerCycle > 0 && module.running
      ? module.onboardCapacity / operation.transferPerCycle : 0
  })) : 0
  const roundTripDuration = route.shipping.roundTripDurationProductionCycles === null ? null
    : route.shipping.roundTripDurationProductionCycles + transferDuration
  const maxImportedPerProductionCycle = roundTripDuration !== null
    && roundTripDuration > 0
    ? importedPerTrip / roundTripDuration
    : null

  return { importedPerTrip, maxImportedPerProductionCycle, fuelPerTrip }
}

export const calculateContractWorkerBreakdown = (contract: ActiveContract) => {
  const cargoModuleWorkers = contract.routes.reduce(
    (contractTotal, route) => contractTotal + (
      route.enabled && (route.operation || route.running)
        ? route.cargoModules.reduce(
            (routeTotal, module) => {
              // Enabled equipment needs its native crew even before assignment catches up.
              const required = route.operation?.modules.find(item => item.entityId === module.entityId)?.workersNeeded ?? module.workers
              const workers = route.running && module.running ? required : 0

              return routeTotal + (route.operation ? Math.max(module.workers, workers) : workers)
            },
            0,
          )
        : 0
    ),
    0,
  )
  const cargoShipWorkers = contract.routes.reduce(
    (total, route) => total + (
      route.enabled && (route.operation || (route.running && route.ship?.running))
        ? Math.max(route.ship?.workers ?? 0, route.running && route.ship?.running
            ? route.operation?.ship?.workersNeeded ?? route.ship.workers : 0)
        : 0
    ),
    0,
  )

  return {
    cargoModuleWorkers,
    cargoShipWorkers,
    total: cargoShipWorkers + cargoModuleWorkers,
  }
}

export const calculateContractWorkers = (activeContracts: readonly ActiveContract[]) => (
  activeContracts.reduce(
    (total, contract) => total + calculateContractWorkerBreakdown(contract).total,
    0,
  )
)

const getFlow = (
  flows: Map<ResourceId, { consumed: number; produced: number; recyclableSourceValueProduced: number }>,
  resourceId: ResourceId,
) => {
  const flow = flows.get(resourceId) ?? { consumed: 0, produced: 0, recyclableSourceValueProduced: 0 }

  flows.set(resourceId, flow)
  return flow
}

export const applyContracts = (
  resourceFlows: ResourceFlow[],
  contracts: readonly ActiveContract[],
  demandBalancedImports: ReadonlyMap<string, number> = new Map(),
  contractsProfitMultiplier = 1,
  /** Factory feedback has already propagated these payment and shipping loads. */
  costsAlreadyIncluded = false,
): { flows: ResourceFlow[]; contractResults: ContractResult[] } => {
  const combined = new Map<ResourceId, { consumed: number; produced: number; recyclableSourceValueProduced: number }>(
    resourceFlows.map((flow) => [flow.resourceId, {
      consumed: flow.consumed,
      produced: flow.produced,
      recyclableSourceValueProduced: flow.recyclableSourceValueProduced ?? 0,
    }]),
  )
  const contractResults: ContractResult[] = []
  const shippingByRoute = new Map<ContractRoute, ReturnType<typeof calculateContractRouteShipping>>()
  const getRouteShipping = (contract: ActiveContract, route: ContractRoute) => {
    const shipping = shippingByRoute.get(route) ?? calculateContractRouteShipping(
      contract, route, contractsProfitMultiplier,
    )

    shippingByRoute.set(route, shipping)
    return shipping
  }
  const getRouteImport = (contract: ActiveContract, route: ContractRoute, requested: number) => {
    const shipping = getRouteShipping(contract, route)

    if (shipping.maxImportedPerProductionCycle === null) return route.operation || route.shipping.fuelPerTrip === null ? 0 : requested

    return Math.min(requested, shipping.maxImportedPerProductionCycle)
  }
  const getRouteTarget = (contract: ActiveContract, route: ContractRoute) => (
    contract.fullThrottle
      ? getRouteShipping(contract, route).maxImportedPerProductionCycle ?? 0
      : route.importedPerProductionCycle
  )
  const fixedImportsByContract = new Map(contracts.map(contract => [
    contract,
    contract.routes.reduce((total, route) => {
      const target = getRouteTarget(contract, route)

      return total + (target === null ? 0 : getRouteImport(contract, route, target))
    }, 0),
  ]))
  const pendingFixedImports = new Map<ResourceId, number>()

  for (const [contract, quantity] of fixedImportsByContract) {
    const resourceId = contract.exchange.imported.resourceId

    pendingFixedImports.set(resourceId, (pendingFixedImports.get(resourceId) ?? 0) + quantity)
  }

  for (const contract of contracts) {
    const resourceId = contract.exchange.imported.resourceId
    const importedFlow = getFlow(combined, resourceId)
    const ownFixedImports = fixedImportsByContract.get(contract) ?? 0
    // Reserve other contracts' fixed deliveries before filling the remaining demand.
    const requiredImported = Math.max(0, importedFlow.consumed - importedFlow.produced
      - (pendingFixedImports.get(resourceId) ?? 0) + ownFixedImports)
    const demand = { remaining: demandBalancedImports.get(contract.id) ?? requiredImported }
    const effectiveImportedQuantity = scaleQuantityLikeGame(
      contract.exchange.imported.quantity,
      Math.max(0.01, contractsProfitMultiplier),
    )
    const routeResults = new Map<string, ContractRouteResult>()

    const applyRoute = (route: ContractRoute, requestedImported: number) => {
      const shipping = getRouteShipping(contract, route)
      const imported = getRouteImport(contract, route, requestedImported)
      const exported = effectiveImportedQuantity > 0
        ? imported * contract.exchange.exported.quantity / effectiveImportedQuantity
        : 0
      const fuelPerProductionCycle = shipping.importedPerTrip > 0
        ? imported / shipping.importedPerTrip * shipping.fuelPerTrip
        : 0

      routeResults.set(route.id, {
        route,
        exported,
        imported,
        requestedImported,
        maxImportedPerProductionCycle: shipping.maxImportedPerProductionCycle,
        fuelPerProductionCycle,
        ...(isRouteOperating(route) && shipping.maxImportedPerProductionCycle === null
          ? { fuelUnavailable: true as const } : {}),
      })
      return imported
    }

    for (const route of contract.routes) {
      const target = getRouteTarget(contract, route)

      if (target === null) continue

      demand.remaining = Math.max(
        0,
        demand.remaining - applyRoute(route, target),
      )
    }
    for (const route of contract.routes) {
      if (getRouteTarget(contract, route) !== null) continue

      demand.remaining = Math.max(0, demand.remaining - applyRoute(route, demand.remaining))
    }

    const routes = contract.routes.flatMap(route => {
      const result = routeResults.get(route.id)

      return result ? [result] : []
    })
    const imported = routes.reduce((total, route) => total + route.imported, 0)
    const exported = routes.reduce((total, route) => total + route.exported, 0)
    const requestedImported = routes.reduce(
      (total, route) => total + route.requestedImported,
      0,
    )
    const fuelPerProductionCycle = routes.reduce(
      (total, route) => total + route.fuelPerProductionCycle,
      0,
    )
    const routeCaps = routes.map(route => route.maxImportedPerProductionCycle)
    const maxImportedPerProductionCycle = routeCaps.some(capacity => capacity === null)
      ? null
      : routeCaps.reduce<number>(
          (total, capacity) => total + (capacity ?? 0),
          0,
        )

    const result: ContractResult = {
      contract,
      routes,
      exported,
      imported,
      requestedImported,
      requiredImported,
      maxImportedPerProductionCycle,
      fuelPerProductionCycle,
    }

    for (const flow of getContractResourceFlows([result])) {
      if (costsAlreadyIncluded && flow.kind !== 'import') continue

      const total = getFlow(combined, flow.resourceId)

      if (flow.kind === 'import') total.produced += flow.quantity
      else total.consumed += flow.quantity
    }
    contractResults.push(result)
    pendingFixedImports.set(resourceId, (pendingFixedImports.get(resourceId) ?? 0) - ownFixedImports)
  }

  const flows: ResourceFlow[] = []

  for (const [resourceId, { consumed, produced, recyclableSourceValueProduced }] of combined) {
    const net = produced - consumed
    const recyclingMetadata = resourceId === 'recyclables'
      ? { recyclableSourceValueProduced }
      : {}

    flows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net, ...recyclingMetadata })
  }

  return { flows, contractResults }
}

/** Re-size dynamic routes from demand, then spend only unclaimed payment goods. */
export const balanceContractExports = (
  resourceFlows: ResourceFlow[],
  contracts: readonly ActiveContract[],
  previousResults: readonly ContractResult[],
  contractsProfitMultiplier = 1,
  paymentAvailability: ReadonlyMap<ResourceId, number> = new Map(),
) => {
  const importTargets = new Map<string, number>()
  const calculatePlan = () => applyContracts(
    resourceFlows, contracts, importTargets,
    contractsProfitMultiplier, true,
  )
  const allocation = { plan: calculatePlan() }
  const previousCosts = getContractResourceFlows(previousResults)
    .filter(flow => flow.kind !== 'import')

  for (const contract of contracts) {
    if (contract.fullThrottle || !contract.exportSurplus || !contract.routes.some(route => route.importedPerProductionCycle === null)) continue

    const paymentId = contract.exchange.exported.resourceId
    // Planning flows contain last iteration's costs. Replace those with the
    // new plan's costs, reserving every contract's required payment before
    // allowing any surplus export. Recompute after each allocation so two
    // contracts cannot spend the same surplus.
    const currentCosts = getContractResourceFlows(allocation.plan.contractResults)
    const reserved = currentCosts.reduce((total, flow) => total + (
      flow.kind !== 'import' && flow.resourceId === paymentId ? flow.quantity : 0
    ), 0)
    const available = Math.min(
      (allocation.plan.flows.find(flow => flow.resourceId === paymentId)?.net ?? 0)
        + previousCosts.reduce((total, flow) => total + (flow.resourceId === paymentId ? flow.quantity : 0), 0),
      paymentAvailability.get(paymentId) ?? Infinity,
    ) - reserved
    const result = allocation.plan.contractResults.find(result => result.contract.id === contract.id)
    const effectiveImportedQuantity = scaleQuantityLikeGame(
      contract.exchange.imported.quantity, Math.max(0.01, contractsProfitMultiplier),
    )

    if (!result || available <= 0 || effectiveImportedQuantity <= 0 || contract.exchange.exported.quantity <= 0) continue

    const additionalImports = available * effectiveImportedQuantity / contract.exchange.exported.quantity

    importTargets.set(contract.id, Math.max(result.requiredImported, result.imported + additionalImports))
    allocation.plan = calculatePlan()
  }

  return allocation.plan
}
