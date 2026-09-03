import { describe, expect, it } from "vitest";

import {
  defaultArea as general,
  plannedDefaultBuildings as plannedGeneralBuildings,
  plannedDefaultBuiltBuildings as plannedGeneralBuiltBuildings,
  plannedNewDefaultBuildings as plannedNewGeneralBuildings,
} from "./modules/default";
import { recipes } from "./recipes";

const plannedBuildings = plannedNewGeneralBuildings;
const plannedAdvancedBuildings = Object.fromEntries(
  Object.entries(plannedBuildings).filter(
    ([recipeId]) => recipeId !== "chemical-plant-ii-cooking-oil-diesel",
  ),
);

const getRecipe = (id: string) => {
  const recipe = recipes.find((candidate) => candidate.id === id);

  if (!recipe) throw new Error(`Missing recipe ${id}`);

  return recipe;
};

describe("planned advanced production", () => {
  it("matches the installed v0.8.7 Electronics IV recipes", () => {
    expect(getRecipe("diamond-reactor-synthesis")).toMatchObject({
      building: "Diamond Reactor",
      cycleDurationSeconds: 60,
      inputs: [
        { resourceId: "graphite", quantity: 2 },
        { resourceId: "salt", quantity: 2 },
      ],
      outputs: [{ resourceId: "diamond", quantity: 2 }],
    });
    expect(getRecipe("chemical-plant-ii-diamond-paste-cooking-oil")).toMatchObject({
      building: "Chemical Plant II",
      inputs: [
        { resourceId: "diamond", quantity: 4 },
        { resourceId: "cookingOil", quantity: 4 },
      ],
      outputs: [{ resourceId: "diamondPaste", quantity: 16 }],
    });
    expect(getRecipe("lens-polisher")).toMatchObject({
      building: "Lens Polisher",
      inputs: [
        { resourceId: "sapphireWafer", quantity: 2 },
        { resourceId: "diamondPaste", quantity: 2 },
        { resourceId: "ethanol", quantity: 2 },
      ],
      outputs: [{ resourceId: "lens", quantity: 2 }],
    });
    expect(getRecipe("assembly-v-electronics-iv")).toMatchObject({
      building: "Assembly V",
      inputs: [
        { resourceId: "electronicsIII", quantity: 6 },
        { resourceId: "lens", quantity: 4 },
        { resourceId: "diamond", quantity: 2 },
      ],
      outputs: [{ resourceId: "electronicsIv", quantity: 6 }],
    });
  });

  it("matches the installed v0.8.7 station consumable recipes", () => {
    expect(getRecipe("assembly-v-composite-core")).toMatchObject({
      building: "Assembly V",
      cycleDurationSeconds: 30,
      inputs: [
        { resourceId: "compositePanel", quantity: 16 },
        { resourceId: "titaniumAlloy", quantity: 8 },
        { resourceId: "electronicsIII", quantity: 2 },
      ],
      outputs: [{ resourceId: "compositeCore", quantity: 8 }],
    });
    expect(getRecipe("chemical-plant-ii-chemical-fuel")).toMatchObject({
      building: "Chemical Plant II",
      cycleDurationSeconds: 30,
      inputs: [
        { resourceId: "ammonia", quantity: 12 },
        { resourceId: "fuelGas", quantity: 12 },
        { resourceId: "aluminum", quantity: 8 },
      ],
      outputs: [{ resourceId: "chemicalFuel", quantity: 8 }],
    });
    expect(getRecipe("assembly-v-station-parts")).toMatchObject({
      building: "Assembly V",
      cycleDurationSeconds: 15,
      inputs: [
        { resourceId: "compositeCore", quantity: 16 },
        { resourceId: "solarCellMono", quantity: 8 },
        { resourceId: "chemicalFuel", quantity: 4 },
      ],
      outputs: [{ resourceId: "stationParts", quantity: 8 }],
    });
    expect(getRecipe("assembly-v-crew-supplies")).toMatchObject({
      building: "Assembly V",
      cycleDurationSeconds: 15,
      inputs: [
        { resourceId: "foodPack", quantity: 8 },
        { resourceId: "medicalSuppliesII", quantity: 4 },
        { resourceId: "plastic", quantity: 4 },
      ],
      outputs: [{ resourceId: "crewSupplies", quantity: 16 }],
    });
    expect(getRecipe("assembly-v-solar-cell-mono")).toMatchObject({
      building: "Assembly V",
      inputs: [
        { resourceId: "steel", quantity: 1.5 },
        { resourceId: "polySilicon", quantity: 18 },
        { resourceId: "glass", quantity: 6 },
      ],
      outputs: [{ resourceId: "solarCellMono", quantity: 12 }],
    });
  });

  it("has no remaining net-new advanced buildings", () => {
    const generalPreset = general.presets.find(({ id }) => id === general.defaultPresetId);

    expect(Object.keys(plannedAdvancedBuildings)).toHaveLength(0);
    expect(Object.values(plannedGeneralBuiltBuildings).every((count) => count === 0)).toBe(true);
    expect(generalPreset?.activeBuildings).toMatchObject(plannedGeneralBuildings);
    expect(generalPreset?.dataSources).toEqual({
      ...Object.fromEntries(
        Object.keys(plannedGeneralBuildings).map((recipeId) => [recipeId, "planned"]),
      ),
    });
    expect(generalPreset?.outputTargets).toBeUndefined();
  });

});
