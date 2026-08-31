import { describe, expect, it } from "vitest";

import { recipes } from "../../db/recipes";
import { getRecipeDisplayName } from "./recipe-display";

describe("recipe display names", () => {
  it("extracts the configuration from legacy building-prefixed names", () => {
    expect(getRecipeDisplayName({
      building: "Chemical Plant II",
      name: "Chemical Plant II (Bauxite Digestion)",
    })).toBe("Bauxite Digestion");
  });

  it("extracts only the final configuration when the building name has parentheses", () => {
    expect(getRecipeDisplayName({
      building: "Smoke stack (large)",
      name: "Smoke stack (large) (Oxygen)",
    })).toBe("Oxygen");
  });

  it("does not treat parentheses in a repeated building name as configuration", () => {
    expect(getRecipeDisplayName({
      building: "Loose station module (electrified)",
      name: "Loose station module (electrified)",
    })).toBe("Loose station module (electrified)");
  });

  it("keeps descriptive names that do not use a parenthesized configuration", () => {
    expect(getRecipeDisplayName({
      building: "Space Station Orbital Research",
      name: "Space Station IV Orbital Research",
    })).toBe("Space Station IV Orbital Research");
  });

  it("removes a repeated building prefix from descriptive names", () => {
    expect(getRecipeDisplayName({
      building: "Crusher (Large)",
      name: "Crusher (Large) — Bauxite",
    })).toBe("Bauxite");
    expect(getRecipeDisplayName({
      building: "Space Station IV",
      name: "Space Station IV Operations",
    })).toBe("Operations");
  });

  it("prefers an explicit display name", () => {
    expect(getRecipeDisplayName({
      building: "Chemical Plant II",
      displayName: "CO₂ → Graphite",
      name: "Internal recipe name",
    })).toBe("CO₂ → Graphite");
  });

  it("uses an explicit player-facing label for an exported game recipe", () => {
    expect(getRecipeDisplayName({
      building: "Arc furnace II",
      gameRecipeId: "CopperSmeltingArc",
      displayName: "Copper smelting",
      name: "Localized recipe name",
    })).toBe("Copper smelting");
  });

  it("describes Copper Electrolysis by its full material transformation", () => {
    const recipe = recipes.find(({ id }) => id === "copper-electrolysis-acid");

    expect(recipe).toBeDefined();
    expect(getRecipeDisplayName(recipe!)).toBe("Impure Copper + Acid → Copper");
  });
});
