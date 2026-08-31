import { getEdict, type EdictLevel } from "../../db/edicts";

export interface FoodConsumptionResult {
  effectivePercent: number;
  multiplier: number;
}

const getFoodConsumptionPercent = (
  edictId: "foodSaver" | "plentyOfFood",
  level: EdictLevel,
) => getEdict(edictId).levels.find(
  (definition) => definition.level === level,
)?.modeledEffects?.foodConsumptionPercent ?? 0;

export const calculateFoodConsumption = (
  foodSaverLevel: EdictLevel,
  plentyOfFoodLevel: EdictLevel,
  focusPercent = 0,
): FoodConsumptionResult => {
  const foodSaverPercent = getFoodConsumptionPercent("foodSaver", foodSaverLevel);
  const plentyOfFoodPercent = getFoodConsumptionPercent("plentyOfFood", plentyOfFoodLevel);
  const normalizedFocusPercent = Math.min(0, focusPercent);
  const effectivePercent = foodSaverPercent
    + plentyOfFoodPercent
    + normalizedFocusPercent;

  return {
    effectivePercent,
    multiplier: 1 + effectivePercent / 100,
  };
};
