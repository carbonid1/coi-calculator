import {
  resolveDirectionalPlan,
  type ResolvedDirectionalPlan,
} from "../../helpers/resolve-layered-value/resolve-directional-plan";
import {
  type CurrentValueSource,
} from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  emptyRocketInfrastructureConfig,
  normalizeRocketInfrastructureConfig,
  plannedRocketInfrastructureConfig,
  rocketInfrastructureItems,
  type RocketInfrastructureConfig,
  type RocketInfrastructureId,
} from "../rocket-infrastructure";
import {
  defaultSpaceStationConfig,
  type SpaceStationConfig,
} from "../space-station";
import { type Module } from "./modules";
import { createAtLeastBuildingActions } from "./plan-mismatch";

export const SPACE_STATION_MODULE_ID = "space-station";
export const SPACE_STATION_PARTS_RECIPE_ID = "assembly-v-station-parts";

export interface SpaceStationAreaBuildingState {
  built: number;
  running: number;
  source: CurrentValueSource;
}

export interface SpaceStationCurrentState {
  rocketRunningConfig?: RocketInfrastructureConfig;
  rocketSource?: CurrentValueSource;
  stationPartsAssembly?: SpaceStationAreaBuildingState;
  stationSource?: CurrentValueSource;
}

const currentLayers = (value: number, source: CurrentValueSource) => {
  if (source === "synced") return { default: 0, synced: value };
  if (source === "modeled") return { default: 0, modeled: value };

  return { default: value };
};

const getResolvedSource = (plan: ResolvedDirectionalPlan) => plan.source;

export const createSpaceStationModule = (
  config: SpaceStationConfig,
  rocketBuiltConfig: RocketInfrastructureConfig = emptyRocketInfrastructureConfig,
  rocketPlanConfig: RocketInfrastructureConfig = plannedRocketInfrastructureConfig,
  currentState: SpaceStationCurrentState = {},
): Module => {
  const hasStation = config.targetLevel > 0;
  const hasOrbitalResearch = config.targetLevel >= 3;
  const rocketBuilt = normalizeRocketInfrastructureConfig(rocketBuiltConfig);
  const rocketRunning = normalizeRocketInfrastructureConfig(
    currentState.rocketRunningConfig ?? rocketBuilt,
  );
  const rocketPlan = normalizeRocketInfrastructureConfig(rocketPlanConfig);
  const stationSource = currentState.stationSource ?? "modeled";
  const rocketSource = currentState.rocketSource ?? "modeled";
  const stationPartsAssembly = currentState.stationPartsAssembly ?? {
    built: 1,
    running: 1,
    source: "modeled" as const,
  };
  const stationPlan = resolveDirectionalPlan(
    currentLayers(config.currentLevel, stationSource),
    { direction: "at-least", target: config.targetLevel },
  );
  const hasCurrentTargetStation = hasStation && stationPlan.satisfied;
  const stationActive = hasStation ? 1 : 0;
  const stationDataSource = getResolvedSource(stationPlan);
  const resolveRocketPlan = (id: RocketInfrastructureId): ResolvedDirectionalPlan => (
    resolveDirectionalPlan(
      currentLayers(rocketRunning[id], rocketSource),
      { direction: "at-least", target: hasStation ? rocketPlan[id] : 0 },
    )
  );
  const rocketPlans: Record<RocketInfrastructureId, ResolvedDirectionalPlan> = {
    rocketAssemblyDepot: resolveRocketPlan("rocketAssemblyDepot"),
    rocketLaunchPad: resolveRocketPlan("rocketLaunchPad"),
  };
  const rocketBuiltBuildings = Object.fromEntries(
    rocketInfrastructureItems.map((item) => [item.recipeId, rocketBuilt[item.id]]),
  );
  const rocketActiveBuildings = Object.fromEntries(
    rocketInfrastructureItems.map((item) => [
      item.recipeId,
      hasStation ? rocketPlans[item.id].value : 0,
    ]),
  );
  const builtBuildings = {
    "space-station-operations": hasCurrentTargetStation ? 1 : 0,
    "space-station-orbital-research": hasCurrentTargetStation ? 1 : 0,
    [SPACE_STATION_PARTS_RECIPE_ID]: stationPartsAssembly.built,
    ...rocketBuiltBuildings,
  };
  const activeBuildings = {
    "space-station-operations": stationActive,
    "space-station-orbital-research": hasOrbitalResearch ? stationActive : 0,
    [SPACE_STATION_PARTS_RECIPE_ID]: stationPartsAssembly.running,
    ...rocketActiveBuildings,
  };
  const dataSources = {
    "space-station-operations": stationDataSource,
    "space-station-orbital-research": stationDataSource,
    [SPACE_STATION_PARTS_RECIPE_ID]: stationPartsAssembly.source,
    ...Object.fromEntries(
      rocketInfrastructureItems.map((item) => [
        item.recipeId,
        getResolvedSource(rocketPlans[item.id]),
      ]),
    ),
  };
  const planMismatches = [
    ...(!stationPlan.satisfied && hasStation
      ? [{
          recipeId: "space-station-operations",
          current: config.currentLevel,
          currentSource: stationPlan.current.source,
          target: config.targetLevel,
          direction: stationPlan.direction,
          format: "level" as const,
          actions: [{
            type: config.currentLevel > 0 ? "upgrade" as const : "build" as const,
            label: config.currentLevel > 0
              ? `Upgrade from level ${config.currentLevel} to level ${config.targetLevel}`
              : `Build Space Station level ${config.targetLevel}`,
          }],
        }]
      : []),
    ...rocketInfrastructureItems.flatMap((item) => {
      const plan = rocketPlans[item.id];

      if (plan.satisfied || !hasStation) return [];

      return [{
        recipeId: item.recipeId,
        current: plan.current.value,
        currentSource: plan.current.source,
        target: plan.target,
        direction: plan.direction,
        format: "count" as const,
        actions: createAtLeastBuildingActions({
          built: rocketBuilt[item.id],
          running: rocketRunning[item.id],
          target: plan.target,
          name: item.name,
        }),
      }];
    }),
  ];

  return {
    id: SPACE_STATION_MODULE_ID,
    name: "Space Station",
    description: "Level 4 station and rocket infrastructure plan; projected resources and workforce are included in Factory Total",
    includedInFactoryTotals: true,
    builtBuildings,
    presets: [
      {
        id: "target-level",
        name: "Target level",
        description: `Space Station level ${config.targetLevel}`,
        activeBuildings,
        dataSources,
        planMismatches: planMismatches.length > 0 ? planMismatches : undefined,
        // Orbital research remains demand-balanced: the station produces
        // points only while Research Lab IV is explicitly in Space Research.
        fixed: [
          "space-station-operations",
          "rocket-ii-launch-amortized",
        ],
      },
    ],
    defaultPresetId: "target-level",
  };
};

export const spaceStation = createSpaceStationModule(defaultSpaceStationConfig);
