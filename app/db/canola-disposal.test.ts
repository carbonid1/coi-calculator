import { expect, it } from "vitest";

import { buildModuleLines } from "../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../helpers/calculate/calculate";
import { calculateFactoryTotal } from "../helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "../helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "../helpers/modifiers/calculate-food-consumption";
import { calculateMaintenanceOutput } from "../helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "../helpers/modifiers/calculate-recycling-efficiency";
import { activeContracts } from "./contracts";
import { defaultActiveEdicts } from "./edicts";
import { defaultArea as general } from "./modules/default";
import { factoryModelModules as modules } from "./modules/modules";
import { calculateOfficePlan, resolvedOfficePlan } from "./offices";
import { type Recipe, recipes } from "./recipes";
import { defaultInfiniteResearchLevels } from "./research";

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

it("disposes of the planned factory's remaining Canola and Cooking Oil", () => {
  const focusBonuses = calculateOfficePlan(
    resolvedOfficePlan.value,
    defaultInfiniteResearchLevels.focusPoints,
  ).bonuses;
  const cropFarming = calculateCropFarmingModifiers(
    defaultInfiniteResearchLevels.cropYield,
    defaultActiveEdicts.farmingBoost,
    focusBonuses.cropYield,
  );
  const result = calculateFactoryTotal(modules, {
    contracts: activeContracts,
    recyclingEfficiencyPercent: calculateRecyclingEfficiency(
      defaultActiveEdicts.recyclingIncrease,
      focusBonuses.recyclingEfficiency,
    ).effectivePercent,
    outputModifiers: {
      cropYield: cropFarming.yieldMultiplier,
      cropWater: cropFarming.waterDemandMultiplier,
      foodConsumption: calculateFoodConsumption(
        0,
        2,
        focusBonuses.foodConsumption,
      ).multiplier,
      maintenanceOutput: calculateMaintenanceOutput(
        defaultInfiniteResearchLevels.maintenanceOutput,
        focusBonuses.maintenanceProduction,
      ).multiplier,
      settlementConsumption: 1 + focusBonuses.settlementConsumption / 100,
    },
    contractsProfitMultiplier: 1 + focusBonuses.contractsProfitability / 100,
  });
  const flow = (resourceId: string) => result.calculation.allResourceFlows.find(
    (candidate) => candidate.resourceId === resourceId,
  );
  const reformer = result.calculation.regularResults.find(
    (candidate) => candidate.recipe.id === "chemical-plant-ii-cooking-oil-diesel",
  );
  const cookingOilInput = reformer?.actualInputs.find(
    (input) => input.resourceId === "cookingOil",
  )?.quantity ?? 0;
  const ethanolInput = reformer?.actualInputs.find(
    (input) => input.resourceId === "ethanol",
  )?.quantity ?? 0;
  const dieselOutput = reformer?.actualOutputs.find(
    (output) => output.resourceId === "diesel",
  )?.quantity ?? 0;

  expect(flow("canola")?.net).toBeCloseTo(0);
  expect(flow("cookingOil")?.net).toBeCloseTo(0);
  expect(cookingOilInput).toBeGreaterThan(0);
  expect(ethanolInput).toBeCloseTo(cookingOilInput / 2);
  expect(dieselOutput).toBeCloseTo(cookingOilInput * 1.8);
  expect(reformer?.supplyRatio).toBeCloseTo(cookingOilInput / 30);
});

it("uses Animal Feed co-products before balancing the dedicated Corn recipe", () => {
  const focusBonuses = calculateOfficePlan(
    resolvedOfficePlan.value,
    defaultInfiniteResearchLevels.focusPoints,
  ).bonuses;
  const cropFarming = calculateCropFarmingModifiers(
    defaultInfiniteResearchLevels.cropYield,
    defaultActiveEdicts.farmingBoost,
    focusBonuses.cropYield,
  );
  const result = calculateFactoryTotal(modules, {
    contracts: activeContracts,
    recyclingEfficiencyPercent: calculateRecyclingEfficiency(
      defaultActiveEdicts.recyclingIncrease,
      focusBonuses.recyclingEfficiency,
    ).effectivePercent,
    outputModifiers: {
      cropYield: cropFarming.yieldMultiplier,
      cropWater: cropFarming.waterDemandMultiplier,
      foodConsumption: calculateFoodConsumption(
        0,
        2,
        focusBonuses.foodConsumption,
      ).multiplier,
      maintenanceOutput: calculateMaintenanceOutput(
        defaultInfiniteResearchLevels.maintenanceOutput,
        focusBonuses.maintenanceProduction,
      ).multiplier,
      settlementConsumption: 1 + focusBonuses.settlementConsumption / 100,
    },
    contractsProfitMultiplier: 1 + focusBonuses.contractsProfitability / 100,
  });
  const animalFeed = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "animalFeed",
  );
  const dedicatedMixer = result.calculation.regularResults.find(
    (line) => line.recipe.id === "mixer-ii-animal-feed-corn",
  );
  const dedicatedOutput = dedicatedMixer?.actualOutputs.find(
    (output) => output.resourceId === "animalFeed",
  )?.quantity ?? 0;
  const coProductOutput = result.calculation.regularResults.reduce((total, line) => (
    line.recipe.id === "mixer-ii-animal-feed-corn"
      ? total
      : total + (line.actualOutputs.find(
        (output) => output.resourceId === "animalFeed",
      )?.quantity ?? 0)
  ), 0);

  expect(dedicatedMixer?.recipe).toMatchObject({
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["animalFeed"],
    allocation: "fallback",
  });
  expect(coProductOutput).toBeGreaterThan(0);
  expect(dedicatedOutput).toBeGreaterThan(0);
  expect(dedicatedOutput).toBeCloseTo((animalFeed?.consumed ?? 0) - coProductOutput);
  expect(animalFeed?.net).toBeCloseTo(0);
});
