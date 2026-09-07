import { type ContractRoute } from '../../db/contracts'

export type ContractRouteBlocker = 'disabled' | 'no-ship' | 'paused'

/** Steady throughput follows configured availability, not momentary cargo state. */
export const getContractRouteBlocker = (route: ContractRoute): ContractRouteBlocker | null => {
  if (!route.enabled) return 'disabled'
  if (!route.ship) return 'no-ship'
  if (!route.running || !route.ship.running) return 'paused'

  return null
}
