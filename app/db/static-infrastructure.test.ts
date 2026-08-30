import { describe, expect, it } from 'vitest'

import {
  calculateStaticInfrastructureTotals,
  emptyStaticInfrastructureConfig,
  type StaticInfrastructureConfig,
} from './static-infrastructure'

const syncedConfig: StaticInfrastructureConfig = {
  captainOfficeI: 0,
  captainOfficeII: 0,
  oreSortingPlant: 7,
  oreSortingPlantLarge: 0,
  electricLocomotiveII: 21,
  unitStationModuleElectrified: 108,
  fluidStationModuleElectrified: 79,
  looseStationModuleElectrified: 143,
  moltenStationModuleElectrified: 0,
  stackerTower: 0,
  trainDepot: 2,
  vehiclesDepot: 2,
  vehiclesDepotII: 1,
  vehiclesDepotIII: 1,
  vehicles: 39,
  maintenanceStatue: 3,
}

describe('static infrastructure workforce', () => {
  it('uses zero for every sync-owned count before a snapshot is available', () => {
    expect(Object.values(emptyStaticInfrastructureConfig).every(count => count === 0)).toBe(true)
  })

  it('includes the aggregate vehicle workers in the infrastructure total', () => {
    expect(calculateStaticInfrastructureTotals(syncedConfig).workers).toBe(486)
  })

  it("includes both Captain's office workforce tiers", () => {
    expect(calculateStaticInfrastructureTotals({
      ...emptyStaticInfrastructureConfig,
      captainOfficeI: 1,
      captainOfficeII: 1,
    }).workers).toBe(32)
  })

  it('uses only running buildings for workforce and fuel drains', () => {
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
        vehiclesDepot: 1,
        vehiclesDepotII: 1,
        vehiclesDepotIII: 0,
        maintenanceStatue: 2,
      },
    )

    expect(totals.workers).toBe(456)
    expect(totals.fuelGasPerCycle).toBe(4)
  })
})
