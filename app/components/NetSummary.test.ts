import { describe, expect, it } from "vitest";

import { recipes } from "../db/recipes";
import { type RegularResult } from "../helpers/calculate/calculate";
import { getDeficitRootCause } from "../helpers/deficit-root-cause/deficit-root-cause";
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
      [
        result("food-processor-meat", 0.41, { activeBuildings: 2, builtBuildings: 2 }),
        result("assembly-v-food-pack-meat", 1, { actualInputs: [{ resourceId: "meat", quantity: 8 }] }),
      ],
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

describe("NetSummary deficit diagnostics", () => {
  const flow = (resourceId: string, produced: number, consumed: number) => ({
    resourceId,
    name: resourceId,
    produced,
    consumed,
    net: produced - consumed,
  });

  it("names a resource nothing in the model produces", () => {
    expect(getDeficitRootCause("rock", [
      result("crusher-large-rock-to-gravel", 1, { actualInputs: [{ resourceId: "rock", quantity: 50 }] }),
    ], [flow("rock", 0, 50)])).toEqual({ kind: "no-producer", detail: "No producer" });
  });

  it("reports saturated producers with buildings still switched off", () => {
    expect(getDeficitRootCause(
      "diesel",
      [
        result("cracking-unit-fuel-gas-diesel", 1, { activeBuildings: 2, builtBuildings: 3 }),
        result("food-processor-meat", 1, { actualInputs: [{ resourceId: "diesel", quantity: 12 }] }),
      ],
      [flow("diesel", 10, 12)],
    )).toEqual({
      kind: "at-capacity",
      detail: "Cracking Unit · at capacity 2/2 of 3 built",
    });
  });

  it("names the input holding back a producer with room", () => {
    expect(getDeficitRootCause(
      "meat",
      [
        result("food-processor-meat", 0.41, { activeBuildings: 2, builtBuildings: 2 }),
        result("assembly-v-food-pack-meat", 1, { actualInputs: [{ resourceId: "meat", quantity: 8 }] }),
      ],
      [flow("meat", 5, 8), flow("chickenCarcass", 20, 20), flow("water", 100, 80), flow("salt", 5, 5)],
    )).toEqual({
      kind: "input-limited",
      detail: "Food Processor · Chicken Carcass, Salt short, 0.82/2",
    });
  });

  it("separates consumption no recipe accounts for", () => {
    expect(getDeficitRootCause(
      "hydrogen",
      [result("hydrogen-reformer-super", 1, {
        activeBuildings: 8,
        builtBuildings: 8,
        actualOutputs: [{ resourceId: "hydrogen", quantity: 256 }],
      })],
      [flow("hydrogen", 256, 400)],
    )).toEqual({
      kind: "at-capacity",
      detail: "Hydrogen Reformer · at capacity 8/8 · +5 covers it · 400 outside recipes",
    });
  });
});

describe("NetSummary deficit attribution", () => {
  const flow = (resourceId: string, produced: number, consumed: number) => ({
    resourceId,
    name: resourceId,
    produced,
    consumed,
    net: produced - consumed,
  });

  it("counts source intake as accounted consumption", () => {
    expect(getDeficitRootCause("treeSapling", [], [flow("treeSapling", 0, 2.43)], [{
      recipe: getRecipe("cracking-unit-fuel-gas-diesel"),
      moduleId: "forest",
      activeBuildings: 1,
      builtBuildings: 1,
      supplyRatio: 1,
      actualInputs: [{ resourceId: "treeSapling", quantity: 2.43 }],
      actualOutputs: [],
    }])).toEqual({ kind: "no-producer", detail: "No producer" });
  });

  it("ignores spare room on a byproduct producer", () => {
    expect(getDeficitRootCause(
      "chlorine",
      [
        result("chemical-plant-ii-titanium-reduction", 0.46),
        result("electrolyzer-ii-chlorine", 1, { activeBuildings: 2, builtBuildings: 2 }),
        result("cracking-unit-fuel-gas-diesel", 1, { actualInputs: [{ resourceId: "chlorine", quantity: 20 }] }),
      ],
      [flow("chlorine", 14, 20)],
    )).toEqual({
      kind: "at-capacity",
      detail: "Electrolyzer II · at capacity 2/2",
    });
  });
});

it("counts the buildings that would close a capacity-limited deficit", () => {
  expect(getDeficitRootCause(
    "diesel",
    [
      result("cracking-unit-fuel-gas-diesel", 1, {
        activeBuildings: 2,
        builtBuildings: 2,
        actualOutputs: [{ resourceId: "diesel", quantity: 40 }],
      }),
      result("food-processor-meat", 1, { actualInputs: [{ resourceId: "diesel", quantity: 65 }] }),
    ],
    [{ resourceId: "diesel", name: "Diesel", produced: 40, consumed: 65, net: -25 }],
  )).toEqual({
    kind: "at-capacity",
    detail: "Cracking Unit · at capacity 2/2 · +2 covers it",
  });
});
