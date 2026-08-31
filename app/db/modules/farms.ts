import { resolveChickenFarmEntityPlan } from "../../helpers/chicken-farm-plan/chicken-farm-plan";
import {
  resolveGreenhouseEntityPlan,
  type GreenhousePlanOptions,
} from "../../helpers/greenhouse-plan/greenhouse-plan";
import { type GroundwaterSourceConstraint } from "../../helpers/groundwater/calculate-groundwater-production";
import { type SharedMachineClaimResolution } from "../../helpers/machine-allocation/machine-allocation";
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
  activeCropFarmGroups,
  type CropFarmGroup,
  type CropFarmTierId,
  type CurrentCropFarmEntity,
  resolvedCurrentCropFarmGroups,
} from "../crop-farming";
import {
  createCropFarmRecipe,
  createGroundwaterPumpRecipe,
} from "../recipes";
import {
  type Module,
  type PlanMismatch,
  type PlanMismatchAction,
} from "./modules";
import { createAtMostBuildingActions } from "./plan-mismatch";

export const GREENHOUSES_MODULE_ID = "greenhouses";
export const CHICKEN_FARMS_MODULE_ID = "chicken-farms";

const plannedGroundwaterPumpCount = 5;
const slaughteringRecipeId = "chicken-farm-slaughtering";
const eggsOnlyRecipeId = "chicken-farm-eggs-only";

export interface CurrentChickenFarmConfiguration {
  slaughtering: boolean;
  built: number;
  running: number;
  chickens: number;
  runningChickens: number;
}

export interface CurrentCropFarmConfiguration {
  tierId: Extract<CropFarmTierId, "greenhouse" | "greenhouseII">;
  schedule: readonly string[];
  fertilityTargetPercent: number;
  built: number;
  running: number;
}

const plannedGreenhousePlan: GreenhousePlanOptions = {
  defaultDirection: "at-least",
  totalDirection: "at-most",
};

const plannedChickenFarmDirection: PlanDirection = "at-least";

const pluralize = (name: string, count: number) => `${name}${count === 1 ? "" : "s"}`;
const currentLayers = (value: number, source: CurrentValueSource) => {
  if (source === "synced") return { default: 0, synced: value };
  if (source === "modeled") return { default: 0, modeled: value };

  return { default: value };
};
const cropFarmKey = (configuration: {
  tierId: CropFarmTierId;
  schedule: readonly string[];
  fertilityTargetPercent: number;
}) => [
  configuration.tierId,
  configuration.schedule.join("/"),
  configuration.fertilityTargetPercent,
].join("|");

const currentCropFarmConfigurationsFromGroups = (
  groups: readonly CropFarmGroup[],
): CurrentCropFarmConfiguration[] => groups.flatMap((group) => (
  group.tierId === "greenhouse" || group.tierId === "greenhouseII"
    ? [{
        tierId: group.tierId,
        schedule: group.schedule,
        fertilityTargetPercent: group.fertilizer?.targetFertilityPercent ?? 100,
        built: group.farmCount,
        running: group.farmCount,
      }]
    : []
));

interface CropFarmInventory extends CurrentCropFarmConfiguration {
  key: string;
  pausedRemaining: number;
  runningRemaining: number;
}

const takeCropFarmInventory = (
  inventory: CropFarmInventory[],
  count: number,
  predicate: (candidate: CropFarmInventory) => boolean,
) => {
  let remaining = count;
  let running = 0;
  let paused = 0;

  for (const candidate of inventory) {
    if (remaining <= 0 || !predicate(candidate)) continue;

    const runningCount = Math.min(candidate.runningRemaining, remaining);

    candidate.runningRemaining -= runningCount;
    remaining -= runningCount;
    running += runningCount;
  }

  for (const candidate of inventory) {
    if (remaining <= 0 || !predicate(candidate)) continue;

    const pausedCount = Math.min(candidate.pausedRemaining, remaining);

    candidate.pausedRemaining -= pausedCount;
    remaining -= pausedCount;
    paused += pausedCount;
  }

  return { paused, running, remaining };
};

export const createGreenhousesModule = (
  plannedGroups: readonly CropFarmGroup[] = activeCropFarmGroups,
  currentConfigurations: readonly CurrentCropFarmConfiguration[] =
    currentCropFarmConfigurationsFromGroups(resolvedCurrentCropFarmGroups.value),
  currentSource: CurrentValueSource = resolvedCurrentCropFarmGroups.source === "default"
    ? "default"
    : "modeled",
  planOptions: GreenhousePlanOptions = plannedGreenhousePlan,
  groundwaterPumpResolution?: SharedMachineClaimResolution,
  currentEntities?: readonly CurrentCropFarmEntity[],
  groundwaterConstraint?: GroundwaterSourceConstraint,
): Module => {
  const inventory: CropFarmInventory[] = currentConfigurations.map((configuration) => ({
    ...configuration,
    key: cropFarmKey(configuration),
    runningRemaining: configuration.running,
    pausedRemaining: Math.max(0, configuration.built - configuration.running),
  }));
  const builtCropFarmTotals: Record<string, number> = {};
  const activeCropFarmTotals: Record<string, number> = {};
  const dataSources: Record<string, ValueSource> = {};
  const planMismatches: PlanMismatch[] = [];
  const groundwaterPumpSource: CurrentValueSource = groundwaterPumpResolution
    ? "synced"
    : "modeled";
  const currentGroundwaterPumpBuilt = groundwaterPumpResolution?.built
    ?? plannedGroundwaterPumpCount;
  const currentGroundwaterPumpRunning = groundwaterPumpResolution?.running
    ?? plannedGroundwaterPumpCount;
  const groundwaterPumpPlan = resolveDirectionalPlan(
    currentLayers(currentGroundwaterPumpRunning, groundwaterPumpSource),
    { direction: "at-least", target: plannedGroundwaterPumpCount },
  );

  dataSources["groundwater-pump"] = groundwaterPumpPlan.source;

  if (!groundwaterPumpPlan.satisfied) {
    const pausedCount = Math.min(
      Math.max(0, currentGroundwaterPumpBuilt - currentGroundwaterPumpRunning),
      groundwaterPumpPlan.difference,
    );
    const buildCount = Math.max(0, groundwaterPumpPlan.difference - pausedCount);
    const fallbackActions: PlanMismatchAction[] = [
      ...(pausedCount > 0
        ? [{
            type: "unpause" as const,
            label: `Unpause ${pausedCount} ${pluralize("Groundwater Pump", pausedCount)} for Greenhouses`,
          }]
        : []),
      ...(buildCount > 0
        ? [{
            type: "build" as const,
            label: `Build ${buildCount} ${pluralize("Groundwater Pump", buildCount)} for Greenhouses`,
          }]
        : []),
    ];

    planMismatches.push({
      recipeId: "groundwater-pump",
      current: currentGroundwaterPumpRunning,
      currentSource: groundwaterPumpSource,
      target: plannedGroundwaterPumpCount,
      direction: "at-least",
      format: "count",
      currentLabel: `${currentGroundwaterPumpRunning} running · ${currentGroundwaterPumpBuilt} assigned`,
      targetLabel: `≥${plannedGroundwaterPumpCount} assigned to Greenhouses`,
      actions: groundwaterPumpResolution?.actions.length
        ? groundwaterPumpResolution.actions
        : fallbackActions,
    });
  }

  if (currentEntities) {
    const resolved = resolveGreenhouseEntityPlan(
      plannedGroups,
      currentEntities,
      currentSource,
      planOptions,
    );
    const cropFarmCount = plannedGroups.reduce((total, group) => total + group.farmCount, 0);

    for (const effectiveGroup of resolved.groups) {
      builtCropFarmTotals[effectiveGroup.group.id] = effectiveGroup.built;
      activeCropFarmTotals[effectiveGroup.group.id] = effectiveGroup.active;
      dataSources[effectiveGroup.group.id] = effectiveGroup.source;
    }

    planMismatches.push(...resolved.planMismatches);

    return {
      id: GREENHOUSES_MODULE_ID,
      name: "Greenhouses",
      description: "",
      gameSynced: true,
      recipes: [
        ...resolved.groups.map(({ group }) => createCropFarmRecipe(group)),
        ...(groundwaterConstraint
          ? [createGroundwaterPumpRecipe("groundwater-pump", groundwaterConstraint)]
          : []),
      ],
      builtBuildings: {
        "groundwater-pump": currentGroundwaterPumpBuilt,
        ...builtCropFarmTotals,
      },
      presets: [{
        id: "current-greenhouse-plan",
        name: "Current Greenhouse Plan",
        description: `${cropFarmCount} planned Greenhouse IIs over the synced inventory`,
        activeBuildings: {
          "groundwater-pump": groundwaterPumpPlan.value,
          ...activeCropFarmTotals,
        },
        dataSources,
        fixed: resolved.groups.map(({ group }) => group.id),
        planMismatches: planMismatches.length > 0 ? planMismatches : undefined,
      }],
      defaultPresetId: "current-greenhouse-plan",
    };
  }

  for (const group of plannedGroups) {
    const target = group.farmCount;
    const key = cropFarmKey({
      tierId: group.tierId,
      schedule: group.schedule,
      fertilityTargetPercent: group.fertilizer?.targetFertilityPercent ?? 100,
    });
    const exact = inventory.filter((candidate) => candidate.key === key);
    const exactRunning = exact.reduce((total, candidate) => total + candidate.running, 0);
    const exactBuilt = exact.reduce((total, candidate) => total + candidate.built, 0);
    const direction = planOptions.directions?.[group.id] ?? planOptions.defaultDirection;
    const plan = resolveDirectionalPlan(
      currentLayers(exactRunning, currentSource),
      { direction, target },
    );

    for (const candidate of exact) {
      candidate.runningRemaining = 0;
      candidate.pausedRemaining = 0;
    }

    if (plan.satisfied) {
      builtCropFarmTotals[group.id] = exactBuilt;
      activeCropFarmTotals[group.id] = exactRunning;
      dataSources[group.id] = currentSource;
      continue;
    }

    if (direction === "at-most") {
      builtCropFarmTotals[group.id] = exactBuilt;
      activeCropFarmTotals[group.id] = target;
      dataSources[group.id] = "planned";
      planMismatches.push({
        recipeId: group.id,
        current: exactRunning,
        currentSource,
        target,
        direction,
        format: "configuration",
        actions: createAtMostBuildingActions({
          running: exactRunning,
          target,
          name: "Greenhouse",
        }),
      });
      continue;
    }

    const exactUnpause = Math.min(
      Math.max(0, exactBuilt - exactRunning),
      Math.max(0, target - exactRunning),
    );
    let remaining = Math.max(0, target - exactRunning - exactUnpause);
    const sameTier = takeCropFarmInventory(
      inventory,
      remaining,
      candidate => candidate.key !== key && candidate.tierId === group.tierId,
    );

    remaining = sameTier.remaining;
    const upgrade = group.tierId === "greenhouseII"
      ? takeCropFarmInventory(
          inventory,
          remaining,
          candidate => candidate.tierId === "greenhouse",
        )
      : { running: 0, paused: 0, remaining };

    remaining = upgrade.remaining;
    const reconfigureCount = sameTier.running + sameTier.paused;
    const upgradeCount = upgrade.running + upgrade.paused;
    const unpauseCount = exactUnpause + sameTier.paused + upgrade.paused;
    const assignedBuilt = exactBuilt + reconfigureCount + upgradeCount;
    const actions: PlanMismatchAction[] = [
      ...(unpauseCount > 0
        ? [{
            type: "unpause" as const,
            label: `Unpause ${unpauseCount} ${pluralize("Greenhouse", unpauseCount)}`,
          }]
        : []),
      ...(reconfigureCount > 0
        ? [{
            type: "configure" as const,
            label: `Configure ${reconfigureCount} ${pluralize("Greenhouse", reconfigureCount)}`,
          }]
        : []),
      ...(upgradeCount > 0
        ? [{
            type: "upgrade" as const,
            label: `Upgrade and configure ${upgradeCount} ${pluralize("Greenhouse", upgradeCount)} to Greenhouse II`,
          }]
        : []),
      ...(remaining > 0
        ? [{
            type: "build" as const,
            label: `Build ${remaining} ${pluralize("Greenhouse II", remaining)}`,
          }]
        : []),
    ];

    builtCropFarmTotals[group.id] = assignedBuilt;
    activeCropFarmTotals[group.id] = target;
    dataSources[group.id] = "planned";
    planMismatches.push({
      recipeId: group.id,
      current: exactRunning,
      currentSource,
      target,
      direction,
      format: "configuration" as const,
      actions,
    });
  }

  const cropFarmCount = plannedGroups.reduce((total, group) => total + group.farmCount, 0);
  const runningCropFarmCount = currentConfigurations.reduce(
    (total, configuration) => total + configuration.running,
    0,
  );
  const totalPlan = resolveDirectionalPlan(
    currentLayers(runningCropFarmCount, currentSource),
    { direction: planOptions.totalDirection, target: cropFarmCount },
  );
  const configurationPauseCount = planMismatches.reduce((total, mismatch) => (
    mismatch.direction === "at-most"
      ? total + Math.max(0, mismatch.current - mismatch.target)
      : total
  ), 0);
  const additionalPauseCount = Math.max(0, totalPlan.difference - configurationPauseCount);

  if (
    !totalPlan.satisfied
    && planOptions.totalDirection === "at-most"
    && additionalPauseCount > 0
  ) {
    let remainingToPause = additionalPauseCount;

    for (const group of plannedGroups) {
      const active = activeCropFarmTotals[group.id] ?? 0;
      const surplus = Math.min(remainingToPause, Math.max(0, active - group.farmCount));

      if (surplus <= 0) continue;

      activeCropFarmTotals[group.id] = active - surplus;
      dataSources[group.id] = "planned";
      remainingToPause -= surplus;
    }

    const action: PlanMismatchAction = {
      type: "pause",
      label: `Pause ${additionalPauseCount} additional ${pluralize("Greenhouse", additionalPauseCount)}`,
    };
    const existingMismatch = planMismatches[0];

    if (existingMismatch) {
      existingMismatch.actions.push(action);
    } else {
      const anchor = plannedGroups[0];

      if (anchor) {
        dataSources[anchor.id] = "planned";
        planMismatches.push({
          recipeId: anchor.id,
          current: runningCropFarmCount,
          currentSource,
          target: cropFarmCount,
          direction: "at-most",
          format: "configuration",
          currentLabel: `${runningCropFarmCount} running Greenhouses`,
          targetLabel: `≤${cropFarmCount} planned configurations`,
          actions: [action],
        });
      }
    }
  }

  return {
    id: GREENHOUSES_MODULE_ID,
    name: "Greenhouses",
    description: "",
    gameSynced: true,
    recipes: groundwaterConstraint
      ? [createGroundwaterPumpRecipe("groundwater-pump", groundwaterConstraint)]
      : undefined,
    builtBuildings: {
      "groundwater-pump": currentGroundwaterPumpBuilt,
      ...builtCropFarmTotals,
    },
    presets: [{
      id: "current-greenhouse-plan",
      name: "Current Greenhouse Plan",
      description: `${cropFarmCount} Greenhouse IIs with five planned active Groundwater Pumps`,
      activeBuildings: {
        "groundwater-pump": groundwaterPumpPlan.value,
        ...activeCropFarmTotals,
      },
      dataSources,
      fixed: plannedGroups.map((group) => group.id),
      planMismatches: planMismatches.length > 0 ? planMismatches : undefined,
    }],
    defaultPresetId: "current-greenhouse-plan",
  };
};

export const greenhouses = createGreenhousesModule();

export const createChickenFarmsModule = (
  settings: ChickenFarmSettings,
  builtSettings: ChickenFarmSettings = resolvedCurrentChickenFarmSettings.value,
  dataSource: ValueSource = "planned",
  builtDataSource: CurrentValueSource = resolvedCurrentChickenFarmSettings.source,
  currentConfigurations?: readonly CurrentChickenFarmConfiguration[],
  planDirection: PlanDirection = plannedChickenFarmDirection,
  currentEntities?: readonly CurrentChickenFarmEntity[],
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

    return {
      id: CHICKEN_FARMS_MODULE_ID,
      name: "Chicken Farms",
      description: "",
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
    };
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

  return {
    id: CHICKEN_FARMS_MODULE_ID,
    name: "Chicken Farms",
    description: "",
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
  };
};

export const chickenFarms = createChickenFarmsModule(
  resolvedChickenFarmSettings.value,
  resolvedCurrentChickenFarmSettings.value,
  resolvedChickenFarmSettings.source,
  resolvedCurrentChickenFarmSettings.source,
);
