import { describe, expect, it } from "vitest";

import { recipes } from "../db/recipes";
import { type PassiveResult, type RegularResult } from "../helpers/calculate/calculate";
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
        detail: "Cracking Unit · at capacity",
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

  it("does not blame a module-scoped consumer whose module has nothing left over", () => {
    expect(getSurplusRootCause("biomass", [
      result("mixer-ii-biomass-compost", 0.34, {
        moduleId: "general",
        actualInputs: [{ resourceId: "biomass", quantity: 8.08 }],
      }),
      result("food-processor-sugar", 0.43, {
        moduleId: "general",
        actualOutputs: [{ resourceId: "biomass", quantity: 8.08 }],
      }),
      result("mixer-ii-biomass-compost", 1, {
        moduleId: "live-area-14",
        activeBuildings: 2,
        builtBuildings: 2,
        actualInputs: [{ resourceId: "biomass", quantity: 48 }],
      }),
      result("food-processor-sugar", 1, {
        moduleId: "live-area-14",
        actualOutputs: [{ resourceId: "biomass", quantity: 48.16 }],
      }),
    ], [], [], 0.16)).toEqual({
      kind: "at-capacity",
      detail: "Mixer II · build 1",
    });
  });

  it("names the end of the chain rather than an intermediate product", () => {
    expect(getSurplusRootCause("biomass", [
      result("mixer-ii-biomass-compost", 0.5),
      result("mixer-ii-dirt-from-compost", 0.4),
      // Running flat out: the slack that leaves Biomass behind is not here.
      result("mixer-ii-organic-fertilizer-compost", 1),
      // Also takes Compost with room, so it is a second end; its Dirt input does not walk past the dump.
      result("mixer-ii-organic-fertilizer-dirt", 0.5),
    ], [], [
      {
        recipe: getRecipe("dirt-terrain-dump"),
        moduleId: "general",
        activeBuildings: 1,
        builtBuildings: 1,
        supplyRatio: 0.3,
        actualInputs: [],
        actualOutputs: [],
      },
    ])).toEqual({
      kind: "demand-met",
      detail: "Dirt, Fertilizer (Organic) demand met",
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
      detail: "Cracking Unit · unpause 1",
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
      detail: "Hydrogen Reformer · build 5 · 400 outside recipes",
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
      detail: "Electrolyzer II · build 1",
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
    detail: "Cracking Unit · build 2",
  });
});

describe("NetSummary passive capacity", () => {
  const passive = (
    recipeId: string,
    overrides: Partial<PassiveResult> = {},
  ): PassiveResult => ({
    recipe: getRecipe(recipeId),
    moduleId: "nuclear",
    activeBuildings: 1,
    builtBuildings: 1,
    supplyRatio: 1,
    actualInputs: [],
    actualOutputs: [],
    ...overrides,
  });

  it("counts a saturated sink and the buildings that would swallow the surplus", () => {
    expect(getSurplusRootCause(
      "oxygen",
      [],
      [],
      [passive("nuclear-smoke-stack-large-oxygen", {
        activeBuildings: 2,
        builtBuildings: 2,
        actualInputs: [{ resourceId: "oxygen", quantity: 1800 }],
      })],
      1000,
    )).toEqual({
      kind: "at-capacity",
      detail: "Smoke stack (large) · build 2",
    });
  });

  it("points at paused consumers before suggesting new ones", () => {
    expect(getSurplusRootCause(
      "oxygen",
      [],
      [],
      [passive("nuclear-smoke-stack-large-oxygen", { activeBuildings: 0, builtBuildings: 2, supplyRatio: 0 })],
      1000,
    )).toEqual({
      kind: "at-capacity",
      detail: "Smoke stack (large) · unpause 2",
    });
  });

  it("names a saturated source pump behind a deficit", () => {
    expect(getDeficitRootCause(
      "seaWater",
      [result("cracking-unit-fuel-gas-diesel", 1, { actualInputs: [{ resourceId: "seaWater", quantity: 300 }] })],
      [{ resourceId: "seaWater", name: "Seawater", produced: 216, consumed: 300, net: -84 }],
      [passive("seawater-pump", { actualOutputs: [{ resourceId: "seaWater", quantity: 216 }] })],
    )).toEqual({
      kind: "at-capacity",
      detail: "Seawater Pump · build 1",
    });
  });

  it("does not treat reserve draw as installed production capacity", () => {
    expect(getDeficitRootCause(
      "sulfur",
      [],
      [{ resourceId: "sulfur", name: "Sulfur", produced: 0, consumed: 10, net: -10 }],
      [passive("sulfur-virtual-provision")],
    )).toEqual({ kind: "no-producer", detail: "No producer · 10 outside recipes" });
  });

  it("merges one building type across modules, unpausing before building", () => {
    expect(getDeficitRootCause(
      "chlorine",
      [
        result("electrolyzer-ii-chlorine", 0, { moduleId: "general", activeBuildings: 0, builtBuildings: 1 }),
        result("electrolyzer-ii-chlorine", 1, {
          moduleId: "live-area-12",
          activeBuildings: 2,
          builtBuildings: 2,
          actualOutputs: [{ resourceId: "chlorine", quantity: 96 }],
        }),
        result("cracking-unit-fuel-gas-diesel", 1, { actualInputs: [{ resourceId: "chlorine", quantity: 180 }] }),
      ],
      [{ resourceId: "chlorine", name: "Chlorine", produced: 96, consumed: 180, net: -84 }],
    )).toEqual({
      kind: "at-capacity",
      detail: "Electrolyzer II · unpause 1, build 1",
    });
  });

  it("offers different building types as alternatives", () => {
    expect(getSurplusRootCause(
      "fuelGas",
      [
        result("cracking-unit-fuel-gas-diesel", 1, { actualInputs: [{ resourceId: "fuelGas", quantity: 36 }] }),
        result("rotary-kiln-alumina-fuel-gas", 1, { actualInputs: [{ resourceId: "fuelGas", quantity: 6 }] }),
      ],
      [],
      [],
      40,
    )).toEqual({
      kind: "at-capacity",
      detail: "Cracking Unit · build 2 or Rotary Kiln (gas) · build 7",
    });
  });

  it("reports a fully paused producer as the deficit's limit", () => {
    expect(getDeficitRootCause(
      "diesel",
      [
        result("cracking-unit-fuel-gas-diesel", 0, { activeBuildings: 0, builtBuildings: 2 }),
        result("food-processor-meat", 1, { actualInputs: [{ resourceId: "diesel", quantity: 30 }] }),
      ],
      [{ resourceId: "diesel", name: "Diesel", produced: 0, consumed: 30, net: -30 }],
    )).toEqual({
      kind: "at-capacity",
      detail: "Cracking Unit · unpause 2",
    });
  });
});
