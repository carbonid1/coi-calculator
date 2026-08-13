import { expect, it } from "vitest";

import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { createStaticInfrastructureModule } from "./static-infrastructure";

it("adds configured ore-sorter loads and the maintenance-statue fuel drain", () => {
  const infrastructureModule = createStaticInfrastructureModule({
    oreSortingPlant: 1,
    oreSortingPlantLarge: 1,
    electricLocomotiveII: 21,
    unitStationModuleElectrified: 108,
    fluidStationModuleElectrified: 79,
    looseStationModuleElectrified: 143,
    truck: 18,
    haulTruckDump: 16,
    megaExcavator: 11,
    maintenanceStatue: 3,
  });
  const result = calculateFactoryTotal([infrastructureModule]);
  const stats = calculateBuildingStats(result.allLines, result.calculation);
  const fuelGas = result.flows.find((flow) => flow.resourceId === "fuelGas");

  expect(stats.workers).toBe(432);
  expect(stats.electricityKw).toBe(17_300);
  expect(fuelGas).toMatchObject({ consumed: 6, produced: 0, net: -6 });
});
