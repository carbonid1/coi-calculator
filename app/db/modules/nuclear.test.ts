import { expect, it } from "vitest";

import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateSolarPower } from "../../helpers/modifiers/calculate-solar-power";
import { defaultInfiniteResearchLevels } from "../research";
import {
  createNuclearModule,
  defaultNuclearConfig,
  plannedNuclearOperation,
} from "./nuclear";
import { createSolarPowerModule } from "./solar-power";

const nuclear = createNuclearModule(defaultNuclearConfig, {
  averageGeneratorOutputMw: 77,
  hydrogenFuelDemandPerCycle: 46.5,
});
const solarPower = createSolarPowerModule({ standard: 38, mono: 195 });

it("keeps installed nuclear capacity current while applying the operation plan", () => {
  const planned = createNuclearModule(
    defaultNuclearConfig,
    { averageGeneratorOutputMw: 77, hydrogenFuelDemandPerCycle: 46.5 },
    plannedNuclearOperation,
  );
  const preset = planned.presets[0];

  expect(preset?.builtBuildings).toMatchObject({
    "hydrogen-reformer-super": 6,
    "electrolyzer-ii-chlorine": 2,
    "evaporation-pond-heated-salt-brine": 2,
    "seawater-pump": 4,
    "thermal-desalinator-super": 6,
  });
  expect(preset?.activeBuildings).toMatchObject({
    "hydrogen-reformer-super": 8,
    "electrolyzer-ii-chlorine": 3,
    "evaporation-pond-heated-salt-brine": 3,
    "seawater-pump": 6,
    "thermal-desalinator-super": 10,
  });
  expect(preset?.electricityDispatchTargets?.["fbr-turbines"]).toBe(159);
  expect(Object.values(preset?.dataSources ?? {}).every(source => source === "planned"))
    .toBe(true);
});

it("lets the operation plan override a higher synced generation baseline", () => {
  const planned = createNuclearModule(
    defaultNuclearConfig,
    { averageGeneratorOutputMw: 200, hydrogenFuelDemandPerCycle: 46.5 },
    plannedNuclearOperation,
  );
  const preset = planned.presets[0];

  expect(preset?.electricityDispatchTargets?.["fbr-turbines"]).toBe(159);
  expect(preset?.activeBuildings["turbine-super"]).toBe(6);
  expect(preset?.activeBuildings["turbine-high"]).toBe(6);
  expect(preset?.activeBuildings["turbine-low"]).toBe(6);
});

it("models the two-FBR checkpoint and its external requirements", () => {
  const result = calculateFactoryTotal([nuclear]);
  const flow = (resourceId: string) => result.calculation.allResourceFlows.find(
    (candidate) => candidate.resourceId === resourceId,
  );
  const liquidDumpLines = result.allLines.filter(
    (line) => line.recipe.id.startsWith("nuclear-liquid-dump-"),
  );
  const waterDumpResult = result.calculation.sinkResults.find(
    (candidate) => candidate.recipe.id === "nuclear-liquid-dump-water",
  );
  const brineDumpResult = result.calculation.sinkResults.find(
    (candidate) => candidate.recipe.id === "nuclear-liquid-dump-brine",
  );
  const oxygenVentResult = result.calculation.sinkResults.find(
    (candidate) => candidate.recipe.id === "nuclear-smoke-stack-large-oxygen",
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
    "seawater-pump": 4,
    "enrichment-plant": 2,
    "chemical-plant-yellowcake": 2,
    "turbine-super": 8,
    "turbine-high": 8,
    "turbine-low": 8,
    "power-generator-ii-nuclear": 16,
    "hydrogen-reformer-super": 6,
    "thermal-desalinator-depleted": 4,
    "thermal-desalinator-super": 6,
    "electrolyzer-ii-chlorine": 2,
    "evaporation-pond-heated-salt-brine": 2,
    "cooling-tower-large-super": 4,
    "cooling-tower-large-depleted": 4,
    "nuclear-liquid-dump-water": 1,
    "nuclear-liquid-dump-brine": 1,
    "nuclear-smoke-stack-large-oxygen": 1,
    "radioactive-waste-storage": 1,
    "shredder-retired-waste": 1,
  });
  expect(nuclear.presets[0]?.activeBuildings).toMatchObject({
    "nuclear-reprocessing": 1,
    "seawater-pump": 4,
    "enrichment-plant": 2,
    "chemical-plant-yellowcake": 2,
    "turbine-super": 3,
    "turbine-high": 3,
    "turbine-low": 3,
    "power-generator-ii-nuclear": 6,
    "hydrogen-reformer-super": 5,
    "thermal-desalinator-depleted": 4,
    "thermal-desalinator-super": 6,
    "electrolyzer-ii-chlorine": 1,
    "evaporation-pond-heated-salt-brine": 1,
    "cooling-tower-large-super": 4,
    "cooling-tower-large-depleted": 4,
    "nuclear-liquid-dump-water": 1,
    "nuclear-liquid-dump-brine": 1,
    "nuclear-smoke-stack-large-oxygen": 1,
    "radioactive-waste-storage": 1,
    "shredder-retired-waste": 1,
  });
  expect(flow("coreFuel")?.net).toBe(0);
  expect(flow("blanketFuel")?.net).toBe(0);
  expect(flow("yellowcake")?.net).toBe(-9);
  expect(flow("hydrogen")?.net).toBe(0);
  expect(flow("water")?.net).toBeCloseTo(0, 10);
  expect(flow("brine")?.net).toBeCloseTo(0, 10);
  expect(flow("oxygen")?.net).toBeCloseTo(0, 10);
  expect(flow("electricity")?.produced).toBeCloseTo(77, 10);
  expect(result.electricityDemandMw).toBe(77);
  expect(liquidDumpLines).toHaveLength(2);
  expect(liquidDumpLines).toEqual(expect.arrayContaining([
    expect.objectContaining({ activeBuildings: 1, builtBuildings: 1 }),
    expect.objectContaining({ activeBuildings: 1, builtBuildings: 1 }),
  ]));
  expect(waterDumpResult?.actualInputs).toEqual([
    expect.objectContaining({ resourceId: "water" }),
  ]);
  expect(brineDumpResult?.actualInputs).toEqual([
    expect.objectContaining({ resourceId: "brine" }),
  ]);
  expect(oxygenVentResult?.actualInputs).toEqual([
    expect.objectContaining({ resourceId: "oxygen" }),
  ]);
  expect(waterDumpResult?.supplyRatio ?? 0).toBeGreaterThan(0);
  expect(brineDumpResult?.supplyRatio ?? 0).toBeGreaterThan(0);
  expect(waterDumpResult?.supplyRatio ?? 0).toBeLessThanOrEqual(1);
  expect(brineDumpResult?.supplyRatio ?? 0).toBeLessThanOrEqual(1);
  expect(oxygenVentResult?.supplyRatio ?? 0).toBeGreaterThan(0);
  expect(oxygenVentResult?.supplyRatio ?? 0).toBeLessThanOrEqual(1);
  expect(calculateBuildingStats(
    liquidDumpLines,
    result.calculation,
  ).workers).toBe(2);
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

  expect(electricity?.produced).toBeCloseTo(120.77024, 6);
  expect(result.electricityDemandMw).toBeCloseTo(120.77024, 6);
});
