import { expect, it } from "vitest";

import { calculateShipsFuelUse } from "./calculate-ships-fuel-use";

it("applies repeatable ship fuel-use research", () => {
  expect(calculateShipsFuelUse(5)).toEqual({
    level: 5,
    reductionPercent: 5,
    multiplier: 0.95,
  });
});
