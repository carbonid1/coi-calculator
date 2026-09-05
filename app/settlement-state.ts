export interface SyncedSettlement {
  housing: { entityId: number; population: number; capacity: number }[]
  population: number
  capacity: number
  foodProductIds: string[]
  serviceIds: string[]
}

export interface SyncedSettlementState {
  population: number
  settlements: SyncedSettlement[]
  /** Last monthly settlement/health records, including signed penalties. */
  unity: { id: string; name: string; amount: number }[] | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)
const isCount = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= 0
)
const isStrings = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0)
  && new Set(value).size === value.length
)

export const isSyncedSettlementState = (value: unknown): value is SyncedSettlementState => {
  if (!isRecord(value) || !isCount(value.population) || !Array.isArray(value.settlements)) return false
  const housingIds = new Set<number>()
  let housedPopulation = 0

  for (const settlement of value.settlements) {
    if (!isRecord(settlement) || !isCount(settlement.population) || !isCount(settlement.capacity)
      || settlement.population > settlement.capacity || !Array.isArray(settlement.housing)
      || !isStrings(settlement.foodProductIds) || !isStrings(settlement.serviceIds)) return false
    housedPopulation += settlement.population
    for (const house of settlement.housing) {
      if (!isRecord(house) || !isCount(house.entityId) || housingIds.has(house.entityId)
        || !isCount(house.population) || !isCount(house.capacity)
        || house.population > house.capacity) return false
      housingIds.add(house.entityId)
    }
  }
  if (housedPopulation > value.population) return false
  if (value.unity === null) return true
  return Array.isArray(value.unity) && value.unity.every(item => (
    isRecord(item) && typeof item.id === 'string' && item.id.length > 0
    && typeof item.name === 'string' && item.name.length > 0
    && typeof item.amount === 'number' && Number.isFinite(item.amount)
  )) && new Set(value.unity.map(item => item.id)).size === value.unity.length
}
