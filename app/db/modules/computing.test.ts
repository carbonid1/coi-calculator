import { expect, it } from "vitest";

import { type SyncedProductionEntity } from "../../game-state";
import {
  computingRecipeIds,
  dataCenter,
  getRackAllocation,
} from "../computing";
import { createComputingModule, createLegacyComputingArea } from "./computing";
import { type Module } from "./modules";

it("calculates a synced two-data-center configuration", () => {
  const config = { dataCenterCount: 2, rackCount: 96, waterChillers: 2 };
  const computing = createComputingModule(config, config, "synced");
  const preset = computing.presets.at(0);

  expect(getRackAllocation(config.rackCount)).toEqual([48, 48]);
  expect(computing.builtBuildings).toMatchObject({
    [computingRecipeIds.dataCenter]: 2,
    [computingRecipeIds.basicRack]: 96,
    [computingRecipeIds.waterChiller]: 2,
  });
  expect(preset?.activeBuildings).toEqual(computing.builtBuildings);
  expect(config.rackCount * dataCenter.computingTflopsPerRack).toBe(384);
  expect(preset?.dataSources?.[computingRecipeIds.basicRack]).toBe("synced");
});

it("keeps built and running synced computing inventory separate", () => {
  const computingModule = createComputingModule(
    { dataCenterCount: 5, rackCount: 202, waterChillers: 5 },
    { dataCenterCount: 1, rackCount: 48, waterChillers: 4 },
    "synced",
  );
  const preset = computingModule.presets[0];

  expect(computingModule.builtBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 5,
    [computingRecipeIds.basicRack]: 202,
    [computingRecipeIds.waterChiller]: 5,
  });
  expect(preset.activeBuildings).toEqual({
    [computingRecipeIds.dataCenter]: 1,
    [computingRecipeIds.basicRack]: 48,
    [computingRecipeIds.waterChiller]: 4,
  });
  expect(preset.dataSources).toEqual({
    [computingRecipeIds.dataCenter]: "synced",
    [computingRecipeIds.basicRack]: "synced",
    [computingRecipeIds.waterChiller]: "synced",
  });
  expect(preset.planMismatches).toBeUndefined();
});

it("preserves the generated area identity and removes handled recipe issues", () => {
  const generatedWaterChillerRecipeId = "live-area-15:WaterChiller:WaterChilling";
  const generatedArea: Module = {
    id: "live-area-15",
    name: "Computing",
    description: "",
    includedInFactoryTotals: false,
    builtBuildings: { [generatedWaterChillerRecipeId]: 1 },
    recipes: [{
      id: generatedWaterChillerRecipeId,
      name: "WaterChilling",
      building: "Water chiller",
      group: "production",
      inputs: [{ resourceId: "water", quantity: 30 }],
      outputs: [{ resourceId: "chilledWater", quantity: 24 }],
    }],
    presets: [{
      id: "live",
      name: "Live area",
      description: "Synced completed buildings plus synced construction ghosts.",
      activeBuildings: { [generatedWaterChillerRecipeId]: 2 },
      currentActiveBuildings: { [generatedWaterChillerRecipeId]: 1 },
      builtBuildings: { [generatedWaterChillerRecipeId]: 1 },
      constructionGhosts: { [generatedWaterChillerRecipeId]: 1 },
      capacityPools: {
        DataCenter: {
          active: 2,
          built: 1,
          currentActive: 1,
          constructionGhosts: 1,
        },
        WaterChiller: {
          active: 2,
          built: 1,
          currentActive: 1,
          constructionGhosts: 1,
        },
      },
      dataSources: { [generatedWaterChillerRecipeId]: "synced" },
      fixed: [],
    }],
    defaultPresetId: "live",
    liveArea: {
      zoneId: 15,
      trackedBuildings: 4,
      constructedBuildings: 2,
      activeBuildings: 2,
      pausedBuildings: 0,
      constructionGhosts: 2,
      issues: [
        {
          id: "DataCenter:no-recipe",
          building: "Data Center",
          count: 1,
          message: "This building does not expose a production recipe.",
        },
      ],
    },
  };
  const computing = createComputingModule(
    { dataCenterCount: 1, rackCount: 48, waterChillers: 1 },
    { dataCenterCount: 1, rackCount: 48, waterChillers: 1 },
    "synced",
    generatedArea,
  );

  expect(computing.id).toBe("live-area-15");
  expect(computing.defaultPresetId).toBe("live");
  expect(computing.includedInFactoryTotals).toBe(true);
  expect(computing.liveArea?.issues).toEqual([]);
  expect(computing.recipes).toEqual([]);
  expect(computing.builtBuildings).not.toHaveProperty(generatedWaterChillerRecipeId);
  expect(computing.presets[0].activeBuildings).not.toHaveProperty(
    generatedWaterChillerRecipeId,
  );
  expect(computing.presets[0].description).toBe("");
  expect(computing.presets[0]).toMatchObject({
    activeBuildings: {
      [computingRecipeIds.dataCenter]: 2,
      [computingRecipeIds.basicRack]: 48,
      [computingRecipeIds.waterChiller]: 2,
    },
    currentActiveBuildings: {
      [computingRecipeIds.dataCenter]: 1,
      [computingRecipeIds.basicRack]: 48,
      [computingRecipeIds.waterChiller]: 1,
    },
    constructionGhosts: {
      [computingRecipeIds.dataCenter]: 1,
      [computingRecipeIds.basicRack]: 0,
      [computingRecipeIds.waterChiller]: 1,
    },
  });
  expect(computing.presets[0].capacityPools).toEqual({});
  expect(computing.presets[0].dataSources).toMatchObject({
    [computingRecipeIds.dataCenter]: "synced",
    [computingRecipeIds.basicRack]: "synced",
    [computingRecipeIds.waterChiller]: "synced",
  });
});

it("creates a generated-style Computing area for pre-ghost synced snapshots", () => {
  const productionEntities: SyncedProductionEntity[] = [
    {
      entityId: 1,
      prototypeId: "DataCenter",
      running: true,
      recipeIds: [],
      zones: [{ id: 15, name: "Computing" }],
      nuclearReactor: null,
      dataCenterRacks: 48,
    },
    {
      entityId: 2,
      prototypeId: "WaterChiller",
      running: false,
      recipeIds: ["WaterChilling"],
      zones: [{ id: 15, name: "Computing" }],
      nuclearReactor: null,
    },
  ];
  const area = createLegacyComputingArea(
    { id: 15, name: "Computing" },
    productionEntities,
  );
  const computing = createComputingModule(
    { dataCenterCount: 1, rackCount: 48, waterChillers: 1 },
    { dataCenterCount: 1, rackCount: 48, waterChillers: 0 },
    "synced",
    area,
  );

  expect(computing).toMatchObject({
    id: "live-area-15",
    name: "Computing",
    includedInFactoryTotals: true,
    liveArea: {
      zoneId: 15,
      trackedBuildings: 2,
      constructedBuildings: 2,
      activeBuildings: 1,
      pausedBuildings: 1,
      constructionGhosts: 0,
      issues: [],
    },
  });
  expect(computing.presets[0].activeBuildings).toMatchObject({
    [computingRecipeIds.dataCenter]: 1,
    [computingRecipeIds.basicRack]: 48,
    [computingRecipeIds.waterChiller]: 0,
  });
});
