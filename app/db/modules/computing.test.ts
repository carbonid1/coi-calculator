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

it("keeps paused synced computing capacity planned and lists the operating actions", () => {
  const computingModule = createComputingModule(
    plannedComputingConfig,
    { dataCenterCount: 5, rackCount: 202, waterChillers: 5 },
    "planned",
    "synced",
    { dataCenterCount: 1, rackCount: 48, waterChillers: 4 },
  );
  const preset = computingModule.presets[0];

  expect(preset.dataSources).toEqual({
    [computingRecipeIds.dataCenter]: "planned",
    [computingRecipeIds.basicRack]: "planned",
    [computingRecipeIds.waterChiller]: "planned",
  });
  expect(preset.planMismatches).toMatchObject([
    {
      recipeId: computingRecipeIds.dataCenter,
      current: 1,
      target: 5,
      actions: [{ type: "unpause", label: "Unpause 4 Data Centers" }],
    },
    {
      recipeId: computingRecipeIds.basicRack,
      current: 48,
      target: 202,
      actions: [{
        type: "unpause",
        label: "Unpause Data Centers for 154 Basic Server Racks",
      }],
    },
    {
      recipeId: computingRecipeIds.waterChiller,
      current: 4,
      target: 5,
      actions: [{ type: "unpause", label: "Unpause 1 Water Chiller" }],
    },
  ]);
});

it("returns computing rows to synced independently when each target is reached", () => {
  const computingModule = createComputingModule(
    plannedComputingConfig,
    { dataCenterCount: 6, rackCount: 210, waterChillers: 5 },
    "planned",
    "synced",
    { dataCenterCount: 6, rackCount: 210, waterChillers: 4 },
  );
  const preset = computingModule.presets[0];

  expect(preset.activeBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 6,
    [computingRecipeIds.basicRack]: 210,
    [computingRecipeIds.waterChiller]: 5,
  });
  expect(preset.dataSources).toEqual({
    [computingRecipeIds.dataCenter]: "synced",
    [computingRecipeIds.basicRack]: "synced",
    [computingRecipeIds.waterChiller]: "planned",
  });
  expect(preset.planMismatches).toHaveLength(1);
});

it("keeps an at-most computing target planned until excess capacity is paused", () => {
  const computingModule = createComputingModule(
    { dataCenterCount: 5, rackCount: 202, waterChillers: 5 },
    { dataCenterCount: 6, rackCount: 210, waterChillers: 6 },
    "planned",
    "synced",
    { dataCenterCount: 6, rackCount: 210, waterChillers: 6 },
    {
      dataCenterCount: "at-most",
      rackCount: "at-most",
      waterChillers: "at-most",
    },
  );
  const preset = computingModule.presets[0];

  expect(preset.activeBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 5,
    [computingRecipeIds.basicRack]: 202,
    [computingRecipeIds.waterChiller]: 5,
  });
  expect(preset.dataSources).toEqual({
    [computingRecipeIds.dataCenter]: "planned",
    [computingRecipeIds.basicRack]: "planned",
    [computingRecipeIds.waterChiller]: "planned",
  });
  expect(preset.planMismatches).toMatchObject([
    {
      recipeId: computingRecipeIds.dataCenter,
      direction: "at-most",
      actions: [{ type: "pause", label: "Pause 1 Data Center" }],
    },
    {
      recipeId: computingRecipeIds.basicRack,
      direction: "at-most",
      actions: [{
        type: "pause",
        label: "Pause Data Centers for 8 Basic Server Racks",
      }],
    },
    {
      recipeId: computingRecipeIds.waterChiller,
      direction: "at-most",
      actions: [{ type: "pause", label: "Pause 1 Water Chiller" }],
    },
  ]);
});
