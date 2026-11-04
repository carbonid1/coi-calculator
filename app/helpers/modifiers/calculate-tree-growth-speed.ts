import { getResearchBonus, type PlanningDefinitions } from '../../planning-state'

export type TreeGrowthSpeedResult = ReturnType<typeof getResearchBonus>
export const calculateTreeGrowthSpeed = (
  definitions: PlanningDefinitions,
  level: number,
): TreeGrowthSpeedResult => getResearchBonus(definitions, 'treeGrowthSpeed', level)
