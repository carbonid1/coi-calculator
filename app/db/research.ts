import { type PlanningDefinitions, getResearchDefinition } from '../planning-state'
import { researchCatalog, type InfiniteResearchId } from './research-catalog'

export { type InfiniteResearchId } from './research-catalog'
export const infiniteResearchCatalog = researchCatalog
export const getInfiniteResearchCatalog = (definitions: PlanningDefinitions) =>
  researchCatalog.map(binding => {
    const native = getResearchDefinition(definitions, binding.id)

    return {
      ...binding,
      maxLevel: native.costs.length - 1,
      spaceResearchLevel: native.spaceResearchLevel,
      effectPerLevel: native.description,
      costs: native.costs,
    }
  })
export type InfiniteResearchDefinition = ReturnType<typeof getInfiniteResearchCatalog>[number]
export const calculateInfiniteResearchLevelCost = (
  research: Pick<InfiniteResearchDefinition, 'costs'>,
  level: number,
) => {
  const cost = research.costs[Math.min(research.costs.length - 1, Math.max(1, Math.trunc(level)))]

  if (cost === undefined) throw new Error('Research cost table is incomplete')
  return cost
}
export const calculateInfiniteResearchRemainingCost = (
  research: Pick<InfiniteResearchDefinition, 'costs'>,
  currentLevel: number,
  targetLevel: number,
) =>
  research.costs
    .slice(
      Math.max(0, Math.trunc(currentLevel)) + 1,
      Math.min(research.costs.length - 1, Math.max(0, Math.trunc(targetLevel))) + 1,
    )
    .reduce((sum, cost) => sum + cost, 0)

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

/** Zero state used until the exporter has supplied save-owned research levels. */
export const emptyInfiniteResearchLevels = {
  vehiclesPollution: 0,
  shipsPollution: 0,
  trainsPollution: 0,
  cropYield: 0,
  treeGrowthSpeed: 0,
  rainwaterYield: 0,
  settlementWaterUse: 0,
  unityCapacity: 0,
  housingCapacity: 0,
  focusPoints: 0,
  vehicleLimit: 0,
  vehiclesFuelUse: 0,
  shipsFuelUse: 0,
  trainsFuelUse: 0,
  rocketsCapacity: 0,
  maintenanceOutput: 0,
  worldMineOutput: 0,
  solarPower: 0,
} as const satisfies Record<InfiniteResearchId, number>
