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
  computingTflops: number;
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

    if (!current || line.activeBuildings > current.activeBuildings) {
      pooledLines.set(line.capacityPoolId, line);
    }
  }

  const workers = [...standaloneLines, ...pooledLines.values()].reduce((total, line) => {
    const building = buildings[line.recipe.building];

    if (!building || line.activeBuildings <= 0) return total;

    return total + building.workers * Math.ceil(line.activeBuildings);
  }, 0);

  const regularElectricityKw = results.regularResults.reduce((total, result) => {
    const building = buildings[result.recipe.building];

    if (!building) return total;

    return total
      + building.electricityKw
      * result.activeBuildings
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

      if (!building || !line || result.activeBuildings <= 0) return total;

      const factor = result.activeBuildings * line.speedLevel;
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
        * result.activeBuildings
        * utilization
        * (result.recipe.electricityMultiplier ?? 1);
    }, 0);

  let populationComputingTflops = 0;
  const machineComputing = new Map<string, { effectiveMachines: number; tflopsPerMachine: number }>();

  for (const result of results.regularResults) {
    const building = buildings[result.recipe.building];
    const tflopsPerMachine = building?.computingTflops ?? 0;

    if (tflopsPerMachine <= 0 || result.supplyRatio <= 0) continue;

    const effectiveMachines = result.recipe.computingScalesWithSpeed
      ? result.activeBuildings * result.supplyRatio * result.speedLevel
      : result.activeBuildings * result.supplyRatio;

    if (result.recipe.computingScalesWithSpeed) {
      populationComputingTflops += tflopsPerMachine * effectiveMachines;
      continue;
    }

    const current = machineComputing.get(result.recipe.building);

    machineComputing.set(result.recipe.building, {
      effectiveMachines: (current?.effectiveMachines ?? 0) + effectiveMachines,
      tflopsPerMachine,
    });
  }

  // Computing is reserved per working machine, not proportional to a recipe's
  // instantaneous progress. Pack steady-state utilization across identical
  // machines, then round to whole concurrently active machines. This matches
  // v0.8.6 statistics: one intermittent reprocessing plant still needs its
  // full 24 TFLOPS, while partial Assembly V loads combine before rounding.
  const machineComputingTflops = [...machineComputing.values()].reduce(
    (total, pool) => total
      + Math.ceil(pool.effectiveMachines - 0.000001) * pool.tflopsPerMachine,
    0,
  );

  return {
    workers,
    electricityKw: regularElectricityKw + passiveElectricityKw,
    computingTflops: populationComputingTflops + machineComputingTflops,
  };
};
