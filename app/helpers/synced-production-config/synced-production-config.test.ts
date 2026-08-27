import { expect, it } from "vitest";

import {
  getSyncedChickenFarmConfigurations,
  getSyncedComputingConfigs,
  getSyncedCropFarmConfigurations,
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

it("maps installed greenhouse prototype and crop IDs to calculator IDs", () => {
  expect(getSyncedCropFarmConfigurations({
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
