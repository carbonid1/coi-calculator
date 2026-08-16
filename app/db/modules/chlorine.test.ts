import { expect, it } from "vitest";
import { type ProductionLine, calculateNet } from "../../helpers/calculate/calculate";
import { type Recipe, recipes } from "../recipes";
import { general } from "./general";
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

it("keeps Nuclear Brine processing local and adds a General surplus pond", () => {
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
  expect(nuclearPreset?.builtBuildings).toMatchObject({
    "electrolyzer-ii-chlorine": 2,
    "evaporation-pond-heated-salt-brine": 2,
  });
  expect(nuclearPreset?.activeBuildings).toMatchObject({
    "electrolyzer-ii-chlorine": 1,
    "evaporation-pond-heated-salt-brine": 1,
  });
});

it("keeps Nuclear Brine out of the General surplus pond", () => {
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
    name: "General Brine",
    building: "Test",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "brine", quantity: 40 }],
  };
  const generalDemand: Recipe = {
    id: "test-general-brine-demand",
    name: "General Brine Demand",
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
  const pondResult = result.sinkResults.find(
    (candidate) => candidate.recipe.id === generalPond.id,
  );

  expect(dumpResult?.actualInputs).toEqual([{ resourceId: "brine", quantity: 100 }]);
  expect(pondResult?.actualInputs).toEqual([{ resourceId: "brine", quantity: 10 }]);
  expect(pondResult?.actualOutputs).toEqual([{ resourceId: "salt", quantity: 1.25 }]);
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
