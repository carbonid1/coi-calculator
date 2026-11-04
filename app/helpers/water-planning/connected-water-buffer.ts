import { type GameStateSnapshot } from '../../game-state'

/** Credit only a complete, exclusive network whose actual pumps match the plan. */
export const getConnectedWaterBuffer = (snapshot: GameStateSnapshot, aquiferId: string, projectedPumps: number) => {
  const pumps = snapshot.machines.filter(pump => pump.running && pump.aquifer?.id === aquiferId).map(pump => pump.entityId)

  if (pumps.length === 0 || projectedPumps !== pumps.length) return undefined
  const network = snapshot.groundwater.networks?.find(network => !network.hasOtherSources
    && network.consumerIds.length > 0 && network.aquiferIds.length === 1 && network.aquiferIds[0] === aquiferId
    && network.activePumpIds.length === pumps.length && pumps.every(id => network.activePumpIds.includes(id)))

  if (!network) return undefined
  const quantity = network.buffers.reduce((total, buffer) => total + buffer.quantity, 0)
  const capacity = network.buffers.reduce((total, buffer) => total + buffer.capacity, 0)

  return capacity > 0 ? { quantity, capacity } : undefined
}
