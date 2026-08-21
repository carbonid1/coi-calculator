import { maintenanceStatue } from "./maintenance-statue";

export const staticInfrastructureItems = [
  {
    id: "oreSortingPlant",
    recipeId: "static-ore-sorting-plant",
    name: "Ore sorting plant",
    detail: "6 workers each; activity-dependent power is excluded",
    building: "Ore sorting plant",
    workers: 6,
  },
  {
    id: "oreSortingPlantLarge",
    recipeId: "static-ore-sorting-plant-large",
    name: "Ore sorting plant (large)",
    detail: "30 workers each; activity-dependent power is excluded",
    building: "Ore sorting plant (large)",
    workers: 30,
  },
  {
    id: "electricLocomotiveII",
    recipeId: "static-electric-locomotive-ii",
    name: "Electric locomotive II",
    detail: "1 worker each; activity-dependent power is excluded",
    building: "Electric locomotive II",
    workers: 1,
  },
  {
    id: "unitStationModuleElectrified",
    recipeId: "static-unit-station-module-electrified",
    name: "Unit station module (electrified)",
    detail: "1 worker each; activity-dependent power is excluded",
    building: "Unit station module (electrified)",
    workers: 1,
  },
  {
    id: "fluidStationModuleElectrified",
    recipeId: "static-fluid-station-module-electrified",
    name: "Fluid station module (electrified)",
    detail: "1 worker each; activity-dependent power is excluded",
    building: "Fluid station module (electrified)",
    workers: 1,
  },
  {
    id: "looseStationModuleElectrified",
    recipeId: "static-loose-station-module-electrified",
    name: "Loose station module (electrified)",
    detail: "1 worker each; activity-dependent power is excluded",
    building: "Loose station module (electrified)",
    workers: 1,
  },
  {
    id: "moltenStationModuleElectrified",
    recipeId: "static-molten-station-module-electrified",
    name: "Molten station module (electrified)",
    detail: "2 workers each; activity-dependent power is excluded",
    building: "Molten station module (electrified)",
    workers: 2,
  },
  {
    id: "stackerTower",
    recipeId: "static-stacker-tower",
    name: "Stacker tower",
    detail: "4 workers each; activity-dependent power is excluded",
    building: "Stacker tower",
    workers: 4,
  },
  {
    id: "vehicles",
    recipeId: "static-vehicles",
    name: "Vehicles",
    detail: "1 worker each; movement- and work-dependent fuel is excluded",
    building: "Vehicles",
    workers: 1,
  },
  {
    id: "maintenanceStatue",
    recipeId: maintenanceStatue.id,
    name: maintenanceStatue.name,
    detail: `${maintenanceStatue.fuelGasPerCycle} Fuel Gas per cycle each · ${maintenanceStatue.baseReductionPercent}% for the first, half effect for each additional`,
    building: maintenanceStatue.name,
    workers: 0,
  },
] as const;

export type StaticInfrastructureId = typeof staticInfrastructureItems[number]["id"];
export type StaticInfrastructureConfig = Record<StaticInfrastructureId, number>;

export const emptyStaticInfrastructureConfig: StaticInfrastructureConfig = {
  oreSortingPlant: 0,
  oreSortingPlantLarge: 0,
  electricLocomotiveII: 0,
  unitStationModuleElectrified: 0,
  fluidStationModuleElectrified: 0,
  looseStationModuleElectrified: 0,
  moltenStationModuleElectrified: 0,
  stackerTower: 0,
  vehicles: 0,
  maintenanceStatue: 0,
};

export const normalizeStaticInfrastructureConfig = (
  config: StaticInfrastructureConfig,
): StaticInfrastructureConfig => ({
  oreSortingPlant: Math.max(0, Math.trunc(config.oreSortingPlant)),
  oreSortingPlantLarge: Math.max(0, Math.trunc(config.oreSortingPlantLarge)),
  electricLocomotiveII: Math.max(0, Math.trunc(config.electricLocomotiveII)),
  unitStationModuleElectrified: Math.max(
    0,
    Math.trunc(config.unitStationModuleElectrified),
  ),
  fluidStationModuleElectrified: Math.max(
    0,
    Math.trunc(config.fluidStationModuleElectrified),
  ),
  looseStationModuleElectrified: Math.max(
    0,
    Math.trunc(config.looseStationModuleElectrified),
  ),
  moltenStationModuleElectrified: Math.max(
    0,
    Math.trunc(config.moltenStationModuleElectrified),
  ),
  stackerTower: Math.max(0, Math.trunc(config.stackerTower)),
  vehicles: Math.max(0, Math.trunc(config.vehicles)),
  maintenanceStatue: Math.max(0, Math.trunc(config.maintenanceStatue)),
});

export const calculateStaticInfrastructureTotals = (
  builtConfig: StaticInfrastructureConfig,
  runningConfig: StaticInfrastructureConfig = builtConfig,
) => {
  const running = clampStaticInfrastructureRunningConfig(
    builtConfig,
    runningConfig,
  );

  return {
    workers: staticInfrastructureItems.reduce(
      (total, item) => total + running[item.id] * item.workers,
      0,
    ),
    fuelGasPerCycle: running.maintenanceStatue * maintenanceStatue.fuelGasPerCycle,
  };
};

export const clampStaticInfrastructureRunningConfig = (
  builtConfig: StaticInfrastructureConfig,
  runningConfig: StaticInfrastructureConfig,
): StaticInfrastructureConfig => {
  const built = normalizeStaticInfrastructureConfig(builtConfig);
  const running = normalizeStaticInfrastructureConfig(runningConfig);
  const clamp = (id: StaticInfrastructureId) => Math.min(built[id], running[id]);

  return {
    oreSortingPlant: clamp("oreSortingPlant"),
    oreSortingPlantLarge: clamp("oreSortingPlantLarge"),
    electricLocomotiveII: clamp("electricLocomotiveII"),
    unitStationModuleElectrified: clamp("unitStationModuleElectrified"),
    fluidStationModuleElectrified: clamp("fluidStationModuleElectrified"),
    looseStationModuleElectrified: clamp("looseStationModuleElectrified"),
    moltenStationModuleElectrified: clamp("moltenStationModuleElectrified"),
    stackerTower: clamp("stackerTower"),
    vehicles: clamp("vehicles"),
    maintenanceStatue: clamp("maintenanceStatue"),
  };
};
