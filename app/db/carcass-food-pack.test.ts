import { expect, it } from "vitest";

import { calculateNet } from "../helpers/calculate/calculate";
import { type Recipe, recipes } from "./recipes";

const getRecipe = (recipeId: string) => {
  const recipe = recipes.find((candidate) => candidate.id === recipeId);

  if (!recipe) throw new Error(`Missing recipe: ${recipeId}`);

  return recipe;
};

const balancedLine = (recipe: Recipe, activeBuildings = 1, moduleId = "test") => ({
  recipe,
  moduleId,
  activeBuildings,
  builtBuildings: activeBuildings,
  speedLevel: 1,
  operatingMode: "balanced" as const,
});

const fixedLine = (recipe: Recipe, activeBuildings = 1, moduleId = "test") => ({
  recipe,
  moduleId,
  activeBuildings,
  builtBuildings: activeBuildings,
  speedLevel: 1,
  operatingMode: "fixed" as const,
});

it("turns surplus Chicken Carcass into Food Packs instead of Trimmings", () => {
  const carcassSource: Recipe = {
    id: "test-carcass-source",
    name: "Test Carcass Source",
    building: "Test Source",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "chickenCarcass", quantity: 60 }],
  };
  const settlementMeat: Recipe = {
    id: "test-meat-consumer",
    name: "Test Meat Consumer",
    building: "Test Consumer",
    group: "production",
    inputs: [{ resourceId: "meat", quantity: 5 }],
    outputs: [],
  };
  const breadSource: Recipe = {
    id: "test-bread-source",
    name: "Test Bread Source",
    building: "Test Producer",
    group: "production",
    balanceBy: "output",
    inputs: [],
    outputs: [{ resourceId: "bread", quantity: 48 }],
  };

  const { allResourceFlows } = calculateNet(
    [
      fixedLine(carcassSource),
      fixedLine(settlementMeat),
      balancedLine(breadSource, 10),
      balancedLine(getRecipe("food-processor-meat"), 2),
      balancedLine(getRecipe("food-processor-meat-trimmings"), 1),
      balancedLine(getRecipe("assembly-v-food-pack-meat"), 2),
    ],
    { water: 1000, salt: 1000 },
  );
  const net = (resourceId: string) => (
    allResourceFlows.find((flow) => flow.resourceId === resourceId)?.net ?? 0
  );

  // The Trimmings fallback keeps its 30 carcass; the other 30 become Meat and
  // then Food Packs instead of sitting in surplus.
  expect(net("chickenCarcass")).toBeCloseTo(0, 2);
  expect(net("foodPack")).toBeGreaterThan(10);
  expect(net("meatTrimmings")).toBeGreaterThan(27);
});

it("reports the input that blocked the carcass route when water runs short", () => {
  const carcassSource: Recipe = {
    id: "test-carcass-source",
    name: "Test Carcass Source",
    building: "Test Source",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "chickenCarcass", quantity: 60 }],
  };

  // Water is produced internally but a single pump covers only a fraction of
  // what two Food Processors ask for, so the route is cut back to fit it.
  const waterSource: Recipe = {
    id: "test-water-source",
    name: "Test Water Source",
    building: "Test Pump",
    group: "production",
    balanceBy: "output",
    inputs: [],
    outputs: [{ resourceId: "water", quantity: 3 }],
  };
  const { allResourceFlows, blockedRoutes } = calculateNet(
    [
      fixedLine(carcassSource),
      balancedLine(waterSource, 1),
      balancedLine(getRecipe("food-processor-meat"), 2),
      balancedLine(getRecipe("assembly-v-food-pack-meat"), 2),
    ],
    { salt: 1000 },
  );
  const water = allResourceFlows.find((flow) => flow.resourceId === "water");
  const meatRoute = blockedRoutes.find((route) => route.recipe.id === "food-processor-meat");

  // The route ran only as far as the pump allows; no water deficit was created.
  expect(water?.net).toBeCloseTo(0, 2);
  expect(meatRoute).toMatchObject({
    surplusResourceIds: ["chickenCarcass"],
    blockedBy: { resourceId: "water" },
  });
  expect(meatRoute?.wantedRatio).toBeGreaterThan(meatRoute?.appliedRatio ?? 0);
  expect(meatRoute?.blockedBy?.deficitIncrease).toBeGreaterThan(0);
});
