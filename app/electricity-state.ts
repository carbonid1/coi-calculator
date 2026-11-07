export interface ElectricityConsumerState {
  prototypeId: string
  name: string
  demandMw: number
  consumedMw: number
  maximumDemandMw: number
  entities: number
  transport: boolean
}

export interface ElectricityState {
  demandMw: number
  surplusDemandMw: number
  consumedMw: number
  generationMw: number
  generationCapacityMw: number
  maximumGenerationCapacityMw: number
  byType: ElectricityConsumerState[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object'
const isNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

export const isElectricityState = (value: unknown): value is ElectricityState => {
  if (!isRecord(value) || !['demandMw', 'surplusDemandMw', 'consumedMw', 'generationMw',
    'generationCapacityMw', 'maximumGenerationCapacityMw'].every(key => isNonNegative(value[key]))
    || !Array.isArray(value.byType)) return false
  const ids = new Set<string>()

  return value.byType.every(consumer => {
    if (!isRecord(consumer) || typeof consumer.prototypeId !== 'string' || !consumer.prototypeId
      || ids.has(consumer.prototypeId) || typeof consumer.name !== 'string'
      || !isNonNegative(consumer.demandMw) || !isNonNegative(consumer.consumedMw)
      || !isNonNegative(consumer.maximumDemandMw) || !isNonNegative(consumer.entities)
      || !Number.isInteger(consumer.entities) || typeof consumer.transport !== 'boolean') return false
    ids.add(consumer.prototypeId)
    return true
  })
}
