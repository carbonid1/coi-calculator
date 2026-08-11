import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { activeContracts } from "../contracts";
import { type ResourceId } from "../resources";
import { general } from "./general";
import { modules } from "./modules";

it("clears the configured electronics and metals capacity limits", () => {
  const result = calculateFactoryTotal(modules, activeContracts);
  const generalPreset = general.presets.find(
    (candidate) => candidate.id === general.defaultPresetId,
  )!;
  const expectedBuildingCounts = {
    "assembly-v-electronics-iii": 2,
    "arc-furnace-ii-copper-ore": 2,
    "arc-furnace-ii-copper-scrap": 2,
    "arc-furnace-ii-iron-ore": 2,
    "arc-furnace-ii-iron-scrap": 2,
    "coal-maker-wood": 2,
    "copper-electrolysis-acid": 4,
    "electrolyzer-ii-chlorine": 1,
    "metal-caster-ii-copper": 4,
    "oxygen-furnace-ii-steel": 2,
  };

  expect(general.buildingTotals).toMatchObject(expectedBuildingCounts);
  expect(generalPreset.buildingTotals).toMatchObject(expectedBuildingCounts);

  const net = (resourceId: ResourceId) => result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === resourceId,
  )?.net ?? 0;

  for (const resourceId of [
    "chlorine",
    "coal",
    "copper",
    "electronicsIII",
    "moltenSteel",
  ] as const) {
    expect(net(resourceId)).toBeGreaterThanOrEqual(-0.001);
  }
});

it("uses surplus FBR steam for desalination before the cooling sink", () => {
  const result = calculateFactoryTotal(modules, activeContracts);
  const superDesalination = result.calculation.regularResults.find(
    (candidate) => candidate.recipe.id === "thermal-desalinator-super",
  )!;
  const superSteam = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "steamSuper",
  )!;
  const superCooling = result.calculation.sinkResults.find(
    (candidate) => candidate.recipe.id === "cooling-tower-large-super",
  )!;

  expect(superDesalination.actualOutputs.find(
    (output) => output.resourceId === "brine",
  )?.quantity).toBeGreaterThan(0);
  expect(superSteam.net).toBeCloseTo(0);
  expect(superCooling.actualInputs.find(
    (input) => input.resourceId === "steamSuper",
  )?.quantity ?? 0).toBe(0);
});
