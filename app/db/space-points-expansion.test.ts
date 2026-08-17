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
      "crusher-large-bauxite": 1,
      "chemical-plant-ii-bauxite-digestion": 1,
      "rotary-kiln-alumina-fuel-gas": 1,
      "crystallizer-alumina": 1,
      "liquid-dump-red-mud": 1,
      "chemical-plant-ii-graphite-coal": 1,
      "diamond-reactor-synthesis": 1,
      "chemical-plant-ii-diamond-paste-cooking-oil": 1,
      "chemical-plant-ii-diamond-paste-heavy-oil": 1,
      "lens-polisher": 2,
      "assembly-v-electronics-iii": 1,
      "assembly-v-electronics-iv": 1,
    });
    expect(preset?.builtBuildings).toEqual(spacePointsExpansionBuiltBuildings);
    expect(preset?.activeBuildings).toEqual(spacePointsExpansionBuiltBuildings);
    expect(preset?.outputTargets).toEqual({ electronicsIv: 4 });
  });

  it("renders the planned chain through normal module results", () => {
    const factory = calculateFactoryTotal(
      modules,
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
    const redMudDump = result.sinkResults.find(
      (line) => line.recipe.id === "liquid-dump-red-mud",
    );
    const stats = calculateBuildingStats(lines, result, outputModifiers);

    expect(electronicsIv?.actualOutputs).toContainEqual({
      resourceId: "electronicsIv",
      quantity: 4,
    });
    expect(result.resourceFlows.find((flow) => flow.resourceId === "bauxite")?.net)
      .toBeCloseTo(-8, 6);
    expect(redMudDump?.actualInputs).toContainEqual({ resourceId: "redMud", quantity: 4 });
    expect(stats.workers).toBe(87);
    expect(stats.computingTflops).toBe(26);
  });
});
