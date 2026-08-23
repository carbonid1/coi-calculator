import { describe, expect, it } from "vitest";

import { calculateReserveRunway } from "./reserves";

describe("reserve runway", () => {
  it("reports production cycles and in-game years at the current draw", () => {
    expect(calculateReserveRunway(6_000, 5)).toEqual({
      balance: 6_000,
      drawPerProductionCycle: 5,
      productionCyclesRemaining: 1_200,
      inGameYearsRemaining: 100,
      status: "draining",
    });
  });

  it("preserves a fractional production cycle instead of rounding it away", () => {
    expect(calculateReserveRunway(3, 6)).toMatchObject({
      productionCyclesRemaining: 0.5,
      inGameYearsRemaining: 0.5 / 12,
      status: "draining",
    });
  });

  it("distinguishes unavailable, confirmed empty, and idle balances", () => {
    expect(calculateReserveRunway(null, 5).status).toBe("unavailable");
    expect(calculateReserveRunway(0, 5).status).toBe("empty");
    expect(calculateReserveRunway(6_000, 0).status).toBe("idle");
  });
});
