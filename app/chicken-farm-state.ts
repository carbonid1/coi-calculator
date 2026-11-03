export interface ChickenFarmDefinition {
  capacity: number
  countStep: number
  feedPerChicken: number
  waterPerChicken: number
  eggsPerChicken: number
  birthsPer100Chickens: number
  carcassPerSlaughteredChicken: number
}

const amount = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
)

const record = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

export const isChickenFarmDefinition = (value: unknown): value is ChickenFarmDefinition => {
  if (!record(value)) return false
  const data = value

  return amount(data.capacity) && Number.isSafeInteger(data.capacity) && data.capacity > 0
    && amount(data.countStep) && Number.isSafeInteger(data.countStep)
    && data.countStep > 0 && data.countStep <= data.capacity
    && amount(data.feedPerChicken) && amount(data.waterPerChicken) && amount(data.eggsPerChicken)
    && amount(data.birthsPer100Chickens) && amount(data.carcassPerSlaughteredChicken)
}
