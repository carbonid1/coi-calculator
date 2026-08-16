import { describe, expect, it } from "vitest";

import {
  defaultInfiniteResearchLevels,
  rainwaterYieldResearch,
} from "../../db/research";
import { calculateRainwaterYield } from "./calculate-rainwater-yield";

describe("calculateRainwaterYield", () => {
  it("keeps the configured default at base rainwater collection", () => {
    expect(defaultInfiniteResearchLevels.rainwaterYield).toBe(0);
    expect(calculateRainwaterYield(defaultInfiniteResearchLevels.rainwaterYield)).toEqual({
      level: 0,
      bonusPercent: 0,
      multiplier: 1,
    });
  });

  it("adds five percent of rainwater collection per whole level", () => {
    expect(rainwaterYieldResearch.percentPerLevel).toBe(5);
    expect(calculateRainwaterYield(3.9)).toEqual({
      level: 3,
      bonusPercent: 15,
      multiplier: 1.15,
    });
  });

  it("clamps to the in-game level range", () => {
    expect(calculateRainwaterYield(-1).level).toBe(0);
    expect(calculateRainwaterYield(41)).toEqual({
      level: 40,
      bonusPercent: 200,
      multiplier: 3,
    });
  });
});
