import {
  chickenFarm,
  type ChickenFarmSettings,
  defaultChickenFarmSettings,
  getChickenFarmLayout,
} from "../chicken-farm";
import { activeCropFarmGroups } from "../crop-farming";
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
const fixedCropFarmIds = activeCropFarmGroups.map((group) => group.id);
const cropFarmCount = activeCropFarmGroups.reduce(
  (total, group) => total + group.farmCount,
  0,
);
const greenhouseBuildings = {
  "groundwater-pump": builtGroundwaterPumpCount,
  ...cropFarmTotals,
};
const activeGreenhouseBuildings = {
  ...greenhouseBuildings,
  "groundwater-pump": activeGroundwaterPumpCount,
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
      fixed: fixedCropFarmIds,
    },
  ],
  defaultPresetId: "current-greenhouse-plan",
};

export const createChickenFarmsModule = (settings: ChickenFarmSettings): Module => {
  const farmRecipeId = settings.slaughtering ? slaughteringRecipeId : eggsOnlyRecipeId;
  const chickenLayout = getChickenFarmLayout(settings.totalChickenCount);
  const builtBuildings = {
    [farmRecipeId]: chickenLayout.farmCount,
  };

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
        activeBuildings: builtBuildings,
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

export const chickenFarms = createChickenFarmsModule(defaultChickenFarmSettings);
