import { type Contract } from '../../db/contracts'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'
import { type ContractRouteResult } from './calculate-contracts'

/** Rated local line ceilings are warnings; they do not replace the shipping forecast. */
export const getContractConnectionLimits = (result: ContractRouteResult, contract: Contract) => (
  (result.route.operation?.connections ?? []).flatMap(connection => {
    const resourceId = resolveSyncedResourceId(connection.product)

    const expected = connection.direction === 'import' ? contract.exchange.imported.resourceId : contract.exchange.exported.resourceId

    if (!resourceId || resourceId !== expected) return []
    const planned = connection.direction === 'import' ? result.imported : result.exported

    return [{
      resourceId,
      direction: connection.direction,
      capacity: connection.capacityPerCycle,
      unmeasuredReason: connection.unmeasuredReason,
      planned,
      limited: connection.capacityPerCycle !== null && planned > connection.capacityPerCycle + 0.001,
    }]
  })
)
