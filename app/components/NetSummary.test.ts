import { describe, expect, it } from "vitest";

import { recipes } from "../db/recipes";
import { type RegularResult } from "../helpers/calculate/calculate";
import { getSurplusRootCause } from "../helpers/surplus-root-cause/surplus-root-cause";
import { isReportedFactoryDeficit } from "./net-summary-flows";

const getRecipe = (recipeId: string) => {
  const recipe = recipes.find((candidate) => candidate.id === recipeId);

  if (!recipe) throw new Error(`Missing recipe: ${recipeId}`);

  return recipe;
};

const result = (
  recipeId: string,
  supplyRatio: number,
  overrides: Partial<RegularResult> = {},
): RegularResult => ({
  recipe: getRecipe(recipeId),
  moduleId: "general",
  activeBuildings: 1,
  builtBuildings: 1,
  operatingMode: "balanced",
  supplyRatio,
  speedLevel: 1,
  actualInputs: [],
  actualOutputs: [],
  recyclableSourceValueProduced: 0,
  ...overrides,
});

describe("NetSummary capacity diagnostics", () => {
  it("leaves Super Steam to in-game monitoring instead of reporting a factory deficit", () => {
    expect(isReportedFactoryDeficit({
      resourceId: "steamSuper",
      name: "Steam (Super)",
      produced: 96,
      consumed: 98.4,
      net: -2.4,
    })).toBe(false);
    expect(isReportedFactoryDeficit({
      resourceId: "copper",
      name: "Copper",
      produced: 8,
      consumed: 10,
      net: -2,
    })).toBe(true);
  });

  it("identifies a full surplus converter as the limit on an input surplus", () => {
    expect(getSurplusRootCause("fuelGas", [result("cracking-unit-fuel-gas-diesel", 1)]))
      .toEqual({
        kind: "at-capacity",
        detail: "Cracking Unit · at capacity 1/1",
      });
  });

  it("treats a surplus nothing consumes as a terminal product", () => {
    expect(getSurplusRootCause("chickenCarcass", [result("cracking-unit-fuel-gas-diesel", 1)]))
      .toEqual({ kind: "terminal", detail: null });
  });

  it("names the input that held a surplus route back", () => {
    expect(getSurplusRootCause(
      "chickenCarcass",
      [result("food-processor-meat", 0.41, { activeBuildings: 2, builtBuildings: 2 })],
      [{
        recipe: getRecipe("food-processor-meat"),
        moduleId: "general",
        activeBuildings: 2,
        surplusResourceIds: ["chickenCarcass"],
        wantedRatio: 0.59,
        appliedRatio: 0,
        blockedBy: { resourceId: "water", deficitIncrease: 10.65 },
      }],
    )).toEqual({
      kind: "input-blocked",
      detail: "Food Processor (Chicken Carcass → Meat + Trimmings) · Water short by 10.65",
    });
  });

  it("reports met product demand when a consumer with room does not run", () => {
    expect(getSurplusRootCause("chickenCarcass", [
      result("food-processor-meat", 0.25, { activeBuildings: 2, builtBuildings: 2 }),
      result("food-processor-meat-trimmings", 1),
    ])).toEqual({
      kind: "demand-met",
      detail: "Meat demand met",
    });
  });
});
