import { type ResourceId } from '../../db/resources'
import { type ContractResult } from './calculate-contracts'
import { getContractRouteBlocker, type ContractRouteBlocker } from './contract-route-status'

export type ContractImportLimit = ContractRouteBlocker | 'voyage-unmeasured' | 'capacity'

/** Material exchange and shipping costs, with the route that caused each flow. */
export interface ContractResourceFlow {
  contractId: string
  contractName: string
  routeId: string
  routeName: string
  kind: 'import' | 'export' | 'fuel'
  resourceId: ResourceId
  quantity: number
  /** Import request before route capacity/availability limits. */
  requestedQuantity: number
  demandBalanced: boolean
  importLimit?: ContractImportLimit
}

export const getContractResourceFlows = (results: readonly ContractResult[]): ContractResourceFlow[] => (
  results.flatMap(result => result.routes.flatMap(route => {
    let importLimit: ContractImportLimit | undefined

    if (route.requestedImported - route.imported > 0.001) {
      importLimit = getContractRouteBlocker(route.route)
        ?? (route.maxImportedPerProductionCycle === null ? 'voyage-unmeasured' : 'capacity')
    }
    const origin = {
      contractId: result.contract.id,
      contractName: result.contract.name,
      routeId: route.route.id,
      routeName: route.route.depotName,
      demandBalanced: route.route.importedPerProductionCycle === null,
    }

    return [
      { ...origin, kind: 'import' as const, resourceId: result.contract.exchange.imported.resourceId,
        quantity: route.imported, requestedQuantity: route.requestedImported, ...(importLimit ? { importLimit } : {}) },
      { ...origin, kind: 'export' as const, resourceId: result.contract.exchange.exported.resourceId,
        quantity: route.exported, requestedQuantity: route.exported },
      { ...origin, kind: 'fuel' as const, resourceId: route.route.shipping.fuelResourceId,
        quantity: route.fuelPerProductionCycle, requestedQuantity: route.fuelPerProductionCycle },
    ]
  }))
)
