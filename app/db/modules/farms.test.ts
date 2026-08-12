import { describe, expect, it } from "vitest";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceOutput } from "../../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../../helpers/modifiers/calculate-recycling-efficiency";
import { calculateSolarPower } from "../../helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "../../helpers/modifiers/calculate-tree-growth-speed";
import { defaultChickenFarmSettings } from "../chicken-farm";
import { activeContracts } from "../contracts";
import {
  activeCropFarmGroups,
  crops,
  type CropId,
} from "../crop-farming";
import { defaultActiveEdicts, defaultEdictLevels } from "../edicts";
import { recipes } from "../recipes";
import { defaultInfiniteResearchLevels } from "../research";
import { createFarmsModule, FARMS_MODULE_ID } from "./farms";
import { modules, type Module } from "./modules";

const plannedCropIds: readonly CropId[] = [
  "canola",
  "wheat",
  "soybean",
  "corn",
  "fruit",
  "vegetables",
  "sugarCane",
  "treeSapling",
  "potato",
];

describe("active crop farm plan", () => {
  it("supports disabling chicken farms completely", () => {
    const farmsModule = createFarmsModule({ totalChickenCount: 0, slaughtering: true });
    const preset = farmsModule.presets.at(0);

    expect(farmsModule.buildingTotals?.["chicken-farm-slaughtering"]).toBe(0);
    expect(preset?.speedLevels?.["chicken-farm-slaughtering"]).toBe(0);
  });

  it("uses the installed v0.8.7 carcass processing recipes", () => {
    const mixed = recipes.find((recipe) => recipe.id === "food-processor-meat");
    const trimmingsOnly = recipes.find(
      (recipe) => recipe.id === "food-processor-meat-trimmings",
    );

    expect(mixed).toMatchObject({
      cycleDurationSeconds: 20,
      balanceBy: "output",
      balanceOutputIds: ["meat"],
      inputs: [
        { resourceId: "chickenCarcass", quantity: 30 },
        { resourceId: "water", quantity: 9 },
        { resourceId: "salt", quantity: 3 },
      ],
      outputs: [
        { resourceId: "meat", quantity: 15 },
        { resourceId: "meatTrimmings", quantity: 6 },
      ],
      sharedCapacity: {
        id: "food-processor-chicken-carcass",
        priority: 1,
      },
    });
    expect(trimmingsOnly).toMatchObject({
      cycleDurationSeconds: 20,
      balanceBy: "input",
      balanceInputIds: ["chickenCarcass"],
      allocation: "fallback",
      allocationPriority: 10,
      inputs: [{ resourceId: "chickenCarcass", quantity: 30 }],
      outputs: [{ resourceId: "meatTrimmings", quantity: 27 }],
      sharedCapacity: {
        id: "food-processor-chicken-carcass",
        priority: 2,
      },
    });
  });

  it("never repeats a fertility-consuming crop across adjacent slots", () => {
    for (const group of activeCropFarmGroups) {
      group.schedule.forEach((cropId, index) => {
        const nextCropId = group.schedule[(index + 1) % group.schedule.length];

        if (crops[cropId].fertilityPercentPerDay > 0) {
          expect(nextCropId, `${group.name}, slot ${index + 1}`).not.toBe(cropId);
        }
      });
    }
  });

  it("covers Plenty of Food II Factory Total farm demand without excessive surplus", () => {
    expect(defaultEdictLevels.plentyOfFood).toBe(2);

    const cropFarming = calculateCropFarmingModifiers(
      defaultInfiniteResearchLevels.cropYield,
      defaultActiveEdicts.farmingBoost,
    );
    const result = calculateFactoryTotal(
      modules,
      activeContracts,
      calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
      {
        foodConsumption: calculateFoodConsumption(
          defaultEdictLevels.foodSaver,
          defaultEdictLevels.plentyOfFood,
        ).multiplier,
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

    for (const cropId of plannedCropIds) {
      const flow = result.flows.find((candidate) => candidate.resourceId === cropId);

      expect(flow, cropId).toBeDefined();
      expect(flow?.net ?? -1, `${cropId} deficit`).toBeGreaterThanOrEqual(-1e-9);
      expect(flow?.net ?? 11, `${cropId} surplus`).toBeLessThanOrEqual(10);
    }

    const sugarCane = result.flows.find((flow) => flow.resourceId === "sugarCane");
    const eggs = result.flows.find((flow) => flow.resourceId === "eggs");
    const meat = result.flows.find((flow) => flow.resourceId === "meat");
    const meatTrimmings = result.flows.find(
      (flow) => flow.resourceId === "meatTrimmings",
    );
    const chickenCarcass = result.flows.find(
      (flow) => flow.resourceId === "chickenCarcass",
    );
    const fuelGas = result.flows.find((flow) => flow.resourceId === "fuelGas");
    const carcassProcessorResults = result.calculation.regularResults.filter(
      (line) => line.recipe.id.startsWith("food-processor-meat"),
    );
    const trimmingsDigester = result.calculation.regularResults.find(
      (line) => line.recipe.id === "anaerobic-digester-meat-trimmings",
    );
    const fuelGasCracker = result.calculation.regularResults.find(
      (line) => line.recipe.id === "cracking-unit-fuel-gas-diesel",
    );

    expect(sugarCane?.net ?? 10).toBeLessThan(3.5);
    expect(defaultChickenFarmSettings).toMatchObject({ totalChickenCount: 1_100 });
    expect(eggs?.net ?? -1).toBeGreaterThanOrEqual(0);
    expect(eggs?.net ?? 1).toBeLessThan(1);
    expect(meat?.net ?? -1).toBeGreaterThanOrEqual(0);
    expect(meat?.net ?? 1).toBeLessThan(1);
    expect(meatTrimmings?.net ?? -1).toBeGreaterThanOrEqual(-1e-9);
    expect(meatTrimmings?.net ?? 1).toBeLessThan(1);
    expect(Math.abs(chickenCarcass?.net ?? 1)).toBeLessThan(1e-9);
    expect(Math.abs(fuelGas?.net ?? 1)).toBeLessThan(1e-9);
    expect(carcassProcessorResults).toHaveLength(2);
    expect(carcassProcessorResults.every((line) => line.supplyRatio > 0)).toBe(true);
    expect(carcassProcessorResults.reduce(
      (total, line) => total + line.supplyRatio,
      0,
    )).toBeLessThanOrEqual(1);
    expect(trimmingsDigester?.supplyRatio ?? 0).toBeGreaterThan(0);
    expect(fuelGasCracker?.supplyRatio ?? 0).toBeGreaterThan(0);
  });

  it("uses the minimum total flock in 50-chicken steps for Plenty of Food II", () => {
    const cropFarming = calculateCropFarmingModifiers(
      defaultInfiniteResearchLevels.cropYield,
      defaultActiveEdicts.farmingBoost,
    );
    const calculateWithChickenCount = (totalChickenCount: number) => {
      const configuredModules: Module[] = modules.map((module) => (
        module.id === FARMS_MODULE_ID
          ? createFarmsModule({ totalChickenCount, slaughtering: true })
          : module
      ));

      return calculateFactoryTotal(
        configuredModules,
        activeContracts,
        calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
        {
          foodConsumption: calculateFoodConsumption(
            defaultEdictLevels.foodSaver,
            defaultEdictLevels.plentyOfFood,
          ).multiplier,
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
    };
    const eggsAt = (totalChickenCount: number) => calculateWithChickenCount(totalChickenCount)
      .flows.find((flow) => flow.resourceId === "eggs")?.net ?? 0;

    expect(eggsAt(1_050)).toBeLessThan(0);
    expect(eggsAt(1_100)).toBeGreaterThanOrEqual(0);
  });
});
