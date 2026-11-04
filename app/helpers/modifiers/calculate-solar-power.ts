import { type CleanPanelsLevel } from '../../db/edicts'
import { getResearchBonus, getEdictEffects, type PlanningDefinitions } from '../../planning-state'

export interface SolarPowerResult {
  bonusPercent: number
  multiplier: number
}
export const calculateSolarPower = (
  definitions: PlanningDefinitions,
  researchLevel: number,
  cleanPanelsLevel: CleanPanelsLevel,
  averageSunIntensityPercent: number,
): SolarPowerResult => {
  const research = getResearchBonus(definitions, 'solarPower', researchLevel)
  const bonusPercent =
    research.bonusPercent +
    (getEdictEffects(definitions, 'cleanPanels', cleanPanelsLevel).effects.SolarPowerMultiplier ??
      0)

  return { bonusPercent, multiplier: ((1 + bonusPercent / 100) * averageSunIntensityPercent) / 100 }
}
