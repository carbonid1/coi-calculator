import { getResearchBonus, type PlanningDefinitions } from '../../planning-state'

export interface MaintenanceOutputResult {
  level: number
  researchBonusPercent: number
  focusBonusPercent: number
  bonusPercent: number
  multiplier: number
}
export const calculateMaintenanceOutput = (
  definitions: PlanningDefinitions,
  level: number,
  focusBonusPercent = 0,
): MaintenanceOutputResult => {
  const research = getResearchBonus(definitions, 'maintenanceOutput', level)
  const focus = Math.max(0, focusBonusPercent)
  const bonusPercent = research.bonusPercent + focus

  return {
    level: research.level,
    researchBonusPercent: research.bonusPercent,
    focusBonusPercent: focus,
    bonusPercent,
    multiplier: 1 + bonusPercent / 100,
  }
}
