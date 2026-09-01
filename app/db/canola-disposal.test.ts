import { expect, it } from "vitest";

import { buildModuleLines } from "../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../helpers/calculate/calculate";
import { defaultArea as general } from "./modules/default";
import { type Recipe, recipes } from "./recipes";

const getRecipe = (recipeId: string) => {
  const recipe = recipes.find((candidate) => candidate.id === recipeId);

  if (!recipe) throw new Error(`Missing recipe: ${recipeId}`);

  return recipe;
};

const fixedLine = (recipe: Recipe, activeBuildings = 1, moduleId = "test") => ({
  recipe,
  moduleId,
  activeBuildings,
  builtBuildings: activeBuildings,
  speedLevel: 1,
  operatingMode: "fixed" as const,
});

const balancedLine = (recipe: Recipe, activeBuildings = 1, moduleId = "test") => ({
  recipe,
  moduleId,
  activeBuildings,
  builtBuildings: activeBuildings,
  speedLevel: 1,
  operatingMode: "balanced" as const,
});

it("plans the paused Cooking Oil reforming plant with verified v0.8.7 rates", () => {
  const preset = general.presets.find((candidate) => candidate.id === general.defaultPresetId);
  const line = buildModuleLines(general, preset ?? null).lines.find(
    (candidate) => candidate.recipe.id === "chemical-plant-ii-cooking-oil-diesel",
  );
  const mill = getRecipe("mill-canola-cooking-oil");

  expect(mill).toMatchObject({
    cycleDurationSeconds: 60,
    balanceOutputIds: ["cookingOil"],
    consumeSurplusInputIds: ["canola"],
    surplusConsumptionPriority: 100,
    surplusConsumptionPhase: "before-fallback",
    inputs: [{ resourceId: "canola", quantity: 16 }],
    outputs: [
      { resourceId: "cookingOil", quantity: 12 },
      { resourceId: "animalFeed", quantity: 4 },
    ],
  });
  expect(line).toMatchObject({
    activeBuildings: 1,
    currentActiveBuildings: 0,
    builtBuildings: 0,
    constructionGhosts: 1,
    dataSource: "planned",
    operatingMode: "balanced",
    recipe: {
      cycleDurationSeconds: 60,
      balanceOutputIds: [],
      consumeSurplusInputIds: ["cookingOil"],
      surplusConsumptionPriority: 110,
      surplusConsumptionPhase: "before-fallback",
      inputs: [
        { resourceId: "ethanol", quantity: 15 },
        { resourceId: "cookingOil", quantity: 30 },
      ],
      outputs: [{ resourceId: "diesel", quantity: 54 }],
    },
  });
});

it("uses Canola and Cooking Oil only after useful Cooking Oil demand", () => {
  const canolaSource: Recipe = {
    id: "test-canola-source",
    name: "Test Canola Source",
    building: "Test Source",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "canola", quantity: 32 }],
  };
  const usefulCookingOilConsumer: Recipe = {
    id: "test-useful-cooking-oil-consumer",
    name: "Test Useful Cooking Oil Consumer",
    building: "Test Consumer",
    group: "production",
    inputs: [{ resourceId: "cookingOil", quantity: 6 }],
    outputs: [],
  };
  const dieselConsumer: Recipe = {
    id: "test-diesel-consumer",
    name: "Test Diesel Consumer",
    building: "Test Consumer",
    group: "production",
    inputs: [{ resourceId: "diesel", quantity: 100 }],
    outputs: [],
  };
  const ethanolProducer: Recipe = {
    id: "test-ethanol-producer",
    name: "Test Ethanol Producer",
    building: "Test Producer",
    group: "production",
    balanceBy: "output",
    inputs: [],
    outputs: [{ resourceId: "ethanol", quantity: 15 }],
  };
  const mill = getRecipe("mill-canola-cooking-oil");
  const reformer = getRecipe("chemical-plant-ii-cooking-oil-diesel");
  const lines = [
    fixedLine(canolaSource, 1, "greenhouses"),
    fixedLine(usefulCookingOilConsumer, 1, "general"),
    fixedLine(dieselConsumer, 1, "general"),
    balancedLine(mill, 2, "general"),
    balancedLine(reformer, 1, "general"),
    balancedLine(ethanolProducer, 1, "chemicals"),
  ];
  const result = calculateNet(lines);
  const reformerResult = result.regularResults.find(
    (candidate) => candidate.recipe.id === reformer.id,
  );
  const ethanolResult = result.regularResults.find(
    (candidate) => candidate.recipe.id === ethanolProducer.id,
  );

  expect(result.allResourceFlows.find((flow) => flow.resourceId === "canola")?.net)
    .toBeCloseTo(0);
  expect(result.allResourceFlows.find((flow) => flow.resourceId === "cookingOil")?.net)
    .toBeCloseTo(0);
  expect(reformerResult).toMatchObject({
    supplyRatio: 0.6,
    actualInputs: [
      { resourceId: "ethanol", quantity: 9 },
      { resourceId: "cookingOil", quantity: 18 },
    ],
    actualOutputs: [{ resourceId: "diesel", quantity: 32.4 }],
  });
  expect(ethanolResult?.actualOutputs).toEqual([
    { resourceId: "ethanol", quantity: 9 },
  ]);
  expect(result.allResourceFlows.find((flow) => flow.resourceId === "diesel")?.net)
    .toBeCloseTo(-67.6);

  const noSurplusConsumer: Recipe = {
    ...usefulCookingOilConsumer,
    id: "test-all-cooking-oil-consumer",
    inputs: [{ resourceId: "cookingOil", quantity: 24 }],
  };
  const noSurplusResult = calculateNet([
    fixedLine(canolaSource, 1, "greenhouses"),
    fixedLine(noSurplusConsumer, 1, "general"),
    fixedLine(dieselConsumer, 1, "general"),
    balancedLine(mill, 2, "general"),
    balancedLine(reformer, 1, "general"),
    balancedLine(ethanolProducer, 1, "chemicals"),
  ]);
  const idleReformer = noSurplusResult.regularResults.find(
    (candidate) => candidate.recipe.id === reformer.id,
  );

  expect(idleReformer?.supplyRatio).toBe(0);
  expect(noSurplusResult.allResourceFlows.find((flow) => flow.resourceId === "diesel")?.net)
    .toBe(-100);
});
