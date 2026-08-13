import {
  chickenFarm,
  type ChickenFarmSettings,
  defaultChickenFarmSettings,
  getChickenFarmLayout,
} from "../chicken-farm";
import { activeCropFarmGroups } from "../crop-farming";
import { type Module } from "./modules";

export const FARMS_MODULE_ID = "farms";

const slaughteringRecipeId = "chicken-farm-slaughtering";
const eggsOnlyRecipeId = "chicken-farm-eggs-only";

export const createFarmsModule = (settings: ChickenFarmSettings): Module => {
  const farmRecipeId = settings.slaughtering ? slaughteringRecipeId : eggsOnlyRecipeId;
  const chickenLayout = getChickenFarmLayout(settings.totalChickenCount);
  const cropFarmTotals = Object.fromEntries(
    activeCropFarmGroups.map((group) => [group.id, group.farmCount]),
  );
  const fixedCropFarmIds = activeCropFarmGroups.map((group) => group.id);
  const cropFarmCount = activeCropFarmGroups.reduce(
    (total, group) => total + group.farmCount,
    0,
  );
  const builtBuildings = {
    ...cropFarmTotals,
    [farmRecipeId]: chickenLayout.farmCount,
  };

  return {
    id: FARMS_MODULE_ID,
    name: "Farms",
    description: `${cropFarmCount} fixed Greenhouse II rotations plus livestock. Crop cards show imported water after weather and gross demand.`,
    builtBuildings,
    presets: [
      {
        id: "current-farm-plan",
        name: "Current Farm Plan",
        description: `${cropFarmCount} Greenhouse IIs and ${chickenLayout.farmCount} Chicken Farms with ${chickenLayout.totalChickenCount} chickens`,
        activeBuildings: builtBuildings,
        fixed: [...fixedCropFarmIds, farmRecipeId],
        speedLevels: {
          [farmRecipeId]: chickenLayout.farmCount > 0
            ? chickenLayout.totalChickenCount
              / (chickenLayout.farmCount * chickenFarm.capacity)
            : 0,
        },
      },
    ],
    defaultPresetId: "current-farm-plan",
  };
};

export const farms = createFarmsModule(defaultChickenFarmSettings);
