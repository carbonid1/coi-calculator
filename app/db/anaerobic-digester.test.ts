import { describe, expect, it } from "vitest";

import { calculateBuildingDiagnostics } from "../helpers/building-diagnostics/building-diagnostics";
import { calculateFactoryTotal } from "../helpers/factory-total/factory-total";
import { baseConfig } from "./config";
import { defaultArea as general } from "./modules/default";
import { modules } from "./modules/modules";
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
  it("shares three active digesters across every configured surplus recipe", () => {
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
    expect(digestionRecipeIds.every((id) => preset?.activeBuildings[id] === 3)).toBe(true);
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

  it("uses all built digesters before recommending another build", () => {
    const result = calculateFactoryTotal(modules, {
      recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent,
    });
    const diagnostic = calculateBuildingDiagnostics(
      modules,
      result.flows,
      result.calculation.regularResults,
      result.calculation.sourceResults,
      result.calculation.sinkResults,
    ).find(({ key }) => key === "general:anaerobic-digester-surplus-organics");

    expect(diagnostic).toMatchObject({
      active: 3,
      built: 3,
      attention: "build",
      attentionCount: 1,
    });
  });
});
