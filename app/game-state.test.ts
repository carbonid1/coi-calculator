import { describe, expect, it } from 'vitest'

import { defaultEdictLevels, edictCatalog } from './db/edicts'
import { defaultInfiniteResearchLevels } from './db/research'
import {
  CURRENT_GAME_STATE_SCHEMA_VERSION,
  isGameStateSnapshot,
  normalizeGameStateSnapshot,
} from './game-state'

const emptyBuildingCount = { built: 0, running: 0 }
const emptyHistory = { averagePerCycle: 0, sampleMonths: 0 }
const edicts = Object.fromEntries(edictCatalog.map(edict => {
  const level = defaultEdictLevels[edict.id]

  return [edict.id, { activeLevel: level, enabledLevel: level, inactiveReason: null }]
}))

const currentSnapshot = {
  schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION,
  saveId: 'Test Island',
  exportedAtUtc: '2026-09-04T00:00:00.000Z',
  buildings: {
    electricLocomotiveII: emptyBuildingCount,
    looseStationModuleElectrified: emptyBuildingCount,
    fluidStationModuleElectrified: emptyBuildingCount,
    unitStationModuleElectrified: emptyBuildingCount,
    moltenStationModuleElectrified: emptyBuildingCount,
    oreSortingPlant: emptyBuildingCount,
    oreSortingPlantLarge: emptyBuildingCount,
    stackerTower: emptyBuildingCount,
    trainDepot: emptyBuildingCount,
    vehiclesDepot: emptyBuildingCount,
    vehiclesDepotII: emptyBuildingCount,
    vehiclesDepotIII: emptyBuildingCount,
    captainOfficeI: emptyBuildingCount,
    captainOfficeII: emptyBuildingCount,
    maintenanceStatue: emptyBuildingCount,
    rocketAssemblyDepot: emptyBuildingCount,
    rocketLaunchPad: emptyBuildingCount,
    solarPanel: emptyBuildingCount,
    solarPanelMono: emptyBuildingCount,
  },
  spaceStation: { currentLevel: 0, highestLevelAchieved: 0 },
  computing: {
    dataCenters: emptyBuildingCount,
    racks: emptyBuildingCount,
    waterChillers: emptyBuildingCount,
  },
  logisticsZones: [],
  chickenFarms: { configurations: [], entities: [] },
  cropFarms: { configurations: [], entities: [] },
  machines: [],
  groundwater: { depletedPumpSpeedPercent: 40, replenishWhenLowPercent: 7 },
  contracts: { established: [], routes: [] },
  productionEntities: [],
  areaEntities: [],
  mineTowers: [],
  vehicles: { workersAssigned: 0 },
  research: defaultInfiniteResearchLevels,
  edicts,
  reserves: { fuelGas: 0, gold: 0 },
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
  it('accepts and normalizes the current exporter schema', () => {
    expect(isGameStateSnapshot(currentSnapshot)).toBe(true)
    expect(normalizeGameStateSnapshot(currentSnapshot)).toEqual(currentSnapshot)
  })

  it('rejects every non-current exporter schema', () => {
    expect(isGameStateSnapshot({ ...currentSnapshot, schemaVersion: 37 })).toBe(false)
    expect(isGameStateSnapshot({ ...currentSnapshot, schemaVersion: 39 })).toBe(false)
  })

  it.each([
    'saveId',
    'spaceStation',
    'computing',
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
    'reserves',
    'history',
  ])('rejects a snapshot without %s', field => {
    expect(isGameStateSnapshot({ ...currentSnapshot, [field]: undefined })).toBe(false)
  })

  it('requires complete and internally consistent building counts', () => {
    const { trainDepot: _trainDepot, ...missingTrainDepot } = currentSnapshot.buildings

    expect(isGameStateSnapshot({ ...currentSnapshot, buildings: missingTrainDepot })).toBe(false)
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      buildings: {
        ...currentSnapshot.buildings,
        oreSortingPlant: { built: 1, running: 2 },
      },
    })).toBe(false)
  })

  it('requires valid Space Station state', () => {
    expect(isGameStateSnapshot({
      ...currentSnapshot,
      spaceStation: { currentLevel: 2, highestLevelAchieved: 1 },
    })).toBe(false)
  })

  it('requires consistent chicken farm configurations and entities', () => {
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
      chickenFarms: {
        configurations: [{
          slaughtering: true,
          built: 1,
          running: 1,
          chickens: 500,
          runningChickens: 500,
        }],
        entities: [entity],
      },
    }

    expect(isGameStateSnapshot(snapshot)).toBe(true)
    expect(isGameStateSnapshot({
      ...snapshot,
      chickenFarms: {
        ...snapshot.chickenFarms,
        entities: [{ ...entity, chickens: 450 }],
      },
    })).toBe(false)
  })

  it('requires consistent crop farm configurations and entities', () => {
    const farm = {
      prototypeId: 'FarmT4',
      running: true,
      fertilityTargetPercent: 100,
      fertilizerProductId: 'Product_Fertilizer2',
      schedule: ['Crop_Potato', null, 'Crop_Corn', null],
    }
    const snapshot = {
      ...currentSnapshot,
      cropFarms: {
        configurations: [{ ...farm, built: 1, running: 1 }],
        entities: [{ ...farm, entityId: 2, zones: [] }],
      },
    }

    expect(isGameStateSnapshot(snapshot)).toBe(true)
    expect(isGameStateSnapshot({
      ...snapshot,
      cropFarms: {
        ...snapshot.cropFarms,
        entities: [{
          ...snapshot.cropFarms.entities[0],
          fertilizerProductId: 'Product_Diesel',
        }],
      },
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
      reserves: { ...currentSnapshot.reserves, fuelGas: -1 },
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
