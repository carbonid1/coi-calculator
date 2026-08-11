import { buildings } from "../../db/buildings";
import {
  type PassiveResult,
  type ProductionLine,
  type RegularResult,
} from "../calculate/calculate";
import {
  getRecipeInputQuantity,
  type RecipeModifierMultipliers,
} from "../modifiers/recipe-output";

interface BuildingStats {
  workers: number;
  electricityKw: number;
}

interface CalculationResults {
  regularResults: RegularResult[];
  sourceResults: PassiveResult[];
  sinkResults: PassiveResult[];
}

export const calculateBuildingStats = (
  lines: ProductionLine[],
  results: CalculationResults,
  recipeModifiers: RecipeModifierMultipliers = {},
): BuildingStats => {
  const standaloneLines: ProductionLine[] = [];
  const pooledLines = new Map<string, ProductionLine>();

  for (const line of lines) {
    if (!line.capacityPoolId) {
      standaloneLines.push(line);
      continue;
    }

    const current = pooledLines.get(line.capacityPoolId);

    if (!current || line.buildingCount > current.buildingCount) {
      pooledLines.set(line.capacityPoolId, line);
    }
  }

  const workers = [...standaloneLines, ...pooledLines.values()].reduce((total, line) => {
    const building = buildings[line.recipe.building];

    if (!building || line.buildingCount <= 0) return total;

    return total + building.workers * Math.ceil(line.buildingCount);
  }, 0);

  const regularElectricityKw = results.regularResults.reduce((total, result) => {
    const building = buildings[result.recipe.building];

    if (!building) return total;

    return total
      + building.electricityKw
      * result.buildingCount
      * result.supplyRatio
      * (result.recipe.electricityMultiplier ?? 1);
  }, 0);

  const passiveElectricityKw = [...results.sourceResults, ...results.sinkResults]
    .reduce((total, result) => {
      const building = buildings[result.recipe.building];
      const line = lines.find((candidate) => (
        candidate.moduleId === result.moduleId
        && candidate.recipe.id === result.recipe.id
      ));

      if (!building || !line || result.buildingCount <= 0) return total;

      const factor = result.buildingCount * line.speedLevel;
      const utilizationRatios = [
        ...result.actualInputs.flatMap((actual) => {
          const declared = result.recipe.inputs.find((input) => input.resourceId === actual.resourceId);
          const capacity = declared
            ? getRecipeInputQuantity(declared, recipeModifiers) * factor
            : 0;

          return capacity > 0 ? [actual.quantity / capacity] : [];
        }),
        ...result.actualOutputs.flatMap((actual) => {
          const declared = result.recipe.outputs.find((output) => output.resourceId === actual.resourceId);
          const capacity = (declared?.quantity ?? 0) * factor;

          return capacity > 0 ? [actual.quantity / capacity] : [];
        }),
      ];
      const utilization = utilizationRatios.length > 0
        ? Math.min(1, Math.max(...utilizationRatios))
        : 0;

      return total
        + building.electricityKw
        * result.buildingCount
        * utilization
        * (result.recipe.electricityMultiplier ?? 1);
    }, 0);

  return {
    workers,
    electricityKw: regularElectricityKw + passiveElectricityKw,
  };
};
