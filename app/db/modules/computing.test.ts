import { expect, it } from "vitest";

import {
  computingRecipeIds,
  dataCenter,
  defaultComputingConfig,
  getRackAllocation,
  plannedComputingConfig,
  resolvedComputingConfig,
  resolvedCurrentComputingConfig,
} from "../computing";
import { computing, createComputingModule } from "./computing";

it("models the current two full data centers", () => {
  const computing = createComputingModule(defaultComputingConfig);
  const preset = computing.presets.at(0);

  expect(getRackAllocation(defaultComputingConfig.rackCount)).toEqual([48, 48]);
  expect(defaultComputingConfig.waterChillers).toBe(2);
  expect(computing.builtBuildings).toMatchObject({
    [computingRecipeIds.dataCenter]: 2,
    [computingRecipeIds.basicRack]: 96,
    [computingRecipeIds.waterChiller]: 2,
  });
  expect(preset?.activeBuildings).toEqual(computing.builtBuildings);
  expect(
    defaultComputingConfig.rackCount * dataCenter.computingTflopsPerRack,
  ).toBe(384);
});

it("keeps the current racks as built capacity and the settlement expansion as planned", () => {
  const preset = computing.presets.at(0);

  expect(resolvedCurrentComputingConfig).toEqual({
    source: "default",
    value: defaultComputingConfig,
  });
  expect(resolvedComputingConfig).toEqual({
    source: "planned",
    value: plannedComputingConfig,
  });
  expect(computing.builtBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 2,
    [computingRecipeIds.basicRack]: 96,
    [computingRecipeIds.waterChiller]: 2,
  });
  expect(preset?.activeBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 5,
    [computingRecipeIds.basicRack]: 202,
    [computingRecipeIds.waterChiller]: 5,
  });
  expect(preset?.dataSources).toEqual({
    [computingRecipeIds.dataCenter]: "planned",
    [computingRecipeIds.basicRack]: "planned",
    [computingRecipeIds.waterChiller]: "planned",
  });
});
