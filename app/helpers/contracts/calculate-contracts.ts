import {
  type ActiveContract,
  cargoShipping,
  type ContractRoute,
} from '../../db/contracts'
import { type ResourceId, resources } from '../../db/resources'
import { type ResourceFlow } from '../calculate/calculate'

export interface ContractRouteResult {
  route: ContractRoute
  exported: number
  imported: number
  requestedImported: number
  maxImportedPerProductionCycle: number | null
  fuelPerProductionCycle: number
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
  route.enabled && route.running && Boolean(route.ship?.running)
)

const calculateContractRouteShipping = (
  contract: ActiveContract,
  route: ContractRoute,
  shipsFuelUseMultiplier = 1,
  contractsProfitMultiplier = 1,
) => {
  if (!isRouteOperating(route)) {
    return { importedPerTrip: 0, maxImportedPerProductionCycle: 0, fuelPerTrip: 0 }
  }

  const installedModuleCount = route.cargoModules.length
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
  const fallbackCapacityMultiplier = route.depotSize === 6 || route.depotSize === 8
    ? cargoShipping.capacityMultiplierByShipSize[route.depotSize]
    : 1
  const fuelResourceMultiplier = route.shipping.fuelResourceId === 'hydrogen'
    ? cargoShipping.hydrogenDieselEnergyRatio
    : 1
  const fuelPerJourneyBase = scaleQuantityLikeGame(
    cargoShipping.fuelPerJourneyBase,
    fuelResourceMultiplier,
  )
  const fuelPerJourneyPerModule = scaleQuantityLikeGame(
    cargoShipping.fuelPerJourneyPerModule,
    fuelResourceMultiplier,
  )
  const saveFuelMultiplier = route.shipping.saveFuel
    ? cargoShipping.saveFuelMultiplier
    : 1
  const loadedShipFuel = fuelPerJourneyBase + scaleQuantityLikeGame(
    fuelPerJourneyPerModule * installedModuleCount,
    fallbackCapacityMultiplier,
  )
  const researchedFuel = scaleQuantityLikeGame(loadedShipFuel, shipsFuelUseMultiplier)
  const fallbackFuelPerTrip = scaleQuantityLikeGame(researchedFuel, saveFuelMultiplier)
  const fuelPerTrip = route.shipping.fuelPerTrip ?? fallbackFuelPerTrip
  const roundTripDuration = route.shipping.roundTripDurationProductionCycles
  const maxImportedPerProductionCycle = roundTripDuration !== null
    && roundTripDuration > 0
    ? importedPerTrip / roundTripDuration
    : null

  return { importedPerTrip, maxImportedPerProductionCycle, fuelPerTrip }
}

export const calculateContractWorkerBreakdown = (contract: ActiveContract) => {
  const cargoModuleWorkers = contract.routes.reduce(
    (contractTotal, route) => contractTotal + (
      route.enabled && route.running
        ? route.cargoModules.reduce(
            (routeTotal, module) => routeTotal + (module.running ? module.workers : 0),
            0,
          )
        : 0
    ),
    0,
  )
  const cargoShipWorkers = contract.routes.reduce(
    (total, route) => total + (
      route.enabled && route.running && route.ship?.running ? route.ship.workers : 0
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
  shipsFuelUseMultiplier = 1,
  demandBalancedImports: ReadonlyMap<string, number> = new Map(),
  contractsProfitMultiplier = 1,
): { flows: ResourceFlow[]; contractResults: ContractResult[] } => {
  const combined = new Map<ResourceId, { consumed: number; produced: number; recyclableSourceValueProduced: number }>(
    resourceFlows.map((flow) => [flow.resourceId, {
      consumed: flow.consumed,
      produced: flow.produced,
      recyclableSourceValueProduced: flow.recyclableSourceValueProduced ?? 0,
    }]),
  )
  const contractResults: ContractResult[] = []

  for (const contract of contracts) {
    const importedFlow = getFlow(combined, contract.exchange.imported.resourceId)
    const requiredImported = Math.max(0, importedFlow.consumed - importedFlow.produced)
    let demandRemaining = demandBalancedImports.get(contract.id) ?? requiredImported
    const effectiveImportedQuantity = scaleQuantityLikeGame(
      contract.exchange.imported.quantity,
      Math.max(0.01, contractsProfitMultiplier),
    )
    const routeResults = new Map<string, ContractRouteResult>()

    const applyRoute = (route: ContractRoute, requestedImported: number) => {
      const shipping = calculateContractRouteShipping(
        contract,
        route,
        shipsFuelUseMultiplier,
        contractsProfitMultiplier,
      )
      const imported = shipping.maxImportedPerProductionCycle === null
        ? requestedImported
        : Math.min(requestedImported, shipping.maxImportedPerProductionCycle)
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
      })
      return imported
    }

    for (const route of contract.routes) {
      if (route.importedPerProductionCycle === null) continue

      demandRemaining = Math.max(
        0,
        demandRemaining - applyRoute(route, route.importedPerProductionCycle),
      )
    }
    for (const route of contract.routes) {
      if (route.importedPerProductionCycle !== null) continue

      demandRemaining = Math.max(0, demandRemaining - applyRoute(route, demandRemaining))
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

    importedFlow.produced += imported
    getFlow(combined, contract.exchange.exported.resourceId).consumed += exported

    contractResults.push({
      contract,
      routes,
      exported,
      imported,
      requestedImported,
      requiredImported,
      maxImportedPerProductionCycle,
      fuelPerProductionCycle,
    })
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
