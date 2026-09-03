import {
  computingRecipeIds,
  type ComputingConfig,
  getDataCenterCount,
} from "../computing";
import { type Module } from "./modules";

const COMPUTING_MODULE_ID = "computing";

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
  builtConfig: ComputingConfig,
  runningConfig: ComputingConfig = builtConfig,
  generatedArea?: Module,
): Module => {
  const built = normalizeComputingConfig(builtConfig);
  const running = normalizeComputingConfig(runningConfig);
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
  const builtBuildings = {
    [computingRecipeIds.dataCenter]: built.dataCenterCount,
    [computingRecipeIds.basicRack]: built.rackCount,
    [computingRecipeIds.waterChiller]: built.waterChillers,
  };
  const activeBuildings = Object.fromEntries(items.map((item) => [
    item.recipeId,
    running[item.key],
  ]));
  const dataSources = Object.fromEntries(items.map((item) => [
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

  if (!generatedArea) return computingModule;

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

  return {
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
  };
};
