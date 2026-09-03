import { expect, it } from "vitest";

import { type SyncedProductionEntity } from "../../game-state";
import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateBuildingDiagnostics } from "../../helpers/building-diagnostics/building-diagnostics";
import { calculateNet } from "../../helpers/calculate/calculate";
import { getPlannedConfigurationSummaries } from "../../helpers/planned-builds/planned-builds";
import {
  attachSolarPanelsToModule,
  resolveSolarPanelModuleAssignments,
} from "./area-solar";
import { type Module } from "./modules";

const createModule = (id: string, name: string): Module => ({
  id,
  name,
  description: `${name} production`,
  builtBuildings: { "assembly-v-electronics-i": 1 },
  presets: [{
    id: "current",
    name: "Current",
    description: "Current production",
    builtBuildings: { "assembly-v-electronics-i": 1 },
    activeBuildings: { "assembly-v-electronics-i": 1 },
    fixed: [],
  }],
  defaultPresetId: "current",
});

const createLiveModule = (id: string, name: string, zoneId: number): Module => ({
  ...createModule(id, name),
  liveArea: {
    zoneId,
    trackedBuildings: 0,
    constructedBuildings: 0,
    activeBuildings: 0,
    pausedBuildings: 0,
    constructionGhosts: 0,
    issues: [],
  },
});
const defaultModule = createModule("general", "Default");
const nuclearModule = createLiveModule("nuclear", "Nuclear", 10);
const computingModule = createLiveModule("computing", "Computing", 20);
const ownershipModules = [defaultModule, nuclearModule, computingModule];
const solarEntity = (
  entityId: number,
  prototypeId: "SolarPanel" | "SolarPanelMono",
  zoneIds: number[],
  running = true,
): SyncedProductionEntity => ({
  entityId,
  prototypeId,
  running,
  recipeIds: [],
  zones: zoneIds.map(id => ({ id, name: `Area ${id}` })),
  nuclearReactor: null,
  dataCenterRacks: null,
});

it("keeps panels from unmatched areas under the Default fallback owner", () => {
  const assignments = resolveSolarPanelModuleAssignments({
    defaultModuleId: defaultModule.id,
    modules: ownershipModules,
    plannedTargets: { mono: 2 },
    productionEntities: [solarEntity(1, "SolarPanelMono", [30])],
  });

  expect(assignments.general).toMatchObject({
    builtCounts: { standard: 0, mono: 1 },
    runningCounts: { standard: 0, mono: 1 },
    plannedTargets: { mono: 2 },
  });
  expect(assignments.nuclear?.builtCounts.mono).toBe(0);
  expect(assignments.computing?.builtCounts.mono).toBe(0);
});

it("applies the global target to the module that owns the live panels", () => {
  const assignments = resolveSolarPanelModuleAssignments({
    defaultModuleId: defaultModule.id,
    modules: ownershipModules,
    plannedTargets: { mono: 2 },
    productionEntities: [solarEntity(1, "SolarPanelMono", [10])],
  });

  expect(assignments.general).toMatchObject({
    builtCounts: { standard: 0, mono: 0 },
    plannedTargets: {},
  });
  expect(assignments.nuclear).toMatchObject({
    builtCounts: { standard: 0, mono: 1 },
    runningCounts: { standard: 0, mono: 1 },
    plannedTargets: { mono: 2 },
  });
});

it("counts an overlapping panel once under the Default fallback owner", () => {
  const assignments = resolveSolarPanelModuleAssignments({
    defaultModuleId: defaultModule.id,
    modules: ownershipModules,
    productionEntities: [solarEntity(1, "SolarPanelMono", [10, 20])],
  });
  const totalBuilt = Object.values(assignments).reduce(
    (total, assignment) => total + assignment.builtCounts.mono,
    0,
  );

  expect(totalBuilt).toBe(1);
  expect(assignments.general?.builtCounts.mono).toBe(1);
  expect(assignments.nuclear?.builtCounts.mono).toBe(0);
  expect(assignments.computing?.builtCounts.mono).toBe(0);
});

it("uses the synced area ID when duplicate area names exist", () => {
  const firstComputing = createLiveModule("live-area-15", "Computing", 15);
  const secondComputing = createLiveModule("live-area-17", "Computing", 17);
  const panel = solarEntity(1, "SolarPanelMono", []);

  panel.zones = [{ id: 17, name: "Computing" }];

  const assignments = resolveSolarPanelModuleAssignments({
    defaultModuleId: defaultModule.id,
    modules: [defaultModule, firstComputing, secondComputing],
    productionEntities: [panel],
  });

  expect(assignments[firstComputing.id]?.builtCounts.mono).toBe(0);
  expect(assignments[secondComputing.id]?.builtCounts.mono).toBe(1);
  expect(assignments[defaultModule.id]?.builtCounts.mono).toBe(0);
});

it("adds live solar buildings to their owning area module", () => {
  const moduleWithSolar = attachSolarPanelsToModule(
    defaultModule,
    { standard: 10, mono: 20 },
    { standard: 8, mono: 15 },
    undefined,
    "synced",
  );
  const { lines } = buildModuleLines(moduleWithSolar, moduleWithSolar.presets[0]);

  expect(lines.filter(line => line.recipe.id.startsWith("solar-panel")).map(line => ({
    id: line.recipe.id,
    active: line.activeBuildings,
    built: line.builtBuildings,
    source: line.dataSource,
    mode: line.operatingMode,
  }))).toEqual([
    { id: "solar-panel", active: 8, built: 10, source: "synced", mode: "fixed" },
    { id: "solar-panel-mono", active: 15, built: 20, source: "synced", mode: "fixed" },
  ]);
});

it("keeps a fixed target planned until enough built panels are running", () => {
  const moduleWithSolar = attachSolarPanelsToModule(
    defaultModule,
    { standard: 10, mono: 25 },
    { standard: 8, mono: 23 },
    { mono: 25 },
    "synced",
  );
  const mono = buildModuleLines(moduleWithSolar, moduleWithSolar.presets[0]).lines.find(
    line => line.recipe.id === "solar-panel-mono",
  );
  const calculation = calculateNet(
    buildModuleLines(moduleWithSolar, moduleWithSolar.presets[0]).lines,
  );
  const diagnostics = calculateBuildingDiagnostics(
    [moduleWithSolar],
    calculation.allResourceFlows,
    calculation.regularResults,
  );

  expect(mono).toMatchObject({
    activeBuildings: 25,
    builtBuildings: 25,
    dataSource: "planned",
  });
  expect(getPlannedConfigurationSummaries([moduleWithSolar], diagnostics)).toMatchObject([{
    key: "general:solar-panel-mono",
  }]);
});

it("uses the live count after a solar target is complete", () => {
  const moduleWithSolar = attachSolarPanelsToModule(
    defaultModule,
    { standard: 38, mono: 423 },
    { standard: 38, mono: 423 },
    { mono: 245 },
    "synced",
  );
  const mono = buildModuleLines(moduleWithSolar, moduleWithSolar.presets[0]).lines.find(
    line => line.recipe.id === "solar-panel-mono",
  );

  expect(mono).toMatchObject({
    activeBuildings: 423,
    builtBuildings: 423,
    dataSource: "synced",
  });
});
