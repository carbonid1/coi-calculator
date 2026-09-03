import { expect, it } from "vitest";

import {
  getSyncedChickenFarmEntities,
  getSyncedCropFarmEntities,
} from "./synced-production-config";

it("preserves chicken modes, population, identities, and areas", () => {
  const state = {
    entities: [{
      entityId: 84,
      prototypeId: "ChickenFarm" as const,
      running: false,
      slaughtering: true,
      chickens: 350,
      zones: [{ id: 12, name: "Chicken Farms" }],
    }],
  };

  expect(getSyncedChickenFarmEntities(state.entities)).toEqual([{
    entityId: 84,
    running: false,
    slaughtering: true,
    chickens: 350,
    zones: [{ id: 12, name: "Chicken Farms" }],
  }]);
});
it("maps exact crop-farm configuration and supplied fertilizer", () => {
  expect(getSyncedCropFarmEntities([{
      entityId: 42,
      prototypeId: "FarmT4",
      running: false,
      fertilityTargetPercent: 110,
      fertilizerProductId: "Product_Fertilizer2",
      schedule: ["Crop_Corn", "Crop_Wheat", null, null],
      zones: [{ id: 10, name: "Any farming area" }],
    }])).toEqual([{
    entityId: 42,
    tierId: "greenhouseII",
    running: false,
    fertilityTargetPercent: 110,
    fertilizerId: "fertilizerII",
    schedule: ["corn", "wheat", "none", "none"],
    zones: [{ id: 10, name: "Any farming area" }],
  }]);
});
