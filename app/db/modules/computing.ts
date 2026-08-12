import {
  computingRecipeIds,
  type ComputingConfig,
  defaultComputingConfig,
  getDataCenterCount,
} from "../computing";
import { type Module } from "./modules";

export const COMPUTING_MODULE_ID = "computing";

export const createComputingModule = (config: ComputingConfig): Module => {
  const rackCount = Math.max(0, Math.trunc(config.rackCount));
  const dataCenters = getDataCenterCount(rackCount);
  const waterChillers = Math.max(0, Math.trunc(config.waterChillers));
  const builtBuildings = {
    [computingRecipeIds.dataCenter]: dataCenters,
    [computingRecipeIds.basicRack]: rackCount,
    [computingRecipeIds.waterChiller]: waterChillers,
  };

  return {
    id: COMPUTING_MODULE_ID,
    name: "Computing",
    description: "Data-center capacity and its closed-loop chilled-water supply",
    builtBuildings,
    presets: [{
      id: "current-data-centers",
      name: "Current data centers",
      description: `${dataCenters} data centers with ${rackCount} racks`,
      activeBuildings: builtBuildings,
      fixed: [computingRecipeIds.dataCenter, computingRecipeIds.basicRack],
    }],
    defaultPresetId: "current-data-centers",
  };
};

export const computing = createComputingModule(defaultComputingConfig);
