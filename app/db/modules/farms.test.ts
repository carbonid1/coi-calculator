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
import {
  CHICKEN_FARMS_MODULE_ID,
  createChickenFarmsModule,
  greenhouses,
} from "./farms";
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
const currentFactoryModules = modules;

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
      "food-processor-meat": 1,
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

  it("keeps every planned crop in surplus for the current factory", () => {
    expect(defaultEdictLevels.plentyOfFood).toBe(2);

    const cropFarming = calculateCropFarmingModifiers(
      defaultInfiniteResearchLevels.cropYield,
      defaultActiveEdicts.farmingBoost,
    );
    const result = calculateFactoryTotal(
      currentFactoryModules,
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
      const net = flow?.net ?? -1;

      expect(flow, cropId).toBeDefined();
      expect(net, `${cropId} deficit`).toBeGreaterThanOrEqual(-1e-9);
      expect(net, `${cropId} surplus`).toBeLessThanOrEqual(5);
    }

    const sugarCane = result.flows.find((flow) => flow.resourceId === "sugarCane");
    const foodPack = result.flows.find((flow) => flow.resourceId === "foodPack");
    const eggs = result.flows.find((flow) => flow.resourceId === "eggs");
    const meat = result.flows.find((flow) => flow.resourceId === "meat");
    const meatTrimmings = result.flows.find(
      (flow) => flow.resourceId === "meatTrimmings",
    );
    const chickenCarcass = result.flows.find(
      (flow) => flow.resourceId === "chickenCarcass",
    );
    const fuelGas = result.flows.find((flow) => flow.resourceId === "fuelGas");
    const diesel = result.flows.find((flow) => flow.resourceId === "diesel");
    const carcassProcessorResults = result.calculation.regularResults.filter(
      (line) => line.recipe.id.startsWith("food-processor-meat"),
    );
    const trimmingsDigester = result.calculation.regularResults.find(
      (line) => line.recipe.id === "anaerobic-digester-meat-trimmings",
    );
    const fuelGasCracker = result.calculation.regularResults.find(
      (line) => line.recipe.id === "cracking-unit-fuel-gas-diesel",
    );

    expect(activeCropFarmGroups.reduce(
      (total, group) => total + group.farmCount,
      0,
    )).toBe(6);
    expect(sugarCane?.net ?? 6).toBeLessThanOrEqual(5);
    expect(foodPack?.net).toBeCloseTo(0);
    expect(defaultChickenFarmSettings).toMatchObject({ totalChickenCount: 1_700 });
    expect(eggs?.net ?? -1).toBeGreaterThanOrEqual(0);
    expect(eggs?.net ?? 1).toBeLessThan(1);
    expect(meat?.net ?? -1).toBeGreaterThanOrEqual(0);
    expect(meat?.net ?? 1).toBeLessThan(1);
    expect(meatTrimmings?.net ?? -1).toBeGreaterThanOrEqual(-1e-9);
    expect(meatTrimmings?.net ?? 1).toBeLessThan(1);
    expect(chickenCarcass?.net).toBeCloseTo(0);
    expect(Math.abs(fuelGas?.net ?? 1)).toBeLessThan(1e-9);
    expect(diesel?.net ?? 0).toBeGreaterThan(0);
    expect(carcassProcessorResults).toHaveLength(2);
    expect(carcassProcessorResults.every((line) => line.builtBuildings === 1)).toBe(true);
    expect(carcassProcessorResults.every((line) => line.supplyRatio > 0)).toBe(true);
    expect(carcassProcessorResults.every((line) => line.supplyRatio <= 1)).toBe(true);
    expect(trimmingsDigester?.supplyRatio ?? 0).toBeGreaterThan(0);
    expect(fuelGasCracker?.supplyRatio ?? 0).toBeGreaterThan(0);
  });

  it("keeps the locked flock balanced while recovering every Carcass", () => {
    const cropFarming = calculateCropFarmingModifiers(
      defaultInfiniteResearchLevels.cropYield,
      defaultActiveEdicts.farmingBoost,
    );
    const calculateWithChickenCount = (totalChickenCount: number) => {
      const configuredModules: Module[] = currentFactoryModules.map((module) => (
        module.id === CHICKEN_FARMS_MODULE_ID
          ? createChickenFarmsModule({ totalChickenCount, slaughtering: true })
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
    const balancesAt = (totalChickenCount: number) => {
      const flows = calculateWithChickenCount(totalChickenCount).flows;

      return {
        eggs: flows.find((flow) => flow.resourceId === "eggs")?.net ?? 0,
        meat: flows.find((flow) => flow.resourceId === "meat")?.net ?? 0,
        meatTrimmings: flows.find(
          (flow) => flow.resourceId === "meatTrimmings",
        )?.net ?? 0,
        chickenCarcass: flows.find(
          (flow) => flow.resourceId === "chickenCarcass",
        )?.net ?? 0,
        diesel: flows.find((flow) => flow.resourceId === "diesel")?.net ?? 0,
      };
    };
    const at1_700 = balancesAt(1_700);

    expect(at1_700.eggs).toBeGreaterThanOrEqual(0);
    expect(at1_700.meat).toBeGreaterThanOrEqual(0);
    expect(at1_700.meatTrimmings).toBeGreaterThanOrEqual(0);
    expect(at1_700.chickenCarcass).toBeCloseTo(0);
    expect(at1_700.diesel).toBeGreaterThan(0);
  });
});
