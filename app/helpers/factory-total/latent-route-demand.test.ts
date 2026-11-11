import { expect, it } from "vitest";

import { type Recipe } from "../../db/recipes";
import { type BlockedSurplusRoute } from "../calculate/calculate";
import { getLatentRouteDemand } from "./latent-route-demand";

const recipe: Recipe = {
  id: "test-route", name: "Test Route", building: "Test", group: "production",
  inputs: [], outputs: [],
};
const route = (overrides: Partial<BlockedSurplusRoute>): BlockedSurplusRoute => ({
  recipe, moduleId: "test", activeBuildings: 1, surplusResourceIds: [],
  wantedRatio: 1, appliedRatio: 0, blockedBy: null, ...overrides,
});

it("adds each route's own shortage of the resource", () => {
  const routes = [
    route({ blockedBy: { resourceId: "water", deficitIncrease: 2 }, blockingResources: [
      { resourceId: "salt", deficitIncrease: 9 }, { resourceId: "water", deficitIncrease: 2 },
    ] }),
    route({ blockedBy: { resourceId: "water", deficitIncrease: 3 } }),
  ];

  expect(getLatentRouteDemand(routes, "water")).toBe(5);
  expect(getLatentRouteDemand(routes, "salt")).toBe(9);
  expect(getLatentRouteDemand(routes, "coal")).toBe(0);
});

it("counts a shortfall object shared by several retried routes once", () => {
  const shared = { resourceId: "water" as const, deficitIncrease: 5 };
  const routes = [
    route({ blockedBy: shared, blockingResources: [shared] }),
    route({ blockedBy: shared, blockingResources: [shared] }),
    route({ blockedBy: { resourceId: "water", deficitIncrease: 1 } }),
  ];

  expect(getLatentRouteDemand(routes, "water")).toBe(6);
});
