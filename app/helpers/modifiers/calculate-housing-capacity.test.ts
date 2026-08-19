import { expect, it } from "vitest";

import { calculateHousingCapacity } from "./calculate-housing-capacity";

it("applies the configured housing capacity research bonus", () => {
  expect(calculateHousingCapacity(4)).toEqual({
    level: 4,
    bonusPercent: 20,
    multiplier: 1.2,
  });
});
