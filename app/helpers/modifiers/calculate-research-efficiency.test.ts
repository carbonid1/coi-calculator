import { describe, expect, it } from "vitest";

import {
  calculatePopulationResearchBonus,
  calculateResearchEfficiency,
} from "./calculate-research-efficiency";

describe("research efficiency", () => {
  it("matches the installed population rounding formula", () => {
    expect(calculatePopulationResearchBonus(0)).toBe(0);
    expect(calculatePopulationResearchBonus(100)).toBe(1);
    expect(calculatePopulationResearchBonus(2_880)).toBe(14);
  });

  it("adds edict, station, population, and Focus bonuses to base output", () => {
    expect(calculateResearchEfficiency({
      edictLevel: 5,
      focusBonusPercent: 20,
      population: 2_880,
      stationBonusPercent: 25,
    })).toEqual({
      bonusPercent: 119,
      edictBonusPercent: 60,
      focusBonusPercent: 20,
      multiplier: 2.19,
      population: 2_880,
      populationBonusPercent: 14,
      stationBonusPercent: 25,
      totalOutputPercent: 219,
    });
  });
});
