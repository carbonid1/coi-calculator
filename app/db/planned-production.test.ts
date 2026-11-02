import { describe, expect, it } from "vitest";

import {
  defaultArea as general,
  plannedDefaultBuildings as plannedGeneralBuildings,
  plannedDefaultBuiltBuildings as plannedGeneralBuiltBuildings,
  plannedNewDefaultBuildings as plannedNewGeneralBuildings,
} from "./modules/default";

const plannedBuildings = plannedNewGeneralBuildings;
const plannedAdvancedBuildings = Object.fromEntries(
  Object.entries(plannedBuildings).filter(
    ([recipeId]) => recipeId !== "chemical-plant-ii-cooking-oil-diesel",
  ),
);

describe("planned advanced production", () => {
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
