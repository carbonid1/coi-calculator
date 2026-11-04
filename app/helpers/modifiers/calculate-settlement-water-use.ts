import { getResearchBonus, type PlanningDefinitions } from '../../planning-state'

export interface SettlementWaterUseResult {
  level: number
  reductionPercent: number
  multiplier: number
}
export const calculateSettlementWaterUse = (
  definitions: PlanningDefinitions,
  level: number,
): SettlementWaterUseResult => {
  const value = getResearchBonus(definitions, 'settlementWaterUse', level)

  return { level: value.level, reductionPercent: -value.bonusPercent, multiplier: value.multiplier }
}
