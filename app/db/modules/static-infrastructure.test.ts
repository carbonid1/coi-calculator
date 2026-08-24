import { expect, it } from "vitest";

import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { createStaticInfrastructureModule } from "./static-infrastructure";

it("uses running counts for loads while retaining completed building capacity", () => {
  const built = {
    oreSortingPlant: 1,
    oreSortingPlantLarge: 1,
    electricLocomotiveII: 21,
    unitStationModuleElectrified: 108,
    fluidStationModuleElectrified: 79,
    looseStationModuleElectrified: 143,
    moltenStationModuleElectrified: 6,
    stackerTower: 2,
    trainDepot: 2,
    vehiclesDepot: 2,
    vehiclesDepotII: 1,
    vehiclesDepotIII: 1,
    vehicles: 39,
    maintenanceStatue: 3,
  };
  const infrastructureModule = createStaticInfrastructureModule(built, {
    ...built,
    oreSortingPlantLarge: 0,
    electricLocomotiveII: 20,
    unitStationModuleElectrified: 100,
    stackerTower: 1,
    trainDepot: 1,
    vehiclesDepot: 1,
    vehiclesDepotII: 1,
    vehiclesDepotIII: 0,
    maintenanceStatue: 2,
  });
  const result = calculateFactoryTotal([infrastructureModule]);
  const stats = calculateBuildingStats(result.allLines, result.calculation);
  const fuelGas = result.flows.find((flow) => flow.resourceId === "fuelGas");

  expect(stats.workers).toBe(427);
  expect(stats.electricityKw).toBe(0);
  expect(fuelGas).toMatchObject({ consumed: 4, produced: 0, net: -4 });
  expect(infrastructureModule.builtBuildings?.["static-ore-sorting-plant-large"])
    .toBe(1);
});
