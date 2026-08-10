import {
  chickenFarm,
  type ChickenFarmSettings,
  defaultChickenFarmSettings,
} from "../chicken-farm";
import { type Module } from "./modules";

export const FARMS_MODULE_ID = "farms";

const slaughteringRecipeId = "chicken-farm-slaughtering";
const eggsOnlyRecipeId = "chicken-farm-eggs-only";

export const createFarmsModule = (settings: ChickenFarmSettings): Module => {
  const farmRecipeId = settings.slaughtering ? slaughteringRecipeId : eggsOnlyRecipeId;
  const buildingTotals = {
    [farmRecipeId]: settings.farmCount,
    "food-processor-meat": 1,
  };

  return {
    id: FARMS_MODULE_ID,
    name: "Farms",
    description: "Steady-state livestock production and food processing",
    buildingTotals,
    presets: [
      {
        id: "chicken-farm",
        name: "Chicken Farms",
        description: `${settings.farmCount} Chicken Farms and one Food Processor`,
        available: buildingTotals,
        fixed: [farmRecipeId],
        speedLevels: {
          [farmRecipeId]: settings.chickenCount / chickenFarm.capacity,
        },
      },
    ],
    defaultPresetId: "chicken-farm",
  };
};

export const farms = createFarmsModule(defaultChickenFarmSettings);
