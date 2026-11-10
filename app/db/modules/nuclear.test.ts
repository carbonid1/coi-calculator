import { expect, it } from "vitest";

import { type SyncedProductionEntity } from "../../game-state";
import { calculateFactoryTotal } from "../../test-fixtures/factory-total";
import { baseConfig } from '../../test-fixtures/historical-planning'
import { emptyPlanningBaselines } from "../planning-baselines";
import { type Module } from "./modules";
import { createNuclearModule, plannedNuclearOperation, thirdFbrNuclearOperation } from "./nuclear";

const sequence = {
  nextEntityId: 1,
};
const syncedEntity = (
  prototypeId: string,
  recipeIds: string[] = [],
  running = true,
): SyncedProductionEntity => ({
  entityId: sequence.nextEntityId++,
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
      hydrogenReformerCount: 6,
      chlorineProcessingCount: 0,
      saltProcessingCount: 0,
      superDesalinatorCount: 0,
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
  expect(preset?.electricityDispatchTargets).toBeUndefined();
});

it('plans individual turbine mode counts without changing other turbine types or physical inventory', () => {
  const entities = [
    ...makeMany(4, 4, 'TurbineSuperPress'),
    ...makeMany(4, 4, 'TurbineHighPressT2'),
    ...makeMany(4, 4, 'TurbineLowPressT2'),
  ].map(entity => ({ ...entity, turbineAutoBalance: false }))
  const nuclearModule = createNuclearModule(emptyPlanningBaselines, {
    hydrogenReformerCount: 0, chlorineProcessingCount: 0, saltProcessingCount: 0, superDesalinatorCount: 0,
    turbineAutoBalanceOff: { 'turbine-super': 3 },
  }, entities)
  const preset = nuclearModule.presets[0]!

  expect(preset.autoBalanceOffBuildings).toEqual({ 'turbine-super': 3, 'turbine-high': 4, 'turbine-low': 4 })
  expect(preset.builtBuildings).toEqual({ 'turbine-super': 4, 'turbine-high': 4, 'turbine-low': 4 })
  expect(preset.planMismatches).toEqual([expect.objectContaining({
    recipeId: 'turbine-super', current: 4, target: 3,
    actions: [{ type: 'configure', label: 'Set auto-balance on for 1 Super-pressure turbine' }],
  })])
})

it.each([
  { pausedAutoBalance: false, explicit: true, expectedOff: 8, configure: 0 },
  { pausedAutoBalance: true, explicit: true, expectedOff: 8, configure: 4 },
  { pausedAutoBalance: false, explicit: false, expectedOff: 8, configure: 0 },
  { pausedAutoBalance: true, explicit: false, expectedOff: 4, configure: 0 },
])('preserves paused turbine settings when planning unpauses (%j)', ({ pausedAutoBalance, explicit, expectedOff, configure }) => {
  const members = [
    ['TurbineSuperPress', 'turbine-super'], ['TurbineHighPressT2', 'turbine-high'], ['TurbineLowPressT2', 'turbine-low'],
  ] as const
  const entities = members.flatMap(([prototype]) => makeMany(8, 4, prototype)
    .map(entity => ({ ...entity, turbineAutoBalance: entity.running ? false : pausedAutoBalance })))
  const plan = { hydrogenReformerCount: 0, chlorineProcessingCount: 0, saltProcessingCount: 0, superDesalinatorCount: 0,
    turbineRows: { working: 4, standby: 0 },
    ...(explicit ? { turbineAutoBalanceOff: Object.fromEntries(members.map(([, id]) => [id, 8])) } : {}),
  }
  const preset = createNuclearModule(emptyPlanningBaselines, plan, entities).presets[0]!
  const current = createNuclearModule(emptyPlanningBaselines, undefined, entities).presets[0]!

  for (const [, id] of members) {
    expect(current.autoBalanceOffBuildings?.[id]).toBe(4)
    expect(preset.autoBalanceOffBuildings?.[id]).toBe(expectedOff)
    const actions = preset.planMismatches?.find(mismatch => mismatch.recipeId === id)?.actions ?? []

    expect(actions.filter(action => action.type === 'unpause')).toHaveLength(1)
    expect(actions.filter(action => action.type === 'configure')).toHaveLength(Number(configure > 0))
    if (configure > 0) expect(actions.find(action => action.type === 'configure')?.label).toContain(`for ${configure} `)
  }
})

it("keeps synced turbine inventory and leaves generation demand driven", () => {
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
    "turbine-super": 3,
    "turbine-high": 3,
    "turbine-low": 3,
    "power-generator-ii-nuclear": 6,
  });
  expect(preset?.dataSources).toMatchObject({
    "turbine-super": "synced",
    "turbine-high": "synced",
    "turbine-low": "synced",
    "power-generator-ii-nuclear": "synced",
  });
  expect(preset?.electricityDispatchTargets).toBeUndefined();
});

it.each([
  { built: 8, running: 4, unplaced: 0, workingBuild: 0, standbyBuild: 0, unpause: 4, pause: 0 },
  { built: 4, running: 4, unplaced: 4, workingBuild: 4, standbyBuild: 0, unpause: 0, pause: 0 },
  { built: 10, running: 8, unplaced: 0, workingBuild: 0, standbyBuild: 0, unpause: 0, pause: 0 },
  { built: 10, running: 10, unplaced: 0, workingBuild: 0, standbyBuild: 0, unpause: 0, pause: 2 },
])("plans four working rows from $built built / $running running trains", (state) => {
  const members = [
    ['turbine-super', 'TurbineSuperPress', 1],
    ['turbine-high', 'TurbineHighPressT2', 1],
    ['turbine-low', 'TurbineLowPressT2', 1],
    ['power-generator-ii-nuclear', 'PowerGeneratorT2', 2],
  ] as const;
  const entities = members.flatMap(([, prototype, scale]) => makeMany(state.built * scale, state.running * scale, prototype)
    .map((entity, index) => ({ ...entity, turbineAutoBalance: prototype.startsWith('Turbine') ? index >= 8 : null })));
  const nuclearModule = createNuclearModule(emptyPlanningBaselines, thirdFbrNuclearOperation, entities);
  const preset = nuclearModule.presets[0];

  for (const [id, , scale] of members) {
    expect(preset.activeBuildings[id]).toBe(8 * scale);
    expect(preset.builtBuildings?.[id]).toBe(state.built * scale);
    expect(preset.currentActiveBuildings?.[id]).toBe(state.running * scale);
    expect(preset.unplacedPlannedBuildings?.[id]).toBe(state.unplaced * scale);
    expect(preset.fixed).not.toContain(id);
    const actions = preset.planMismatches?.find(mismatch => mismatch.recipeId === id)?.actions ?? [];

    expect(actions.filter(action => action.type === 'build').length)
      .toBe(Number(state.workingBuild > 0) + Number(state.standbyBuild > 0));
    expect(actions.filter(action => action.type === 'unpause').length).toBe(Number(state.unpause > 0));
    expect(actions.filter(action => action.type === 'pause').length).toBe(Number(state.pause > 0));
    if (state.standbyBuild > 0) expect(actions.filter(action => action.type === 'build').at(-1)?.label)
      .toMatch(new RegExp(`Build ${state.standbyBuild * scale} .* for standby \\(leave paused\\)`));
    if (actions.length === 0) expect(preset.dataSources?.[id]).toBe('synced');
  }
  expect(preset.electricityDispatchTargets).toBeUndefined();
  expect(preset.autoBalanceOffBuildings).toEqual({ 'turbine-super': 8, 'turbine-high': 8, 'turbine-low': 8 });
  const mismatchIds = (preset.planMismatches ?? []).map(mismatch => mismatch.recipeId);

  expect(new Set(mismatchIds).size).toBe(mismatchIds.length);
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

it("keeps standard and tall seawater pumps at their synced running counts", () => {
  const entities = [
    ...makeMany(4, 4, "OceanWaterPumpT1", ["OceanWaterPumping2x"]),
    ...makeMany(2, 1, "OceanWaterPumpLarge", ["OceanWaterPumping2xT2"]),
  ];
  const nuclearModule = createNuclearModule(
    emptyPlanningBaselines,
    {
      ...plannedNuclearOperation,
      hydrogenReformerCount: 0,
      chlorineProcessingCount: 0,
      saltProcessingCount: 0,
      superDesalinatorCount: 0,
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
    "seawater-pump-tall": 1,
  });
  expect(preset?.dataSources?.["seawater-pump"]).toBe("synced");
  expect(preset?.dataSources?.["seawater-pump-tall"]).toBe("synced");
  expect(preset?.planMismatches).toBeUndefined();
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
