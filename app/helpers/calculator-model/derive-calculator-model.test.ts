import { expect, it } from 'vitest'

import { type GameStateSnapshot, type SyncedProductionEntity } from '../../game-state'
import { createCacheTestModel } from '../../test-fixtures/factory-calculation-cache'
import { deriveCalculatorModel } from './derive-calculator-model'

const createSnapshot = (housingCount = 18): GameStateSnapshot => {
  const base = createCacheTestModel().snapshot
  const populationZone = { id: 14, name: 'Population' }
  const spaceZone = { id: 18, name: 'Operations' }
  const housing: SyncedProductionEntity[] = Array.from({ length: housingCount + 2 }, (_, index) => ({
    entityId: index + 1, prototypeId: index < housingCount ? 'HousingT3' : 'HousingT2',
    running: index < housingCount, recipeIds: [], zones: [populationZone],
    nuclearReactor: null, dataCenterRacks: null,
  }))
  const productionEntities = [
    ...housing,
    ...[101, 102, 103].map(entityId => ({
      entityId, prototypeId: entityId === 103 ? 'RocketLaunchPad' : 'ResearchLab4',
      running: false, recipeIds: [], zones: entityId === 103 ? [spaceZone] : [],
      nuclearReactor: null, dataCenterRacks: null,
    })),
  ]

  return {
    ...base,
    research: { ...base.research, housingCapacity: 4 },
    edicts: { ...base.edicts, researchEfficiency: { activeLevel: 0, enabledLevel: 0, inactiveReason: null } },
    logisticsZones: [populationZone, spaceZone],
    productionEntities,
    areaEntities: productionEntities.map(entity => ({
      ...entity, prototypeName: entity.prototypeId, constructionState: 'Constructed',
      constructed: true, tile: { x: entity.entityId, y: 0 }, recipes: [],
    })),
    settlement: {
      population: 5184, unity: [], settlements: [{
        population: 5184, capacity: housingCount * 288, foodProductIds: ['Potato'], serviceIds: [],
        housing: housing.map((entity, index) => ({
          entityId: entity.entityId, population: index < 18 ? 288 : 0,
          capacity: index < housingCount ? 288 : 168,
        })),
      }],
    },
  }
}

it('uses the housing and station plans for the research summary', () => {
  const model = deriveCalculatorModel({ snapshot: createSnapshot(), machineZoneAssignments: {} })

  expect(model.researchEfficiency).toMatchObject({
    population: 7488, populationBonusPercent: 37, populationIsPlanned: true,
    stationBonusPercent: 25, stationIsPlanned: true, totalOutputPercent: 162,
  })
})

it('keeps synced occupancy after the housing target is built, even with empty homes', () => {
  const model = deriveCalculatorModel({ snapshot: createSnapshot(26), machineZoneAssignments: {} })

  expect(model.populationCapacity).toBe(7488)
  expect(model.researchEfficiency).toMatchObject({
    population: 5184, populationBonusPercent: 26, populationIsPlanned: false,
  })
})

it('does not award a planned station bonus without a station module', () => {
  const snapshot = createSnapshot()

  snapshot.productionEntities = snapshot.productionEntities.filter(entity => entity.prototypeId !== 'RocketLaunchPad')
  snapshot.areaEntities = snapshot.areaEntities.filter(entity => entity.prototypeId !== 'RocketLaunchPad')
  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {} })

  expect(model.researchEfficiency).toMatchObject({
    population: 7488, stationBonusPercent: 0, stationIsPlanned: false, totalOutputPercent: 137,
  })
})
