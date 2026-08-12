import { activeHousingType, defaultHousingCount } from "../housing";
import {
  settlementRecipeIds,
  settlementServiceBuildings,
} from "../settlement";
import { type Module } from "./modules";

export const HOUSING_MODULE_ID = "housing";

export const createHousingModule = (housingCount: number): Module => {
  const residents = Math.max(0, Math.trunc(housingCount));
  const serviceFactor = residents > 0 ? 1 : 0;
  const buildingTotals = {
    [settlementRecipeIds.residents]: residents,
    [settlementRecipeIds.foodMarket]: settlementServiceBuildings.foodMarket * serviceFactor,
    [settlementRecipeIds.foodMarketII]: settlementServiceBuildings.foodMarketII * serviceFactor,
    [settlementRecipeIds.transformer]: settlementServiceBuildings.transformer * serviceFactor,
    [settlementRecipeIds.waterFacility]: settlementServiceBuildings.waterFacility * serviceFactor,
    [settlementRecipeIds.wasteCollection]: settlementServiceBuildings.wasteCollection * serviceFactor,
    [settlementRecipeIds.recyclablesCollection]: settlementServiceBuildings.recyclablesCollection * serviceFactor,
    [settlementRecipeIds.biomassCollection]: settlementServiceBuildings.biomassCollection * serviceFactor,
    [settlementRecipeIds.clinic]: settlementServiceBuildings.clinic * serviceFactor,
    [settlementRecipeIds.internetModule]: settlementServiceBuildings.internetModule * serviceFactor,
    [settlementRecipeIds.wastewaterTreatment]: settlementServiceBuildings.wastewaterTreatment * serviceFactor,
    [settlementRecipeIds.anaerobicDigester]: settlementServiceBuildings.anaerobicDigester * serviceFactor,
    [settlementRecipeIds.biomassCompostMixer]: settlementServiceBuildings.biomassCompostMixer * serviceFactor,
  };

  return {
    id: HOUSING_MODULE_ID,
    name: "Population",
    description: "Full-capacity Housing II demand with settlement services and waste processing",
    buildingTotals,
    presets: [
      {
        id: "housing-ii-full-capacity",
        name: "Housing II — Full Capacity",
        description: `${residents} Housing II buildings at full population capacity`,
        available: buildingTotals,
        fixed: Object.keys(buildingTotals).filter((recipeId) => (
          recipeId !== settlementRecipeIds.wastewaterTreatment
          && recipeId !== settlementRecipeIds.anaerobicDigester
          && recipeId !== settlementRecipeIds.biomassCompostMixer
        )),
        speedLevels: {
          [settlementRecipeIds.internetModule]: housingCount
            * activeHousingType.populationCapacity
            / 100,
        },
      },
    ],
    defaultPresetId: "housing-ii-full-capacity",
  };
};

export const housing = createHousingModule(defaultHousingCount);
