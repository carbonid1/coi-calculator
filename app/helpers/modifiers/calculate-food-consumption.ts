import { getEdict, type EdictLevel } from "../../db/edicts";

export interface FoodConsumptionResult {
  foodSaverPercent: number;
  plentyOfFoodPercent: number;
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
): FoodConsumptionResult => {
  const foodSaverPercent = getFoodConsumptionPercent("foodSaver", foodSaverLevel);
  const plentyOfFoodPercent = getFoodConsumptionPercent("plentyOfFood", plentyOfFoodLevel);
  const effectivePercent = foodSaverPercent + plentyOfFoodPercent;

  return {
    foodSaverPercent,
    plentyOfFoodPercent,
    effectivePercent,
    multiplier: 1 + effectivePercent / 100,
  };
};
