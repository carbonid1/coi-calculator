import { maintenanceStatue } from './maintenance-statue'

export const staticInfrastructureItems = [
  {
    id: 'captainOfficeI',
    recipeId: 'static-captain-office-i',
    name: "Captain's office I",
    building: "Captain's office I",
  },
  {
    id: 'captainOfficeII',
    recipeId: 'static-captain-office-ii',
    name: "Captain's office II",
    building: "Captain's office II",
  },
  {
    id: 'oreSortingPlant',
    recipeId: 'static-ore-sorting-plant',
    name: 'Ore sorting plant',
    building: 'Ore sorting plant',
  },
  {
    id: 'oreSortingPlantLarge',
    recipeId: 'static-ore-sorting-plant-large',
    name: 'Ore sorting plant (large)',
    building: 'Ore sorting plant (large)',
  },
  {
    id: 'electricLocomotiveII',
    recipeId: 'static-electric-locomotive-ii',
    name: 'Electric locomotive II',
    building: 'Electric locomotive II',
  },
  {
    id: 'unitStationModuleElectrified',
    recipeId: 'static-unit-station-module-electrified',
    name: 'Unit station module (electrified)',
    building: 'Unit station module (electrified)',
  },
  {
    id: 'fluidStationModuleElectrified',
    recipeId: 'static-fluid-station-module-electrified',
    name: 'Fluid station module (electrified)',
    building: 'Fluid station module (electrified)',
  },
  {
    id: 'looseStationModuleElectrified',
    recipeId: 'static-loose-station-module-electrified',
    name: 'Loose station module (electrified)',
    building: 'Loose station module (electrified)',
  },
  {
    id: 'moltenStationModuleElectrified',
    recipeId: 'static-molten-station-module-electrified',
    name: 'Molten station module (electrified)',
    building: 'Molten station module (electrified)',
  },
  {
    id: 'stackerTower',
    recipeId: 'static-stacker-tower',
    name: 'Stacker tower',
    building: 'Stacker tower',
  },
  {
    id: 'trainDepot',
    recipeId: 'static-train-depot',
    name: 'Train depot',
    building: 'Train depot',
  },
  {
    id: 'vehiclesDepot',
    recipeId: 'static-vehicles-depot',
    name: 'Vehicles depot',
    building: 'Vehicles depot',
  },
  {
    id: 'vehiclesDepotII',
    recipeId: 'static-vehicles-depot-ii',
    name: 'Vehicles depot II',
    building: 'Vehicles depot II',
  },
  {
    id: 'vehiclesDepotIII',
    recipeId: 'static-vehicles-depot-iii',
    name: 'Vehicles depot III',
    building: 'Vehicles depot III',
  },
  {
    id: 'vehicles',
    recipeId: 'static-vehicles',
    name: 'Vehicles',
    building: 'Vehicles',
  },
  {
    id: 'maintenanceStatue',
    recipeId: maintenanceStatue.id,
    name: maintenanceStatue.name,
    building: maintenanceStatue.name,
  },
] as const

type StaticInfrastructureId = (typeof staticInfrastructureItems)[number]['id']
export type StaticInfrastructureConfig = Record<StaticInfrastructureId, number>

export const emptyStaticInfrastructureConfig: StaticInfrastructureConfig = {
  captainOfficeI: 0,
  captainOfficeII: 0,
  oreSortingPlant: 0,
  oreSortingPlantLarge: 0,
  electricLocomotiveII: 0,
  unitStationModuleElectrified: 0,
  fluidStationModuleElectrified: 0,
  looseStationModuleElectrified: 0,
  moltenStationModuleElectrified: 0,
  stackerTower: 0,
  trainDepot: 0,
  vehiclesDepot: 0,
  vehiclesDepotII: 0,
  vehiclesDepotIII: 0,
  vehicles: 0,
  maintenanceStatue: 0,
}

export const normalizeStaticInfrastructureConfig = (
  config: StaticInfrastructureConfig,
): StaticInfrastructureConfig => ({
  captainOfficeI: Math.max(0, Math.trunc(config.captainOfficeI)),
  captainOfficeII: Math.max(0, Math.trunc(config.captainOfficeII)),
  oreSortingPlant: Math.max(0, Math.trunc(config.oreSortingPlant)),
  oreSortingPlantLarge: Math.max(0, Math.trunc(config.oreSortingPlantLarge)),
  electricLocomotiveII: Math.max(0, Math.trunc(config.electricLocomotiveII)),
  unitStationModuleElectrified: Math.max(0, Math.trunc(config.unitStationModuleElectrified)),
  fluidStationModuleElectrified: Math.max(0, Math.trunc(config.fluidStationModuleElectrified)),
  looseStationModuleElectrified: Math.max(0, Math.trunc(config.looseStationModuleElectrified)),
  moltenStationModuleElectrified: Math.max(0, Math.trunc(config.moltenStationModuleElectrified)),
  stackerTower: Math.max(0, Math.trunc(config.stackerTower)),
  trainDepot: Math.max(0, Math.trunc(config.trainDepot)),
  vehiclesDepot: Math.max(0, Math.trunc(config.vehiclesDepot)),
  vehiclesDepotII: Math.max(0, Math.trunc(config.vehiclesDepotII)),
  vehiclesDepotIII: Math.max(0, Math.trunc(config.vehiclesDepotIII)),
  vehicles: Math.max(0, Math.trunc(config.vehicles)),
  maintenanceStatue: Math.max(0, Math.trunc(config.maintenanceStatue)),
})
