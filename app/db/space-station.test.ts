import { describe, expect, it } from "vitest";

import { calculateBuildingDiagnostics } from "../helpers/building-diagnostics/building-diagnostics";
import { calculateBuildingStats } from "../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../helpers/factory-total/factory-total";
import { createLiveAreaModules } from "../helpers/live-area-modules/live-area-modules";
import {
  getPlanMismatchSummaries,
  getPlannedBuildSummaries,
} from "../helpers/planned-builds/planned-builds";
import { baseConfig } from "./config";
import { defaultArea as general } from "./modules/default";
import {
  createLegacySpaceStationArea,
  createSpaceStationModule,
  selectSpaceStationZone,
  shouldUseSpaceStationFallback,
  spaceStation,
} from "./modules/space-station";
import { recipes } from "./recipes";
import {
  calculateSpaceStationLevel,
  calculateRocketIiRecurringLogistics,
  defaultRocketIiRecurringLogistics,
  defaultSpaceStationConfig,
  getStationPartsKind,
} from "./space-station";

describe("Space Station", () => {
  it("keeps the station fallback only for snapshots without area inventory", () => {
    expect(shouldUseSpaceStationFallback()).toBe(true);
    expect(shouldUseSpaceStationFallback(15)).toBe(true);
    expect(shouldUseSpaceStationFallback(23)).toBe(true);
    expect(shouldUseSpaceStationFallback(24)).toBe(false);
    expect(shouldUseSpaceStationFallback(29)).toBe(false);
  });

  it("selects one Space Station area and prefers the one containing station infrastructure", () => {
    const zones = [
      { id: 9, name: "Space Station" },
      { id: 4, name: "Space Station" },
      { id: 2, name: "Other" },
    ];

    expect(selectSpaceStationZone(zones, [
      {
        entityId: 1,
        prototypeId: "RocketLaunchPad",
        running: false,
        recipeIds: [],
        zones: [zones[0]!],
        nuclearReactor: null,
      },
    ])).toEqual(zones[0]);
    expect(selectSpaceStationZone(zones, [])).toEqual(zones[1]);
  });

  it("retains standard Station Parts after this save reached orbital research", () => {
    expect(getStationPartsKind(1, 2)).toBe("basic");
    expect(getStationPartsKind(1, 4)).toBe("standard");
  });

  it("calculates the level-four operating point from the v0.8.7 formulas", () => {
    expect(calculateSpaceStationLevel(4, 4)).toEqual({
      constructionParts: 120,
      crew: 6,
      crewSuppliesPerCycle: 1.2,
      level: 4,
      maintenancePartsPerCycle: 1,
      researchEfficiencyBonusPercent: 25,
      researchSuppliesPerCycle: 4,
      spaceResearchPointsPerCycle: 96,
      stationPartsKind: "standard",
      unityPerCycle: 0.3,
    });
  });

  it("amortizes Rocket II supply and crew launches at capacity research level one", () => {
    expect(defaultRocketIiRecurringLogistics).toMatchObject({
      cargoCapacity: 126,
      crewCapacity: 13,
      payloadCapacityBonusPercent: 5,
      researchLevel: 1,
    });
    expect(defaultRocketIiRecurringLogistics.cargoLaunchesPerCycle)
      .toBeCloseTo(6.2 / 126, 9);
    expect(defaultRocketIiRecurringLogistics.crewLaunchesPerCycle)
      .toBeCloseTo(1 / 24, 9);
    expect(defaultRocketIiRecurringLogistics.launchesPerCycle)
      .toBeCloseTo(0.090873016, 9);
    expect(defaultRocketIiRecurringLogistics.compositePanelPerCycle)
      .toBeCloseTo(43.619048, 6);
    expect(defaultRocketIiRecurringLogistics.aluminumPerCycle)
      .toBeCloseTo(43.619048, 6);
    expect(defaultRocketIiRecurringLogistics.titaniumAlloyPerCycle)
      .toBeCloseTo(10.904762, 6);
    expect(defaultRocketIiRecurringLogistics.waterPerCycle)
      .toBeCloseTo(14.539683, 6);
    expect(defaultRocketIiRecurringLogistics.hydrogenPerCycle)
      .toBeCloseTo(29.079365, 6);
  });

  it("models Composite Panels and Rocket II as real production lines", () => {
    expect(recipes.find((recipe) => recipe.id === "assembly-v-composite-panel"))
      .toMatchObject({
        building: "Assembly V",
        cycleDurationSeconds: 15,
        inputs: [
          { resourceId: "aluminum", quantity: 32 },
          { resourceId: "steel", quantity: 4 },
          { resourceId: "plastic", quantity: 8 },
        ],
        outputs: [{ resourceId: "compositePanel", quantity: 32 }],
      });
    expect(recipes.find((recipe) => recipe.id === "rocket-ii-assembly"))
      .toMatchObject({
        building: "Rocket Assembly Depot",
        cycleDurationSeconds: 360,
        outputs: [{ resourceId: "rocketII", quantity: 1 / 6 }],
      });
    expect(recipes.find((recipe) => recipe.id === "rocket-ii-launch-amortized"))
      .toMatchObject({
        inputs: [
          { resourceId: "rocketII", quantity: 0.09087301587301587 },
          { resourceId: "water", quantity: 14.53968253968254 },
          { resourceId: "hydrogen", quantity: 29.07936507936508 },
          { resourceId: "oxygen", quantity: 8.178571428571429 },
        ],
      });
  });

  it("renders station operations as one physical asset without sharing their calculations", () => {
    const stationRecipes = recipes.filter(({ id }) => (
      ["space-station-operations", "space-station-orbital-research"].includes(id)
    ));

    expect(stationRecipes).toHaveLength(2);
    expect(stationRecipes.map(({ displayGroup }) => displayGroup)).toEqual([
      { id: "space-station", label: "Space Station IV" },
      { id: "space-station", label: "Space Station IV" },
    ]);
    expect(stationRecipes.every(({ sharedCapacity }) => sharedCapacity == null)).toBe(true);
  });

  it("adds the complete planned station to Factory Total over an empty baseline", () => {
    const stationModule = createSpaceStationModule(defaultSpaceStationConfig);
    const result = calculateFactoryTotal(
      [stationModule],
      { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
    );
    const stats = calculateBuildingStats(result.allLines, result.calculation);
    const preset = stationModule.presets[0];

    expect(result.allLines.map((line) => line.recipe.id)).toEqual([
      "assembly-v-station-parts",
      "space-station-operations",
      "space-station-orbital-research",
      "rocket-ii-assembly",
      "rocket-ii-launch-amortized",
    ]);
    expect(stats).toMatchObject({
      workers: 196,
      computingTflops: 14,
    });
    expect(stationModule.builtBuildings).toMatchObject({
      "assembly-v-station-parts": 1,
    });
    expect(preset?.activeBuildings).toMatchObject({
      "assembly-v-station-parts": 1,
    });
    expect(preset?.dataSources).toMatchObject({
      "assembly-v-station-parts": "modeled",
    });
    expect(stationModule.builtBuildings).toMatchObject({
      "rocket-ii-assembly": 0,
      "rocket-ii-launch-amortized": 0,
    });
    expect(preset?.activeBuildings).toMatchObject({
      "rocket-ii-assembly": 1,
      "rocket-ii-launch-amortized": 1,
    });
    expect(preset?.dataSources).toMatchObject({
      "rocket-ii-assembly": "planned",
      "rocket-ii-launch-amortized": "planned",
    });
    expect(preset?.planMismatches?.map(({ recipeId }) => recipeId)).toEqual([
      "space-station-operations",
      "rocket-ii-assembly",
      "rocket-ii-launch-amortized",
    ]);
    expect(recipes.some((recipe) => recipe.id.startsWith("static-rocket-")))
      .toBe(false);
  });

  it("returns all five calculation lines to synced once their targets are reached", () => {
    const stationModule = createSpaceStationModule(
      { currentLevel: 4, highestLevelAchieved: 4, targetLevel: 4 },
      { rocketAssemblyDepot: 1, rocketLaunchPad: 1 },
      { rocketAssemblyDepot: 1, rocketLaunchPad: 1 },
      {
        rocketRunningConfig: { rocketAssemblyDepot: 1, rocketLaunchPad: 1 },
        rocketSource: "synced",
        stationPartsAssembly: { built: 1, running: 1, source: "synced" },
        stationSource: "synced",
      },
    );
    const preset = stationModule.presets[0];

    expect(preset?.dataSources).toEqual({
      "space-station-operations": "synced",
      "space-station-orbital-research": "synced",
      "assembly-v-station-parts": "synced",
      "rocket-ii-assembly": "synced",
      "rocket-ii-launch-amortized": "synced",
    });
    expect(preset?.planMismatches).toBeUndefined();
  });

  it("preserves the generated Space Station area while supplying orbital calculations", () => {
    const zone = { id: 15, name: "Space Station" };
    const [generatedArea] = createLiveAreaModules(
      [zone],
      [
        {
          entityId: 1,
          prototypeId: "AssemblyRoboticT2",
          prototypeName: "Assembly V",
          constructionState: "Constructed",
          constructed: true,
          running: true,
          tile: { x: 1, y: 1 },
          zones: [zone],
          recipes: [{
            id: "StationPartsAssembly",
            name: "Station parts",
            durationSeconds: 15,
            assigned: true,
            inputs: [{ productId: "CompositeCore", name: "Composite Core", quantity: 4 }],
            outputs: [{ productId: "StationParts", name: "Station Parts", quantity: 2 }],
          }],
        },
        {
          entityId: 2,
          prototypeId: "RocketAssemblyDepot",
          prototypeName: "Rocket assembly depot",
          constructionState: "InConstruction",
          constructed: false,
          running: false,
          tile: { x: 2, y: 2 },
          zones: [zone],
          recipes: [],
        },
        {
          entityId: 3,
          prototypeId: "RocketLaunchPad",
          prototypeName: "Rocket launch pad",
          constructionState: "Constructed",
          constructed: true,
          running: false,
          tile: { x: 3, y: 3 },
          zones: [zone],
          recipes: [],
        },
      ],
      [],
    );

    if (!generatedArea) throw new Error("Missing generated Space Station area");

    const liveStation = createSpaceStationModule(
      defaultSpaceStationConfig,
      { rocketAssemblyDepot: 0, rocketLaunchPad: 1 },
      { rocketAssemblyDepot: 1, rocketLaunchPad: 1 },
      {
        rocketRunningConfig: { rocketAssemblyDepot: 0, rocketLaunchPad: 0 },
        rocketSource: "synced",
        stationPartsAssembly: { built: 1, running: 1, source: "synced" },
        stationSource: "synced",
      },
      generatedArea,
    );
    const preset = liveStation.presets[0];
    const stationPartsRecipeId =
      "live-area-15:AssemblyRoboticT2:StationPartsAssembly";

    expect(liveStation).toMatchObject({
      id: "live-area-15",
      name: "Space Station",
      description: "",
      includedInFactoryTotals: true,
      defaultPresetId: "live",
    });
    expect(liveStation.recipes?.map(recipe => recipe.id)).toEqual([stationPartsRecipeId]);
    expect(liveStation.builtBuildings).not.toHaveProperty("assembly-v-station-parts");
    expect(preset).toMatchObject({
      description: "",
      activeBuildings: {
        [stationPartsRecipeId]: 1,
        "space-station-operations": 1,
        "space-station-orbital-research": 1,
        "rocket-ii-assembly": 1,
        "rocket-ii-launch-amortized": 1,
      },
      currentActiveBuildings: {
        [stationPartsRecipeId]: 1,
        "space-station-operations": 0,
        "space-station-orbital-research": 0,
        "rocket-ii-assembly": 0,
        "rocket-ii-launch-amortized": 0,
      },
      dataSources: {
        [stationPartsRecipeId]: "synced",
        "space-station-operations": "planned",
        "space-station-orbital-research": "planned",
        "rocket-ii-assembly": "planned",
        "rocket-ii-launch-amortized": "planned",
      },
      constructionGhosts: {
        "rocket-ii-assembly": 1,
      },
    });
    expect(preset?.capacityPools).toEqual({
      AssemblyRoboticT2: expect.any(Object),
    });
    expect(preset?.planMismatches?.map(mismatch => mismatch.recipeId)).toEqual([
      "space-station-operations",
      "rocket-ii-launch-amortized",
    ]);
    expect(liveStation.liveArea?.issues).toEqual([]);
  });

  it("creates a generated-style Space Station area for pre-ghost snapshots", () => {
    const area = createLegacySpaceStationArea(
      { id: 15, name: "Space Station" },
      [
        {
          entityId: 1,
          prototypeId: "RocketAssemblyDepot",
          running: false,
          recipeIds: [],
          zones: [{ id: 15, name: "Space Station" }],
          nuclearReactor: null,
        },
        {
          entityId: 2,
          prototypeId: "RocketLaunchPad",
          running: true,
          recipeIds: [],
          zones: [{ id: 15, name: "Space Station" }],
          nuclearReactor: null,
        },
      ],
    );

    expect(area).toMatchObject({
      id: "live-area-15",
      name: "Space Station",
      includedInFactoryTotals: false,
      liveArea: {
        zoneId: 15,
        trackedBuildings: 2,
        constructedBuildings: 2,
        activeBuildings: 1,
        pausedBuildings: 1,
        constructionGhosts: 0,
        issues: [],
      },
    });
  });

  it("keeps only unmet live targets planned and exposes actions to Factory Total", () => {
    const stationModule = createSpaceStationModule(
      { currentLevel: 4, highestLevelAchieved: 4, targetLevel: 4 },
      { rocketAssemblyDepot: 1, rocketLaunchPad: 1 },
      { rocketAssemblyDepot: 1, rocketLaunchPad: 1 },
      {
        rocketRunningConfig: { rocketAssemblyDepot: 0, rocketLaunchPad: 1 },
        rocketSource: "synced",
        stationSource: "synced",
      },
    );
    const result = calculateFactoryTotal(
      [stationModule],
      { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
    );
    const diagnostics = calculateBuildingDiagnostics(
      [stationModule],
      result.flows,
      result.calculation.regularResults,
      result.calculation.sourceResults,
      result.calculation.sinkResults,
    );
    const preset = stationModule.presets[0];

    expect(preset?.dataSources).toMatchObject({
      "space-station-operations": "synced",
      "space-station-orbital-research": "synced",
      "rocket-ii-assembly": "planned",
      "rocket-ii-launch-amortized": "synced",
    });
    expect(getPlanMismatchSummaries([stationModule], diagnostics)).toMatchObject([{
      key: "space-station:rocket-ii-assembly",
      buildingName: "Rocket Assembly Depot",
      current: 0,
      currentSource: "synced",
      target: 1,
      direction: "at-least",
      actions: [{
        type: "unpause",
        label: "Unpause 1 Rocket Assembly Depot",
      }],
    }]);
  });

  it("exposes the station plan through standard module flows and building pressure", () => {
    const stationModule = createSpaceStationModule(defaultSpaceStationConfig);
    const result = calculateFactoryTotal(
      [stationModule],
      { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
    );
    const planLines = result.allLines;
    const regularResults = result.calculation.regularResults;
    const stats = calculateBuildingStats(planLines, {
      regularResults,
      sourceResults: [],
      sinkResults: [],
    });
    const flow = (resourceId: string) => result.flows.find(
      (candidate) => candidate.resourceId === resourceId,
    );

    expect(planLines
      .filter((line) => line.recipe.id !== "assembly-v-station-parts")
      .every((line) => line.dataSource === "planned")).toBe(true);
    expect(planLines.find(
      (line) => line.recipe.id === "assembly-v-station-parts",
    )?.dataSource).toBe("modeled");
    expect(planLines.some((line) => line.recipe.id === "assembly-v-composite-panel"))
      .toBe(false);
    expect(stats.workers).toBe(196);
    expect(stats.computingTflops).toBe(14);
    expect(flow("stationParts")?.net).toBe(0);
    expect(flow("compositeCore")?.net).toBe(-2);
    expect(flow("solarCellMono")?.net).toBe(-1);
    expect(flow("chemicalFuel")?.net).toBe(-0.5);
    expect(flow("crewSupplies")?.net).toBe(-1.2);
    expect(flow("electronicsIv")?.net).toBe(0);
    expect(flow("spaceResearchPoints")?.net).toBe(0);
    expect(regularResults.find(
      ({ recipe }) => recipe.id === "space-station-orbital-research",
    )?.supplyRatio).toBe(0);
    expect(flow("compositePanel")?.net).toBeCloseTo(-43.619048, 6);
    expect(flow("aluminum")).toBeUndefined();
    expect(flow("plastic")).toBeUndefined();
    expect(flow("steel")?.net).toBeCloseTo(-7.269841, 6);
    expect(flow("titaniumAlloy")?.net).toBeCloseTo(-10.904762, 6);
  });

  it("does not expose orbital research mode as a physical planned build", () => {
    const stationModule = createSpaceStationModule(defaultSpaceStationConfig);
    const result = calculateFactoryTotal(
      [stationModule],
      { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
    );
    const diagnostics = calculateBuildingDiagnostics(
      [stationModule],
      result.flows,
      result.calculation.regularResults,
      result.calculation.sourceResults,
      result.calculation.sinkResults,
    );
    const plannedBuilds = getPlannedBuildSummaries(diagnostics);
    const orbitalResearch = diagnostics.find(
      ({ buildingName }) => buildingName === "Space Station Orbital Research",
    );

    expect(orbitalResearch).toMatchObject({
      plannedCapacity: false,
      attention: null,
    });
    expect(plannedBuilds.map(({ buildingName }) => buildingName)).not.toContain(
      "Space Station Orbital Research",
    );
    expect(plannedBuilds.map(({ buildingName }) => buildingName)).toEqual(
      expect.arrayContaining([
        "Rocket Assembly Depot",
        "Rocket Launch Pad",
        "Space Station IV",
      ]),
    );
  });

  it("applies synced rocket-capacity research to recurring launch demand", () => {
    const levelTen = calculateRocketIiRecurringLogistics(
      calculateSpaceStationLevel(4, 4),
      10,
    );
    const result = calculateFactoryTotal(
      [spaceStation],
      {
        recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent,
        outputModifiers: {
          rocketLaunches: levelTen.launchesPerCycle
            / defaultRocketIiRecurringLogistics.launchesPerCycle,
        },
      },
    );
    const launch = result.calculation.regularResults.find(
      (line) => line.recipe.id === "rocket-ii-launch-amortized",
    );
    const input = (resourceId: string) => launch?.actualInputs.find(
      (candidate) => candidate.resourceId === resourceId,
    )?.quantity;

    expect(input("rocketII")).toBeCloseTo(levelTen.launchesPerCycle, 9);
    expect(input("water")).toBeCloseTo(levelTen.waterPerCycle, 9);
    expect(input("hydrogen")).toBeCloseTo(levelTen.hydrogenPerCycle, 9);
    expect(input("oxygen")).toBeCloseTo(levelTen.oxygenPerCycle, 9);
  });

  it("retains a balanced space plan when the planning modules are inspected in isolation", () => {
    const result = calculateFactoryTotal(
      [
        spaceStation,
        general,
      ],
      { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
    );
    const orbitalResearch = result.calculation.regularResults.find(
      (line) => line.recipe.id === "space-station-orbital-research",
    );
    const flow = (resourceId: string) => result.flows.find(
      (candidate) => candidate.resourceId === resourceId,
    );

    expect(orbitalResearch).toMatchObject({ supplyRatio: 1 });
    expect(flow("spaceResearchPoints")).toMatchObject({
      consumed: 96,
      produced: 96,
      net: 0,
    });
    expect(flow("electronicsIv")).toMatchObject({ consumed: 4, produced: 4, net: 0 });
    expect(flow("crewSupplies")).toMatchObject({ consumed: 1.2, produced: 1.2, net: 0 });
    expect(flow("stationParts")).toMatchObject({ consumed: 1, produced: 1, net: 0 });
    expect(flow("aluminum")?.consumed).toBeCloseTo(48.119048, 6);
    expect(flow("titaniumAlloy")?.consumed).toBeCloseTo(12.904762, 6);
    expect(flow("compositePanel")).toMatchObject({ net: 0 });
    expect(flow("rocketII")?.net).toBeCloseTo(0, 12);
  });
});
