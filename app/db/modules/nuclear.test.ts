import { expect, it } from "vitest";

import { type SyncedProductionEntity } from "../../game-state";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { baseConfig } from "../config";
import { emptyPlanningBaselines } from "../planning-baselines";
import { type Module } from "./modules";
import { createNuclearModule, plannedNuclearOperation } from "./nuclear";

let nextEntityId = 1;
const syncedEntity = (
  prototypeId: string,
  recipeIds: string[] = [],
  running = true,
): SyncedProductionEntity => ({
  entityId: nextEntityId++,
  prototypeId,
  running,
  recipeIds,
  zones: [{ id: 14, name: "Nuclear" }],
  nuclearReactor: null,
});
const reactor = (
  enrichmentStep: number,
  targetPowerPercent: number,
  running = true,
): SyncedProductionEntity => ({
  ...syncedEntity("FastBreederReactor", [], running),
  nuclearReactor: { enrichmentStep, targetPowerPercent },
});
const makeMany = (
  built: number,
  running: number,
  prototypeId: string,
  recipeIds: string[] = [],
) => Array.from(
  { length: built },
  (_, index) => syncedEntity(prototypeId, recipeIds, index < running),
);

it("layers a pending operation target over exact synced inventory", () => {
  const entities = makeMany(
    5,
    1,
    "HydrogenReformer",
    ["HydrogenProductionFromSteamSp"],
  );
  const nuclearModule = createNuclearModule(
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
      target: 6,
      actions: [
        { type: "unpause", label: "Unpause 4 Hydrogen Reformers" },
        { type: "build", label: "Build 1 Hydrogen Reformer" },
      ],
    }),
  ]);
});

it("uses the synced reactor enrichment and power configuration", () => {
  const nuclearModule = createNuclearModule(
    emptyPlanningBaselines,
    undefined,
    [reactor(0, 400), reactor(1, 200), reactor(2, 100)],
  );
  const preset = nuclearModule.presets[0];

  expect(preset?.builtBuildings).toMatchObject({ fbr: 1, "fbr-0x": 1, "fbr-3x": 1 });
  expect(preset?.speedLevels).toMatchObject({ fbr: 2, "fbr-0x": 4, "fbr-3x": 1 });
  expect(preset?.dataSources).toMatchObject({
    fbr: "synced",
    "fbr-0x": "synced",
    "fbr-3x": "synced",
  });
  expect(nuclearModule.gameSynced).toBe(true);
});

it("projects turbine operation from synced reactor capacity", () => {
  const entities = [
    reactor(0, 400),
    ...makeMany(8, 3, "TurbineSuperPress"),
    ...makeMany(8, 3, "TurbineHighPressT2"),
    ...makeMany(8, 3, "TurbineLowPressT2"),
    ...makeMany(16, 6, "PowerGeneratorT2"),
  ];
  const nuclearModule = createNuclearModule(
    { averageGeneratorOutputMw: 77, hydrogenFuelDemandPerCycle: 46.5 },
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
  expect(preset?.electricityDispatchTargets?.["fbr-turbines"]).toBe(159);
});

it("returns reached operation targets to synced state", () => {
  const entities = [
    reactor(0, 400),
    ...makeMany(8, 8, "HydrogenReformer", ["HydrogenProductionFromSteamSp"]),
    ...makeMany(3, 3, "ElectrolyzerT2", ["BrineElectrolysis"]),
    ...makeMany(3, 3, "EvaporationPondHeated", ["SaltMakingFromBrine"]),
    ...makeMany(10, 10, "ThermalDesalinator", ["DesalinationFromSP"]),
    ...makeMany(6, 6, "OceanWaterPumpT1", ["OceanWaterPumping2x"]),
    ...makeMany(6, 6, "TurbineSuperPress"),
    ...makeMany(6, 6, "TurbineHighPressT2"),
    ...makeMany(6, 6, "TurbineLowPressT2"),
    ...makeMany(12, 12, "PowerGeneratorT2"),
  ];
  const nuclearModule = createNuclearModule(
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
});

it("keeps standard and tall seawater pumps distinct under one plan target", () => {
  const entities = [
    ...makeMany(4, 4, "OceanWaterPumpT1", ["OceanWaterPumping2x"]),
    ...makeMany(2, 1, "OceanWaterPumpLarge", ["OceanWaterPumping2xT2"]),
  ];
  const nuclearModule = createNuclearModule(
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
  expect(preset?.dataSources?.["seawater-pump"]).toBe("synced");
  expect(preset?.dataSources?.["seawater-pump-tall"]).toBe("planned");
});

it("preserves the synced Nuclear checkpoint's complete Factory Total", () => {
  const entities = [
    reactor(0, 400),
    reactor(2, 100),
    ...makeMany(4, 4, "OceanWaterPumpT1", ["OceanWaterPumping2x"]),
    ...makeMany(1, 1, "NuclearReprocessingPlant", ["CoreFuelReprocessing"]),
    ...makeMany(2, 2, "UraniumEnrichmentPlant", ["BlanketFuelReprocessing"]),
    ...makeMany(2, 2, "ChemicalPlant2", ["BlanketFuelFromYellowcake"]),
    ...makeMany(8, 3, "TurbineSuperPress"),
    ...makeMany(8, 3, "TurbineHighPressT2"),
    ...makeMany(8, 3, "TurbineLowPressT2"),
    ...makeMany(16, 6, "PowerGeneratorT2"),
    ...makeMany(8, 8, "HydrogenReformer", ["HydrogenProductionFromSteamSp"]),
    ...makeMany(4, 4, "ThermalDesalinator", ["DesalinationFromDepleted"]),
    ...makeMany(6, 6, "ThermalDesalinator", ["DesalinationFromSP"]),
    ...makeMany(2, 1, "ElectrolyzerT2", ["BrineElectrolysis"]),
    ...makeMany(2, 1, "EvaporationPondHeated", ["SaltMakingFromBrine"]),
    ...makeMany(4, 4, "CoolingTowerT2"),
    ...makeMany(1, 1, "WasteDump", ["OceanWaterDumping"]),
    ...makeMany(1, 1, "WasteDump", ["BrineDumping"]),
    ...makeMany(1, 1, "SmokeStackLarge", ["SmokeStackOxygen"]),
    ...makeMany(1, 1, "NuclearWasteStorage"),
    ...makeMany(1, 1, "Shredder", ["ShreddingRetiredWaste"]),
  ];
  const nuclearModule = createNuclearModule(
    { averageGeneratorOutputMw: 77, hydrogenFuelDemandPerCycle: 46.5 },
    undefined,
    entities,
  );
  const result = calculateFactoryTotal(
    [nuclearModule],
    { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
  );
  const flow = (resourceId: string) => result.calculation.allResourceFlows.find(
    candidate => candidate.resourceId === resourceId,
  );

  expect(flow("coreFuel")?.net).toBeCloseTo(0, 6);
  expect(flow("blanketFuel")?.net).toBeCloseTo(0, 6);
  expect(flow("yellowcake")?.net).toBeCloseTo(-9, 6);
  expect(flow("hydrogen")?.net).toBeCloseTo(0, 6);
  expect(flow("water")?.net).toBeCloseTo(0, 6);
  expect(flow("brine")?.net).toBeCloseTo(0, 6);
  expect(flow("oxygen")?.net).toBeCloseTo(0, 6);
  expect(flow("electricity")?.produced).toBeCloseTo(77, 6);
  expect(result.electricityDemandMw).toBeCloseTo(77, 6);
});

it("preserves the generated Nuclear area identity", () => {
  const entities = [reactor(0, 400)];
  const generatedArea: Module = {
    id: "live-area-14",
    name: "Nuclear",
    description: "",
    gameSynced: true,
    builtBuildings: {},
    presets: [{
      id: "live",
      name: "Live area",
      description: "",
      activeBuildings: {},
      fixed: [],
    }],
    defaultPresetId: "live",
    liveArea: {
      zoneId: 14,
      trackedBuildings: 1,
      constructedBuildings: 1,
      activeBuildings: 1,
      pausedBuildings: 0,
      constructionGhosts: 0,
      issues: [],
    },
  };
  const nuclearModule = createNuclearModule(
    emptyPlanningBaselines,
    undefined,
    entities,
    generatedArea,
  );

  expect(nuclearModule).toMatchObject({
    id: "live-area-14",
    name: "Nuclear",
    gameSynced: true,
    includedInFactoryTotals: true,
    liveArea: { zoneId: 14 },
  });
});
