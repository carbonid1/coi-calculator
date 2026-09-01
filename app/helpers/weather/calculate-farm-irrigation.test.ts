import { expect, it } from "vitest";

import { type CropFarmGroup } from "../../db/crop-farming";
import { calculateFarmIrrigationRates } from "./calculate-farm-irrigation";

it("applies Rainwater Yield to the finite-buffer farm simulation", () => {
  const group: CropFarmGroup = {
    id: "weather-test-farm",
    name: "Weather test farm",
    farmCount: 1,
    tierId: "greenhouseII",
    schedule: ["potato", "fruit", "wheat", "soybean"],
    fertilizer: { id: "fertilizerII", targetFertilityPercent: 110 },
  };

  const base = calculateFarmIrrigationRates(group, 1, 1);
  const improved = calculateFarmIrrigationRates(group, 1, 1.5);

  expect(improved.grossWaterPerMonth).toBe(base.grossWaterPerMonth);
  expect(improved.importedWaterPerMonth).toBeLessThan(base.importedWaterPerMonth);
});
