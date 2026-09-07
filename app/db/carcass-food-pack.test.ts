import { expect, it } from "vitest";

import { calculateNet } from "../helpers/calculate/calculate";
import { getSurplusRootCause } from "../helpers/surplus-root-cause/surplus-root-cause";
import { type Recipe, recipes } from "./recipes";
import { type ResourceId } from "./resources";

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
  capacityPoolId: recipe.sharedCapacity ? `${moduleId}:${recipe.sharedCapacity.id}` : undefined,
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

  // With no Sausage demand, all carcass can become Meat; only its unavoidable
  // Trimmings byproduct remains.
  expect(net("chickenCarcass")).toBeCloseTo(0, 2);
  expect(net("foodPack")).toBeCloseTo(25 * 32 / 24);
  expect(net("meatTrimmings")).toBeCloseTo(12);
});

const foodLines = () => [
  balancedLine(getRecipe("food-processor-meat"), 2),
  balancedLine(getRecipe("food-processor-meat-trimmings")),
  balancedLine(getRecipe("food-processor-sausage")),
  balancedLine(getRecipe("assembly-v-food-pack-eggs"), 2),
  balancedLine(getRecipe("assembly-v-food-pack-meat"), 2),
  balancedLine(getRecipe("mill-wheat"), 6),
  balancedLine(getRecipe("baking-unit-bread"), 4),
  balancedLine(getRecipe("anaerobic-digester-meat-trimmings"), 4),
  balancedLine(getRecipe("anaerobic-digester-wheat"), 4),
];
const quantity = (result: ReturnType<typeof calculateNet>, recipeId: string, resourceId: ResourceId, direction: "actualInputs" | "actualOutputs") => (
  result.regularResults.find(line => line.recipe.id === recipeId)?.[direction]
    .find(amount => amount.resourceId === resourceId)?.quantity ?? 0
);

it.each([false, true])("reserves population Meat and Sausages before surplus packs and digestion (reversed: %s)", reverse => {
  const lines = foodLines();
  const result = calculateNet(
    reverse ? lines.toReversed() : lines,
    { chickenCarcass: 60, eggs: 24, wheat: 100, water: 1000, salt: 1000 },
    undefined, {}, { meat: 12, sausage: 15, foodPack: 32 },
  );

  expect(result.allResourceFlows.find(flow => flow.resourceId === "meat")?.net).toBeCloseTo(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "sausage")?.net).toBeCloseTo(0);
  expect(quantity(result, "assembly-v-food-pack-eggs", "foodPack", "actualOutputs")).toBeCloseTo(32);
  // Carcass x for Meat: 0.2x + 0.9(60-x) = 15 Trimmings for Sausages.
  expect(quantity(result, "assembly-v-food-pack-meat", "foodPack", "actualOutputs"))
    .toBeCloseTo(((54 - 15) / 0.7 / 2 - 12) * 32 / 24);
  expect(quantity(result, "anaerobic-digester-meat-trimmings", "meatTrimmings", "actualInputs")).toBeCloseTo(0);
  expect(result.allResourceFlows.filter(flow => flow.net < -0.001)).toEqual([]);
});

it.each([20, 30])("does not take scarce carcass from population food for packs or fuel (%s carcass)", chickenCarcass => {
  const result = calculateNet(foodLines().toReversed(),
    { chickenCarcass, wheat: 100, water: 1000, salt: 1000 },
    undefined, {}, { meat: 12, sausage: 15, foodPack: 32 });

  expect(quantity(result, "food-processor-meat", "meat", "actualOutputs")).toBeCloseTo(Math.min(12, chickenCarcass / 2));
  expect(quantity(result, "assembly-v-food-pack-meat", "foodPack", "actualOutputs")).toBe(0);
  expect(quantity(result, "anaerobic-digester-meat-trimmings", "meatTrimmings", "actualInputs")).toBe(0);
});

it("uses scarce Wheat for Sausages, then surplus packs, before digestion", () => {
  const run = (wheat: number) => calculateNet(foodLines(),
    { chickenCarcass: 60, eggs: 24, wheat, water: 1000, salt: 1000 },
    undefined, {}, { meat: 12, sausage: 15 });
  const scarce = run(15 * 6 / 24);

  expect(quantity(scarce, "food-processor-sausage", "sausage", "actualOutputs")).toBeCloseTo(15);
  expect(quantity(scarce, "assembly-v-food-pack-eggs", "foodPack", "actualOutputs")).toBeCloseTo(0);
  expect(quantity(scarce, "assembly-v-food-pack-meat", "foodPack", "actualOutputs")).toBeCloseTo(0);

  const enoughForSomePacks = run(45);

  expect(quantity(enoughForSomePacks, "assembly-v-food-pack-meat", "foodPack", "actualOutputs")).toBeGreaterThan(0);
  expect(quantity(enoughForSomePacks, "anaerobic-digester-wheat", "wheat", "actualInputs")).toBeCloseTo(0);
  expect(enoughForSomePacks.allResourceFlows.filter(flow => flow.net < -0.001)).toEqual([]);
});

it("keeps both packing recipes' surplus output when import demand is already covered", () => {
  const result = calculateNet([
    balancedLine(getRecipe("assembly-v-food-pack-eggs"), 2),
    balancedLine(getRecipe("assembly-v-food-pack-meat"), 2),
  ], { eggs: 24, meat: 12, bread: 200 }, undefined, {}, { foodPack: 32 });

  expect(result.allResourceFlows.find(flow => flow.resourceId === "foodPack"))
    .toMatchObject({ produced: 48, consumed: 32, net: 16 });
});

it("does not charge demand unlocked by a preceding surplus route to Food Packs", () => {
  const recoveredIron: Recipe = {
    id: "test-recovered-iron", name: "Recovered Iron", building: "Test", group: "production",
    balanceBy: "output", balanceOutputIds: [],
    consumeSurplusInputIds: ["ironScrap"], surplusConsumptionPhase: "before-fallback",
    surplusConsumptionPriority: 1,
    inputs: [{ resourceId: "ironScrap", quantity: 1 }],
    outputs: [{ resourceId: "iron", quantity: 1 }],
  };
  const constructionParts: Recipe = {
    id: "test-construction-parts", name: "Construction Parts", building: "Test", group: "production",
    balanceBy: "output", balanceInputIds: ["iron"],
    inputs: [{ resourceId: "iron", quantity: 1 }, { resourceId: "rock", quantity: 1 }],
    outputs: [{ resourceId: "constructionPartsI", quantity: 1 }],
  };
  const result = calculateNet([
    balancedLine(recoveredIron), balancedLine(constructionParts),
    balancedLine(getRecipe("assembly-v-food-pack-eggs")),
  ], { ironScrap: 1, eggs: 24, bread: 48 }, undefined, {}, { constructionPartsI: 1 });

  expect(result.allResourceFlows.find(flow => flow.resourceId === "rock")?.net).toBe(-1);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "foodPack")?.produced).toBe(32);
  expect(result.blockedRoutes.find(route => route.recipe.id === "assembly-v-food-pack-eggs")).toBeUndefined();
});

it.each([0, 1])("keeps recovered Water for packs when byproduct disposal has %s Rock available", rock => {
  const bread: Recipe = {
    id: "test-bread-byproduct", name: "Bread", building: "Test", group: "production",
    balanceBy: "output", balanceOutputIds: ["bread"],
    inputs: [{ resourceId: "water", quantity: 1 }],
    outputs: [{ resourceId: "bread", quantity: 48 }, { resourceId: "compost", quantity: 1 }],
  };
  const recovery: Recipe = {
    id: "test-water-recovery", name: "Recovery", building: "Test", group: "sink",
    inputs: [{ resourceId: "steamDepleted", quantity: 1 }], outputs: [{ resourceId: "water", quantity: 1 }],
  };
  const gravel: Recipe = {
    id: "test-gravel", name: "Gravel", building: "Test", group: "production", balanceBy: "output",
    inputs: [{ resourceId: "rock", quantity: 1 }], outputs: [{ resourceId: "gravel", quantity: 1 }],
  };
  const dirt: Recipe = {
    id: "test-dirt", name: "Dirt", building: "Test", group: "production",
    allocation: "surplus", balanceBy: "input", balanceInputIds: ["compost"],
    inputs: [{ resourceId: "compost", quantity: 1 }, { resourceId: "gravel", quantity: 1 }],
    outputs: [{ resourceId: "dirt", quantity: 2 }],
  };
  const result = calculateNet([
    balancedLine(bread), balancedLine(gravel), balancedLine(dirt), balancedLine(recovery),
    balancedLine(getRecipe("assembly-v-food-pack-eggs")),
  ], { eggs: 24, steamDepleted: 1, ...(rock ? { rock } : {}) });

  expect(result.allResourceFlows.find(flow => flow.resourceId === "foodPack")?.produced).toBeCloseTo(32);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "compost")?.net).toBeCloseTo(1 - rock);
  expect(result.allResourceFlows.filter(flow => flow.net < -0.001)).toEqual([]);
});

it("clears an earlier shortage when a byproduct frees enough input for the next attempt", () => {
  const flour: Recipe = {
    id: "test-flour", name: "Flour", building: "Mill", group: "production", balanceBy: "output",
    inputs: [], outputs: [{ resourceId: "flour", quantity: 2.5 }],
  };
  const feed: Recipe = {
    id: "test-feed", name: "Feed", building: "Mixer", group: "production", balanceBy: "output",
    inputs: [{ resourceId: "flour", quantity: 1 }], outputs: [{ resourceId: "animalFeed", quantity: 1 }],
  };
  const packs: Recipe = {
    id: "test-packs", name: "Packs", building: "Packing", group: "production", balanceBy: "output",
    balanceOutputIds: ["foodPack"], consumeSurplusInputIds: ["meat"],
    surplusConsumptionPhase: "before-fallback",
    inputs: [{ resourceId: "meat", quantity: 10 }, { resourceId: "flour", quantity: 2 }],
    outputs: [{ resourceId: "foodPack", quantity: 1 }, { resourceId: "animalFeed", quantity: 1 }],
  };
  const result = calculateNet(
    [flour, feed, packs].map(recipe => balancedLine(recipe)),
    { meat: 20 }, undefined, {}, { animalFeed: 1 },
  );

  // The first attempt lacks Flour. Its Feed byproduct then releases the
  // Mixer's Flour, allowing Packing to reach full capacity on a later pass.
  expect(quantity(result, packs.id, "foodPack", "actualOutputs")).toBeCloseTo(1);
  expect(quantity(result, feed.id, "animalFeed", "actualOutputs")).toBeCloseTo(0);
  expect(result.blockedRoutes).toEqual([]);
  expect(getSurplusRootCause("meat", result.regularResults, result.blockedRoutes, [], 10).kind)
    .toBe("at-capacity");
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
