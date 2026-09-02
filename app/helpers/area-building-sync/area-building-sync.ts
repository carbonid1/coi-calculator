import {
  type SyncedBuildingCount,
  type SyncedBuildingId,
  type SyncedProductionEntity,
  syncedBuildingIds,
} from "../../game-state";

export const syncedBuildingPrototypeIds: Record<SyncedBuildingId, string> = {
  rocketAssemblyDepot: "RocketAssemblyDepot",
  rocketLaunchPad: "RocketLaunchPad",
  electricLocomotiveII: "LocomotiveT2Electric",
  looseStationModuleElectrified: "TrainStationLoose_ELEC",
  fluidStationModuleElectrified: "TrainStationFluid_ELEC",
  unitStationModuleElectrified: "TrainStationUnit_ELEC",
  moltenStationModuleElectrified: "TrainStationMolten_ELEC",
  oreSortingPlant: "OreSortingPlantT1",
  oreSortingPlantLarge: "OreSortingPlantT2",
  stackerTower: "StackerTower",
  trainDepot: "TrainDepot",
  vehiclesDepot: "VehiclesDepot",
  vehiclesDepotII: "VehiclesDepotT2",
  vehiclesDepotIII: "VehiclesDepotT3",
  captainOfficeI: "CaptainOfficeT1",
  captainOfficeII: "CaptainOfficeT2",
  solarPanel: "SolarPanel",
  solarPanelMono: "SolarPanelMono",
  maintenanceStatue: "StatueOfMaintenanceGolden",
};

const buildingIdByPrototype = new Map(
  syncedBuildingIds.map(buildingId => [
    syncedBuildingPrototypeIds[buildingId],
    buildingId,
  ]),
);

export const resolveAreaBuildingCounts = (
  productionEntities: readonly SyncedProductionEntity[],
  zoneId: number,
): Partial<Record<SyncedBuildingId, SyncedBuildingCount>> => {
  const counts: Partial<Record<SyncedBuildingId, SyncedBuildingCount>> = {};

  for (const entity of productionEntities) {
    if (!entity.zones.some(zone => zone.id === zoneId)) continue;
    const buildingId = buildingIdByPrototype.get(entity.prototypeId);

    if (!buildingId) continue;
    const count = counts[buildingId] ?? { built: 0, running: 0 };

    count.built++;
    count.running += Number(entity.running);
    counts[buildingId] = count;
  }

  return counts;
};

export const resolveAreaRecipeBuildingCount = (
  productionEntities: readonly SyncedProductionEntity[],
  zoneId: number,
  prototypeId: string,
  gameRecipeId: string,
): SyncedBuildingCount => {
  let built = 0;
  let running = 0;

  for (const entity of productionEntities) {
    if (entity.prototypeId !== prototypeId) continue;
    if (!entity.recipeIds.includes(gameRecipeId)) continue;
    if (!entity.zones.some(zone => zone.id === zoneId)) continue;

    built++;
    running += Number(entity.running);
  }

  return { built, running };
};
