import { describe, expect, it } from "vitest";

import { calculateBuildingStats } from "../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceOutput } from "../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../helpers/modifiers/calculate-recycling-efficiency";
import { calculateSolarPower } from "../helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "../helpers/modifiers/calculate-tree-growth-speed";
import { extractModuleResult } from "../helpers/module-result/module-result";
import { defaultActiveEdicts } from "./edicts";
import { modules } from "./modules/modules";
import {
  SPACE_POINTS_EXPANSION_MODULE_ID,
  spacePointsExpansion,
  spacePointsExpansionBuiltBuildings,
} from "./modules/space-points-expansion";
import { recipes } from "./recipes";
import { defaultInfiniteResearchLevels } from "./research";
import { defaultRocketIiRecurringLogistics } from "./space-station";

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

describe("Space Points expansion module", () => {
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
      cycleDurationSeconds: 30,
      inputs: [
        { resourceId: "diamond", quantity: 4 },
        { resourceId: "cookingOil", quantity: 4 },
      ],
      outputs: [{ resourceId: "diamondPaste", quantity: 16 }],
    });
    expect(getRecipe("chemical-plant-ii-diamond-paste-heavy-oil")).toMatchObject({
      building: "Chemical Plant II",
      cycleDurationSeconds: 30,
      inputs: [
        { resourceId: "diamond", quantity: 4 },
        { resourceId: "heavyOil", quantity: 2 },
      ],
      outputs: [{ resourceId: "diamondPaste", quantity: 16 }],
    });
    expect(getRecipe("lens-polisher")).toMatchObject({
      building: "Lens Polisher",
      cycleDurationSeconds: 30,
      inputs: [
        { resourceId: "sapphireWafer", quantity: 2 },
        { resourceId: "diamondPaste", quantity: 2 },
        { resourceId: "ethanol", quantity: 2 },
      ],
      outputs: [{ resourceId: "lens", quantity: 2 }],
    });
    expect(getRecipe("assembly-v-electronics-iv")).toMatchObject({
      building: "Assembly V",
      cycleDurationSeconds: 30,
      inputs: [
        { resourceId: "electronicsIII", quantity: 6 },
        { resourceId: "lens", quantity: 4 },
        { resourceId: "diamond", quantity: 2 },
      ],
      outputs: [{ resourceId: "electronicsIv", quantity: 6 }],
    });
  });

  it("uses the standard module model with locked new-building counts", () => {
    const preset = spacePointsExpansion.presets[0];

    expect(modules).toContain(spacePointsExpansion);
    expect(spacePointsExpansionBuiltBuildings).toEqual({
      "crusher-large-bauxite": 2,
      "chemical-plant-ii-bauxite-digestion": 2,
      "rotary-kiln-alumina-fuel-gas": 2,
      "aluminum-cell-electrolysis": 2,
      "cooled-caster-ii-aluminum": 2,
      "crystallizer-alumina": 1,
      "settling-tank-red-mud-acid": 4,
      "crusher-large-titanium": 1,
      "arc-furnace-ii-titanium-ore": 1,
      "chemical-plant-ii-titanium-chlorination": 1,
      "distillation-stage-iii-titanium-purification": 1,
      "chemical-plant-ii-titanium-reduction": 1,
      "arc-furnace-ii-titanium-sponge": 1,
      "alloy-mixer-titanium": 1,
      "cooled-caster-ii-titanium-alloy": 1,
      "diamond-reactor-synthesis": 1,
      "chemical-plant-ii-diamond-paste-cooking-oil": 1,
      "chemical-plant-ii-diamond-paste-heavy-oil": 1,
      "lens-polisher": 2,
      "assembly-v-electronics-iv": 1,
    });
    expect(preset?.builtBuildings).toEqual(spacePointsExpansionBuiltBuildings);
    expect(preset?.activeBuildings).toEqual(spacePointsExpansionBuiltBuildings);
    expect(preset?.outputTargets).toEqual({
      aluminum: defaultRocketIiRecurringLogistics.aluminumPerCycle,
      titaniumAlloy: defaultRocketIiRecurringLogistics.titaniumAlloyPerCycle,
      electronicsIv: 4,
      ironOreCrushed: 15.832451499118164,
    });
    expect(spacePointsExpansionBuiltBuildings).not.toHaveProperty(
      "assembly-v-electronics-iii",
    );
    expect(spacePointsExpansionBuiltBuildings).not.toHaveProperty(
      "chemical-plant-ii-graphite-coal",
    );
  });

  it("renders the planned chain through normal module results", () => {
    const factory = calculateFactoryTotal(
      [{ ...spacePointsExpansion, includedInFactoryTotals: true }],
      [],
      calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
      outputModifiers,
    );
    const result = extractModuleResult(
      SPACE_POINTS_EXPANSION_MODULE_ID,
      factory.calculation,
    );
    const lines = factory.allLines.filter(
      (line) => line.moduleId === SPACE_POINTS_EXPANSION_MODULE_ID,
    );
    const electronicsIv = result.regularResults.find(
      (line) => line.recipe.id === "assembly-v-electronics-iv",
    );
    const redMudRecovery = result.regularResults.find(
      (line) => line.recipe.id === "settling-tank-red-mud-acid",
    );
    const stats = calculateBuildingStats(lines, result, outputModifiers);
    const flow = (resourceId: string) => result.resourceFlows.find(
      (candidate) => candidate.resourceId === resourceId,
    );

    expect(electronicsIv?.actualOutputs).toContainEqual({
      resourceId: "electronicsIv",
      quantity: 4,
    });
    expect(flow("aluminum")?.net)
      .toBeCloseTo(defaultRocketIiRecurringLogistics.aluminumPerCycle, 6);
    expect(flow("titaniumAlloy")?.net)
      .toBeCloseTo(defaultRocketIiRecurringLogistics.titaniumAlloyPerCycle, 6);
    expect(flow("electronicsIv")?.net).toBeCloseTo(4, 6);
    expect(flow("electronicsIII")?.net).toBeCloseTo(-4, 6);
    expect(flow("bauxite")?.net).toBeCloseTo(-142.492063, 6);
    expect(flow("titaniumOre")?.net).toBeCloseTo(-38.772487, 6);
    expect(redMudRecovery?.actualInputs.find(({ resourceId }) => resourceId === "redMud")?.quantity)
      .toBeCloseTo(71.246032, 6);
    expect(flow("ironOreCrushed")?.net).toBeCloseTo(15.832451, 6);
    expect(stats.workers).toBe(242);
    expect(stats.computingTflops).toBe(20);
  });

  it("stays available as a plan while remaining outside Factory Total", () => {
    const factory = calculateFactoryTotal(modules);

    expect(spacePointsExpansion.includedInFactoryTotals).toBe(false);
    expect(factory.allLines.some(
      (line) => line.moduleId === SPACE_POINTS_EXPANSION_MODULE_ID,
    )).toBe(false);
  });
});
