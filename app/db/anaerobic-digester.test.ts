import { describe, expect, it } from "vitest";

import { general } from "./modules/general";
import { recipes } from "./recipes";

const digestionRecipeIds = [
  "anaerobic-digester-meat-trimmings",
  "anaerobic-digester-sugar-cane",
  "anaerobic-digester-potato",
  "anaerobic-digester-wheat",
  "anaerobic-digester-corn",
  "anaerobic-digester-fruit",
  "anaerobic-digester-soybean",
  "anaerobic-digester-vegetables",
  "anaerobic-digester-poppy",
] as const;

describe("surplus-organics digestion", () => {
  it("shares two active digesters across every configured surplus recipe", () => {
    const digestionRecipes = digestionRecipeIds.map((id) => (
      recipes.find((recipe) => recipe.id === id)
    ));
    const preset = general.presets.find(({ id }) => id === general.defaultPresetId);

    expect(digestionRecipes).toHaveLength(9);
    expect(digestionRecipes.every((recipe) => (
      recipe?.sharedCapacity?.id === "anaerobic-digester-surplus-organics"
      && recipe.allocation === "fallback"
    ))).toBe(true);
    expect(digestionRecipeIds.every((id) => general.builtBuildings[id] === 3)).toBe(true);
    expect(digestionRecipeIds.every((id) => preset?.activeBuildings[id] === 2)).toBe(true);
    expect(digestionRecipeIds.every((id) => preset?.dataSources?.[id] === "modeled")).toBe(true);
    expect(digestionRecipes.map((recipe) => ({
      input: recipe?.inputs[0],
      outputs: recipe?.outputs,
    }))).toEqual([
      {
        input: { resourceId: "meatTrimmings", quantity: 8 },
        outputs: [
          { resourceId: "fuelGas", quantity: 4 },
          { resourceId: "compost", quantity: 2 },
        ],
      },
      {
        input: { resourceId: "sugarCane", quantity: 12 },
        outputs: [
          { resourceId: "fuelGas", quantity: 8 },
          { resourceId: "compost", quantity: 1 },
        ],
      },
      {
        input: { resourceId: "potato", quantity: 14 },
        outputs: [
          { resourceId: "fuelGas", quantity: 8 },
          { resourceId: "compost", quantity: 1 },
        ],
      },
      {
        input: { resourceId: "wheat", quantity: 12 },
        outputs: [
          { resourceId: "fuelGas", quantity: 12 },
          { resourceId: "compost", quantity: 1 },
        ],
      },
      {
        input: { resourceId: "corn", quantity: 14 },
        outputs: [
          { resourceId: "fuelGas", quantity: 14 },
          { resourceId: "compost", quantity: 1 },
        ],
      },
      {
        input: { resourceId: "fruit", quantity: 12 },
        outputs: [
          { resourceId: "fuelGas", quantity: 12 },
          { resourceId: "compost", quantity: 1 },
        ],
      },
      {
        input: { resourceId: "soybean", quantity: 14 },
        outputs: [
          { resourceId: "fuelGas", quantity: 12 },
          { resourceId: "compost", quantity: 1 },
        ],
      },
      {
        input: { resourceId: "vegetables", quantity: 14 },
        outputs: [
          { resourceId: "fuelGas", quantity: 8 },
          { resourceId: "compost", quantity: 1 },
        ],
      },
      {
        input: { resourceId: "poppy", quantity: 14 },
        outputs: [
          { resourceId: "fuelGas", quantity: 8 },
          { resourceId: "compost", quantity: 1 },
        ],
      },
    ]);
  });
});
