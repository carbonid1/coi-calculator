export interface WaterNetwork {
  pumpIds: number[]
  activePumpIds: number[]
  aquiferIds: string[]
  consumerIds: number[]
  hasOtherSources: boolean
  buffers: { entityId: number; kind: 'tank' | 'pipe'; quantity: number; capacity: number }[]
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const ids = (value: unknown): value is number[] => Array.isArray(value) && value.length <= 100000
  && value.every(id => amount(id) && Number.isSafeInteger(id)) && new Set(value).size === value.length
const subset = (children: number[], parents: number[]) => children.every(id => parents.includes(id))

export const isWaterNetworks = (value: unknown): value is WaterNetwork[] => {
  if (!Array.isArray(value) || value.length > 10000) return false
  const pumps = new Set<number>(), buffers = new Set<number>()

  for (const network of value) {
    if (!record(network) || !ids(network.pumpIds) || network.pumpIds.length === 0
      || !ids(network.activePumpIds) || !subset(network.activePumpIds, network.pumpIds)
      || !ids(network.consumerIds) || typeof network.hasOtherSources !== 'boolean'
      || !Array.isArray(network.aquiferIds) || network.aquiferIds.length === 0
      || !network.aquiferIds.every(id => typeof id === 'string' && id.length > 0)
      || new Set(network.aquiferIds).size !== network.aquiferIds.length
      || !Array.isArray(network.buffers) || network.buffers.length > 100000) return false
    for (const id of network.pumpIds) { if (pumps.has(id)) return false; pumps.add(id) }
    for (const buffer of network.buffers) {
      if (!record(buffer) || !amount(buffer.entityId) || !Number.isSafeInteger(buffer.entityId)
        || (buffer.kind !== 'tank' && buffer.kind !== 'pipe') || !amount(buffer.quantity)
        || !amount(buffer.capacity) || buffer.quantity > buffer.capacity || buffers.has(buffer.entityId)) return false
      buffers.add(buffer.entityId)
    }
  }
  return true
}
