import { type ValueSource } from "../../data-source";
import { resolveChickenFarmEntityPlan } from "../../helpers/chicken-farm-plan/chicken-farm-plan";
import { type PlanDirection } from "../../helpers/resolve-directional-plan";
import {
  type CurrentChickenFarmEntity,
  chickenFarm,
  type ChickenFarmSettings,
} from "../chicken-farm";
import { type Module } from "./modules";

export const CHICKEN_FARMS_MODULE_ID = "chicken-farms";

const slaughteringRecipeId = "chicken-farm-slaughtering";
const eggsOnlyRecipeId = "chicken-farm-eggs-only";

const attachToSyncedArea = (farmModule: Module, syncedArea?: Module): Module => {
  if (!syncedArea) return farmModule;

  const areaPreset = syncedArea.presets.find(preset => (
    preset.id === syncedArea.defaultPresetId
  )) ?? syncedArea.presets[0];
  const farmPreset = farmModule.presets[0];

  if (!areaPreset || !farmPreset) return farmModule;

  return {
    ...syncedArea,
    includedInFactoryTotals: true,
    builtBuildings: {
      ...syncedArea.builtBuildings,
      ...farmModule.builtBuildings,
    },
    presets: [{
      ...areaPreset,
      activeBuildings: {
        ...areaPreset.activeBuildings,
        ...farmPreset.activeBuildings,
      },
      builtBuildings: {
        ...areaPreset.builtBuildings,
        ...farmModule.builtBuildings,
      },
      dataSources: {
        ...areaPreset.dataSources,
        ...farmPreset.dataSources,
      },
      fixed: [...new Set([...areaPreset.fixed, ...farmPreset.fixed])],
      planMismatches: farmPreset.planMismatches,
      speedLevels: {
        ...areaPreset.speedLevels,
        ...farmPreset.speedLevels,
      },
      unplacedPlannedBuildings: farmPreset.unplacedPlannedBuildings,
    }],
    defaultPresetId: areaPreset.id,
  };
};
const plannedChickenFarmDirection: PlanDirection = "at-least";

export const createChickenFarmsModule = (
  settings: ChickenFarmSettings,
  currentEntities: readonly CurrentChickenFarmEntity[],
  planDirection: PlanDirection = plannedChickenFarmDirection,
  syncedArea?: Module,
): Module => {
  const resolved = resolveChickenFarmEntityPlan(settings, currentEntities, planDirection);
  const builtBuildings: Record<string, number> = {};
  const activeBuildings: Record<string, number> = {};
  const dataSources: Record<string, ValueSource> = {};
  const speedLevels: Record<string, number> = {};
  const unplacedPlannedBuildings: Record<string, number> = {};

  for (const mode of resolved.modes) {
    const recipeId = mode.slaughtering ? slaughteringRecipeId : eggsOnlyRecipeId;

    builtBuildings[recipeId] = mode.built;
    activeBuildings[recipeId] = mode.active;
    dataSources[recipeId] = mode.source;
    speedLevels[recipeId] = mode.active > 0
      ? mode.chickens / (mode.active * chickenFarm.capacity)
      : 0;
    const unplaced = Math.max(0, mode.active - mode.built);

    if (unplaced > 0) unplacedPlannedBuildings[recipeId] = unplaced;
  }

  return attachToSyncedArea({
    id: CHICKEN_FARMS_MODULE_ID,
    name: "Chicken Farms",
    description: "",
    capabilities: ["chicken-farming"],
    gameSynced: true,
    builtBuildings,
    presets: [{
      id: "current-chicken-farm-plan",
      name: "Chicken Farms",
      description: "",
      activeBuildings,
      dataSources,
      unplacedPlannedBuildings: Object.keys(unplacedPlannedBuildings).length > 0
        ? unplacedPlannedBuildings
        : undefined,
      planMismatches: resolved.planMismatches.length > 0
        ? resolved.planMismatches
        : undefined,
      fixed: Object.keys(activeBuildings),
      speedLevels,
    }],
    defaultPresetId: "current-chicken-farm-plan",
  }, syncedArea);
};
