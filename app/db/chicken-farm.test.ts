import { describe, expect, it } from "vitest";

import {
  getChickenFarmLayout,
  getChickenFarmRates,
} from "./chicken-farm";

describe("chicken farm totals", () => {
  it("keeps an explicitly empty flock at zero", () => {
    expect(getChickenFarmLayout(0)).toEqual({
      totalChickenCount: 0,
      farmCount: 0,
      fullFarmCount: 0,
      partialFarmChickenCount: 0,
    });
    expect(getChickenFarmRates({ totalChickenCount: 0, slaughtering: true })).toEqual({
      animalFeed: 0,
      water: 0,
      eggs: 0,
      chickenCarcass: 0,
    });
  });

  it("packs a total flock into full farms plus one partial farm", () => {
    expect(getChickenFarmLayout(1_250)).toEqual({
      totalChickenCount: 1_250,
      farmCount: 3,
      fullFarmCount: 2,
      partialFarmChickenCount: 250,
    });
  });

  it("calculates aggregate rates from the total flock", () => {
    const rates = getChickenFarmRates({ totalChickenCount: 1_100, slaughtering: true });

    expect(rates.animalFeed).toBe(33.30078125);
    expect(rates.water).toBe(39.74609375);
    expect(rates.eggs).toBe(16.11328125);
    expect(rates.chickenCarcass).toBe(22);
  });

  it("matches the installed game's 500-chicken slaughtering display", () => {
    expect(getChickenFarmRates({ totalChickenCount: 500, slaughtering: true })).toEqual({
      animalFeed: 15.13671875,
      water: 18.06640625,
      eggs: 7.32421875,
      chickenCarcass: 10,
    });
  });
});
