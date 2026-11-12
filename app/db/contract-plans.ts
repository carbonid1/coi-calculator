import { type GameStateSnapshot, type SyncedContractRoute } from '../game-state'

interface ContractRoutePlan {
  /** False forecasts this route as unavailable without changing the game. */
  enabled?: boolean
  /** Fixed import allocation, or null/omitted to follow the remaining factory demand. */
  importedPerProductionCycle?: number | null
}

export type ContractRoutePlans = Readonly<Partial<Record<number, ContractRoutePlan>>>

/** Calculator-owned overrides for synced cargo-depot contract routes. */
export const contractRoutePlans: ContractRoutePlans = {}

export const surplusExportContractIds: ReadonlySet<string> = new Set()

const ironOreContractId = 'Contract_Product_IronOre_For_Product_VehicleParts2'
const ironOreDepotId = 382801

/** Reuse the save's idle iron ore depot and the native contract terms. */
export const planIronOreContract = ({ contracts, planningDefinitions, world }: GameStateSnapshot) => {
  const gameId = ironOreContractId
  const established = contracts.established.find(contract => contract.gameId === gameId)
  const terms = established ?? planningDefinitions.factory.contracts.find(contract => contract.gameId === gameId)
  const assigned = contracts.routes.filter(route => route.contractGameId === gameId)
  const route = assigned.find(route => route.depotEntityId === ironOreDepotId)
    ?? assigned[0] ?? world.routes.find(route => route.depotEntityId === ironOreDepotId)
  const issues = []

  if (!terms) return null
  if (!established) issues.push({ gameId, message: 'Establish the Vehicle Parts II → Iron Ore contract.' })
  if (!route?.ship) {
    issues.push({ gameId, message: 'Assign a Cargo Depot and Cargo Ship to the Iron Ore contract.' })
    return { contracts, world, issues, routePlans: contractRoutePlans }
  }

  const cargoDirection = (productId: string | undefined) => {
    if (productId === terms.exportedProduct.productId) return 'export' as const
    if (productId === terms.importedProduct.productId) return 'import' as const
    return null
  }
  const cargoChanges = route.modules.flatMap(module => {
    const direction = cargoDirection(module.selectedProduct?.productId)

    return direction && (!module.running || module.direction !== direction)
      ? [{ module, direction }]
      : []
  })
  const modules = route.modules.map(module => {
    const change = cargoChanges.find(change => change.module.entityId === module.entityId)

    return change ? { ...module, direction: change.direction, running: true } : module
  })

  if (!modules.some(module => module.direction === 'export' && cargoDirection(module.selectedProduct?.productId) === 'export')
    || !modules.some(module => module.direction === 'import' && cargoDirection(module.selectedProduct?.productId) === 'import')) {
    issues.push({ gameId, message: 'Configure cargo modules for Vehicle Parts II export and Iron Ore import.' })
    return { contracts, world, issues, routePlans: contractRoutePlans }
  }

  if (!route.contractGameId) issues.push({ gameId, message: 'Assign the Iron Ore contract to its Cargo Depot.' })
  if (cargoChanges.some(({ module, direction }) => direction === 'export' && module.direction !== direction)) {
    issues.push({ gameId, message: 'Set the Vehicle Parts II modules to export and connect their supply belt.' })
  }
  if (cargoChanges.some(({ module, direction }) => direction === 'import' && module.direction !== direction)) {
    issues.push({ gameId, message: 'Set the Iron Ore modules to import and connect their output belt.' })
  }
  if (!route.running) issues.push({ gameId, message: 'Unpause the Iron Ore Cargo Depot.' })
  if (!route.ship.running) issues.push({ gameId, message: 'Unpause the Iron Ore Cargo Ship.' })
  const pausedModules = cargoChanges.filter(({ module }) => !module.running).length

  if (pausedModules > 0) issues.push({ gameId,
    message: `Unpause ${pausedModules} cargo ${pausedModules === 1 ? 'module' : 'modules'} for the Iron Ore contract.`,
  })
  if (issues.length === 0) return null

  const connections = [
    { product: terms.exportedProduct, direction: 'export' },
    { product: terms.importedProduct, direction: 'import' },
  ] as const
  const projectedRoute: SyncedContractRoute = {
    ...route,
    contractGameId: gameId,
    running: true,
    modules,
    ship: { ...route.ship, running: true },
    operation: route.operation && {
      ...route.operation,
      connections: connections.map(({ product, direction }) => {
        const measured = route.operation?.connections?.find(connection => (
          connection.product.productId === product.productId && connection.direction === direction
        ))

        // The Bridge gives paused modules zero capacity. Measure again once
        // this cargo group is running in its planned direction.
        if (cargoChanges.some(change => change.direction === direction)) {
          return { product, direction, capacityPerCycle: null, unmeasuredReason: 'planned-configuration' }
        }
        return measured
      }).filter(connection => connection !== undefined),
    },
  }
  const depotId = route.depotEntityId

  return {
    contracts: {
      established: established ? contracts.established : [...contracts.established, terms],
      routes: [...contracts.routes.filter(candidate => candidate.depotEntityId !== depotId), projectedRoute],
    },
    world: { ...world, routes: world.routes.filter(candidate => candidate.depotEntityId !== depotId) },
    issues,
    routePlans: { ...contractRoutePlans, [depotId]: { enabled: true } },
  }
}
