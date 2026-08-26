import { type ValueSource } from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  computingRecipeIds,
  type ComputingConfig,
  getDataCenterCount,
  resolvedComputingConfig,
  resolvedCurrentComputingConfig,
} from "../computing";
import { type Module } from "./modules";

export const COMPUTING_MODULE_ID = "computing";

export const createComputingModule = (
  config: ComputingConfig,
  builtConfig: ComputingConfig = config,
  dataSource: ValueSource = "modeled",
  builtDataSource: ValueSource = dataSource,
): Module => {
  const rackCount = Math.max(0, Math.trunc(config.rackCount));
  const dataCenters = Math.max(
    getDataCenterCount(rackCount),
    Math.max(0, Math.trunc(config.dataCenterCount)),
  );
  const waterChillers = Math.max(0, Math.trunc(config.waterChillers));
  const builtRackCount = Math.max(0, Math.trunc(builtConfig.rackCount));
  const builtDataCenters = Math.max(
    getDataCenterCount(builtRackCount),
    Math.max(0, Math.trunc(builtConfig.dataCenterCount)),
  );
  const builtWaterChillers = Math.max(0, Math.trunc(builtConfig.waterChillers));
  const builtBuildings = {
    [computingRecipeIds.dataCenter]: builtDataCenters,
    [computingRecipeIds.basicRack]: builtRackCount,
    [computingRecipeIds.waterChiller]: builtWaterChillers,
  };
  const activeBuildings = {
    [computingRecipeIds.dataCenter]: dataCenters,
    [computingRecipeIds.basicRack]: rackCount,
    [computingRecipeIds.waterChiller]: waterChillers,
  };
  const dataSources = Object.fromEntries(
    Object.entries(activeBuildings).map(([recipeId, count]) => [
      recipeId,
      count === builtBuildings[recipeId as keyof typeof builtBuildings]
        ? builtDataSource
        : dataSource,
    ]),
  );

  return {
    id: COMPUTING_MODULE_ID,
    name: "Computing",
    description: "Data-center capacity and its closed-loop chilled-water supply",
    builtBuildings,
    presets: [{
      id: "current-data-centers",
      name: "Data center configuration",
      description: `${dataCenters} data centers with ${rackCount} racks`,
      activeBuildings,
      dataSources,
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
);
