import { expect, it } from "vitest";

import { calculateUnityCapacity } from "./calculate-unity-capacity";

it("applies the configured Unity capacity research bonus", () => {
  expect(calculateUnityCapacity(5)).toEqual({
    level: 5,
    bonusPercent: 25,
    multiplier: 1.25,
  });
});
