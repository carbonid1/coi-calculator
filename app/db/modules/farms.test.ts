import { describe, expect, it } from "vitest";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../../helpers/modifiers/calculate-food-consumption";
import { calculateRecyclingEfficiency } from "../../helpers/modifiers/calculate-recycling-efficiency";
import { defaultChickenFarmSettings } from "../chicken-farm";
import { activeContracts } from "../contracts";
import {
  activeCropFarmGroups,
  crops,
} from "../crop-farming";
import { defaultActiveEdicts } from "../edicts";
import { recipes } from "../recipes";
import { defaultInfiniteResearchLevels } from "../research";
import {
  createChickenFarmsModule,
  greenhouses,
} from "./farms";
import { modules } from "./modules";

describe("active crop farm plan", () => {
  it("supports disabling chicken farms completely", () => {
    const chickenFarmsModule = createChickenFarmsModule({
      totalChickenCount: 0,
      slaughtering: true,
    });
    const preset = chickenFarmsModule.presets.at(0);

    expect(chickenFarmsModule.builtBuildings?.["chicken-farm-slaughtering"]).toBe(0);
    expect(preset?.speedLevels?.["chicken-farm-slaughtering"]).toBe(0);
  });

  it("connects four active and one paused Groundwater Pump only to Greenhouses", () => {
    const greenhousePreset = greenhouses.presets.at(0);
    const chickenFarmsModule = createChickenFarmsModule(defaultChickenFarmSettings);

    expect(greenhouses.builtBuildings["groundwater-pump"]).toBe(5);
    expect(greenhousePreset?.activeBuildings["groundwater-pump"]).toBe(4);
    expect(chickenFarmsModule.builtBuildings).not.toHaveProperty("groundwater-pump");
  });

  it("uses separate dedicated v0.8.7 Carcass processors in General", () => {
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
    });
    expect(trimmingsOnly).toMatchObject({
      cycleDurationSeconds: 20,
      balanceBy: "input",
      balanceInputIds: ["chickenCarcass"],
      allocation: "fallback",
      allocationPriority: 10,
      inputs: [{ resourceId: "chickenCarcass", quantity: 30 }],
      outputs: [{ resourceId: "meatTrimmings", quantity: 27 }],
    });
    expect(mixed?.sharedCapacity).toBeUndefined();
    expect(trimmingsOnly?.sharedCapacity).toBeUndefined();
    expect(modules.find((module) => module.id === "general")?.builtBuildings).toMatchObject({
      "food-processor-meat": 2,
      "food-processor-meat-trimmings": 1,
    });
    expect(createChickenFarmsModule(defaultChickenFarmSettings).builtBuildings).not.toHaveProperty(
      "food-processor-meat",
    );
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

  it("keeps all active crops supplied with no more than 5 surplus per month", () => {
    const cropFarming = calculateCropFarmingModifiers(
      defaultInfiniteResearchLevels.cropYield,
      defaultActiveEdicts.farmingBoost,
    );
    const result = calculateFactoryTotal(
      modules,
      activeContracts,
      calculateRecyclingEfficiency(
        defaultActiveEdicts.recyclingIncrease,
      ).effectivePercent,
      {
        cropYield: cropFarming.yieldMultiplier,
        cropWater: cropFarming.waterDemandMultiplier,
        foodConsumption: calculateFoodConsumption(0, 2).multiplier,
      },
    );
    const cropFlows = new Map(
      result.calculation.allResourceFlows.map((flow) => [flow.resourceId, flow]),
    );
    const fallbackConsumption = new Map<string, number>();

    for (const line of result.calculation.regularResults) {
      if (line.recipe.allocation !== "fallback" && line.recipe.allocation !== "surplus") {
        continue;
      }

      for (const input of line.actualInputs) {
        fallbackConsumption.set(
          input.resourceId,
          (fallbackConsumption.get(input.resourceId) ?? 0) + input.quantity,
        );
      }
    }

    expect(activeCropFarmGroups.reduce((total, group) => total + group.farmCount, 0)).toBe(6);

    for (const crop of Object.values(crops)) {
      if (!crop.productId) continue;

      const flow = cropFlows.get(crop.productId);

      if (!flow || flow.produced <= 0) continue;

      const primarySurplus = Math.max(0, flow.net)
        + (fallbackConsumption.get(crop.productId) ?? 0);

      expect(flow.net, crop.name).toBeGreaterThanOrEqual(-0.001);
      expect(primarySurplus, crop.name).toBeLessThanOrEqual(5.001);
    }
  });

});
