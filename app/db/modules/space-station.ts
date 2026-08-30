import {
  AREA_INVENTORY_SCHEMA_VERSION,
  type SyncedLogisticsZoneRef,
  type SyncedProductionEntity,
} from "../../game-state";
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
export const SPACE_STATION_ZONE_NAME = "Space Station";

const handledAreaPrototypeIds = new Set([
  "RocketAssemblyDepot",
  "RocketLaunchPad",
]);

const isStationPartsAssembly = (entity: SyncedProductionEntity) => (
  entity.prototypeId === "AssemblyRoboticT2"
  && entity.recipeIds.includes("StationPartsAssembly")
);

const spaceStationZoneScore = (
  zone: SyncedLogisticsZoneRef,
  productionEntities: readonly SyncedProductionEntity[],
) => productionEntities.filter(entity => (
  entity.zones.some(entityZone => entityZone.id === zone.id)
  && (handledAreaPrototypeIds.has(entity.prototypeId) || isStationPartsAssembly(entity))
)).length;

export const selectSpaceStationZone = (
  zones: readonly SyncedLogisticsZoneRef[],
  productionEntities: readonly SyncedProductionEntity[],
): SyncedLogisticsZoneRef | undefined => (
  zones
    .filter(zone => zone.name === SPACE_STATION_ZONE_NAME)
    .sort((left, right) => (
      spaceStationZoneScore(right, productionEntities)
      - spaceStationZoneScore(left, productionEntities)
      || left.id - right.id
    ))[0]
);

export const shouldUseSpaceStationFallback = (schemaVersion?: number | null) => (
  schemaVersion == null || schemaVersion < AREA_INVENTORY_SCHEMA_VERSION
);

const handledAreaRecipeMarkers = [...handledAreaPrototypeIds].map(id => `:${id}:`);

const isHandledAreaRecipeId = (id: string) => (
  handledAreaRecipeMarkers.some(marker => id.includes(marker))
);

const withoutHandledAreaRecipeIds = <T>(values: Record<string, T> | undefined) => (
  values
    ? Object.fromEntries(
        Object.entries(values).filter(([id]) => !isHandledAreaRecipeId(id)),
      )
    : undefined
);

const withoutHandledAreaPrototypeIds = <T>(values: Record<string, T> | undefined) => (
  values
    ? Object.fromEntries(
        Object.entries(values).filter(([id]) => !handledAreaPrototypeIds.has(id)),
      )
    : undefined
);

export const createLegacySpaceStationArea = (
  zone: SyncedLogisticsZoneRef,
  productionEntities: readonly SyncedProductionEntity[],
): Module => {
  const zoneEntities = productionEntities.filter(entity => (
    entity.zones.some(entityZone => entityZone.id === zone.id)
  ));

  return {
    id: `live-area-${zone.id}`,
    name: zone.name ?? SPACE_STATION_ZONE_NAME,
    description: "",
    includedInFactoryTotals: false,
    builtBuildings: {},
    presets: [{
      id: "live",
      name: "Live area",
      description: "",
      activeBuildings: {},
      currentActiveBuildings: {},
      builtBuildings: {},
      constructionGhosts: {},
      capacityPools: {},
      dataSources: {},
      fixed: [],
    }],
    defaultPresetId: "live",
    liveArea: {
      zoneId: zone.id,
      trackedBuildings: zoneEntities.length,
      constructedBuildings: zoneEntities.length,
      activeBuildings: zoneEntities.filter(entity => entity.running).length,
      pausedBuildings: zoneEntities.filter(entity => !entity.running).length,
      constructionGhosts: 0,
      issues: [],
    },
  };
};

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
  generatedArea?: Module,
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

  const stationModule: Module = {
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

  if (!generatedArea) return stationModule;

  const generatedPreset = generatedArea.defaultPresetId
    ? generatedArea.presets.find(preset => preset.id === generatedArea.defaultPresetId)
    : generatedArea.presets[0];
  const stationPreset = stationModule.presets[0];

  if (!generatedPreset || !stationPreset) return generatedArea;

  const generatedStationPartsRecipeId = generatedArea.recipes?.find(recipe => (
    recipe.id.includes(":AssemblyRoboticT2:")
    && recipe.id.endsWith(":StationPartsAssembly")
  ))?.id;
  const stationRecipeIds = new Set([
    "space-station-operations",
    "space-station-orbital-research",
    "rocket-ii-assembly",
    "rocket-ii-launch-amortized",
    ...(!generatedStationPartsRecipeId ? [SPACE_STATION_PARTS_RECIPE_ID] : []),
  ]);
  const stationValues = <T>(values: Record<string, T> | undefined) => (
    values
      ? Object.fromEntries(
          Object.entries(values).filter(([id]) => stationRecipeIds.has(id)),
        )
      : undefined
  );
  const rocketConstructionGhosts = {
    "rocket-ii-assembly":
      generatedPreset.capacityPools?.RocketAssemblyDepot?.constructionGhosts ?? 0,
    "rocket-ii-launch-amortized":
      generatedPreset.capacityPools?.RocketLaunchPad?.constructionGhosts ?? 0,
  };
  const projectedRocketBuildings = {
    "rocket-ii-assembly":
      rocketRunning.rocketAssemblyDepot + rocketConstructionGhosts["rocket-ii-assembly"],
    "rocket-ii-launch-amortized":
      rocketRunning.rocketLaunchPad + rocketConstructionGhosts["rocket-ii-launch-amortized"],
  };
  const getProjectedRocketBuildingCount = (recipeId: string) => {
    if (recipeId === "rocket-ii-assembly") {
      return projectedRocketBuildings["rocket-ii-assembly"];
    }
    if (recipeId === "rocket-ii-launch-amortized") {
      return projectedRocketBuildings["rocket-ii-launch-amortized"];
    }

    return undefined;
  };
  const mergedPlanMismatches = [
    ...(generatedPreset.planMismatches ?? []).filter(mismatch => (
      !isHandledAreaRecipeId(mismatch.recipeId)
    )),
    ...(stationPreset.planMismatches ?? []).filter(mismatch => {
      if (!stationRecipeIds.has(mismatch.recipeId)) return false;
      const projectedRocketCount = getProjectedRocketBuildingCount(mismatch.recipeId);

      return projectedRocketCount == null || projectedRocketCount < mismatch.target;
    }),
  ];
  const mergedPreset = {
    ...generatedPreset,
    description: "",
    activeBuildings: {
      ...withoutHandledAreaRecipeIds(generatedPreset.activeBuildings),
      ...stationValues(stationPreset.activeBuildings),
    },
    currentActiveBuildings: {
      ...withoutHandledAreaRecipeIds(generatedPreset.currentActiveBuildings),
      "space-station-operations": hasCurrentTargetStation ? 1 : 0,
      "space-station-orbital-research": hasCurrentTargetStation && hasOrbitalResearch ? 1 : 0,
      "rocket-ii-assembly": rocketRunning.rocketAssemblyDepot,
      "rocket-ii-launch-amortized": rocketRunning.rocketLaunchPad,
      ...(!generatedStationPartsRecipeId
        ? { [SPACE_STATION_PARTS_RECIPE_ID]: stationPartsAssembly.running }
        : {}),
    },
    builtBuildings: {
      ...withoutHandledAreaRecipeIds(generatedPreset.builtBuildings),
      ...stationValues(stationModule.builtBuildings),
    },
    constructionGhosts: {
      ...withoutHandledAreaRecipeIds(generatedPreset.constructionGhosts),
      ...rocketConstructionGhosts,
    },
    capacityPools: withoutHandledAreaPrototypeIds(generatedPreset.capacityPools),
    dataSources: {
      ...withoutHandledAreaRecipeIds(generatedPreset.dataSources),
      ...stationValues(stationPreset.dataSources),
    },
    fixed: [
      ...new Set([
        ...generatedPreset.fixed.filter(id => !isHandledAreaRecipeId(id)),
        ...stationPreset.fixed.filter(id => stationRecipeIds.has(id)),
      ]),
    ],
    planMismatches: mergedPlanMismatches.length > 0 ? mergedPlanMismatches : undefined,
  };

  return {
    ...generatedArea,
    description: "",
    includedInFactoryTotals: true,
    builtBuildings: {
      ...withoutHandledAreaRecipeIds(generatedArea.builtBuildings),
      ...stationValues(stationModule.builtBuildings),
    },
    recipes: generatedArea.recipes?.filter(recipe => !isHandledAreaRecipeId(recipe.id)),
    presets: [mergedPreset],
    defaultPresetId: mergedPreset.id,
    liveArea: generatedArea.liveArea
      ? {
          ...generatedArea.liveArea,
          issues: generatedArea.liveArea.issues.filter(issue => {
            const prototypeId = issue.id.split(":", 1)[0];

            return !prototypeId || !handledAreaPrototypeIds.has(prototypeId);
          }),
        }
      : undefined,
  };
};

export const spaceStation = createSpaceStationModule(defaultSpaceStationConfig);
