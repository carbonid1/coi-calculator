import { maintenanceStatue } from "./maintenance-statue";

export const staticInfrastructureItems = [
  {
    id: "oreSortingPlant",
    recipeId: "static-ore-sorting-plant",
    name: "Ore sorting plant",
    detail: "6 workers and 100 kW each",
    building: "Ore sorting plant",
    workers: 6,
  },
  {
    id: "oreSortingPlantLarge",
    recipeId: "static-ore-sorting-plant-large",
    name: "Ore sorting plant (large)",
    detail: "30 workers and 700 kW each",
    building: "Ore sorting plant (large)",
    workers: 30,
  },
  {
    id: "electricLocomotiveII",
    recipeId: "static-electric-locomotive-ii",
    name: "Electric locomotive II",
    detail: "1 worker each; variable traction power is excluded",
    building: "Electric locomotive II",
    workers: 1,
  },
  {
    id: "unitStationModuleElectrified",
    recipeId: "static-unit-station-module-electrified",
    name: "Unit station module (electrified)",
    detail: "1 worker and 50 kW each",
    building: "Unit station module (electrified)",
    workers: 1,
  },
  {
    id: "fluidStationModuleElectrified",
    recipeId: "static-fluid-station-module-electrified",
    name: "Fluid station module (electrified)",
    detail: "1 worker and 50 kW each",
    building: "Fluid station module (electrified)",
    workers: 1,
  },
  {
    id: "looseStationModuleElectrified",
    recipeId: "static-loose-station-module-electrified",
    name: "Loose station module (electrified)",
    detail: "1 worker and 50 kW each",
    building: "Loose station module (electrified)",
    workers: 1,
  },
  {
    id: "truck",
    recipeId: "static-truck",
    name: "Truck",
    detail: "1 worker each; movement-dependent fuel is excluded",
    building: "Truck",
    workers: 1,
  },
  {
    id: "haulTruckDump",
    recipeId: "static-haul-truck-dump",
    name: "Haul truck (dump)",
    detail: "1 worker each; movement-dependent fuel is excluded",
    building: "Haul truck (dump)",
    workers: 1,
  },
  {
    id: "megaExcavator",
    recipeId: "static-mega-excavator",
    name: "Mega excavator",
    detail: "1 worker each; movement- and mining-dependent fuel is excluded",
    building: "Mega excavator",
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

export const defaultStaticInfrastructureConfig: StaticInfrastructureConfig = {
  oreSortingPlant: 7,
  oreSortingPlantLarge: 0,
  electricLocomotiveII: 21,
  unitStationModuleElectrified: 108,
  fluidStationModuleElectrified: 79,
  looseStationModuleElectrified: 143,
  truck: 18,
  haulTruckDump: 16,
  megaExcavator: 11,
  maintenanceStatue: 3,
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
  truck: Math.max(0, Math.trunc(config.truck)),
  haulTruckDump: Math.max(0, Math.trunc(config.haulTruckDump)),
  megaExcavator: Math.max(0, Math.trunc(config.megaExcavator)),
  maintenanceStatue: Math.max(0, Math.trunc(config.maintenanceStatue)),
});

export const calculateStaticInfrastructureTotals = (
  config: StaticInfrastructureConfig,
) => {
  const normalized = normalizeStaticInfrastructureConfig(config);

  return {
    workers: staticInfrastructureItems.reduce(
      (total, item) => total + normalized[item.id] * item.workers,
      0,
    ),
    fuelGasPerCycle: normalized.maintenanceStatue * maintenanceStatue.fuelGasPerCycle,
  };
};
