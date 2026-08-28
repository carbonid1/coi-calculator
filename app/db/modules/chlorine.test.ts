import { expect, it } from "vitest";
import { type ProductionLine, calculateNet } from "../../helpers/calculate/calculate";
import { type Recipe, recipes } from "../recipes";
import { defaultArea as general } from "./default";
import { nuclear } from "./nuclear";

const recipeById = (id: string): Recipe => {
  const recipe = recipes.find((candidate) => candidate.id === id);

  if (!recipe) throw new Error(`Missing recipe: ${id}`);

  return recipe;
};

const balancedLine = (recipe: Recipe): ProductionLine => ({
  recipe,
  moduleId: "chlorine-test",
  activeBuildings: 1,
  builtBuildings: 1,
  speedLevel: 1,
  operatingMode: "balanced",
});

const fixedLine = (recipe: Recipe, moduleId: string): ProductionLine => ({
  recipe,
  moduleId,
  activeBuildings: 1,
  builtBuildings: 1,
  speedLevel: 1,
  operatingMode: "fixed",
});

it("prioritizes the modeled Default pond before balanced Nuclear salt production", () => {
  const generalPreset = general.presets.find(
    (candidate) => candidate.id === general.defaultPresetId,
  );
  const nuclearPreset = nuclear.presets.find(
    (candidate) => candidate.id === nuclear.defaultPresetId,
  );

  expect(general.builtBuildings["electrolyzer-ii-chlorine"]).toBeUndefined();
  expect(generalPreset?.builtBuildings?.["electrolyzer-ii-chlorine"]).toBeUndefined();
  expect(generalPreset?.builtBuildings).toMatchObject({
    "general-evaporation-pond-heated-brine-surplus": 1,
  });
  expect(generalPreset?.fixed).toContain(
    "general-evaporation-pond-heated-brine-surplus",
  );
  expect(nuclearPreset?.builtBuildings).toMatchObject({
    "electrolyzer-ii-chlorine": 2,
    "evaporation-pond-heated-salt-brine": 2,
  });
  expect(nuclearPreset?.activeBuildings).toMatchObject({
    "electrolyzer-ii-chlorine": 1,
    "evaporation-pond-heated-salt-brine": 1,
  });
});

it("exports Nuclear Brine to the fixed Default pond before dumping the remainder", () => {
  const nuclearBrine: Recipe = {
    id: "test-nuclear-brine",
    name: "Nuclear Brine",
    building: "Test",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "brine", quantity: 100 }],
  };
  const generalBrine: Recipe = {
    id: "test-general-brine",
    name: "Default Brine",
    building: "Test",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "brine", quantity: 40 }],
  };
  const generalDemand: Recipe = {
    id: "test-general-brine-demand",
    name: "Default Brine Demand",
    building: "Test",
    group: "production",
    inputs: [{ resourceId: "brine", quantity: 30 }],
    outputs: [],
  };
  const nuclearDump = recipeById("nuclear-liquid-dump-brine");
  const generalPond = recipeById("general-evaporation-pond-heated-brine-surplus");
  const result = calculateNet([
    fixedLine(nuclearBrine, "nuclear"),
    fixedLine(generalBrine, "general"),
    fixedLine(generalDemand, "general"),
    fixedLine(nuclearDump, "nuclear"),
    fixedLine(generalPond, "general"),
  ]);
  const dumpResult = result.sinkResults.find(
    (candidate) => candidate.recipe.id === nuclearDump.id,
  );
  const pondResult = result.regularResults.find(
    (candidate) => candidate.recipe.id === generalPond.id,
  );

  expect(pondResult?.actualInputs).toEqual([{ resourceId: "brine", quantity: 96 }]);
  expect(pondResult?.actualOutputs).toEqual([{ resourceId: "salt", quantity: 12 }]);
  expect(dumpResult?.actualInputs[0]).toMatchObject({ resourceId: "brine" });
  expect(dumpResult?.actualInputs[0]?.quantity).toBeCloseTo(14);
});

it("balances two Nuclear ponds against Salt demand left after the fixed Default pond", () => {
  const nuclearBrine: Recipe = {
    id: "test-nuclear-brine-for-salt",
    name: "Nuclear Brine for Salt",
    building: "Test",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "brine", quantity: 192 }],
  };
  const generalPond = recipeById("general-evaporation-pond-heated-brine-surplus");
  const nuclearPond = recipeById("evaporation-pond-heated-salt-brine");
  const result = calculateNet(
    [
      fixedLine(nuclearBrine, "nuclear"),
      fixedLine(generalPond, "general"),
      {
        ...balancedLine(nuclearPond),
        moduleId: "nuclear",
        activeBuildings: 2,
        builtBuildings: 2,
      },
    ],
    {},
    50,
    {},
    { salt: 24 },
  );
  const generalResult = result.regularResults.find(
    (candidate) => candidate.recipe.id === generalPond.id,
  );
  const nuclearResult = result.regularResults.find(
    (candidate) => candidate.recipe.id === nuclearPond.id,
  );

  expect(generalResult?.supplyRatio).toBe(1);
  expect(generalResult?.actualInputs).toEqual([{ resourceId: "brine", quantity: 96 }]);
  expect(nuclearResult?.supplyRatio).toBe(0.5);
  expect(nuclearResult?.actualInputs).toEqual([{ resourceId: "brine", quantity: 96 }]);
  expect(result.allResourceFlows.find(({ resourceId }) => resourceId === "salt")?.net)
    .toBe(0);
});

it("uses Titanium reduction Chlorine before running Electrolyzer II", () => {
  const reduction = recipeById("chemical-plant-ii-titanium-reduction");
  const electrolyzer = recipeById("electrolyzer-ii-chlorine");
  const result = calculateNet(
    [balancedLine(reduction), balancedLine(electrolyzer)],
    {
      titaniumChloridePure: 24,
      salt: 12,
      brine: 72,
    },
    50,
    {},
    {
      titaniumSponge: 24,
      chlorine: 24,
    },
  );
  const reductionResult = result.regularResults.find(
    (candidate) => candidate.recipe.id === reduction.id,
  );
  const electrolyzerResult = result.regularResults.find(
    (candidate) => candidate.recipe.id === electrolyzer.id,
  );

  expect(reductionResult?.actualOutputs).toContainEqual({
    resourceId: "chlorine",
    quantity: 12,
  });
  expect(electrolyzerResult?.actualOutputs).toContainEqual({
    resourceId: "chlorine",
    quantity: 12,
  });
});

it("keeps Titanium production idle without Titanium Alloy demand", () => {
  const titaniumRecipeIds = [
    "crusher-large-titanium",
    "arc-furnace-ii-titanium-ore",
    "chemical-plant-ii-titanium-chlorination",
    "distillation-stage-iii-titanium-purification",
    "chemical-plant-ii-titanium-reduction",
    "arc-furnace-ii-titanium-sponge",
    "alloy-mixer-titanium",
    "cooled-caster-ii-titanium-alloy",
  ];
  const result = calculateNet(titaniumRecipeIds.map((id) => balancedLine(recipeById(id))));

  expect(result.regularResults.every((candidate) => candidate.supplyRatio === 0)).toBe(true);
});
