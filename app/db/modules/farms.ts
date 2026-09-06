import { type ValueSource } from "../../data-source";
import { type SyncedAreaEntity } from "../../game-state";
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
      currentActiveBuildings: {
        ...areaPreset.currentActiveBuildings,
        ...farmPreset.currentActiveBuildings,
      },
      constructionGhosts: {
        ...areaPreset.constructionGhosts,
        ...farmPreset.constructionGhosts,
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
      planMismatches: [
        ...(areaPreset.planMismatches ?? []),
        ...(farmPreset.planMismatches ?? []),
      ],
      speedLevels: {
        ...areaPreset.speedLevels,
        ...farmPreset.speedLevels,
      },
      unplacedPlannedBuildings: {
        ...areaPreset.unplacedPlannedBuildings,
        ...farmPreset.unplacedPlannedBuildings,
      },
    }],
    defaultPresetId: areaPreset.id,
  };
};
const plannedChickenFarmDirection: PlanDirection = "at-least";

export const createChickenFarmsModule = (
  settings: ChickenFarmSettings | null,
  currentEntities: readonly CurrentChickenFarmEntity[],
  planDirection: PlanDirection = plannedChickenFarmDirection,
  syncedArea?: Module,
  constructionGhostCount = 0,
): Module => {
  const resolved = resolveChickenFarmEntityPlan(settings, currentEntities, planDirection);

  if (constructionGhostCount > 0) {
    let mode = resolved.modes.find(candidate => candidate.slaughtering);

    if (!mode) {
      mode = { slaughtering: true, built: 0, active: 0, chickens: 0, source: "planned" };
      resolved.modes.push(mode);
    }
    mode.active += constructionGhostCount;
    mode.chickens += constructionGhostCount * chickenFarm.capacity;
    mode.source = "planned";
  }
  const builtBuildings: Record<string, number> = {};
  const activeBuildings: Record<string, number> = {};
  const currentActiveBuildings: Record<string, number> = {};
  const constructionGhosts: Record<string, number> = {};
  const dataSources: Record<string, ValueSource> = {};
  const speedLevels: Record<string, number> = {};
  const unplacedPlannedBuildings: Record<string, number> = {};

  for (const mode of resolved.modes) {
    const recipeId = mode.slaughtering ? slaughteringRecipeId : eggsOnlyRecipeId;

    builtBuildings[recipeId] = mode.built;
    activeBuildings[recipeId] = mode.active;
    currentActiveBuildings[recipeId] = currentEntities.filter(entity => (
      entity.running && entity.slaughtering === mode.slaughtering
    )).length;
    const ghosts = mode.slaughtering ? constructionGhostCount : 0;

    constructionGhosts[recipeId] = ghosts;
    dataSources[recipeId] = mode.source;
    speedLevels[recipeId] = mode.active > 0
      ? mode.chickens / (mode.active * chickenFarm.capacity)
      : 0;
    const unplaced = Math.max(0, mode.active - mode.built - ghosts);

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
      currentActiveBuildings,
      constructionGhosts,
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

const plannedConstructionStates = new Set([
  "NotStarted", "InConstruction", "PreparingUpgrade", "BeingUpgraded",
]);

// Use the same stable ownership rule as crop farms. Unnamed inventory belongs to Default.
const ownerZoneId = (entity: Pick<CurrentChickenFarmEntity, "zones">) => (
  entity.zones.filter(zone => Boolean(zone.name)).toSorted((a, b) => a.id - b.id)[0]?.id ?? -1
);

export const createChickenFarmAreaModule = (
  module: Module,
  currentEntities: readonly CurrentChickenFarmEntity[],
  areaEntities: readonly SyncedAreaEntity[],
): Module => {
  if (!module.liveArea) return module;
  const zoneId = module.liveArea.zoneId;
  const farms = currentEntities.filter(entity => ownerZoneId(entity) === zoneId);
  const ghosts = areaEntities.filter(entity => (
    entity.prototypeId === "ChickenFarm"
    && ownerZoneId(entity) === zoneId
    && !entity.constructed
    && plannedConstructionStates.has(entity.constructionState)
  ));

  if (farms.length === 0 && ghosts.length === 0) return module;

  return createChickenFarmsModule(null, farms, undefined, module, ghosts.length);
};
