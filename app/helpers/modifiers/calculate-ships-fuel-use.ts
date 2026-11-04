import { getResearchBonus, type PlanningDefinitions } from '../../planning-state'

export interface ShipsFuelUseResult {
  level: number
  reductionPercent: number
  multiplier: number
}
export const calculateShipsFuelUse = (
  definitions: PlanningDefinitions,
  level: number,
): ShipsFuelUseResult => {
  const value = getResearchBonus(definitions, 'shipsFuelUse', level)

  return { level: value.level, reductionPercent: -value.bonusPercent, multiplier: value.multiplier }
}
