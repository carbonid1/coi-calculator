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

it("assigns planned Brine processing to Nuclear rather than General", () => {
  const generalPreset = general.presets.find(
    (candidate) => candidate.id === general.defaultPresetId,
  );
  const nuclearPreset = nuclear.presets.find(
    (candidate) => candidate.id === nuclear.defaultPresetId,
  );

  expect(general.builtBuildings["electrolyzer-ii-chlorine"]).toBeUndefined();
  expect(generalPreset?.builtBuildings?.["electrolyzer-ii-chlorine"]).toBeUndefined();
  expect(nuclearPreset?.builtBuildings).toMatchObject({
    "electrolyzer-ii-chlorine": 2,
    "evaporation-pond-heated-salt-brine": 2,
  });
  expect(nuclearPreset?.activeBuildings).toMatchObject({
    "electrolyzer-ii-chlorine": 1,
    "evaporation-pond-heated-salt-brine": 1,
  });
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
