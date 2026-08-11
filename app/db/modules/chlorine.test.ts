import { expect, it } from "vitest";
import { type ProductionLine, calculateNet } from "../../helpers/calculate/calculate";
import { type Recipe, recipes } from "../recipes";
import { general } from "./general";

const recipeById = (id: string): Recipe => {
  const recipe = recipes.find((candidate) => candidate.id === id);

  if (!recipe) throw new Error(`Missing recipe: ${id}`);

  return recipe;
};

const balancedLine = (recipe: Recipe): ProductionLine => ({
  recipe,
  moduleId: "chlorine-test",
  buildingCount: 1,
  totalBuildings: 1,
  speedLevel: 1,
  operatingMode: "balanced",
});

it("models the two installed Electrolyzer II buildings", () => {
  const preset = general.presets.find((candidate) => candidate.id === general.defaultPresetId);

  expect(general.buildingTotals["electrolyzer-ii-chlorine"]).toBe(2);
  expect(preset?.buildingTotals?.["electrolyzer-ii-chlorine"]).toBe(2);
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
