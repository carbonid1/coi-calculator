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

  it("prefers the readable name when a game ID is also present", () => {
    expect(getRecipeDisplayName({
      building: "Chemical Plant II", gameRecipeId: "GraphiteProductionCo2",
      name: "Graphite from Carbon Dioxide",
    })).toBe("Graphite from Carbon Dioxide");
  });

  it.each([
    ["GraphiteProduction", "coal", "Coal"],
    ["GraphiteProductionCo2", "carbonDioxide", "Carbon Dioxide"],
  ])("uses materials to distinguish the ID-only %s route", (name, resourceId, inputName) => {
    expect(getRecipeDisplayName({
      building: "Chemical Plant II", gameRecipeId: name, name,
      inputs: [{ resourceId, quantity: 1 }],
      outputs: [{ resourceId: "graphite", quantity: 1 }],
    })).toBe(`${inputName} → Graphite`);
  });

  it.each([undefined, "SomeOtherId"])("recognizes an ID-like name without a matching game ID (%s)", gameRecipeId => {
    expect(getRecipeDisplayName({
      building: "Chemical Plant II", name: "GraphiteProductionCo2", gameRecipeId,
      outputs: [{ resourceId: "graphite", quantity: 1 }],
    })).toBe("Graphite");
  });

  it("labels sources, sinks and missing materials without exposing IDs", () => {
    expect(getRecipeDisplayName({
      building: "Smoke stack (large)", name: "SmokeStackOxygen",
      inputs: [{ resourceId: "oxygen", quantity: 10 }],
    })).toBe("Oxygen");
    expect(getRecipeDisplayName({
      building: "Seawater Pump", name: "OceanWaterPumping",
      outputs: [{ resourceId: "seaWater", quantity: 10 }],
    })).toBe("Sea Water");
    expect(getRecipeDisplayName({
      building: "Chemical Plant II", name: "Unknown_Game_Recipe", displayName: " ",
    })).toBe("Chemical Plant II");
  });

  it("keeps meaningful parentheses in a product name", () => {
    expect(getRecipeDisplayName({
      building: "Mixer II", name: "Fertilizer (Organic)",
    })).toBe("Fertilizer (Organic)");
  });

  it("recognizes IDs inside a legacy building-prefixed label", () => {
    expect(getRecipeDisplayName({
      building: "Chemical Plant II", name: "Chemical Plant II (GraphiteProductionCo2)",
      inputs: [{ resourceId: "carbonDioxide", quantity: 144 }],
      outputs: [{ resourceId: "graphite", quantity: 6 }],
    })).toBe("Carbon Dioxide → Graphite");
  });
});
