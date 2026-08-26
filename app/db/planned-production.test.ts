import { describe, expect, it } from "vitest";

import { calculateBuildingStats } from "../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceOutput } from "../helpers/modifiers/calculate-maintenance-output";
import { calculateSolarPower } from "../helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "../helpers/modifiers/calculate-tree-growth-speed";
import { defaultActiveEdicts } from "./edicts";
import {
  GENERAL_MODULE_ID,
  general,
  plannedGeneralBuildings,
  plannedGeneralBuiltBuildings,
  plannedNewGeneralBuildings,
} from "./modules/general";
import { modules } from "./modules/modules";
import {
  PROCESS_STEAM_MODULE_ID,
  plannedProcessSteamBuildings,
  plannedProcessSteamBuiltBuildings,
  processSteam,
} from "./modules/process-steam";
import { recipes } from "./recipes";
import { defaultInfiniteResearchLevels } from "./research";
import { defaultRocketIiRecurringLogistics } from "./space-station";

const plannedBuildings = {
  ...plannedNewGeneralBuildings,
  ...plannedProcessSteamBuildings,
};

const getRecipe = (id: string) => {
  const recipe = recipes.find((candidate) => candidate.id === id);

  if (!recipe) throw new Error(`Missing recipe ${id}`);

  return recipe;
};

const cropFarming = calculateCropFarmingModifiers(
  defaultInfiniteResearchLevels.cropYield,
  defaultActiveEdicts.farmingBoost,
);
const outputModifiers = {
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
};

describe("planned advanced production", () => {
  it("matches the installed v0.8.7 Electronics IV recipes", () => {
    expect(getRecipe("diamond-reactor-synthesis")).toMatchObject({
      building: "Diamond Reactor",
      cycleDurationSeconds: 60,
      inputs: [
        { resourceId: "graphite", quantity: 2 },
        { resourceId: "salt", quantity: 2 },
      ],
      outputs: [{ resourceId: "diamond", quantity: 2 }],
    });
    expect(getRecipe("chemical-plant-ii-diamond-paste-cooking-oil")).toMatchObject({
      building: "Chemical Plant II",
      inputs: [
        { resourceId: "diamond", quantity: 4 },
        { resourceId: "cookingOil", quantity: 4 },
      ],
      outputs: [{ resourceId: "diamondPaste", quantity: 16 }],
    });
    expect(getRecipe("lens-polisher")).toMatchObject({
      building: "Lens Polisher",
      inputs: [
        { resourceId: "sapphireWafer", quantity: 2 },
        { resourceId: "diamondPaste", quantity: 2 },
        { resourceId: "ethanol", quantity: 2 },
      ],
      outputs: [{ resourceId: "lens", quantity: 2 }],
    });
    expect(getRecipe("assembly-v-electronics-iv")).toMatchObject({
      building: "Assembly V",
      inputs: [
        { resourceId: "electronicsIII", quantity: 6 },
        { resourceId: "lens", quantity: 4 },
        { resourceId: "diamond", quantity: 2 },
      ],
      outputs: [{ resourceId: "electronicsIv", quantity: 6 }],
    });
  });

  it("matches the installed v0.8.7 station consumable recipes", () => {
    expect(getRecipe("assembly-v-composite-core")).toMatchObject({
      building: "Assembly V",
      cycleDurationSeconds: 30,
      inputs: [
        { resourceId: "compositePanel", quantity: 16 },
        { resourceId: "titaniumAlloy", quantity: 8 },
        { resourceId: "electronicsIII", quantity: 2 },
      ],
      outputs: [{ resourceId: "compositeCore", quantity: 8 }],
    });
    expect(getRecipe("chemical-plant-ii-chemical-fuel")).toMatchObject({
      building: "Chemical Plant II",
      cycleDurationSeconds: 30,
      inputs: [
        { resourceId: "ammonia", quantity: 12 },
        { resourceId: "fuelGas", quantity: 12 },
        { resourceId: "aluminum", quantity: 8 },
      ],
      outputs: [{ resourceId: "chemicalFuel", quantity: 8 }],
    });
    expect(getRecipe("assembly-v-station-parts")).toMatchObject({
      building: "Assembly V",
      cycleDurationSeconds: 15,
      inputs: [
        { resourceId: "compositeCore", quantity: 16 },
        { resourceId: "solarCell", quantity: 8 },
        { resourceId: "chemicalFuel", quantity: 4 },
      ],
      outputs: [{ resourceId: "stationParts", quantity: 8 }],
    });
    expect(getRecipe("assembly-v-crew-supplies")).toMatchObject({
      building: "Assembly V",
      cycleDurationSeconds: 15,
      inputs: [
        { resourceId: "foodPack", quantity: 8 },
        { resourceId: "medicalSuppliesII", quantity: 4 },
        { resourceId: "plastic", quantity: 4 },
      ],
      outputs: [{ resourceId: "crewSupplies", quantity: 16 }],
    });
  });

  it("keeps every advanced building planned while assigning it to its operating module", () => {
    const generalPreset = general.presets.find(({ id }) => id === general.defaultPresetId);
    const processSteamPreset = processSteam.presets.find(
      ({ id }) => id === processSteam.defaultPresetId,
    );

    expect(modules.some(({ id }) => id === "space-points-expansion")).toBe(false);
    expect(Object.keys(plannedBuildings)).toHaveLength(26);
    expect(Object.values({
      ...plannedGeneralBuiltBuildings,
      ...plannedProcessSteamBuiltBuildings,
    }).every((count) => count === 0)).toBe(true);
    expect(generalPreset?.activeBuildings).toMatchObject(plannedGeneralBuildings);
    expect(processSteamPreset?.activeBuildings).toMatchObject(plannedProcessSteamBuildings);
    expect(generalPreset?.dataSources).toEqual(Object.fromEntries(
      Object.keys(plannedGeneralBuildings).map((recipeId) => [recipeId, "planned"]),
    ));
    expect(processSteamPreset?.dataSources).toEqual(Object.fromEntries(
      Object.keys(plannedProcessSteamBuildings).map((recipeId) => [recipeId, "planned"]),
    ));
    expect(generalPreset?.outputTargets).toEqual({
      compositePanel: defaultRocketIiRecurringLogistics.compositePanelPerCycle + 4,
      titaniumAlloy: defaultRocketIiRecurringLogistics.titaniumAlloyPerCycle + 2,
    });
  });

  it("runs the same planned chain through General and Process Steam", () => {
    const factory = calculateFactoryTotal(modules, [], undefined, outputModifiers);
    const plannedIds = new Set(Object.keys(plannedBuildings));
    const lines = factory.allLines.filter(({ recipe }) => plannedIds.has(recipe.id));
    const results = factory.calculation.regularResults.filter(
      ({ recipe }) => plannedIds.has(recipe.id),
    );
    const result = (recipeId: string) => results.find(
      ({ recipe }) => recipe.id === recipeId,
    );
    const stats = calculateBuildingStats(lines, {
      regularResults: results,
      sourceResults: [],
      sinkResults: [],
    }, outputModifiers);

    expect(lines).toHaveLength(plannedIds.size);
    expect(lines.every(({ dataSource }) => dataSource === "planned")).toBe(true);
    expect(lines.find(
      ({ recipe }) => recipe.id === "distillation-stage-iii-titanium-purification",
    )?.moduleId).toBe(PROCESS_STEAM_MODULE_ID);
    expect(lines.filter(
      ({ recipe }) => recipe.id !== "distillation-stage-iii-titanium-purification",
    ).every(({ moduleId }) => moduleId === GENERAL_MODULE_ID)).toBe(true);
    expect(result("assembly-v-electronics-iv")?.actualOutputs).toContainEqual({
      resourceId: "electronicsIv",
      quantity: 0,
    });
    expect(result("assembly-v-composite-panel")?.actualOutputs.find(
      ({ resourceId }) => resourceId === "compositePanel",
    )?.quantity).toBeCloseTo(defaultRocketIiRecurringLogistics.compositePanelPerCycle + 4, 6);
    expect(result("cooled-caster-ii-titanium-alloy")?.actualOutputs.find(
      ({ resourceId }) => resourceId === "titaniumAlloy",
    )?.quantity).toBeCloseTo(defaultRocketIiRecurringLogistics.titaniumAlloyPerCycle + 2, 6);
    expect(result("settling-tank-red-mud-acid")?.actualOutputs.find(
      ({ resourceId }) => resourceId === "ironOreCrushed",
    )?.quantity).toBeCloseTo(16.5176366843, 6);
    expect(stats.workers).toBe(308);
    expect(stats.computingTflops).toBe(18);
  });
});
