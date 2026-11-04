import { expect, it } from 'vitest'

import { computingRecipeIds } from '../../db/computing'
import { activeCropFarmGroups } from '../../db/crop-farm-plans'
import { getLiveAreaPlans } from '../../db/live-area-plans'
import { getCropFarmGroundwaterClaimId } from '../../db/modules/crop-farm-areas'
import { type GameStateSnapshot, type SyncedProductionEntity } from '../../game-state'
import { createCacheTestModel } from '../../test-fixtures/factory-calculation-cache'
import { deriveCalculatorModel } from './derive-calculator-model'

it('anchors recycling projections to the observed game efficiency', () => {
  const snapshot = createSnapshot()

  snapshot.recycling.efficiencyPercent = 37.25
  snapshot.edicts.recyclingIncrease = { activeLevel: 5, enabledLevel: 5, inactiveReason: null }
  snapshot.focus.recyclingEfficiency = { activeStep: 3, targetStep: 5 }
  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {} })

  expect(model.recyclingEfficiencyPercent).toBe(39.25)
  expect(model.outputModifiers.recycling.efficiencyPercent).toBe(39.25)
  expect(model.factoryCalculationInput.recyclingEfficiencyPercent).toBe(39.25)
})

it.each([
  { saveId: 'Last-Stop Waters', zoneId: 10, planned: true },
  { saveId: 'Different factory', zoneId: 10, planned: false },
  { saveId: 'Last-Stop Waters', zoneId: 99, planned: false },
])('scopes fixed crop rotations to their saved area ($saveId, $zoneId)', ({ saveId, zoneId, planned }) => {
  const snapshot = createSnapshot()
  const zone = { id: zoneId, name: 'Renamed greenhouses' }

  snapshot.saveId = saveId
  snapshot.logisticsZones.push(zone)
  snapshot.cropFarms = [{
    entityId: 901, prototypeId: 'FarmT4', running: false,
    fertilityTargetPercent: 0, fertilizerProductId: null,
    schedule: [null, null, null, null], zones: [zone],
  }]
  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {} })
  const area = model.configuredModules.find(module => module.liveArea?.zoneId === zoneId)
  const plans = area?.presets[0].planMismatches?.filter(mismatch => mismatch.recipeId.includes(':crop-farm-plan:')) ?? []

  expect(plans.length).toBe(planned ? activeCropFarmGroups.length : 0)
})

it('applies crop plans when the saved area only contains farms under construction', () => {
  const snapshot = createSnapshot()
  const zone = { id: 10, name: 'Greenhouses' }

  snapshot.saveId = 'Last-Stop Waters'
  snapshot.cropFarms = []
  snapshot.logisticsZones.push(zone)
  snapshot.areaEntities.push({
    entityId: 901, prototypeId: 'FarmT4', prototypeName: 'Greenhouse II',
    constructed: false, running: false, constructionState: 'InConstruction',
    zones: [zone], tile: { x: 901, y: 0 }, recipes: [],
  })
  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {} })
  const area = model.configuredModules.find(module => module.liveArea?.zoneId === zone.id)
  const preset = area?.presets[0]
  const recipeId = `live-area-10:crop-farm-plan:${activeCropFarmGroups[0].id}`

  expect(preset?.constructionGhosts?.[recipeId]).toBe(1)
  expect(preset?.planMismatches?.find(mismatch => mismatch.recipeId === recipeId)?.actions)
    .toEqual([{ type: 'configure', label: 'Set 1 to Canola / Corn / Wheat · 140% fertility' }])
  expect(Object.values(preset?.unplacedPlannedBuildings ?? {}).reduce((sum, count) => sum + count, 0))
    .toBe(9)
})

it('uses the rack distribution in the synced computing inventory', () => {
  const snapshot = createSnapshot()
  const zone = { id: 13, name: 'Computing' }
  const centers = [48, 48, 48, 48, 48, 48, 48, 0, 16, 32, 48]
    .map((dataCenterRacks, index) => ({
      entityId: 900 + index, prototypeId: 'DataCenter', running: index < 8,
      recipeIds: [], zones: [zone], dataCenterRacks, nuclearReactor: null,
    }))

  snapshot.saveId = 'Last-Stop Waters'
  snapshot.logisticsZones.push(zone)
  snapshot.productionEntities.push(...centers)
  snapshot.areaEntities.push(...centers.map(entity => ({ ...entity,
    prototypeName: 'Data center', constructionState: 'Constructed', constructed: true,
    tile: { x: entity.entityId, y: 0 }, recipes: [],
  })))
  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {} })
  const preset = model.configuredComputingModules.find(module => module.liveArea?.zoneId === zone.id)?.presets[0]

  expect(preset?.activeBuildings[computingRecipeIds.dataCenter]).toBe(9)
  expect(preset?.activeBuildings[computingRecipeIds.basicRack]).toBe(384)
  expect(preset?.planMismatches).toContainEqual(expect.objectContaining({
    recipeId: computingRecipeIds.dataCenter,
    actions: [{ type: 'unpause', label: 'Unpause 1 Data Center' }],
  }))
})

it.each([
  { saveId: 'Last-Stop Waters', zoneId: 13, racks: 369 },
  { saveId: 'Different factory', zoneId: 13, racks: 48 },
  { saveId: 'Last-Stop Waters', zoneId: 99, racks: 48 },
])('scopes the computing expansion to its saved area ($saveId, $zoneId)', ({ saveId, zoneId, racks }) => {
  const snapshot = createSnapshot();
  const entity = { entityId: 900, prototypeId: 'DataCenter', running: true, recipeIds: [],
    zones: [{ id: zoneId, name: 'Renamed computing area' }], dataCenterRacks: 48, nuclearReactor: null };

  snapshot.saveId = saveId;
  snapshot.productionEntities.push(entity);
  snapshot.areaEntities.push({ ...entity, prototypeName: 'Data center', constructionState: 'Constructed',
    constructed: true, tile: { x: 900, y: 0 }, recipes: [] });
  snapshot.logisticsZones.push(entity.zones[0]);
  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {} });
  const area = model.configuredComputingModules.find(module => module.liveArea?.zoneId === zoneId);

  expect(area?.presets[0].activeBuildings[computingRecipeIds.basicRack]).toBe(racks);
});

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

it.each([
  { zoneId: 14, name: 'Population', running: true },
  { zoneId: 42, name: 'Water supply', running: false },
])('recognizes pumps already owned by a non-farm area ($name)', ({ zoneId, name, running }) => {
  const snapshot = createSnapshot()
  const zone = { id: zoneId, name }
  const pump = {
    entityId: 901, prototypeId: 'LandWaterPump', running,
    zones: [zone], tile: { x: 1888, y: 821 },
  }

  if (!snapshot.logisticsZones.some(candidate => candidate.id === zoneId)) {
    snapshot.logisticsZones.push(zone)
  }
  snapshot.machines.push({ ...pump, kind: 'groundwater-pump', customTitle: null, aquifer: null })
  snapshot.productionEntities.push({ ...pump, recipeIds: ['LandWaterPumping'], nuclearReactor: null })
  snapshot.areaEntities.push({
    ...pump, prototypeName: 'Groundwater pump', constructionState: 'Constructed', constructed: true,
    recipes: [{
      id: 'LandWaterPumping', name: 'LandWaterPumping', assigned: true,
      durationSeconds: 10, inputs: [],
      outputs: [{ productId: 'Product_Water', name: 'Water', quantity: 8 }],
    }],
  })

  const model = deriveCalculatorModel({ snapshot, revision: null, machineZoneAssignments: {} })
  const pumpOwners = model.configuredModules.flatMap(module => (module.recipes ?? [])
    .filter(recipe => recipe.gameBuildingId === 'LandWaterPump')
    .map(recipe => ({ moduleId: module.id, built: module.builtBuildings[recipe.id] })))

  expect(pumpOwners).toEqual([{ moduleId: `live-area-${zoneId}`, built: 1 }])
  expect(model.sharedMachineAllocation.claims[getCropFarmGroundwaterClaimId(zoneId)])
    .toMatchObject({ built: 1, running: Number(running), suggestedBuilt: 0, actions: [] })
  expect(model.sharedMachineAllocation.inventory).toEqual([
    expect.objectContaining({ built: 1, assigned: 1, unresolved: 0 }),
  ])
  expect(model.sharedMachineAllocation.zones).toEqual([
    expect.objectContaining({ id: zoneId, needsAssignment: false }),
  ])
  expect(model.sharedMachineAllocation.issues).toEqual([])
})

it('uses the housing and station plans for the research summary', () => {
  const model = deriveCalculatorModel({ snapshot: createSnapshot(), machineZoneAssignments: {} })

  expect(model.researchEfficiency).toMatchObject({
    population: 7488, populationBonusPercent: 37, populationIsPlanned: true,
    stationBonusPercent: 20, stationIsPlanned: true, totalOutputPercent: 157,
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

it('applies saved area priorities and invalidates the calculation when they change', () => {
  const snapshot = createSnapshot()
  const original = deriveCalculatorModel({ snapshot, machineZoneAssignments: {} })
  const planned = deriveCalculatorModel({ snapshot, machineZoneAssignments: {},
    resourcePriorityOverrides: { 14: { water: 'local-first' }, 99: { brine: 'local-first' } } })
  const reverted = deriveCalculatorModel({ snapshot, machineZoneAssignments: {},
    resourcePriorityOverrides: { 14: { water: 'factory' } } })
  const area = (model: typeof original, zoneId: number) => model.configuredModules
    .find(module => module.liveArea?.zoneId === zoneId)?.presets[0].resourceProcessingPriorities

  expect(area(planned, 14)).toEqual({ water: 'local-first' })
  expect(area(planned, 18)).toBeUndefined()
  expect(area(reverted, 14)).toEqual({ water: 'factory' })
  expect(planned.calculationRevision).not.toBe(original.calculationRevision)
  expect(reverted.calculationRevision).not.toBe(planned.calculationRevision)
  expect(getLiveAreaPlans('Last-Stop Waters')[12].resourceProcessingPriorities).toEqual({ brine: 'local-first' })
  expect(getLiveAreaPlans('Another save')[12]).toBeUndefined()
})
