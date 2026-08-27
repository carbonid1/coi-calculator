import { type ComputingConfig } from "../../db/computing";
import {
  type CurrentChickenFarmConfiguration,
  type CurrentCropFarmConfiguration,
} from "../../db/modules/farms";
import {
  type SyncedChickenFarmState,
  type SyncedComputingState,
  type SyncedCropFarmState,
} from "../../game-state";

const gameCropIds: Record<string, string> = {
  Crop_NoCrop: "none",
  Crop_GreenManure: "greenManure",
  Crop_Potato: "potato",
  Crop_Corn: "corn",
  Crop_Wheat: "wheat",
  Crop_TreeSapling: "treeSapling",
  Crop_Soybeans: "soybean",
  Crop_SugarCane: "sugarCane",
  Crop_Vegetables: "vegetables",
  Crop_Fruits: "fruit",
  Crop_Canola: "canola",
  Crop_Poppy: "poppy",
  Crop_Flowers: "flowers",
};

export const getSyncedComputingConfigs = (
  state: SyncedComputingState,
): { built: ComputingConfig; running: ComputingConfig } => ({
  built: {
    dataCenterCount: state.dataCenters.built,
    rackCount: state.racks.built,
    waterChillers: state.waterChillers.built,
  },
  running: {
    dataCenterCount: state.dataCenters.running,
    rackCount: state.racks.running,
    waterChillers: state.waterChillers.running,
  },
});

export const getSyncedChickenFarmConfigurations = (
  state: SyncedChickenFarmState,
): CurrentChickenFarmConfiguration[] => state.configurations.map(configuration => ({
  ...configuration,
}));

export const getSyncedCropFarmConfigurations = (
  state: SyncedCropFarmState,
): CurrentCropFarmConfiguration[] => state.configurations.map(configuration => ({
  tierId: configuration.prototypeId === "FarmT4" ? "greenhouseII" : "greenhouse",
  schedule: configuration.schedule.map(cropId => (
    cropId === null ? "none" : (gameCropIds[cropId] ?? cropId)
  )),
  fertilityTargetPercent: configuration.fertilityTargetPercent,
  built: configuration.built,
  running: configuration.running,
}));
