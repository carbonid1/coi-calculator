import { describe, expect, it } from 'vitest'

import { defaultEdictLevels, edictCatalog } from './db/edicts'
import { mapFocusValues } from './db/offices'
import { defaultInfiniteResearchLevels } from './db/research'
import {
  CURRENT_GAME_STATE_SCHEMA_VERSION,
  isGameStateSnapshot,
  normalizeGameStateSnapshot,
} from './game-state'
import { testBuildingDefinitions } from './test-fixtures/building-requirements'
import { testProducts } from './test-fixtures/products'
import { testChickenFarmDefinition, testRocketIiDefinition, testSpaceStationLevels } from './test-fixtures/recorded-game-data'
import { emptySettlement, testWeather } from './test-fixtures/synced-island-settings'

const emptyHistory = { averagePerCycle: 0, sampleMonths: 0 }
const edicts = Object.fromEntries(edictCatalog.map(edict => {
  const level = defaultEdictLevels[edict.id]

  return [edict.id, { activeLevel: level, enabledLevel: level, inactiveReason: null }]
}))

const currentSnapshot = {
  world: { mines: [], routes: [], unassignedShipIds: [], unassignedWorkers: 0 },
  storages: [],
  schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION,
  chickenFarmDefinition: testChickenFarmDefinition,
  rocketIiDefinition: testRocketIiDefinition,
  spaceStationLevels: testSpaceStationLevels,
  buildingDefinitions: testBuildingDefinitions,
  recycling: { efficiencyPercent: 20, scrapPerRecyclable: 2, products: [] },
  gameVersion: '0.8.8',
  gameId: '123',
  sessionId: '456',
  settlement: emptySettlement,
  weather: testWeather,
  saveId: 'Test Island',
  exportedAtUtc: '2026-09-04T00:00:00.000Z',
  spaceStation: { currentLevel: 0, highestLevelAchieved: 0 },
  logisticsZones: [],
  chickenFarms: [],
  cropFarms: [],
  machines: [],
  groundwater: { depletedPumpSpeedPercent: 40, replenishWhenLowPercent: 7 },
  contracts: { established: [], routes: [] },
  productionEntities: [],
  areaEntities: [],
  mineTowers: [],
  vehicles: { workersAssigned: 0 },
  research: defaultInfiniteResearchLevels,
  focus: mapFocusValues(() => ({ targetStep: 0, activeStep: 0 })),
  edicts,
  reserves: { fuelGas: 0, gold: 0, sulfur: 0 },
  history: {
    windowMonths: 120,
    maintenance: {
      maintenanceI: emptyHistory,
      maintenanceII: emptyHistory,
      maintenanceIII: emptyHistory,
    },
    hydrogenFuel: {
      total: emptyHistory,
      byUse: {
        vehicles: emptyHistory,
        cargoShips: emptyHistory,
        battleShip: emptyHistory,
        powerGenerators: emptyHistory,
        trains: emptyHistory,
      },
    },
    electricityGeneration: { byType: [] },
  },
}

describe('game-state snapshot validation', () => {
  it('requires ordered native station tiers and rejects incomplete or unsupported values', () => {
    const first = testSpaceStationLevels[0]

    if (!first) throw new Error('Recorded station tiers are missing')
    for (const levels of [undefined, null, [], [first, first],
      [{ ...first, crew: -1 }], [{ ...first, level: 2 }],
      [{ ...first, unityPerCycle: Number.NaN }],
      [{ ...first, maintenance: { ...first.maintenance, quantity: -1 } }],
      [{ ...first, researchSupplies: { productId: 'unknown', name: 'unknown', quantity: 1 } }],
    ]) {
      expect(normalizeGameStateSnapshot({ ...currentSnapshot, spaceStationLevels: levels })).toBeNull()
    }
    expect(normalizeGameStateSnapshot({ ...currentSnapshot,
      spaceStation: { currentLevel: testSpaceStationLevels.length + 1, highestLevelAchieved: testSpaceStationLevels.length + 1 },
    })).toBeNull()
  })
  it('requires complete, supported Rocket II data from the compatible Bridge', () => {
    for (const definition of [undefined, null, {},
      { ...testRocketIiDefinition, cargoCapacity: 0 },
      { ...testRocketIiDefinition, crewCapacity: 1.5 },
      { ...testRocketIiDefinition, buildCycles: 0 },
      { ...testRocketIiDefinition, crewRotationCycles: Number.NaN },
      { ...testRocketIiDefinition, compositePanelOutput: 0 },
      { ...testRocketIiDefinition, launchInputs: [] },
      { ...testRocketIiDefinition, buildInputs: [{ productId: 'unknown', name: 'unknown', quantity: 10 }] },
      { ...testRocketIiDefinition, buildInputs: [{ productId: 'Product_Steel', name: 'Steel', quantity: -10 }] },
      { ...testRocketIiDefinition, launchInputs: [...testRocketIiDefinition.launchInputs, testRocketIiDefinition.launchInputs[0]] },
    ]) {
      expect(normalizeGameStateSnapshot({ ...currentSnapshot, rocketIiDefinition: definition })).toBeNull()
    }
  })
  it('requires valid chicken farm data from the compatible Bridge', () => {
    for (const definition of [undefined, null, {},
      { ...testChickenFarmDefinition, capacity: 0 },
      { ...testChickenFarmDefinition, countStep: -1 },
      { ...testChickenFarmDefinition, feedPerChicken: Number.NaN },
      { ...testChickenFarmDefinition, eggsPerChicken: -1 },
    ]) {
      expect(normalizeGameStateSnapshot({ ...currentSnapshot, chickenFarmDefinition: definition })).toBeNull()
    }
  })
  it('preserves native products from the same game session', () => {
    const snapshot = { ...currentSnapshot, products: testProducts }

    expect(normalizeGameStateSnapshot(snapshot)).toEqual(snapshot)
  })

  it('rejects native products from another game or session', () => {
    expect(normalizeGameStateSnapshot({
      ...currentSnapshot, products: { ...testProducts, gameId: '999' },
    })).toBeNull()
    expect(normalizeGameStateSnapshot({
      ...currentSnapshot, products: { ...testProducts, sessionId: '999' },
    })).toBeNull()
  })

  it('accepts and normalizes the current exporter schema', () => {
    expect(isGameStateSnapshot(currentSnapshot)).toBe(true)
    expect(normalizeGameStateSnapshot(currentSnapshot)).toEqual(currentSnapshot)
  })

  it('rejects malformed building requirements instead of calculating partial totals', () => {
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      buildingDefinitions: [{ ...testBuildingDefinitions[0], workers: -1 }],
    })).toBe(false)
  })

  it('rejects every non-current exporter schema', () => {
    expect(isGameStateSnapshot({ ...currentSnapshot, schemaVersion: 39 })).toBe(false)
    expect(isGameStateSnapshot({ ...currentSnapshot, schemaVersion: 41 })).toBe(false)
    expect(isGameStateSnapshot({ ...currentSnapshot, schemaVersion: 42 })).toBe(false)
    expect(isGameStateSnapshot({ ...currentSnapshot, schemaVersion: 43 })).toBe(false)
    expect(isGameStateSnapshot({ ...currentSnapshot, schemaVersion: 46 })).toBe(false)
    expect(isGameStateSnapshot({ ...currentSnapshot, schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION + 1 })).toBe(false)
  })

  it.each(['0.8.7', '0.8.9', '', null])('rejects an incompatible game version: %s', gameVersion => {
    expect(isGameStateSnapshot({ ...currentSnapshot, gameVersion })).toBe(false)
  })

  it('requires game and session identities and accepts current-game hotfixes', () => {
    expect(isGameStateSnapshot({ ...currentSnapshot, gameVersion: '0.8.8a' })).toBe(true)
    expect(isGameStateSnapshot({ ...currentSnapshot, gameId: '' })).toBe(false)
    expect(isGameStateSnapshot({ ...currentSnapshot, sessionId: null })).toBe(false)
  })

  it.each([
    'settlement',
    'weather',
    'saveId',
    'spaceStation',
    'logisticsZones',
    'chickenFarms',
    'cropFarms',
    'machines',
    'groundwater',
    'contracts',
    'productionEntities',
    'areaEntities',
    'mineTowers',
    'vehicles',
    'research',
    'edicts',
    'focus',
    'world',
    'storages',
    'history',
    'buildingDefinitions',
  ])('rejects a snapshot without %s', field => {
    expect(isGameStateSnapshot({ ...currentSnapshot, [field]: undefined })).toBe(false)
  })

  it('requires valid Space Station state', () => {
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      spaceStation: { currentLevel: 2, highestLevelAchieved: 1 },
    })).toBe(false)
  })

  it('requires unique valid chicken farm entities', () => {
    const entity = {
      entityId: 1,
      prototypeId: 'ChickenFarm',
      running: true,
      slaughtering: true,
      chickens: 500,
      zones: [],
    }
    const snapshot = {
      ...currentSnapshot,
      chickenFarms: [entity],
    }

    expect(isGameStateSnapshot(snapshot)).toBe(true)
    expect(isGameStateSnapshot({
      ...snapshot,
      chickenFarms: [entity, entity],
    })).toBe(false)
    expect(isGameStateSnapshot({
      ...snapshot,
      chickenFarms: [{ ...entity, chickens: -1 }],
    })).toBe(false)
  })

  it('requires unique valid crop farm entities', () => {
    const farm = {
      prototypeId: 'FarmT4',
      running: true,
      fertilityTargetPercent: 100,
      fertilizerProductId: 'Product_Fertilizer2',
      schedule: ['Crop_Potato', null, 'Crop_Corn', null],
    }
    const snapshot = {
      ...currentSnapshot,
      cropFarms: [{ ...farm, entityId: 2, zones: [] }],
    }

    expect(isGameStateSnapshot(snapshot)).toBe(true)
    expect(isGameStateSnapshot({
      ...snapshot,
      cropFarms: [{
        ...snapshot.cropFarms[0],
        fertilizerProductId: 'Product_Diesel',
      }],
    })).toBe(false)
  })

  it('requires unique machines with valid and consistent aquifers', () => {
    const aquifer = {
      id: '10:20',
      position: { x: 10, y: 20 },
      quantity: 10_000,
      capacity: 20_000,
      configuredCapacity: 20_000,
    }
    const machine = {
      entityId: 3,
      kind: 'groundwater-pump',
      prototypeId: 'AirSeparator',
      running: true,
      customTitle: null,
      tile: { x: 1, y: 2 },
      zones: [],
      aquifer,
    }

    expect(isGameStateSnapshot({ ...currentSnapshot, machines: [machine] })).toBe(true)
    expect(isGameStateSnapshot({ ...currentSnapshot, machines: [machine, machine] })).toBe(false)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      machines: [machine, { ...machine, entityId: 4, aquifer: { ...aquifer, quantity: 1 } }],
    })).toBe(false)
  })

  it('requires production identity and prototype-specific configuration', () => {
    const reactor = {
      entityId: 5,
      prototypeId: 'FastBreederReactor',
      running: true,
      recipeIds: ['NuclearReactorT2'],
      zones: [],
      nuclearReactor: { enrichmentStep: 1, targetPowerPercent: 100 },
      dataCenterRacks: null,
      trainStation: null,
    }

    expect(isGameStateSnapshot({ ...currentSnapshot, productionEntities: [reactor] })).toBe(true)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      productionEntities: [{ ...reactor, nuclearReactor: null }],
    })).toBe(false)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      productionEntities: [reactor, reactor],
    })).toBe(false)
  })

  it('requires compact area recipes and prototype-specific area configuration', () => {
    const recipe = {
      id: 'AirSeparation',
      name: 'Air Separation',
      durationSeconds: 10,
      electricityMultiplier: 1,
      assigned: true,
      inputs: [],
      outputs: [{ productId: 'Product_Oxygen', name: 'Oxygen', quantity: 1 }],
    }
    const entity = {
      entityId: 6,
      prototypeId: 'AirSeparator',
      prototypeName: 'Air Separator',
      constructionState: 'Constructed',
      constructed: true,
      running: true,
      tile: { x: 1, y: 2 },
      zones: [],
      availableRecipeCount: 1,
      recipes: [recipe],
      oreSorter: null,
      trainStation: null,
      forestry: null,
      office: null,
    }

    expect(isGameStateSnapshot({ ...currentSnapshot, areaEntities: [entity] })).toBe(true)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      areaEntities: [{ ...entity, availableRecipeCount: undefined }],
    })).toBe(false)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      areaEntities: [{ ...entity, recipes: [{ ...recipe, durationSeconds: 0 }] }],
    })).toBe(false)
    for (const electricityMultiplier of [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isGameStateSnapshot({
        ...currentSnapshot,
        areaEntities: [{ ...entity, recipes: [{ ...recipe, electricityMultiplier }] }],
      })).toBe(false)
    }
  })

  it('requires exact forestry, sorter, and office configurations', () => {
    const baseEntity = {
      entityId: 7,
      prototypeId: 'ForestryTower',
      prototypeName: 'Forestry Tower',
      constructionState: 'Constructed',
      constructed: true,
      running: true,
      tile: { x: 1, y: 2 },
      zones: [],
      availableRecipeCount: 0,
      recipes: [],
      oreSorter: null,
      trainStation: null,
      office: null,
      forestry: {
        treeCount: 100,
        cuttingEnabled: true,
        targetHarvestPercent: 100,
        harvestsPerCycle: 1,
        harvestDurationMonths: 100,
        outputs: [{ productId: 'Product_Air', name: 'Air', quantityPerCycle: 1 }],
      },
    }

    expect(isGameStateSnapshot({ ...currentSnapshot, areaEntities: [baseEntity] })).toBe(true)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      areaEntities: [{ ...baseEntity, forestry: null }],
    })).toBe(false)
  })

  it('requires unique contract ownership', () => {
    const contract = {
      gameId: 'Contract_Test',
      exportedProduct: { productId: 'Product_Air', name: 'Air' },
      exportedQuantity: 1,
      importedProduct: { productId: 'Product_Oxygen', name: 'Oxygen' },
      importedQuantity: 1,
      unityPerCycle: 0,
      unityPer100Imported: 0,
      unityToEstablish: 0,
      minimumReputation: 0,
    }
    const route = {
      depotEntityId: 8,
      depotPrototypeId: 'AirSeparator',
      depotPrototypeName: 'Air Separator',
      depotCustomTitle: null,
      running: true,
      slotCount: 0,
      contractGameId: contract.gameId,
      zones: [],
      modules: [],
      ship: null,
      operation: { dockBlocked: false, modules: [], ship: null },
    }

    expect(isGameStateSnapshot({
      ...currentSnapshot,
      contracts: { established: [contract], routes: [route] },
    })).toBe(true)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      contracts: { established: [contract], routes: [route, route] },
    })).toBe(false)
  })

  it('accepts an enabled edict whose effect is currently inactive', () => {
    const normalized = normalizeGameStateSnapshot({
      ...currentSnapshot,
      edicts: {
        ...edicts,
        maintenanceReducer: {
          enabledLevel: 3,
          activeLevel: 0,
          inactiveReason: 'Not enough Unity',
        },
      },
    })

    expect(normalized?.edicts.maintenanceReducer).toEqual({
      enabledLevel: 3,
      activeLevel: 0,
      inactiveReason: 'Not enough Unity',
    })
  })

  it('rejects impossible research, edict, reserve, and worker values', () => {
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      research: { ...currentSnapshot.research, solarPower: 201 },
    })).toBe(false)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      edicts: {
        ...edicts,
        farmingBoost: { enabledLevel: 1, activeLevel: 4, inactiveReason: null },
      },
    })).toBe(false)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      storages: [{ entityId: 1, product: { productId: 'Product_Sulfur', name: 'Sulfur' }, quantity: -1, capacity: 100, trainLinked: false, hasAssignedInputs: false }],
    })).toBe(false)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      vehicles: { workersAssigned: 2.5 },
    })).toBe(false)
  })

  it('rejects invalid or duplicate history series', () => {
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      history: {
        ...currentSnapshot.history,
        maintenance: {
          ...currentSnapshot.history.maintenance,
          maintenanceII: { averagePerCycle: -1, sampleMonths: 120 },
        },
      },
    })).toBe(false)

    const generation = {
      prototypeId: 'PowerGeneratorT2',
      name: 'Power Generator II',
      averageMw: 10,
      sampleMonths: 120,
    }

    expect(isGameStateSnapshot({
      ...currentSnapshot,
      history: {
        ...currentSnapshot.history,
        electricityGeneration: { byType: [generation, generation] },
      },
    })).toBe(false)
  })
})
