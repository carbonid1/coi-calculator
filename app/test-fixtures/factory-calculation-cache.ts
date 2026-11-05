import { defaultEdictLevels, edictCatalog } from '../db/edicts'
import { mapFocusValues } from '../db/offices'
import { CURRENT_GAME_STATE_SCHEMA_VERSION, normalizeGameStateSnapshot } from '../game-state'
import { deriveCalculatorModel } from '../helpers/calculator-model/derive-calculator-model'
import { testBuildingDefinitions } from './building-requirements'
import { defaultInfiniteResearchLevels } from './historical-planning'
import { testGroundwater , testChickenFarmDefinition, testCropFarming, testOfficeFocusDefinitions, testPlanningDefinitions, testRocketIiDefinition, testSpaceStationLevels } from './recorded-game-data'
import { emptySettlement, testWeather } from './synced-island-settings'

export const createCacheTestModel = () => {
  const emptyHistory = { averagePerCycle: 0, sampleMonths: 0 }
  const snapshot = normalizeGameStateSnapshot({
    world: { mines: [], routes: [], unassignedShipIds: [], unassignedWorkers: 0 },
    storages: [],
    schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION,
    chickenFarmDefinition: testChickenFarmDefinition,
    rocketIiDefinition: testRocketIiDefinition,
    spaceStationLevels: testSpaceStationLevels,
    cropFarming: testCropFarming,
    officeFocusDefinitions: testOfficeFocusDefinitions,
    planningDefinitions: testPlanningDefinitions,
    buildingDefinitions: testBuildingDefinitions,
    recycling: { efficiencyPercent: 20, scrapPerRecyclable: 2, products: [] },
    gameVersion: '0.8.8',
    gameId: '123',
    sessionId: '456',
    settlement: emptySettlement,
    weather: testWeather,
    saveId: 'island-a',
    exportedAtUtc: '2026-09-04T00:00:00.000Z',
    spaceStation: { currentLevel: 0, highestLevelAchieved: 0 },
    logisticsZones: [], chickenFarms: [], cropFarms: [], machines: [],
    groundwater: { ...testGroundwater, aquifers: [] },
    contracts: { established: [], routes: [] },
    productionEntities: [], areaEntities: [], mineTowers: [],
    vehicles: { workersAssigned: 0 },
    research: defaultInfiniteResearchLevels,
    focus: mapFocusValues(() => ({ targetStep: 0, activeStep: 0 })),
    edicts: Object.fromEntries(edictCatalog.map(edict => [edict.id, {
      activeLevel: defaultEdictLevels[edict.id], enabledLevel: defaultEdictLevels[edict.id], inactiveReason: null,
    }])),
    reserves: { fuelGas: 0, gold: 0, sulfur: 0, rock: 0 },
    history: {
      windowMonths: 120,
      maintenance: { maintenanceI: emptyHistory, maintenanceII: emptyHistory, maintenanceIII: emptyHistory },
      hydrogenFuel: {
        total: emptyHistory,
        byUse: { vehicles: emptyHistory, cargoShips: emptyHistory, battleShip: emptyHistory, powerGenerators: emptyHistory, trains: emptyHistory },
      },
      electricityGeneration: { byType: [] },
    },
  })

  if (!snapshot) throw new Error('Invalid cache test snapshot')
  return deriveCalculatorModel({ snapshot, revision: 'new', machineZoneAssignments: {} })
}
