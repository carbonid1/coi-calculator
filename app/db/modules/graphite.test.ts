import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceOutput } from "../../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../../helpers/modifiers/calculate-recycling-efficiency";
import { calculateSolarPower } from "../../helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "../../helpers/modifiers/calculate-tree-growth-speed";
import { activeContracts } from "../contracts";
import { defaultActiveEdicts } from "../edicts";
import { defaultInfiniteResearchLevels } from "../research";
import { modules } from "./modules";

it("balances graphite production with the planned carbon dioxide capacity", () => {
  const cropFarming = calculateCropFarmingModifiers(
    defaultInfiniteResearchLevels.cropYield,
    defaultActiveEdicts.farmingBoost,
  );
  const result = calculateFactoryTotal(
    modules,
    activeContracts,
    calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
    {
      foodConsumption: calculateFoodConsumption(0, 2).multiplier,
      maintenanceOutput: calculateMaintenanceOutput(
        defaultInfiniteResearchLevels.maintenanceOutput,
      ).multiplier,
      solarPower: calculateSolarPower(
        defaultInfiniteResearchLevels.solarPower,
        defaultActiveEdicts.cleanPanels,
      ).multiplier,
      cropYield: cropFarming.yieldMultiplier,
      cropWater: cropFarming.waterDemandMultiplier,
      treeGrowthSpeed: calculateTreeGrowthSpeed(
        defaultInfiniteResearchLevels.treeGrowthSpeed,
      ).multiplier,
    },
  );
  const graphite = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "graphite",
  )!;
  const carbonDioxide = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "carbonDioxide",
  )!;
  const graphiteResults = result.calculation.regularResults.filter(
    (candidate) => candidate.recipe.id.startsWith("chemical-plant-ii-graphite"),
  );
  const carbonDioxideResult = graphiteResults.find(
    (candidate) => candidate.recipe.id === "chemical-plant-ii-graphite",
  )!;
  const coalResult = graphiteResults.find(
    (candidate) => candidate.recipe.id === "chemical-plant-ii-graphite-coal",
  )!;

  expect(carbonDioxideResult.builtBuildings).toBe(3);
  expect(coalResult.builtBuildings).toBe(2);
  expect(carbonDioxideResult.capacityPoolId).toBe("general:chemical-plant-ii-electronics");
  expect(coalResult.capacityPoolId).toBeUndefined();
  expect(carbonDioxideResult.supplyRatio).toBeGreaterThan(0);
  expect(coalResult.supplyRatio).toBeGreaterThan(0);
  expect(carbonDioxideResult.recipe.sharedCapacity?.priority).toBe(2);
  expect(coalResult.recipe.sharedCapacity).toBeUndefined();
  expect(coalResult.recipe.electricityMultiplier).toBe(2);
  expect(coalResult.supplyRatio).toBeCloseTo(1);
  expect(carbonDioxide.net).toBeCloseTo(0);
  expect(graphite.produced).toBeLessThan(graphite.consumed);
  expect(graphite.net).toBeCloseTo(-0.7496905556);
});
