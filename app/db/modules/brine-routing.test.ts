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

it("uses surplus Super Steam to cover Brine, Chlorine, and Salt demand", () => {
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
  const net = (resourceId: "brine" | "chlorine" | "salt") => (
    result.flows.find((flow) => flow.resourceId === resourceId)?.net ?? 0
  );
  const superDesalination = result.calculation.regularResults.find(
    (candidate) => candidate.recipe.id === "thermal-desalinator-super",
  );

  expect(superDesalination?.activeBuildings).toBe(2);
  expect(superDesalination?.supplyRatio ?? 0).toBeGreaterThan(0);
  expect(superDesalination?.actualOutputs.find(
    (output) => output.resourceId === "brine",
  )?.quantity ?? 0).toBeGreaterThan(0);
  expect(net("brine")).toBeGreaterThanOrEqual(-0.001);
  expect(net("chlorine")).toBeGreaterThanOrEqual(-0.001);
  expect(net("salt")).toBeGreaterThanOrEqual(-0.001);
});
