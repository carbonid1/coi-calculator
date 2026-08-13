import { describe, expect, it } from "vitest";

import { recipes } from "./recipes";

const getRecipe = (id: string) => {
  const recipe = recipes.find((candidate) => candidate.id === id);

  expect(recipe, `Missing recipe ${id}`).toBeDefined();
  return recipe!;
};

describe("installed v0.8.7 advanced-material recipes", () => {
  it("contains every Aluminum production, byproduct, and scrap recipe", () => {
    const aluminumRecipeIds = [
      "crusher-large-bauxite",
      "chemical-plant-ii-bauxite-digestion",
      "settling-tank-red-mud-seawater",
      "settling-tank-red-mud-acid",
      "liquid-dump-red-mud",
      "rotary-kiln-alumina-fuel-gas",
      "rotary-kiln-alumina-hydrogen",
      "aluminum-cell-electrolysis",
      "cooled-caster-ii-aluminum",
      "arc-furnace-aluminum-scrap",
      "arc-furnace-ii-aluminum-scrap",
      "crystallizer-alumina",
      "compactor-aluminum-scrap",
      "shredder-aluminum-scrap",
    ];

    expect(aluminumRecipeIds.map((id) => getRecipe(id).id)).toEqual(aluminumRecipeIds);
    expect(getRecipe("chemical-plant-ii-bauxite-digestion")).toMatchObject({
      inputs: [
        { resourceId: "bauxitePowder", quantity: 72 },
        { resourceId: "brine", quantity: 24 },
      ],
      outputs: [
        { resourceId: "hydratedAlumina", quantity: 36 },
        { resourceId: "redMud", quantity: 36 },
      ],
    });
    expect(getRecipe("aluminum-cell-electrolysis")).toMatchObject({
      inputs: [
        { resourceId: "alumina", quantity: 24 },
        { resourceId: "graphite", quantity: 6 },
      ],
      outputs: [
        { resourceId: "moltenAluminum", quantity: 24 },
        { resourceId: "carbonDioxide", quantity: 18 },
      ],
    });
  });

  it("keeps all eight Titanium chain recipes at the installed rates", () => {
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

    expect(titaniumRecipeIds.map((id) => getRecipe(id).id)).toEqual(titaniumRecipeIds);
    expect(getRecipe("alloy-mixer-titanium")).toMatchObject({
      inputs: [
        { resourceId: "moltenTitanium", quantity: 96 },
        { resourceId: "moltenAluminum", quantity: 12 },
      ],
      outputs: [{ resourceId: "moltenTitaniumAlloy", quantity: 108 }],
    });
  });
});
