import { getResearchBonus, type PlanningDefinitions } from '../../planning-state'

export type HousingCapacityResult = ReturnType<typeof getResearchBonus>
export const calculateHousingCapacity = (
  definitions: PlanningDefinitions,
  level: number,
): HousingCapacityResult => getResearchBonus(definitions, 'housingCapacity', level)
