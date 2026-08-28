import { describe, expect, it } from "vitest";

import { recipes } from "../db/recipes";
import { type RegularResult } from "../helpers/calculate/calculate";
import { getSurplusCapacityLimit } from "../helpers/capacity-limit/capacity-limit";
import { isReportedFactoryDeficit } from "./net-summary-flows";

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
    const recipe = recipes.find((candidate) => (
      candidate.id === "cracking-unit-fuel-gas-diesel"
    ));

    expect(recipe).toBeDefined();
    if (!recipe) return;

    const result: RegularResult = {
      recipe,
      moduleId: "general",
      activeBuildings: 1,
      builtBuildings: 1,
      operatingMode: "balanced",
      supplyRatio: 1,
      speedLevel: 1,
      actualInputs: [],
      actualOutputs: [],
      appliedRecyclingEfficiencyPercent: null,
      recyclableSourceValueProduced: 0,
    };

    expect(getSurplusCapacityLimit("fuelGas", [result])).toContain(
      "Cracking Unit \u00b7 at capacity 1/1",
    );
  });
});
