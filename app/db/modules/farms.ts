import { resolveChickenFarmEntityPlan } from "../../helpers/chicken-farm-plan/chicken-farm-plan";
import {
  resolveDirectionalPlan,
  type PlanDirection,
} from "../../helpers/resolve-layered-value/resolve-directional-plan";
import {
  type CurrentValueSource,
  type ValueSource,
} from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  type CurrentChickenFarmEntity,
  chickenFarm,
  type ChickenFarmSettings,
  getChickenFarmLayout,
  resolvedChickenFarmSettings,
  resolvedCurrentChickenFarmSettings,
} from "../chicken-farm";
import {
  type Module,
  type PlanMismatchAction,
} from "./modules";
import { createAtMostBuildingActions } from "./plan-mismatch";

export const CHICKEN_FARMS_MODULE_ID = "chicken-farms";

const slaughteringRecipeId = "chicken-farm-slaughtering";
const eggsOnlyRecipeId = "chicken-farm-eggs-only";

export interface CurrentChickenFarmConfiguration {
  slaughtering: boolean;
  built: number;
  running: number;
  chickens: number;
  runningChickens: number;
}

const attachToSyncedArea = (farmModule: Module, syncedArea?: Module): Module => {
  if (!syncedArea) return farmModule;

  const areaPreset = syncedArea.presets.find(preset => (
    preset.id === syncedArea.defaultPresetId
  )) ?? syncedArea.presets[0];
  const farmPreset = farmModule.presets[0];

  if (!areaPreset || !farmPreset) return farmModule;

  return {
    ...syncedArea,
    includedInFactoryTotals: true,
    builtBuildings: {
      ...syncedArea.builtBuildings,
      ...farmModule.builtBuildings,
    },
    presets: [{
      ...areaPreset,
      activeBuildings: {
        ...areaPreset.activeBuildings,
        ...farmPreset.activeBuildings,
      },
      builtBuildings: {
        ...areaPreset.builtBuildings,
        ...farmModule.builtBuildings,
      },
      dataSources: {
        ...areaPreset.dataSources,
        ...farmPreset.dataSources,
      },
      fixed: [...new Set([...areaPreset.fixed, ...farmPreset.fixed])],
      planMismatches: farmPreset.planMismatches,
      speedLevels: {
        ...areaPreset.speedLevels,
        ...farmPreset.speedLevels,
      },
      unplacedPlannedBuildings: farmPreset.unplacedPlannedBuildings,
    }],
    defaultPresetId: areaPreset.id,
  };
};

const plannedChickenFarmDirection: PlanDirection = "at-least";

const pluralize = (name: string, count: number) => `${name}${count === 1 ? "" : "s"}`;
const currentLayers = (value: number, source: CurrentValueSource) => {
  if (source === "synced") return { default: 0, synced: value };

  return { default: value };
};

export const createChickenFarmsModule = (
  settings: ChickenFarmSettings,
  builtSettings: ChickenFarmSettings = resolvedCurrentChickenFarmSettings.value,
  dataSource: ValueSource = "planned",
  builtDataSource: CurrentValueSource = resolvedCurrentChickenFarmSettings.source,
  currentConfigurations?: readonly CurrentChickenFarmConfiguration[],
  planDirection: PlanDirection = plannedChickenFarmDirection,
  currentEntities?: readonly CurrentChickenFarmEntity[],
  syncedArea?: Module,
): Module => {
  const farmRecipeId = settings.slaughtering ? slaughteringRecipeId : eggsOnlyRecipeId;
  const chickenLayout = getChickenFarmLayout(settings.totalChickenCount);
  const builtChickenLayout = getChickenFarmLayout(builtSettings.totalChickenCount);
  const currentSource = builtDataSource;

  if (currentEntities) {
    const resolved = resolveChickenFarmEntityPlan(
      settings,
      currentEntities,
      currentSource,
      planDirection,
    );
    const builtBuildings: Record<string, number> = {};
    const activeBuildings: Record<string, number> = {};
    const dataSources: Record<string, ValueSource> = {};
    const speedLevels: Record<string, number> = {};
    const unplacedPlannedBuildings: Record<string, number> = {};

    for (const mode of resolved.modes) {
      const recipeId = mode.slaughtering ? slaughteringRecipeId : eggsOnlyRecipeId;

      builtBuildings[recipeId] = mode.built;
      activeBuildings[recipeId] = mode.active;
      dataSources[recipeId] = mode.source;
      speedLevels[recipeId] = mode.active > 0
        ? mode.chickens / (mode.active * chickenFarm.capacity)
        : 0;
      const unplaced = Math.max(0, mode.active - mode.built);

      if (unplaced > 0) unplacedPlannedBuildings[recipeId] = unplaced;
    }

    return attachToSyncedArea({
      id: CHICKEN_FARMS_MODULE_ID,
      name: "Chicken Farms",
      description: "",
      capabilities: ["chicken-farming"],
      gameSynced: true,
      builtBuildings,
      presets: [{
        id: "current-chicken-farm-plan",
        name: "Chicken Farms",
        description: "",
        activeBuildings,
        dataSources,
        unplacedPlannedBuildings: Object.keys(unplacedPlannedBuildings).length > 0
          ? unplacedPlannedBuildings
          : undefined,
        planMismatches: resolved.planMismatches.length > 0
          ? resolved.planMismatches
          : undefined,
        fixed: Object.keys(activeBuildings),
        speedLevels,
      }],
      defaultPresetId: "current-chicken-farm-plan",
    }, syncedArea);
  }

  const configurations = currentConfigurations ?? [{
    slaughtering: builtSettings.slaughtering,
    built: builtChickenLayout.farmCount,
    running: builtChickenLayout.farmCount,
    chickens: builtChickenLayout.totalChickenCount,
    runningChickens: builtChickenLayout.totalChickenCount,
  }];
  const desiredConfigurations = configurations.filter(
    configuration => configuration.slaughtering === settings.slaughtering,
  );
  const otherConfigurations = configurations.filter(
    configuration => configuration.slaughtering !== settings.slaughtering,
  );
  const totalBuilt = configurations.reduce((total, configuration) => (
    total + configuration.built
  ), 0);
  const totalChickens = configurations.reduce((total, configuration) => (
    total + configuration.chickens
  ), 0);
  const desiredBuilt = desiredConfigurations.reduce((total, configuration) => (
    total + configuration.built
  ), 0);
  const desiredRunning = desiredConfigurations.reduce((total, configuration) => (
    total + configuration.running
  ), 0);
  const desiredRunningChickens = desiredConfigurations.reduce((total, configuration) => (
    total + configuration.runningChickens
  ), 0);
  const otherBuilt = otherConfigurations.reduce((total, configuration) => (
    total + configuration.built
  ), 0);
  const otherRunning = otherConfigurations.reduce((total, configuration) => (
    total + configuration.running
  ), 0);
  const otherRunningChickens = otherConfigurations.reduce((total, configuration) => (
    total + configuration.runningChickens
  ), 0);
  const isPlanned = dataSource === "planned";
  const farmPlan = resolveDirectionalPlan(
    currentLayers(desiredRunning, currentSource),
    { direction: planDirection, target: chickenLayout.farmCount },
  );
  const animalPlan = resolveDirectionalPlan(
    currentLayers(desiredRunningChickens, currentSource),
    { direction: planDirection, target: chickenLayout.totalChickenCount },
  );
  const satisfied = farmPlan.satisfied && animalPlan.satisfied;
  const effectiveFarmCount = isPlanned ? farmPlan.value : desiredRunning;
  const effectiveChickenCount = isPlanned ? animalPlan.value : desiredRunningChickens;
  const preserveOtherConfigurations = !isPlanned || satisfied || planDirection === "at-most";
  const otherRecipeId = settings.slaughtering ? eggsOnlyRecipeId : slaughteringRecipeId;
  const builtBuildings: Record<string, number> = {
    [farmRecipeId]: preserveOtherConfigurations ? desiredBuilt : totalBuilt,
  };
  const activeBuildings: Record<string, number> = {
    [farmRecipeId]: effectiveFarmCount,
  };
  const dataSources: Record<string, ValueSource> = {
    [farmRecipeId]: isPlanned && !satisfied ? "planned" : currentSource,
  };
  const speedLevels: Record<string, number> = {
    [farmRecipeId]: effectiveFarmCount > 0
      ? effectiveChickenCount / (effectiveFarmCount * chickenFarm.capacity)
      : 0,
  };
  const unplacedPlannedBuildings: Record<string, number> = {};

  for (const [recipeId, active] of Object.entries(activeBuildings)) {
    const unplaced = Math.max(0, active - (builtBuildings[recipeId] ?? 0));

    if (unplaced > 0) unplacedPlannedBuildings[recipeId] = unplaced;
  }

  if (preserveOtherConfigurations && otherRunning > 0) {
    builtBuildings[otherRecipeId] = otherBuilt;
    activeBuildings[otherRecipeId] = otherRunning;
    dataSources[otherRecipeId] = currentSource;
    speedLevels[otherRecipeId] = otherRunning > 0
      ? otherRunningChickens / (otherRunning * chickenFarm.capacity)
      : 0;
  }
  const farmDeficit = Math.max(0, chickenLayout.farmCount - desiredRunning);
  const unpauseDesired = Math.min(Math.max(0, desiredBuilt - desiredRunning), farmDeficit);
  const afterDesired = farmDeficit - unpauseDesired;
  const configureRunning = Math.min(otherRunning, afterDesired);
  const afterRunningConfiguration = afterDesired - configureRunning;
  const configurePaused = Math.min(
    Math.max(0, otherBuilt - otherRunning),
    afterRunningConfiguration,
  );
  const buildCount = Math.max(0, afterRunningConfiguration - configurePaused);
  const configureCount = configureRunning + configurePaused;
  const unpauseCount = unpauseDesired + configurePaused;
  const addChickenCount = Math.max(0, chickenLayout.totalChickenCount - totalChickens);
  const atLeastActions: PlanMismatchAction[] = [
    ...(unpauseCount > 0
      ? [{
          type: "unpause" as const,
          label: `Unpause ${unpauseCount} Chicken ${pluralize("Farm", unpauseCount)}`,
        }]
      : []),
    ...(configureCount > 0
      ? [{
          type: "configure" as const,
          label: `Set slaughtering ${settings.slaughtering ? "on" : "off"} for ${configureCount} Chicken ${pluralize("Farm", configureCount)}`,
        }]
      : []),
    ...(buildCount > 0
      ? [{
          type: "build" as const,
          label: `Build ${buildCount} Chicken ${pluralize("Farm", buildCount)}`,
        }]
      : []),
    ...(addChickenCount > 0
      ? [{
          type: "add-animals" as const,
          label: `Add ${addChickenCount.toLocaleString()} chickens`,
        }]
      : []),
  ];
  const atMostActions: PlanMismatchAction[] = [
    ...createAtMostBuildingActions({
      running: desiredRunning,
      target: chickenLayout.farmCount,
      name: "Chicken Farm",
    }),
    ...(desiredRunningChickens > chickenLayout.totalChickenCount
      ? [{
          type: "remove-animals" as const,
          label: `Remove ${(desiredRunningChickens - chickenLayout.totalChickenCount).toLocaleString()} chickens`,
        }]
      : []),
  ];
  const actions = planDirection === "at-most" ? atMostActions : atLeastActions;
  const mismatchActions: PlanMismatchAction[] = actions.length > 0
    ? actions
    : [{
        type: "configure",
        label: "Rebalance chickens across the active planned farms",
      }];

  return attachToSyncedArea({
    id: CHICKEN_FARMS_MODULE_ID,
    name: "Chicken Farms",
    description: "",
    capabilities: ["chicken-farming"],
    gameSynced: true,
    builtBuildings,
    presets: [
      {
        id: "current-chicken-farm-plan",
        name: "Chicken Farms",
        description: "",
        activeBuildings,
        dataSources,
        unplacedPlannedBuildings: Object.keys(unplacedPlannedBuildings).length > 0
          ? unplacedPlannedBuildings
          : undefined,
        planMismatches: isPlanned && !satisfied
          ? [{
              recipeId: farmRecipeId,
              current: desiredRunningChickens,
              currentSource,
              target: chickenLayout.totalChickenCount,
              direction: planDirection,
              format: "animals",
              currentLabel: `${desiredRunningChickens.toLocaleString()} chickens · ${desiredRunning}/${desiredBuilt} matching farms active`,
              targetLabel: `${planDirection === "at-least" ? "≥" : "≤"}${chickenLayout.totalChickenCount.toLocaleString()} chickens · ${planDirection === "at-least" ? "≥" : "≤"}${chickenLayout.farmCount} farms`,
              actions: mismatchActions,
            }]
          : undefined,
        fixed: Object.keys(activeBuildings),
        speedLevels,
      },
    ],
    defaultPresetId: "current-chicken-farm-plan",
  }, syncedArea);
};

export const chickenFarms = createChickenFarmsModule(
  resolvedChickenFarmSettings.value,
  resolvedCurrentChickenFarmSettings.value,
  resolvedChickenFarmSettings.source,
  resolvedCurrentChickenFarmSettings.source,
);
