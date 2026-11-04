import { type InfiniteResearchId } from '../db/research'

// Historical save configuration for solver regressions only.
export const baseConfig = { recyclingEfficiencyPercent: 20, researchMode: 'with-space' } as const

export const defaultInfiniteResearchLevels = {
  vehiclesPollution: 0,
  shipsPollution: 0,
  trainsPollution: 0,
  cropYield: 20,
  treeGrowthSpeed: 5,
  rainwaterYield: 10,
  settlementWaterUse: 0,
  unityCapacity: 5,
  housingCapacity: 4,
  focusPoints: 5,
  vehicleLimit: 0,
  vehiclesFuelUse: 5,
  shipsFuelUse: 5,
  trainsFuelUse: 5,
  rocketsCapacity: 1,
  maintenanceOutput: 4,
  worldMineOutput: 5,
  solarPower: 10,
} as const satisfies Record<InfiniteResearchId, number>
