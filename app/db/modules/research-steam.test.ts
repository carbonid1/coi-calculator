import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { extractModuleResult } from "../../helpers/module-result/module-result";
import { activeContracts } from "../contracts";
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
    "shredder-woodchips": 1,
    "chemical-plant-ii-paper": 2,
    "distillation-stage-iii-titanium-purification": 1,
    "sour-water-stripper": 1,
    "incineration-plant-waste": 1,
  });
  expect(actualOutput(result, "incineration-plant-waste", "steamHigh")).toBeGreaterThan(0);
  expect(titaniumPurification.supplyRatio).toBe(0);
  expect(steam.net).toBeCloseTo(0);
  expect(sourWater.consumed).toBeGreaterThan(0);
  expect(sourWater.net).toBeCloseTo(0);
});
