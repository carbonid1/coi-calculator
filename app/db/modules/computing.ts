import {
  resolveDirectionalPlan,
  type PlanDirection,
} from "../../helpers/resolve-layered-value/resolve-directional-plan";
import {
  type CurrentValueSource,
  type ValueSource,
} from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  computingRecipeIds,
  type ComputingConfig,
  getDataCenterCount,
  resolvedComputingConfig,
  resolvedCurrentComputingConfig,
} from "../computing";
import { type Module, type PlanMismatchAction } from "./modules";
import {
  createAtLeastBuildingActions,
  createAtMostBuildingActions,
} from "./plan-mismatch";

export const COMPUTING_MODULE_ID = "computing";

export type ComputingPlanDirections = Record<keyof ComputingConfig, PlanDirection>;

export const plannedComputingDirections: ComputingPlanDirections = {
  dataCenterCount: "at-least",
  rackCount: "at-least",
  waterChillers: "at-least",
};

const currentLayers = (value: number, source: CurrentValueSource) => {
  if (source === "synced") return { default: 0, synced: value };
  if (source === "modeled") return { default: 0, modeled: value };

  return { default: value };
};

const normalizeComputingConfig = (config: ComputingConfig): ComputingConfig => {
  const rackCount = Math.max(0, Math.trunc(config.rackCount));

  return {
    rackCount,
    dataCenterCount: Math.max(
      getDataCenterCount(rackCount),
      Math.max(0, Math.trunc(config.dataCenterCount)),
    ),
    waterChillers: Math.max(0, Math.trunc(config.waterChillers)),
  };
};

export const createComputingModule = (
  config: ComputingConfig,
  builtConfig: ComputingConfig = config,
  dataSource: ValueSource = "modeled",
  builtDataSource: ValueSource = dataSource,
  runningConfig: ComputingConfig = builtConfig,
  planDirections: ComputingPlanDirections = plannedComputingDirections,
): Module => {
  const target = normalizeComputingConfig(config);
  const built = normalizeComputingConfig(builtConfig);
  const running = normalizeComputingConfig(runningConfig);
  const currentSource: CurrentValueSource = builtDataSource === "planned"
    ? "modeled"
    : builtDataSource;
  const items = [
    {
      recipeId: computingRecipeIds.dataCenter,
      key: "dataCenterCount" as const,
      name: "Data Center",
    },
    {
      recipeId: computingRecipeIds.basicRack,
      key: "rackCount" as const,
      name: "Basic Server Rack",
    },
    {
      recipeId: computingRecipeIds.waterChiller,
      key: "waterChillers" as const,
      name: "Water Chiller",
    },
  ];
  const resolvePlan = (key: (typeof items)[number]["key"]) => resolveDirectionalPlan(
    currentLayers(running[key], currentSource),
    { direction: planDirections[key], target: target[key] },
  );
  const plans = {
    dataCenterCount: resolvePlan("dataCenterCount"),
    rackCount: resolvePlan("rackCount"),
    waterChillers: resolvePlan("waterChillers"),
  };
  const builtBuildings = {
    [computingRecipeIds.dataCenter]: built.dataCenterCount,
    [computingRecipeIds.basicRack]: built.rackCount,
    [computingRecipeIds.waterChiller]: built.waterChillers,
  };
  const activeBuildings = Object.fromEntries(items.map((item) => [
    item.recipeId,
    plans[item.key].value,
  ]));
  const dataSources = Object.fromEntries(items.map((item) => [
    item.recipeId,
    dataSource === "planned" ? plans[item.key].source : dataSource,
  ]));
  const planMismatches = items.flatMap((item) => {
    const plan = plans[item.key];

    if (dataSource !== "planned" || plan.satisfied) return [];

    let actions: PlanMismatchAction[];

    if (plan.direction === "at-most") {
      actions = item.key === "rackCount"
        ? [{
            type: "pause",
            label: `Pause Data Centers for ${plan.difference} Basic Server Racks`,
          }]
        : createAtMostBuildingActions({
            running: running[item.key],
            target: plan.target,
            name: item.name,
          });
    } else if (item.key === "rackCount") {
      actions = [
        ...(
          Math.min(
            Math.max(0, built.rackCount - running.rackCount),
            Math.max(0, plan.target - running.rackCount),
          ) > 0
            ? [{
                type: "unpause" as const,
                label: `Unpause Data Centers for ${Math.min(
                  Math.max(0, built.rackCount - running.rackCount),
                  Math.max(0, plan.target - running.rackCount),
                )} Basic Server Racks`,
              }]
            : []
        ),
        ...(plan.target > built.rackCount
          ? [{
              type: "build" as const,
              label: `Install ${plan.target - built.rackCount} Basic Server Racks`,
            }]
          : []),
      ];
    } else {
      actions = createAtLeastBuildingActions({
        built: built[item.key],
        running: running[item.key],
        target: plan.target,
        name: item.name,
      });
    }

    return [{
      recipeId: item.recipeId,
      current: plan.current.value,
      currentSource: plan.current.source,
      target: plan.target,
      direction: plan.direction,
      format: "count" as const,
      actions,
    }];
  });

  return {
    id: COMPUTING_MODULE_ID,
    name: "Computing",
    description: "Data-center capacity and its closed-loop chilled-water supply",
    builtBuildings,
    presets: [{
      id: "current-data-centers",
      name: "Data center configuration",
      description: `${activeBuildings[computingRecipeIds.dataCenter]} data centers with ${activeBuildings[computingRecipeIds.basicRack]} racks`,
      activeBuildings,
      dataSources,
      planMismatches: planMismatches.length > 0 ? planMismatches : undefined,
      fixed: [computingRecipeIds.dataCenter, computingRecipeIds.basicRack],
    }],
    defaultPresetId: "current-data-centers",
  };
};

export const computing = createComputingModule(
  resolvedComputingConfig.value,
  resolvedCurrentComputingConfig.value,
  resolvedComputingConfig.source,
  resolvedCurrentComputingConfig.source,
  resolvedCurrentComputingConfig.value,
);
