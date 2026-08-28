import { expect, it } from "vitest";

import {
  getCropFarmConfigurationsFromEntities,
  getSyncedChickenFarmConfigurations,
  getSyncedChickenFarmEntities,
  getSyncedComputingConfigs,
  getSyncedCropFarmConfigurations,
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

it("preserves chicken modes and population", () => {
  expect(getSyncedChickenFarmConfigurations({
    entities: [],
    configurations: [{
      slaughtering: true,
      built: 5,
      running: 1,
      chickens: 2_350,
      runningChickens: 500,
    }],
  })).toEqual([{
    slaughtering: true,
    built: 5,
    running: 1,
    chickens: 2_350,
    runningChickens: 500,
  }]);
});

it("preserves chicken farm IDs and exact vehicle-area membership", () => {
  expect(getSyncedChickenFarmEntities({
    configurations: [],
    entities: [{
      entityId: 84,
      prototypeId: "ChickenFarm",
      running: false,
      slaughtering: true,
      chickens: 350,
      zones: [{ id: 12, name: "Chicken Farms" }],
    }],
  })).toEqual([{
    entityId: 84,
    running: false,
    slaughtering: true,
    chickens: 350,
    zones: [{ id: 12, name: "Chicken Farms" }],
  }]);
});

it("maps installed greenhouse prototype and crop IDs to calculator IDs", () => {
  expect(getSyncedCropFarmConfigurations({
    entities: [],
    configurations: [{
      prototypeId: "FarmT4",
      built: 1,
      running: 1,
      fertilityTargetPercent: 140,
      schedule: ["Crop_Potato", "Crop_Fruits", null, "Crop_Wheat"],
    }],
  })).toEqual([{
    tierId: "greenhouseII",
    built: 1,
    running: 1,
    fertilityTargetPercent: 140,
    schedule: ["potato", "fruit", "none", "wheat"],
  }]);
});

it("groups greenhouses only when tier, schedule, and fertility configuration are identical", () => {
  expect(getSyncedCropFarmConfigurations({
    entities: [],
    configurations: [
      {
        prototypeId: "FarmT4",
        built: 1,
        running: 1,
        fertilityTargetPercent: 140,
        schedule: ["Crop_Corn", "Crop_Wheat", null, null],
      },
      {
        prototypeId: "FarmT4",
        built: 2,
        running: 0,
        fertilityTargetPercent: 140,
        schedule: ["Crop_Corn", "Crop_Wheat", null, null],
      },
      {
        prototypeId: "FarmT4",
        built: 1,
        running: 0,
        fertilityTargetPercent: 0,
        schedule: ["Crop_Corn", "Crop_Wheat", null, null],
      },
    ],
  })).toEqual([
    {
      tierId: "greenhouseII",
      built: 3,
      running: 1,
      fertilityTargetPercent: 140,
      schedule: ["corn", "wheat", "none", "none"],
    },
    {
      tierId: "greenhouseII",
      built: 1,
      running: 0,
      fertilityTargetPercent: 0,
      schedule: ["corn", "wheat", "none", "none"],
    },
  ]);
});

it("preserves stable greenhouse entity IDs for plan binding", () => {
  expect(getSyncedCropFarmEntities({
    configurations: [],
    entities: [{
      entityId: 42,
      prototypeId: "FarmT4",
      running: false,
      fertilityTargetPercent: 140,
      schedule: ["Crop_Corn", "Crop_Wheat", null, null],
    }],
  })).toEqual([{
    entityId: 42,
    tierId: "greenhouseII",
    running: false,
    fertilityTargetPercent: 140,
    schedule: ["corn", "wheat", "none", "none"],
    zones: [],
  }]);
});

it("groups only the greenhouse entities selected for an area", () => {
  expect(getCropFarmConfigurationsFromEntities([
    {
      entityId: 42,
      tierId: "greenhouseII",
      running: true,
      fertilityTargetPercent: 140,
      schedule: ["corn", "wheat", "none", "none"],
    },
    {
      entityId: 43,
      tierId: "greenhouseII",
      running: false,
      fertilityTargetPercent: 140,
      schedule: ["corn", "wheat", "none", "none"],
    },
  ])).toEqual([{
    tierId: "greenhouseII",
    built: 2,
    running: 1,
    fertilityTargetPercent: 140,
    schedule: ["corn", "wheat", "none", "none"],
  }]);
});
