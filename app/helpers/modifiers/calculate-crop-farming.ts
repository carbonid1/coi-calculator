import { type FarmingBoostLevel } from '../../db/edicts'
import { getResearchBonus, getEdictEffects, type PlanningDefinitions } from '../../planning-state'

export interface CropFarmingModifiers {
  yieldBonusPercent: number
  yieldMultiplier: number
  waterDemandMultiplier: number
}
export const calculateCropFarmingModifiers = (
  definitions: PlanningDefinitions,
  researchLevel: number,
  farmingBoostLevel: FarmingBoostLevel,
  focusYieldBonusPercent = 0,
): CropFarmingModifiers => {
  const research = getResearchBonus(definitions, 'cropYield', researchLevel)
  const water = getResearchBonus(
    definitions,
    'cropYield',
    researchLevel,
    'FarmWaterConsumptionMultiplier',
  )
  const edict = getEdictEffects(definitions, 'farmingBoost', farmingBoostLevel).effects
  const yieldBonusPercent =
    research.bonusPercent + (edict.FarmYieldMultiplier ?? 0) + Math.max(0, focusYieldBonusPercent)

  return {
    yieldBonusPercent,
    yieldMultiplier: 1 + yieldBonusPercent / 100,
    waterDemandMultiplier:
      1 + (water.bonusPercent + (edict.FarmWaterConsumptionMultiplier ?? 0)) / 100,
  }
}
