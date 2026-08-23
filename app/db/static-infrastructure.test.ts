import { describe, expect, it } from "vitest";

import {
  calculateStaticInfrastructureTotals,
  emptyStaticInfrastructureConfig,
  type StaticInfrastructureConfig,
} from "./static-infrastructure";

const syncedConfig: StaticInfrastructureConfig = {
  oreSortingPlant: 7,
  oreSortingPlantLarge: 0,
  electricLocomotiveII: 21,
  unitStationModuleElectrified: 108,
  fluidStationModuleElectrified: 79,
  looseStationModuleElectrified: 143,
  moltenStationModuleElectrified: 0,
  stackerTower: 0,
  trainDepot: 2,
  vehicles: 39,
  maintenanceStatue: 3,
};

describe("static infrastructure workforce", () => {
  it("uses zero for every sync-owned count before a snapshot is available", () => {
    expect(Object.values(emptyStaticInfrastructureConfig).every(count => count === 0))
      .toBe(true);
  });

  it("includes the aggregate vehicle workers in the infrastructure total", () => {
    expect(calculateStaticInfrastructureTotals(
      syncedConfig,
    ).workers).toBe(448);
  });

  it("uses only running buildings for workforce and fuel drains", () => {
    const totals = calculateStaticInfrastructureTotals(
      {
        ...syncedConfig,
        stackerTower: 3,
      },
      {
        ...syncedConfig,
        oreSortingPlant: 6,
        electricLocomotiveII: 19,
        stackerTower: 2,
        trainDepot: 1,
        maintenanceStatue: 2,
      },
    );

    expect(totals.workers).toBe(440);
    expect(totals.fuelGasPerCycle).toBe(4);
  });
});
