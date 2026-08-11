import {
  chickenFarm,
  type ChickenFarmSettings,
  defaultChickenFarmSettings,
} from "../chicken-farm";
import { activeCropFarmGroups } from "../crop-farming";
import { type Module } from "./modules";

export const FARMS_MODULE_ID = "farms";

const slaughteringRecipeId = "chicken-farm-slaughtering";
const eggsOnlyRecipeId = "chicken-farm-eggs-only";

export const createFarmsModule = (settings: ChickenFarmSettings): Module => {
  const farmRecipeId = settings.slaughtering ? slaughteringRecipeId : eggsOnlyRecipeId;
  const cropFarmTotals = Object.fromEntries(
    activeCropFarmGroups.map((group) => [group.id, group.farmCount]),
  );
  const fixedCropFarmIds = activeCropFarmGroups.map((group) => group.id);
  const cropFarmCount = activeCropFarmGroups.reduce(
    (total, group) => total + group.farmCount,
    0,
  );
  const buildingTotals = {
    ...cropFarmTotals,
    [farmRecipeId]: settings.farmCount,
    "food-processor-meat": 1,
  };

  return {
    id: FARMS_MODULE_ID,
    name: "Farms",
    description: `${cropFarmCount} fixed Greenhouse II rotations plus livestock. Crop cards show imported water after weather and gross demand.`,
    buildingTotals,
    presets: [
      {
        id: "current-farm-plan",
        name: "Current Farm Plan",
        description: `${cropFarmCount} Greenhouse IIs, ${settings.farmCount} Chicken Farms, and one Food Processor`,
        available: buildingTotals,
        fixed: [...fixedCropFarmIds, farmRecipeId],
        speedLevels: {
          [farmRecipeId]: settings.chickenCount / chickenFarm.capacity,
        },
      },
    ],
    defaultPresetId: "current-farm-plan",
  };
};

export const farms = createFarmsModule(defaultChickenFarmSettings);
