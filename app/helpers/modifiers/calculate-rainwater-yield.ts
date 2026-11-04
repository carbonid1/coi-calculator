import { getResearchBonus, type PlanningDefinitions } from '../../planning-state'

export type RainwaterYieldResult = ReturnType<typeof getResearchBonus>
export const calculateRainwaterYield = (
  definitions: PlanningDefinitions,
  level: number,
): RainwaterYieldResult => getResearchBonus(definitions, 'rainwaterYield', level)
