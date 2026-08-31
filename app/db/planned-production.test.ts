import { describe, expect, it } from "vitest";

import { calculateBuildingStats } from "../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceOutput } from "../helpers/modifiers/calculate-maintenance-output";
import { calculateSolarPower } from "../helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "../helpers/modifiers/calculate-tree-growth-speed";
import { baseConfig } from "./config";
import { activeContracts } from "./contracts";
import { defaultActiveEdicts } from "./edicts";
import {
  DEFAULT_MODULE_ID,
  defaultArea as general,
  modeledDefaultRecipeIds as modeledGeneralRecipeIds,
  plannedDefaultBuildings as plannedGeneralBuildings,
  plannedDefaultBuiltBuildings as plannedGeneralBuiltBuildings,
  plannedNewDefaultBuildings as plannedNewGeneralBuildings,
} from "./modules/default";
import { factoryModelModules as modules } from "./modules/modules";
import {
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
const plannedAdvancedBuildings = Object.fromEntries(
  Object.entries(plannedBuildings).filter(
    ([recipeId]) => recipeId !== "chemical-plant-ii-cooking-oil-diesel",
  ),
);

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
        { resourceId: "solarCellMono", quantity: 8 },
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
    expect(getRecipe("assembly-v-solar-cell-mono")).toMatchObject({
      building: "Assembly V",
      inputs: [
        { resourceId: "steel", quantity: 1.5 },
        { resourceId: "polySilicon", quantity: 18 },
        { resourceId: "glass", quantity: 6 },
      ],
      outputs: [{ resourceId: "solarCellMono", quantity: 12 }],
    });
  });

  it("has no remaining net-new advanced buildings", () => {
    const generalPreset = general.presets.find(({ id }) => id === general.defaultPresetId);
    const processSteamPreset = processSteam.presets.find(
      ({ id }) => id === processSteam.defaultPresetId,
    );

    expect(modules.some(({ id }) => id === "space-points-expansion")).toBe(false);
    expect(Object.keys(plannedAdvancedBuildings)).toHaveLength(0);
    expect(Object.values({
      ...plannedGeneralBuiltBuildings,
      ...plannedProcessSteamBuiltBuildings,
    }).every((count) => count === 0)).toBe(true);
    expect(generalPreset?.activeBuildings).toMatchObject(plannedGeneralBuildings);
    expect(processSteamPreset?.activeBuildings).toMatchObject(plannedProcessSteamBuildings);
    expect(generalPreset?.dataSources).toEqual({
      ...Object.fromEntries(
        modeledGeneralRecipeIds.map((recipeId) => [recipeId, "modeled"]),
      ),
      ...Object.fromEntries(
        Object.keys(plannedGeneralBuildings).map((recipeId) => [recipeId, "planned"]),
      ),
      "groundwater-pump-factory-reserve": "modeled",
    });
    expect(processSteamPreset?.dataSources).toBeUndefined();
    expect(generalPreset?.outputTargets).toEqual({
      compositePanel: defaultRocketIiRecurringLogistics.compositePanelPerCycle + 4,
      titaniumAlloy: defaultRocketIiRecurringLogistics.titaniumAlloyPerCycle + 2,
    });
  });

  it("runs the completed advanced chain through Default", () => {
    const factory = calculateFactoryTotal(modules, {
      recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent,
      outputModifiers,
    });
    const plannedIds = new Set(Object.keys(plannedAdvancedBuildings));
    const lines = factory.allLines.filter(({ recipe }) => plannedIds.has(recipe.id));
    const results = factory.calculation.regularResults.filter(
      ({ recipe }) => plannedIds.has(recipe.id),
    );
    const factoryResult = (recipeId: string) => factory.calculation.regularResults.find(
      ({ recipe }) => recipe.id === recipeId,
    );
    const stats = calculateBuildingStats(lines, {
      regularResults: results,
      sourceResults: [],
      sinkResults: [],
    }, outputModifiers);

    expect(lines).toHaveLength(plannedIds.size);
    expect(lines.every(({ dataSource }) => dataSource === "planned")).toBe(true);
    expect(plannedIds.size).toBe(0);
    expect(plannedIds.has("distillation-stage-iii-titanium-purification")).toBe(false);
    expect(lines.every(({ moduleId }) => moduleId === DEFAULT_MODULE_ID)).toBe(true);
    expect(factoryResult("assembly-v-electronics-iv")?.actualOutputs).toContainEqual({
      resourceId: "electronicsIv",
      quantity: 4,
    });
    expect(factoryResult("assembly-v-composite-panel")).toMatchObject({
      activeBuildings: 2,
      builtBuildings: 2,
    });
    expect(factoryResult("assembly-v-composite-panel")?.actualOutputs.find(
      ({ resourceId }) => resourceId === "compositePanel",
    )?.quantity).toBeCloseTo(defaultRocketIiRecurringLogistics.compositePanelPerCycle + 4, 6);
    expect(factoryResult("cooled-caster-ii-titanium-alloy")?.actualOutputs.find(
      ({ resourceId }) => resourceId === "titaniumAlloy",
    )?.quantity).toBeCloseTo(defaultRocketIiRecurringLogistics.titaniumAlloyPerCycle + 2, 6);
    expect(factory.flows.find(({ resourceId }) => resourceId === "moltenIron")?.net ?? 0)
      .toBeCloseTo(0, 6);
    expect(factoryResult("settling-tank-red-mud-acid")?.actualOutputs.find(
      ({ resourceId }) => resourceId === "ironOreCrushed",
    )?.quantity).toBe(0);
    expect(factoryResult("aluminum-cell-electrolysis")).toMatchObject({
      activeBuildings: 3,
      builtBuildings: 3,
    });
    expect(factoryResult("metal-caster-ii-aluminum")).toMatchObject({
      activeBuildings: 3,
      builtBuildings: 3,
    });
    expect(3 * (factoryResult("metal-caster-ii-aluminum")?.supplyRatio ?? 0))
      .toBeGreaterThan(2);
    expect(stats.workers).toBe(0);
    expect(stats.computingTflops).toBe(0);
  });

  it("supplies Sand through the demand-balanced Quartz contract", () => {
    const factory = calculateFactoryTotal(modules, {
      contracts: activeContracts,
      contractsProfitMultiplier: 1.14,
      recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent,
      outputModifiers,
    });
    const quartzContract = factory.contractResults.find(
      ({ contract }) => contract.id === "quartz-for-coal",
    );
    const quartzCrusher = factory.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "crusher-large-quartz",
    );
    const sandCrusher = factory.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "crusher-large-quartz-crushed",
    );

    expect(quartzContract?.imported ?? 0).toBeGreaterThan(0);
    expect(factory.calculation.sourceResults.some(({ recipe }) => (
      recipe.outputs.some(({ resourceId }) => resourceId === "sand")
    ))).toBe(false);
    expect(quartzCrusher?.actualOutputs.find(
      ({ resourceId }) => resourceId === "quartzCrushed",
    )?.quantity).toBeCloseTo(quartzContract?.imported ?? 0, 6);
    expect(quartzCrusher).toMatchObject({
      activeBuildings: 1,
      builtBuildings: 1,
      dataSource: "modeled",
    });
    expect(sandCrusher).toMatchObject({
      activeBuildings: 2,
      builtBuildings: 2,
      dataSource: "modeled",
    });
    expect(sandCrusher?.actualOutputs.find(
      ({ resourceId }) => resourceId === "sand",
    )?.quantity).toBeCloseTo(quartzContract?.imported ?? 0, 6);
  });
});
