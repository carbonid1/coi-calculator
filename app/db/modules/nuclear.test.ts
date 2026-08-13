import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateSolarPower } from "../../helpers/modifiers/calculate-solar-power";
import { defaultInfiniteResearchLevels } from "../research";
import { defaultNuclearConfig, nuclear } from "./nuclear";
import { solarPower } from "./solar-power";

it("models the two-FBR checkpoint and its external requirements", () => {
  const result = calculateFactoryTotal([nuclear]);
  const flow = (resourceId: string) => result.calculation.allResourceFlows.find(
    (candidate) => candidate.resourceId === resourceId,
  );

  expect(defaultNuclearConfig).toEqual({
    breederReactors: 1,
    breederPowerLevel: 1,
    nonBreederReactors: 1,
    nonBreederPowerLevel: 4,
  });
  expect(nuclear.presets[0]?.fixed).toEqual(["fbr-0x", "fbr-3x"]);
  expect(nuclear.presets[0]?.builtBuildings).toMatchObject({
    "nuclear-reprocessing": 1,
    "seawater-pump": 3,
    "enrichment-plant": 2,
    "chemical-plant-yellowcake": 2,
    "turbine-super": 9,
    "turbine-high": 9,
    "turbine-low": 9,
    "power-generator-ii-nuclear": 18,
    "hydrogen-reformer-super": 4,
    "thermal-desalinator-depleted": 4,
    "thermal-desalinator-super": 4,
    "cooling-tower-large-super": 4,
    "cooling-tower-large-depleted": 4,
    "radioactive-waste-storage": 1,
    "shredder-retired-waste": 1,
  });
  expect(nuclear.presets[0]?.activeBuildings).toMatchObject({
    "nuclear-reprocessing": 1,
    "seawater-pump": 3,
    "enrichment-plant": 2,
    "chemical-plant-yellowcake": 2,
    "turbine-super": 2,
    "turbine-high": 2,
    "turbine-low": 2,
    "power-generator-ii-nuclear": 4,
    "hydrogen-reformer-super": 4,
    "thermal-desalinator-depleted": 4,
    "thermal-desalinator-super": 4,
    "cooling-tower-large-super": 3,
    "cooling-tower-large-depleted": 3,
    "radioactive-waste-storage": 1,
    "shredder-retired-waste": 1,
  });
  expect(flow("coreFuel")?.net).toBe(0);
  expect(flow("blanketFuel")?.net).toBe(0);
  expect(flow("yellowcake")?.net).toBe(-9);
  expect(flow("hydrogen")?.net).toBe(0);
  expect(flow("water")?.net ?? 0).toBeGreaterThanOrEqual(-0.001);
  expect(flow("electricity")?.produced).toBeCloseTo(50, 10);
  expect(result.electricityDemandMw).toBe(50);
});

it("treats the baseline as nuclear generation in addition to solar", () => {
  const solarPowerOutput = calculateSolarPower(
    defaultInfiniteResearchLevels.solarPower,
    0,
  );
  const result = calculateFactoryTotal(
    [nuclear, solarPower],
    [],
    50,
    { solarPower: solarPowerOutput.multiplier },
  );
  const electricity = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "electricity",
  );

  expect(electricity?.produced).toBeCloseTo(84.7, 1);
  expect(result.electricityDemandMw).toBeCloseTo(84.7, 1);
});
