import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateTreeGrowthSpeed } from "../../helpers/modifiers/calculate-tree-growth-speed";
import { extractModuleResult } from "../../helpers/module-result/module-result";
import { activeContracts } from "../contracts";
import { defaultInfiniteResearchLevels } from "../research";
import { forestry } from "./forestry";
import { modules } from "./modules";
import { processSteam } from "./process-steam";
import {
  research,
  RESEARCH_LAB_EQUIPMENT_IV_DEMAND,
  RESEARCH_MODULE_ID,
} from "./research";

const actualOutput = (
  result: ReturnType<typeof calculateFactoryTotal>,
  recipeId: string,
  resourceId: string,
) => result.calculation.regularResults
  .find((candidate) => candidate.recipe.id === recipeId)
  ?.actualOutputs.find((output) => output.resourceId === resourceId)
  ?.quantity ?? 0;

it("balances the complete Lab Equipment chain against measured research demand", () => {
  const result = calculateFactoryTotal(modules, activeContracts);
  const labEquipmentRecipeIds = [
    "assembly-v-lab-equipment-i",
    "assembly-v-lab-equipment-ii",
    "assembly-v-lab-equipment-iii",
    "assembly-v-lab-equipment-iv",
  ];
  const researchPreset = research.presets.find(
    (candidate) => candidate.id === research.defaultPresetId,
  )!;
  const researchResult = extractModuleResult(
    RESEARCH_MODULE_ID,
    result.calculation,
    researchPreset.fixedDemands,
  );

  for (const recipeId of labEquipmentRecipeIds) {
    const output = result.calculation.regularResults
      .find((candidate) => candidate.recipe.id === recipeId)
      ?.actualOutputs[0]?.quantity;

    expect(output).toBeCloseTo(RESEARCH_LAB_EQUIPMENT_IV_DEMAND);
  }

  expect(actualOutput(result, "chemical-plant-ii-paper", "paper")).toBeCloseTo(11.5);
  expect(actualOutput(result, "shredder-woodchips", "woodchips")).toBeCloseTo(5.75);
  expect(research.buildingTotals).toEqual({
    "assembly-v-lab-equipment-i": 1,
    "assembly-v-lab-equipment-ii": 1,
    "assembly-v-lab-equipment-iii": 1,
    "assembly-v-lab-equipment-iv": 2,
  });
  expect(researchResult.resourceFlows).not.toContainEqual(
    expect.objectContaining({ resourceId: "labEquipmentIv" }),
  );
});

it("routes process steam to every active consumer", () => {
  const result = calculateFactoryTotal(modules, activeContracts);
  const steam = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "steamHigh",
  )!;
  const sourWater = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "sourWater",
  )!;
  const titaniumPurification = result.calculation.regularResults.find(
    (candidate) => candidate.recipe.id === "distillation-stage-iii-titanium-purification",
  )!;

  expect(processSteam.buildingTotals).toEqual({
    "chemical-plant-ii-paper": 1,
    "distillation-stage-iii-titanium-purification": 1,
    "sour-water-stripper": 1,
    "incineration-plant-waste": 1,
  });
  expect(forestry.buildingTotals).toEqual({
    "forestry-trees-100-growth": 1,
    "shredder-woodchips": 1,
  });
  expect(actualOutput(result, "incineration-plant-waste", "steamHigh")).toBeGreaterThan(0);
  expect(titaniumPurification.supplyRatio).toBe(0);
  expect(steam.net).toBeCloseTo(0);
  expect(sourWater.consumed).toBeGreaterThan(0);
  expect(sourWater.net).toBeCloseTo(0);
});

it("autobalances fully grown trees and exposes their sapling demand", () => {
  const result = calculateFactoryTotal(modules, activeContracts);
  const forestrySource = result.calculation.sourceResults.find(
    (candidate) => candidate.recipe.id === "forestry-trees-100-growth",
  )!;
  const harvestedWood = forestrySource.actualOutputs.find(
    (output) => output.resourceId === "wood",
  )!.quantity;
  const saplingDemand = forestrySource.actualInputs.find(
    (input) => input.resourceId === "treeSapling",
  )!.quantity;

  expect(harvestedWood).toBeCloseTo(23.3375, 4);
  expect(saplingDemand).toBeCloseTo(harvestedWood / 20);
  expect(saplingDemand).toBeCloseTo(1.166875, 6);
});

it("models repeatable tree growth research from a level-zero factory baseline", () => {
  const baseline = calculateTreeGrowthSpeed(defaultInfiniteResearchLevels.treeGrowthSpeed);
  const firstLevel = calculateTreeGrowthSpeed(1);
  const maximum = calculateTreeGrowthSpeed(50);
  const acceleratedResult = calculateFactoryTotal(
    modules,
    activeContracts,
    undefined,
    { treeGrowthSpeed: maximum.multiplier },
  );
  const acceleratedForestry = acceleratedResult.calculation.sourceResults.find(
    (candidate) => candidate.recipe.id === "forestry-trees-100-growth",
  )!;
  const acceleratedSaplings = acceleratedForestry.actualInputs.find(
    (input) => input.resourceId === "treeSapling",
  )!.quantity;

  expect(baseline).toMatchObject({
    level: 0,
    bonusPercent: 0,
    multiplier: 1,
    growthCycles: 144,
    growthYears: 12,
  });
  expect(firstLevel.bonusPercent).toBe(1);
  expect(firstLevel.growthCycles).toBeCloseTo(144 / 1.01);
  expect(maximum).toMatchObject({
    level: 50,
    bonusPercent: 50,
    multiplier: 1.5,
    growthCycles: 96,
    growthYears: 8,
  });
  // Growth speed changes the forest area needed, not saplings per Wood.
  expect(acceleratedSaplings).toBeCloseTo(1.166875, 6);
});
