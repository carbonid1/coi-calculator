import { expect, it } from 'vitest'

import { buildModuleLines } from '../../helpers/build-module-lines/build-module-lines'
import { calculateBuildingStats } from '../../helpers/building-stats/building-stats'
import { calculateFactoryTotal } from '../../helpers/factory-total/factory-total'
import { createStaticInfrastructureModule } from './static-infrastructure'

it('uses running counts for loads while retaining completed building capacity', () => {
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
  }
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
  })
  const result = calculateFactoryTotal([infrastructureModule])
  const stats = calculateBuildingStats(result.allLines, result.calculation)
  const fuelGas = result.calculation.allResourceFlows.find(flow => flow.resourceId === 'fuelGas')

  expect(stats.workers).toBe(427)
  expect(stats.electricityKw).toBe(0)
  expect(stats.computingTflops).toBe(0)
  expect(fuelGas).toMatchObject({ consumed: 4, produced: 0, net: -4 })
  expect(infrastructureModule.builtBuildings?.['static-ore-sorting-plant-large']).toBe(1)
  expect(infrastructureModule.builtBuildings).not.toHaveProperty('static-rocket-assembly-depot')
  expect(infrastructureModule.builtBuildings).not.toHaveProperty('static-rocket-launch-pad')
})

it('exposes modeled and synced counts through standard production lines', () => {
  const built = {
    oreSortingPlant: 1,
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
    maintenanceStatue: 3,
  }
  const infrastructureModule = createStaticInfrastructureModule(built, built, {
    syncedCounts: true,
  })
  const lines = buildModuleLines(
    infrastructureModule,
    infrastructureModule.presets[0] ?? null,
  )
  const source = (recipeId: string) => (
    lines.lines.find(line => line.recipe.id === recipeId)?.dataSource
  )

  expect(source('static-ore-sorting-plant')).toBe('synced')
  expect(source('statue-of-maintenance-golden')).toBe('synced')
})
