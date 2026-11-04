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
