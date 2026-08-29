import { expect, it } from "vitest";

import { type SyncedProductionEntity } from "../../game-state";
import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateSolarPower } from "../../helpers/modifiers/calculate-solar-power";
import { baseConfig } from "../config";
import { emptyPlanningBaselines } from "../planning-baselines";
import { defaultInfiniteResearchLevels } from "../research";
import { attachSolarPanelsToModule } from "./area-solar";
import { type Module } from "./modules";
import {
  createNuclearModule,
  defaultNuclearConfig,
  plannedNuclearOperation,
} from "./nuclear";

const nuclear = createNuclearModule(defaultNuclearConfig, {
  averageGeneratorOutputMw: 77,
  hydrogenFuelDemandPerCycle: 46.5,
});
const emptyDefaultModule: Module = {
  id: "general",
  name: "Default",
  description: "Default-area test module",
  builtBuildings: {},
  presets: [{
    id: "current",
    name: "Current",
    description: "Current production",
    activeBuildings: {},
    fixed: [],
  }],
  defaultPresetId: "current",
};
const defaultWithSolar = attachSolarPanelsToModule(
  emptyDefaultModule,
  { standard: 38, mono: 195 },
  { standard: 38, mono: 195 },
);

const syncedEntity = (
  entityId: number,
  prototypeId: string,
  recipeIds: string[] = [],
  running = true,
): SyncedProductionEntity => ({
  entityId,
  prototypeId,
  running,
  recipeIds,
  zones: [{ id: 14, name: "Nuclear" }],
  nuclearReactor: null,
});

it("keeps installed nuclear capacity current while applying the operation plan", () => {
  const planned = createNuclearModule(
    defaultNuclearConfig,
    { averageGeneratorOutputMw: 77, hydrogenFuelDemandPerCycle: 46.5 },
    plannedNuclearOperation,
  );
  const preset = planned.presets[0];

  expect(preset?.builtBuildings).toMatchObject({
    "hydrogen-reformer-super": 8,
    "electrolyzer-ii-chlorine": 2,
    "evaporation-pond-heated-salt-brine": 2,
    "seawater-pump": 4,
    "thermal-desalinator-super": 6,
  });
  expect(preset?.activeBuildings).toMatchObject({
    "hydrogen-reformer-super": 8,
    "electrolyzer-ii-chlorine": 2,
    "evaporation-pond-heated-salt-brine": 2,
    "seawater-pump": 6,
    "thermal-desalinator-super": 10,
  });
  expect(preset?.activeBuildings).not.toHaveProperty("seawater-pump-tall");
  expect(preset?.electricityDispatchTargets?.["fbr-turbines"]).toBe(159);
  expect(preset?.dataSources?.["hydrogen-reformer-super"]).toBeUndefined();
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

it("layers a pending operation target over exact synced Nuclear inventory", () => {
  const entities = Array.from({ length: 5 }, (_, index) => syncedEntity(
    index + 1,
    "HydrogenReformer",
    ["HydrogenProductionFromSteamSp"],
    index === 0,
  ));
  const nuclearModule = createNuclearModule(
    defaultNuclearConfig,
    emptyPlanningBaselines,
    {
      ...plannedNuclearOperation,
      generationTargetMw: 0,
      hydrogenReformerCount: 6,
      chlorineProcessingCount: 0,
      saltProcessingCount: 0,
      superDesalinatorCount: 0,
      seawaterPumpCount: 0,
    },
    entities,
  );
  const preset = nuclearModule.presets[0];

  expect(preset?.builtBuildings?.["hydrogen-reformer-super"]).toBe(5);
  expect(preset?.activeBuildings["hydrogen-reformer-super"]).toBe(6);
  expect(preset?.dataSources?.["hydrogen-reformer-super"]).toBe("planned");
  expect(preset?.planMismatches).toEqual([
    expect.objectContaining({
      recipeId: "hydrogen-reformer-super",
      current: 1,
      currentSource: "synced",
      target: 6,
      actions: [
        { type: "unpause", label: "Unpause 4 Hydrogen Reformers" },
        { type: "build", label: "Build 1 Hydrogen Reformer" },
      ],
    }),
  ]);
});

it("replaces modeled current buildings instead of adding synced inventory", () => {
  const nuclearModule = createNuclearModule(
    defaultNuclearConfig,
    emptyPlanningBaselines,
    undefined,
    [syncedEntity(1, "HydrogenReformer", ["HydrogenProductionFromSteamSp"])],
  );
  const preset = nuclearModule.presets[0];

  expect(preset?.builtBuildings).toMatchObject({
    "fbr-0x": 0,
    "fbr-3x": 0,
    "hydrogen-reformer-super": 1,
  });
  expect(preset?.activeBuildings).toMatchObject({
    "fbr-0x": 0,
    "fbr-3x": 0,
    "hydrogen-reformer-super": 1,
  });
  expect(preset?.dataSources?.["hydrogen-reformer-super"]).toBe("synced");
});

it("keeps the middle-enrichment reactor in synced Nuclear capacity", () => {
  const reactor: SyncedProductionEntity = {
    ...syncedEntity(1, "FastBreederReactor"),
    nuclearReactor: { enrichmentStep: 1, targetPowerPercent: 200 },
  };
  const nuclearModule = createNuclearModule(
    defaultNuclearConfig,
    emptyPlanningBaselines,
    undefined,
    [reactor],
  );
  const preset = nuclearModule.presets[0];

  expect(preset?.builtBuildings.fbr).toBe(1);
  expect(preset?.activeBuildings.fbr).toBe(1);
  expect(preset?.speedLevels?.fbr).toBe(2);
  expect(nuclearModule.description).toContain("1 FBR synced");
  expect(nuclearModule.description).toContain("120 MW configured capacity");
});

it("keeps the turbine dispatch plan above lower synced running counts", () => {
  let entityId = 0;
  const makeMany = (
    built: number,
    running: number,
    prototypeId: string,
  ) => Array.from(
    { length: built },
    (_, index) => syncedEntity(++entityId, prototypeId, [], index < running),
  );
  const entities = [
    ...makeMany(8, 3, "TurbineSuperPress"),
    ...makeMany(8, 3, "TurbineHighPressT2"),
    ...makeMany(8, 3, "TurbineLowPressT2"),
    ...makeMany(16, 6, "PowerGeneratorT2"),
  ];
  const nuclearModule = createNuclearModule(
    defaultNuclearConfig,
    emptyPlanningBaselines,
    plannedNuclearOperation,
    entities,
  );
  const preset = nuclearModule.presets[0];

  expect(preset?.builtBuildings).toMatchObject({
    "turbine-super": 8,
    "turbine-high": 8,
    "turbine-low": 8,
    "power-generator-ii-nuclear": 16,
  });
  expect(preset?.activeBuildings).toMatchObject({
    "turbine-super": 6,
    "turbine-high": 6,
    "turbine-low": 6,
    "power-generator-ii-nuclear": 12,
  });
  expect(preset?.dataSources).toMatchObject({
    "turbine-super": "planned",
    "turbine-high": "planned",
    "turbine-low": "planned",
    "power-generator-ii-nuclear": "planned",
  });
  expect(preset?.planMismatches).toEqual(expect.arrayContaining([
    expect.objectContaining({
      recipeId: "turbine-super",
      current: 3,
      target: 6,
      actions: [{ type: "unpause", label: "Unpause 3 Super-Pressure Turbines" }],
    }),
    expect.objectContaining({
      recipeId: "power-generator-ii-nuclear",
      current: 6,
      target: 12,
      actions: [{ type: "unpause", label: "Unpause 6 Power Generators II" }],
    }),
  ]));
});

it("drops reached operation targets back to synced state", () => {
  let entityId = 0;
  const makeMany = (
    count: number,
    prototypeId: string,
    recipeIds: string[] = [],
  ) => Array.from(
    { length: count },
    () => syncedEntity(++entityId, prototypeId, recipeIds),
  );
  const entities = [
    ...makeMany(8, "HydrogenReformer", ["HydrogenProductionFromSteamSp"]),
    ...makeMany(3, "ElectrolyzerT2", ["BrineElectrolysis"]),
    ...makeMany(3, "EvaporationPondHeated", ["SaltMakingFromBrine"]),
    ...makeMany(10, "ThermalDesalinator", ["DesalinationFromSP"]),
    ...makeMany(6, "OceanWaterPumpT1", ["OceanWaterPumping2x"]),
    ...makeMany(6, "TurbineSuperPress"),
    ...makeMany(6, "TurbineHighPressT2"),
    ...makeMany(6, "TurbineLowPressT2"),
    ...makeMany(12, "PowerGeneratorT2"),
  ];
  const nuclearModule = createNuclearModule(
    defaultNuclearConfig,
    emptyPlanningBaselines,
    plannedNuclearOperation,
    entities,
  );
  const preset = nuclearModule.presets[0];

  expect(preset?.planMismatches).toBeUndefined();
  expect(preset?.dataSources).toMatchObject({
    "hydrogen-reformer-super": "synced",
    "electrolyzer-ii-chlorine": "synced",
    "evaporation-pond-heated-salt-brine": "synced",
    "thermal-desalinator-super": "synced",
    "seawater-pump": "synced",
  });
  expect(preset?.activeBuildings).toMatchObject({
    "hydrogen-reformer-super": 8,
    "electrolyzer-ii-chlorine": 3,
    "evaporation-pond-heated-salt-brine": 3,
    "thermal-desalinator-super": 10,
    "seawater-pump": 6,
  });
});

it("keeps standard and tall seawater pumps distinct while sharing the plan target", () => {
  let entityId = 0;
  const entities = [
    ...Array.from({ length: 4 }, () => syncedEntity(
      ++entityId,
      "OceanWaterPumpT1",
      ["OceanWaterPumping2x"],
    )),
    syncedEntity(
      ++entityId,
      "OceanWaterPumpLarge",
      ["OceanWaterPumping2xT2"],
    ),
    syncedEntity(
      ++entityId,
      "OceanWaterPumpLarge",
      ["OceanWaterPumping2xT2"],
      false,
    ),
  ];
  const nuclearModule = createNuclearModule(
    defaultNuclearConfig,
    emptyPlanningBaselines,
    {
      ...plannedNuclearOperation,
      generationTargetMw: 0,
      hydrogenReformerCount: 0,
      chlorineProcessingCount: 0,
      saltProcessingCount: 0,
      superDesalinatorCount: 0,
      seawaterPumpCount: 6,
    },
    entities,
  );
  const preset = nuclearModule.presets[0];

  expect(preset?.builtBuildings).toMatchObject({
    "seawater-pump": 4,
    "seawater-pump-tall": 2,
  });
  expect(preset?.activeBuildings).toMatchObject({
    "seawater-pump": 4,
    "seawater-pump-tall": 2,
  });
  expect(preset?.dataSources).toMatchObject({
    "seawater-pump": "synced",
    "seawater-pump-tall": "planned",
  });
  expect(preset?.planMismatches).toEqual([
    expect.objectContaining({
      recipeId: "seawater-pump-tall",
      current: 1,
      target: 2,
      actions: [{
        type: "unpause",
        label: "Unpause 1 Seawater Pump (Tall)",
      }],
    }),
  ]);
});

it("models the two-FBR checkpoint and its external requirements", () => {
  const result = calculateFactoryTotal(
    [nuclear],
    { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
  );
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
  expect(nuclear.presets[0]?.fixed).toEqual(["fbr-0x", "fbr", "fbr-3x"]);
  expect(nuclear.presets[0]?.builtBuildings).toMatchObject({
    "nuclear-reprocessing": 1,
    "seawater-pump": 4,
    "enrichment-plant": 2,
    "chemical-plant-yellowcake": 2,
    "turbine-super": 8,
    "turbine-high": 8,
    "turbine-low": 8,
    "power-generator-ii-nuclear": 16,
    "hydrogen-reformer-super": 8,
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
    "hydrogen-reformer-super": 8,
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
    [nuclear, defaultWithSolar],
    {
      recyclingEfficiencyPercent: 50,
      outputModifiers: { solarPower: solarPowerOutput.multiplier },
    },
  );
  const electricity = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "electricity",
  );

  expect(electricity?.produced).toBeCloseTo(120.77024, 6);
  expect(result.electricityDemandMw).toBeCloseTo(120.77024, 6);
});
