import { describe, expect, it } from "vitest";

import {
  getRecipeInputQuantity,
  getRecipeOutputQuantity,
} from "../helpers/modifiers/recipe-output";
import { recipes } from "./recipes";

describe("Chemical Plant II graphite from coal", () => {
  const recipe = recipes.find(({ id }) => id === "chemical-plant-ii-graphite-coal")!;

  it("uses the installed 30-second binding normalized to one production cycle", () => {
    expect(recipe).toBeDefined();
    expect(recipe.cycleDurationSeconds).toBe(30);
    expect(recipe.inputs.map((input) => [
      input.resourceId,
      getRecipeInputQuantity(input),
    ])).toEqual([
      ["coal", 8],
      ["chlorine", 24],
    ]);
    expect(recipe.outputs.map((output) => [
      output.resourceId,
      getRecipeOutputQuantity(recipe, output),
    ])).toEqual([
      ["graphite", 24],
      ["sourWater", 8],
    ]);
  });

  it("gives three plants 72 Graphite of capacity per production cycle", () => {
    const graphite = recipe.outputs.find(({ resourceId }) => resourceId === "graphite")!;

    expect(getRecipeOutputQuantity(recipe, graphite) * 3).toBe(72);
  });
});
