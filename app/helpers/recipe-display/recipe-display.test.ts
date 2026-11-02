import { describe, expect, it } from "vitest";

import { testRecipes as recipes } from '../../test-fixtures/solver-recipes'
import { getRecipeDisplayName, getRecipePresentation } from "./recipe-display";

describe("recipe display names", () => {
  it('preserves both routes to the same product using structured ingredients', () => {
    const base = { building: 'Assembly V', name: 'FoodPack', outputs: [{ resourceId: 'foodPack' as const, quantity: 1 }] };
    const eggs = getRecipePresentation({ ...base, inputs: [{ resourceId: 'eggs', quantity: 1 }, { resourceId: 'bread', quantity: 2 }] });
    const meat = getRecipePresentation({ ...base, inputs: [{ resourceId: 'meat', quantity: 1 }, { resourceId: 'bread', quantity: 2 }] });

    expect(eggs.inputs).toEqual(['eggs', 'bread']);
    expect(meat.inputs).toEqual(['meat', 'bread']);
    expect(eggs.configuration).toBeUndefined();
    expect(meat.configuration).toBeUndefined();
  });

  it('keeps authored configuration and excludes zero-quantity recipe materials', () => {
    const presentation = getRecipePresentation({
      building: 'Chicken Farm', name: 'Chicken Farm', displayName: 'Slaughtering enabled',
      configurationLabel: 'Slaughtering enabled',
      inputs: [{ resourceId: 'water', quantity: 0 }],
      outputs: [{ resourceId: 'chickenCarcass', quantity: 1 }],
    });

    expect(presentation.configuration).toBe('Slaughtering enabled');
    expect(presentation.inputs).toEqual([]);
    expect(presentation.outputs).toEqual(['chickenCarcass']);
  });

  it.each(['evaporation-pond-heated-salt-brine', 'chemical-plant-yellowcake', 'thermal-desalinator-super', 'nuclear-reprocessing'])(
    'keeps %s descriptions available without treating them as settings', id => {
      const recipe = recipes.find(recipe => recipe.id === id)!;
      const presentation = getRecipePresentation(recipe);

      expect(presentation.name).toBeTruthy();
      expect(presentation.configuration).toBeUndefined();
      expect(presentation.inputs.length).toBeGreaterThan(0);
    },
  );

  it('shows an actual setting regardless of the wording of the recipe description', () => {
    const reactor = recipes.find(recipe => recipe.id === 'fbr-3x')!;

    expect(getRecipePresentation({ ...reactor, name: 'Localized reactor name' }).configuration).toBe('3× enrichment');
    expect(getRecipePresentation({ building: 'Station module', name: 'Water · unloading', inputs: [], outputs: [] })
      .configuration).toBe('Water · unloading');
  });

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
