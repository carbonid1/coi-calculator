import { type ComputingDefinitions } from '../../planning-state';
import {
  computingRecipeIds,
  type ComputingConfig,
  getDataCenterCount,
} from "../computing";
import { type Module, type PlanMismatchAction } from "./modules";

const COMPUTING_MODULE_ID = "computing";

const computingItems = [
  { recipeId: computingRecipeIds.dataCenter, key: "dataCenterCount", name: "Data Center" },
  { recipeId: computingRecipeIds.basicRack, key: "rackCount", name: "Basic rack" },
  { recipeId: computingRecipeIds.waterChiller, key: "waterChillers", name: "Water Chiller" },
] as const;

const normalizeComputingConfig = (definitions: ComputingDefinitions, config: ComputingConfig): ComputingConfig => {
  const rackCount = Math.max(0, Math.trunc(config.rackCount));

  return {
    rackCount,
    dataCenterCount: Math.max(
      getDataCenterCount(definitions, rackCount),
      Math.max(0, Math.trunc(config.dataCenterCount)),
    ),
    waterChillers: Math.max(0, Math.trunc(config.waterChillers)),
  };
};

const applyComputingPlan = (
  definitions: ComputingDefinitions,
  module: Module,
  config?: ComputingConfig,
  pausedDataCenterRacks?: readonly number[],
): Module => {
  if (!config) return module;

  return {
    ...module,
    presets: module.presets.map(preset => {
      const target = normalizeComputingConfig(definitions, config);
      const builtCount = (id: string) => preset.builtBuildings?.[id] ?? module.builtBuildings[id] ?? 0;
      const currentCount = (id: string) => preset.currentActiveBuildings?.[id]
        ?? Math.max(0, (preset.activeBuildings[id] ?? 0) - (preset.constructionGhosts?.[id] ?? 0));
      const currentCenters = currentCount(computingRecipeIds.dataCenter);
      const currentRacks = currentCount(computingRecipeIds.basicRack);
      const centerGhosts = preset.constructionGhosts?.[computingRecipeIds.dataCenter] ?? 0;
      const neededCenters = Math.max(0, target.dataCenterCount - currentCenters - centerGhosts);
      const neededInstalledRacks = Math.max(0,
        Math.min(target.rackCount, builtCount(computingRecipeIds.basicRack)) - currentRacks);
      const reused = { centers: 0, racks: 0 };

      if (pausedDataCenterRacks) {
        // Start the fullest paused centers first, including all racks housed in each one.
        for (const racks of pausedDataCenterRacks.toSorted((a, b) => b - a)) {
          if (reused.centers >= neededCenters && reused.racks >= neededInstalledRacks) break;
          reused.centers++;
          reused.racks += racks;
        }
      } else if (neededCenters > 0 || neededInstalledRacks > 0) {
        // Aggregate callers cannot locate installed racks; keep every paused host in the plan.
        reused.centers = Math.max(0, builtCount(computingRecipeIds.dataCenter) - currentCenters);
        reused.racks = Math.max(0, builtCount(computingRecipeIds.basicRack) - currentRacks);
      }
      target.dataCenterCount = Math.max(target.dataCenterCount, currentCenters + centerGhosts + reused.centers);
      target.rackCount = Math.max(target.rackCount, currentRacks + reused.racks);

      const planned = {
        ...preset,
        activeBuildings: { ...preset.activeBuildings },
        currentActiveBuildings: { ...preset.currentActiveBuildings },
        unplacedPlannedBuildings: { ...preset.unplacedPlannedBuildings },
        dataSources: { ...preset.dataSources },
        planMismatches: [...(preset.planMismatches ?? [])],
        nonActionablePlanRecipeIds: [...(preset.nonActionablePlanRecipeIds ?? [])],
      };

      for (const { recipeId, key, name } of computingItems) {
        const built = preset.builtBuildings?.[recipeId] ?? module.builtBuildings[recipeId] ?? 0;
        const ghosts = preset.constructionGhosts?.[recipeId] ?? 0;
        const current = preset.currentActiveBuildings?.[recipeId]
          ?? Math.max(0, (preset.activeBuildings[recipeId] ?? 0) - ghosts);
        const projected = Math.max(preset.activeBuildings[recipeId] ?? 0, target[key]);

        planned.activeBuildings[recipeId] = projected;
        planned.currentActiveBuildings[recipeId] = current;
        planned.unplacedPlannedBuildings[recipeId] = Math.max(0, projected - built - ghosts);
        planned.dataSources[recipeId] = projected > current ? "planned" : "synced";
        if (projected <= current) continue;

        const missing = Math.max(0, projected - built - ghosts);
        const unpause = Math.min(Math.max(0, built - current), Math.max(0, projected - current - ghosts));
        const actions: PlanMismatchAction[] = [];

        if (key === "rackCount") {
          // Paused racks start with their Data Center; only new racks need
          // their own installation action.
          planned.nonActionablePlanRecipeIds.push(recipeId);
          if (missing > 0) actions.push({ type: "configure", label: `Install ${missing} Basic racks` });
        } else if (unpause > 0) {
          actions.push({ type: "unpause", label: `Unpause ${unpause} ${name}` });
          if (missing > 0) actions.push({ type: "build", label: `Build ${missing} ${name}` });
        }
        if (actions.length > 0) planned.planMismatches.push({
          recipeId, current, target: projected, direction: "at-least", format: "count", actions,
        });
      }

      return planned;
    }),
  };
};

export const createComputingModule = (
  definitions: ComputingDefinitions,
  builtConfig: ComputingConfig,
  runningConfig: ComputingConfig = builtConfig,
  generatedArea?: Module,
  plannedConfig?: ComputingConfig,
  pausedDataCenterRacks?: readonly number[],
): Module => {
  const built = normalizeComputingConfig(definitions, builtConfig);
  const running = normalizeComputingConfig(definitions, runningConfig);
  const builtBuildings = {
    [computingRecipeIds.dataCenter]: built.dataCenterCount,
    [computingRecipeIds.basicRack]: built.rackCount,
    [computingRecipeIds.waterChiller]: built.waterChillers,
  };
  const activeBuildings = Object.fromEntries(computingItems.map((item) => [
    item.recipeId,
    running[item.key],
  ]));
  const dataSources = Object.fromEntries(computingItems.map((item) => [
    item.recipeId,
    "synced" as const,
  ]));

  const computingModule: Module = {
    id: COMPUTING_MODULE_ID,
    name: "Computing",
    description: "",
    capabilities: ["computing"],
    builtBuildings,
    presets: [{
      id: "current-data-centers",
      name: "Data center configuration",
      description: "",
      activeBuildings,
      dataSources,
      fixed: [computingRecipeIds.dataCenter, computingRecipeIds.basicRack],
    }],
    defaultPresetId: "current-data-centers",
  };

  if (!generatedArea) return applyComputingPlan(definitions, computingModule, plannedConfig, pausedDataCenterRacks);

  const handledPrototypeIds = new Set(["DataCenter", "WaterChiller"]);
  const handledRecipeMarkers = [...handledPrototypeIds].map(id => `:${id}:`);
  const isHandledGeneratedRecipeId = (id: string) => (
    handledRecipeMarkers.some(marker => id.includes(marker))
  );
  const withoutHandledRecipeIds = <T>(values: Record<string, T> | undefined) => (
    values
      ? Object.fromEntries(
          Object.entries(values).filter(([id]) => !isHandledGeneratedRecipeId(id)),
        )
      : undefined
  );
  const withoutHandledPrototypeIds = <T>(values: Record<string, T> | undefined) => (
    values
      ? Object.fromEntries(
          Object.entries(values).filter(([id]) => !handledPrototypeIds.has(id)),
        )
      : undefined
  );
  const rawGeneratedPreset = generatedArea.defaultPresetId
    ? generatedArea.presets.find(preset => preset.id === generatedArea.defaultPresetId)
    : generatedArea.presets[0];
  const dataCenterConstructionGhosts =
    rawGeneratedPreset?.capacityPools?.DataCenter?.constructionGhosts ?? 0;
  const waterChillerConstructionGhosts =
    rawGeneratedPreset?.capacityPools?.WaterChiller?.constructionGhosts ?? 0;
  const computingConstructionGhosts = {
    [computingRecipeIds.dataCenter]: dataCenterConstructionGhosts,
    [computingRecipeIds.basicRack]: 0,
    [computingRecipeIds.waterChiller]: waterChillerConstructionGhosts,
  };
  const generatedPreset = rawGeneratedPreset
    ? {
        ...rawGeneratedPreset,
        activeBuildings: withoutHandledRecipeIds(rawGeneratedPreset.activeBuildings) ?? {},
        currentActiveBuildings: withoutHandledRecipeIds(
          rawGeneratedPreset.currentActiveBuildings,
        ),
        builtBuildings: withoutHandledRecipeIds(rawGeneratedPreset.builtBuildings),
        constructionGhosts: withoutHandledRecipeIds(rawGeneratedPreset.constructionGhosts),
        dataSources: withoutHandledRecipeIds(rawGeneratedPreset.dataSources),
        capacityPools: withoutHandledPrototypeIds(rawGeneratedPreset.capacityPools),
      }
    : undefined;
  const computingPreset = computingModule.presets[0];

  if (!computingPreset) return generatedArea;

  const projectedComputingBuildings = {
    ...computingPreset.activeBuildings,
    [computingRecipeIds.dataCenter]:
      (computingPreset.activeBuildings[computingRecipeIds.dataCenter] ?? 0)
      + dataCenterConstructionGhosts,
    [computingRecipeIds.waterChiller]:
      (computingPreset.activeBuildings[computingRecipeIds.waterChiller] ?? 0)
      + waterChillerConstructionGhosts,
  };

  const mergedPreset = generatedPreset
    ? {
        ...generatedPreset,
        description: "",
        activeBuildings: {
          ...generatedPreset.activeBuildings,
          ...projectedComputingBuildings,
        },
        currentActiveBuildings: {
          ...generatedPreset.currentActiveBuildings,
          ...computingPreset.activeBuildings,
        },
        builtBuildings: {
          ...generatedPreset.builtBuildings,
          ...computingModule.builtBuildings,
        },
        constructionGhosts: {
          ...generatedPreset.constructionGhosts,
          ...computingConstructionGhosts,
        },
        dataSources: {
          ...generatedPreset.dataSources,
          ...computingPreset.dataSources,
        },
        fixed: [...new Set([...generatedPreset.fixed, ...computingPreset.fixed])],
      }
    : computingPreset;
  const handledIssuePrefixes = [...handledPrototypeIds].map(id => `${id}:`);

  return applyComputingPlan(definitions, {
    ...generatedArea,
    includedInFactoryTotals: true,
    builtBuildings: {
      ...withoutHandledRecipeIds(generatedArea.builtBuildings),
      ...computingModule.builtBuildings,
    },
    recipes: generatedArea.recipes?.filter(recipe => !isHandledGeneratedRecipeId(recipe.id)),
    presets: [mergedPreset],
    defaultPresetId: mergedPreset.id,
    liveArea: generatedArea.liveArea
      ? {
          ...generatedArea.liveArea,
          issues: generatedArea.liveArea.issues.filter(issue => (
            !handledIssuePrefixes.some(prefix => issue.id.startsWith(prefix))
          )),
        }
      : undefined,
  }, plannedConfig, pausedDataCenterRacks);
};
