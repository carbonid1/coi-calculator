import { type ValueSource } from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  chickenFarm,
  type ChickenFarmSettings,
  getChickenFarmLayout,
  resolvedChickenFarmSettings,
  resolvedCurrentChickenFarmSettings,
} from "../chicken-farm";
import {
  activeCropFarmGroups,
  resolvedCropFarmGroups,
  resolvedCurrentCropFarmGroups,
} from "../crop-farming";
import { type Module } from "./modules";

export const GREENHOUSES_MODULE_ID = "greenhouses";
export const CHICKEN_FARMS_MODULE_ID = "chicken-farms";

const builtGroundwaterPumpCount = 5;
const activeGroundwaterPumpCount = 5;
const slaughteringRecipeId = "chicken-farm-slaughtering";
const eggsOnlyRecipeId = "chicken-farm-eggs-only";

const cropFarmTotals = Object.fromEntries(
  activeCropFarmGroups.map((group) => [group.id, group.farmCount]),
);
let unassignedBuiltCropFarms = resolvedCurrentCropFarmGroups.value.reduce(
  (total, group) => total + group.farmCount,
  0,
);
const builtCropFarmTotals = Object.fromEntries(
  activeCropFarmGroups.map((group) => {
    const builtCount = Math.min(group.farmCount, unassignedBuiltCropFarms);
    unassignedBuiltCropFarms -= builtCount;
    return [group.id, builtCount];
  }),
);
const fixedCropFarmIds = activeCropFarmGroups.map((group) => group.id);
const cropFarmCount = activeCropFarmGroups.reduce(
  (total, group) => total + group.farmCount,
  0,
);
const greenhouseBuildings = {
  "groundwater-pump": builtGroundwaterPumpCount,
  ...builtCropFarmTotals,
};
const activeGreenhouseBuildings = {
  "groundwater-pump": activeGroundwaterPumpCount,
  ...cropFarmTotals,
};

export const greenhouses: Module = {
  id: GREENHOUSES_MODULE_ID,
  name: "Greenhouses",
  description: `${cropFarmCount} fixed Greenhouse II rotations. Five directly connected Groundwater Pumps are active; they balance only greenhouse demand, and any remaining Water is imported. Crop cards show imported water after weather and gross demand.`,
  builtBuildings: greenhouseBuildings,
  presets: [
    {
      id: "current-greenhouse-plan",
      name: "Current Greenhouse Plan",
      description: `${cropFarmCount} Greenhouse IIs with five active Groundwater Pumps`,
      activeBuildings: activeGreenhouseBuildings,
      dataSources: Object.fromEntries(
        activeCropFarmGroups.map((group) => [group.id, resolvedCropFarmGroups.source]),
      ),
      fixed: fixedCropFarmIds,
    },
  ],
  defaultPresetId: "current-greenhouse-plan",
};

export const createChickenFarmsModule = (
  settings: ChickenFarmSettings,
  builtSettings: ChickenFarmSettings = settings,
  dataSource: ValueSource = "modeled",
  builtDataSource: ValueSource = dataSource,
): Module => {
  const farmRecipeId = settings.slaughtering ? slaughteringRecipeId : eggsOnlyRecipeId;
  const chickenLayout = getChickenFarmLayout(settings.totalChickenCount);
  const builtChickenLayout = getChickenFarmLayout(builtSettings.totalChickenCount);
  const builtBuildings = {
    [farmRecipeId]: builtChickenLayout.farmCount,
  };
  const activeBuildings = {
    [farmRecipeId]: chickenLayout.farmCount,
  };
  const settingsSource = settings.totalChickenCount === builtSettings.totalChickenCount
    && settings.slaughtering === builtSettings.slaughtering
    ? builtDataSource
    : dataSource;

  return {
    id: CHICKEN_FARMS_MODULE_ID,
    name: "Chicken Farms",
    description: `${chickenLayout.farmCount} Chicken Farms with ${chickenLayout.totalChickenCount} chickens. Their Water is imported from Factory Total; they are not connected to the Greenhouse groundwater network.`,
    builtBuildings,
    presets: [
      {
        id: "current-chicken-farm-plan",
        name: "Current Chicken Farm Plan",
        description: `${chickenLayout.farmCount} Chicken Farms with ${chickenLayout.totalChickenCount} chickens`,
        activeBuildings,
        dataSources: { [farmRecipeId]: settingsSource },
        fixed: [farmRecipeId],
        speedLevels: {
          [farmRecipeId]: chickenLayout.farmCount > 0
            ? chickenLayout.totalChickenCount
              / (chickenLayout.farmCount * chickenFarm.capacity)
            : 0,
        },
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
