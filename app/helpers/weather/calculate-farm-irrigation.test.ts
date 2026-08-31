import { expect, it } from "vitest";

import { activeCropFarmGroups } from "../../db/crop-farming";
import { calculateFarmIrrigationRates } from "./calculate-farm-irrigation";

it("applies Rainwater Yield to the finite-buffer farm simulation", () => {
  const group = activeCropFarmGroups[0];

  expect(group).toBeDefined();

  const base = calculateFarmIrrigationRates(group!, 1, 1);
  const improved = calculateFarmIrrigationRates(group!, 1, 1.5);

  expect(improved.grossWaterPerMonth).toBe(base.grossWaterPerMonth);
  expect(improved.importedWaterPerMonth).toBeLessThan(base.importedWaterPerMonth);
});
