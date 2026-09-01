import { expect, it } from "vitest";

import {
  getSyncedChickenFarmConfigurations,
  getSyncedChickenFarmEntities,
  getSyncedComputingConfigs,
  getSyncedCropFarmEntities,
} from "./synced-production-config";

it("maps computing built and running capacity independently", () => {
  expect(getSyncedComputingConfigs({
    dataCenters: { built: 5, running: 1 },
    racks: { built: 202, running: 48 },
    waterChillers: { built: 5, running: 4 },
  })).toEqual({
    built: { dataCenterCount: 5, rackCount: 202, waterChillers: 5 },
    running: { dataCenterCount: 1, rackCount: 48, waterChillers: 4 },
  });
});

it("preserves chicken modes, population, identities, and areas", () => {
  const state = {
    configurations: [{
      slaughtering: true,
      built: 5,
      running: 1,
      chickens: 2_350,
      runningChickens: 500,
    }],
    entities: [{
      entityId: 84,
      prototypeId: "ChickenFarm" as const,
      running: false,
      slaughtering: true,
      chickens: 350,
      zones: [{ id: 12, name: "Chicken Farms" }],
    }],
  };

  expect(getSyncedChickenFarmConfigurations(state)).toEqual(state.configurations);
  expect(getSyncedChickenFarmEntities(state)).toEqual([{
    entityId: 84,
    running: false,
    slaughtering: true,
    chickens: 350,
    zones: [{ id: 12, name: "Chicken Farms" }],
  }]);
});

it("maps exact crop-farm configuration and supplied fertilizer", () => {
  expect(getSyncedCropFarmEntities({
    configurations: [],
    entities: [{
      entityId: 42,
      prototypeId: "FarmT4",
      running: false,
      fertilityTargetPercent: 110,
      fertilizerProductId: "Product_Fertilizer2",
      schedule: ["Crop_Corn", "Crop_Wheat", null, null],
      zones: [{ id: 10, name: "Any farming area" }],
    }],
  })).toEqual([{
    entityId: 42,
    tierId: "greenhouseII",
    running: false,
    fertilityTargetPercent: 110,
    fertilizerId: "fertilizerII",
    schedule: ["corn", "wheat", "none", "none"],
    zones: [{ id: 10, name: "Any farming area" }],
  }]);
});

it("creates entity-shaped synced farms for older aggregate snapshots", () => {
  expect(getSyncedCropFarmEntities({
    entities: [],
    configurations: [{
      prototypeId: "FarmT4",
      built: 2,
      running: 1,
      fertilityTargetPercent: 140,
      fertilizerProductId: "Product_Fertilizer2",
      schedule: ["Crop_Potato", "Crop_Fruits", null, "Crop_Wheat"],
    }],
  })).toEqual([
    expect.objectContaining({
      tierId: "greenhouseII",
      running: true,
      fertilizerId: "fertilizerII",
      schedule: ["potato", "fruit", "none", "wheat"],
    }),
    expect.objectContaining({
      tierId: "greenhouseII",
      running: false,
      fertilizerId: "fertilizerII",
      schedule: ["potato", "fruit", "none", "wheat"],
    }),
  ]);
});
