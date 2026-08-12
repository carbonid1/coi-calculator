import { describe, expect, it } from "vitest";

import { calculateFoodConsumption } from "./calculate-food-consumption";

describe("food consumption edicts", () => {
  it("uses 0% as the unmodified baseline", () => {
    expect(calculateFoodConsumption(0, 0)).toEqual({
      foodSaverPercent: 0,
      plentyOfFoodPercent: 0,
      effectivePercent: 0,
      multiplier: 1,
    });
  });

  it("applies each edict's cumulative tier value", () => {
    expect(calculateFoodConsumption(2, 0).effectivePercent).toBe(-30);
    expect(calculateFoodConsumption(2, 0).multiplier).toBe(0.7);
    expect(calculateFoodConsumption(0, 2).effectivePercent).toBe(40);
    expect(calculateFoodConsumption(0, 2).multiplier).toBe(1.4);
  });

  it("adds Food Saver and Plenty of Food on their shared multiplier", () => {
    expect(calculateFoodConsumption(2, 2).effectivePercent).toBe(10);
    expect(calculateFoodConsumption(2, 2).multiplier).toBe(1.1);
  });
});
