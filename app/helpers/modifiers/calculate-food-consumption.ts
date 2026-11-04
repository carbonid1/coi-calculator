import { type EdictLevel } from '../../db/edicts'
import { getEdictEffects, type PlanningDefinitions } from '../../planning-state'

export interface FoodConsumptionResult {
  effectivePercent: number
  multiplier: number
}
export const calculateFoodConsumption = (
  definitions: PlanningDefinitions,
  foodSaverLevel: EdictLevel,
  plentyOfFoodLevel: EdictLevel,
  focusPercent = 0,
): FoodConsumptionResult => {
  const foodSaver =
    getEdictEffects(definitions, 'foodSaver', foodSaverLevel).effects.FoodConsumptionMultiplier ?? 0
  const plenty =
    getEdictEffects(definitions, 'plentyOfFood', plentyOfFoodLevel).effects
      .FoodConsumptionMultiplier ?? 0
  const effectivePercent = foodSaver + plenty + Math.min(0, focusPercent)

  return { effectivePercent, multiplier: 1 + effectivePercent / 100 }
}
