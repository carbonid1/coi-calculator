import { resolveSyncedResourceId } from './helpers/synced-resources/synced-resources'

interface StationProduct {
  productId: string
  name: string
  quantity: number
}

export interface SpaceStationLevelDefinition {
  level: number
  crew: number
  construction: StationProduct
  maintenance: StationProduct
  crewSupplies: StationProduct
  researchSupplies: StationProduct
  researchEfficiencyBonusPercent: number
  spaceResearchPointsPerCycle: number
  unityPerCycle: number
}

const record = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)
const amount = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
)
const product = (value: unknown): value is StationProduct => record(value)
  && typeof value.productId === 'string' && value.productId.length > 0
  && typeof value.name === 'string' && amount(value.quantity)
  && resolveSyncedResourceId({ productId: value.productId, name: value.name }) !== undefined
const level = (value: unknown, index: number): value is SpaceStationLevelDefinition => record(value)
  && value.level === index + 1 && amount(value.crew) && Number.isSafeInteger(value.crew)
  && product(value.construction) && product(value.maintenance)
  && product(value.crewSupplies) && product(value.researchSupplies)
  && amount(value.researchEfficiencyBonusPercent)
  && amount(value.spaceResearchPointsPerCycle) && amount(value.unityPerCycle)

export const isSpaceStationLevels = (value: unknown): value is SpaceStationLevelDefinition[] => (
  Array.isArray(value) && value.length > 0 && value.every(level)
)
