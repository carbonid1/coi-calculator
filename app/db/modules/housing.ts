import { calculateHousingCapacity } from "../../helpers/modifiers/calculate-housing-capacity";
import { type ValueSource } from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  activeHousingType,
  resolvedCurrentHousingCount,
  resolvedHousingCount,
} from "../housing";
import { defaultInfiniteResearchLevels } from "../research";
import {
  settlementRecipeIds,
  settlementServiceBuildings,
} from "../settlement";
import { type Module } from "./modules";

export const HOUSING_MODULE_ID = "housing";

export const createHousingModule = (
  housingCount: number,
  housingCapacityLevel: number = defaultInfiniteResearchLevels.housingCapacity,
  builtHousingCount: number = housingCount,
  dataSource: ValueSource = "modeled",
): Module => {
  const residents = Math.max(0, Math.trunc(housingCount));
  const builtResidents = Math.max(0, Math.trunc(builtHousingCount));
  const capacityMultiplier = calculateHousingCapacity(housingCapacityLevel).multiplier;
  const serviceFactor = residents > 0 ? 1 : 0;
  const builtServiceFactor = builtResidents > 0 ? 1 : 0;
  const builtBuildings: Record<string, number> = {
    [settlementRecipeIds.residents]: builtResidents,
    [settlementRecipeIds.foodMarket]: settlementServiceBuildings.foodMarket * builtServiceFactor,
    [settlementRecipeIds.foodMarketII]: settlementServiceBuildings.foodMarketII * builtServiceFactor,
    [settlementRecipeIds.transformer]: settlementServiceBuildings.transformer * builtServiceFactor,
    [settlementRecipeIds.waterFacility]: settlementServiceBuildings.waterFacility * builtServiceFactor,
    [settlementRecipeIds.householdGoodsModule]: settlementServiceBuildings.householdGoodsModule * builtServiceFactor,
    [settlementRecipeIds.wasteCollection]: settlementServiceBuildings.wasteCollection * builtServiceFactor,
    [settlementRecipeIds.recyclablesCollection]: settlementServiceBuildings.recyclablesCollection * builtServiceFactor,
    [settlementRecipeIds.biomassCollection]: settlementServiceBuildings.biomassCollection * builtServiceFactor,
    [settlementRecipeIds.clinic]: settlementServiceBuildings.clinic * builtServiceFactor,
    [settlementRecipeIds.internetModule]: settlementServiceBuildings.internetModule * builtServiceFactor,
    [settlementRecipeIds.wastewaterTreatment]: settlementServiceBuildings.wastewaterTreatment * builtServiceFactor,
    [settlementRecipeIds.anaerobicDigester]: settlementServiceBuildings.anaerobicDigester * builtServiceFactor,
    [settlementRecipeIds.biomassCompostMixer]: settlementServiceBuildings.biomassCompostMixer * builtServiceFactor,
  };
  const activeBuildings: Record<string, number> = {
    [settlementRecipeIds.residents]: residents,
    [settlementRecipeIds.foodMarket]: settlementServiceBuildings.foodMarket * serviceFactor,
    [settlementRecipeIds.foodMarketII]: settlementServiceBuildings.foodMarketII * serviceFactor,
    [settlementRecipeIds.transformer]: settlementServiceBuildings.transformer * serviceFactor,
    [settlementRecipeIds.waterFacility]: settlementServiceBuildings.waterFacility * serviceFactor,
    [settlementRecipeIds.householdGoodsModule]: settlementServiceBuildings.householdGoodsModule * serviceFactor,
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
    description: `Full-capacity ${activeHousingType.name} demand with settlement services and waste processing`,
    builtBuildings,
    presets: [
      {
        id: "housing-full-capacity",
        name: `${activeHousingType.name} — Full Capacity`,
        description: `${residents} ${activeHousingType.name} buildings at full population capacity`,
        activeBuildings,
        dataSources: Object.fromEntries(
          Object.keys(activeBuildings)
            .filter((recipeId) => (
              recipeId === settlementRecipeIds.residents
              || activeBuildings[recipeId] !== builtBuildings[recipeId]
            ))
            .map((recipeId) => [recipeId, dataSource]),
        ),
        fixed: Object.keys(builtBuildings).filter((recipeId) => (
          recipeId !== settlementRecipeIds.wastewaterTreatment
          && recipeId !== settlementRecipeIds.anaerobicDigester
          && recipeId !== settlementRecipeIds.biomassCompostMixer
        )),
        speedLevels: {
          [settlementRecipeIds.residents]: capacityMultiplier,
          [settlementRecipeIds.internetModule]: housingCount
            * activeHousingType.populationCapacity
            * capacityMultiplier
            / 100,
        },
      },
    ],
    defaultPresetId: "housing-full-capacity",
  };
};

export const housing = createHousingModule(
  resolvedHousingCount.value,
  defaultInfiniteResearchLevels.housingCapacity,
  resolvedCurrentHousingCount.value,
  resolvedHousingCount.source,
);
