import { describe, expect, it } from "vitest";

import {
  defaultInfiniteResearchLevels,
  settlementWaterUseResearch,
} from "../../db/research";
import { calculateSettlementWaterUse } from "./calculate-settlement-water-use";

describe("calculateSettlementWaterUse", () => {
  it("keeps the configured default at base settlement water flow", () => {
    expect(defaultInfiniteResearchLevels.settlementWaterUse).toBe(0);
    expect(calculateSettlementWaterUse(
      defaultInfiniteResearchLevels.settlementWaterUse,
    )).toEqual({
      level: 0,
      reductionPercent: 0,
      multiplier: 1,
    });
  });

  it("reduces Water and Waste Water by two percent per whole level", () => {
    expect(settlementWaterUseResearch.percentPerLevel).toBe(-2);
    expect(calculateSettlementWaterUse(3.9)).toEqual({
      level: 3,
      reductionPercent: 6,
      multiplier: 0.94,
    });
  });

  it("clamps to the in-game level range", () => {
    expect(calculateSettlementWaterUse(-1).level).toBe(0);
    const result = calculateSettlementWaterUse(41);

    expect(result.level).toBe(40);
    expect(result.reductionPercent).toBe(80);
    expect(result.multiplier).toBeCloseTo(0.2);
  });
});
