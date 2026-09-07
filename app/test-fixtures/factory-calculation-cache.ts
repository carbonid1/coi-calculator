import { defaultEdictLevels, edictCatalog } from '../db/edicts'
import { defaultInfiniteResearchLevels } from '../db/research'
import { CURRENT_GAME_STATE_SCHEMA_VERSION, normalizeGameStateSnapshot } from '../game-state'
import { deriveCalculatorModel } from '../helpers/calculator-model/derive-calculator-model'
import { emptySettlement, testWeather } from './synced-island-settings'

export const createCacheTestModel = () => {
  const emptyHistory = { averagePerCycle: 0, sampleMonths: 0 }
  const snapshot = normalizeGameStateSnapshot({
    world: { mines: [], routes: [], unassignedShipIds: [], unassignedWorkers: 0 },
    storages: [],
    schemaVersion: CURRENT_GAME_STATE_SCHEMA_VERSION,
    settlement: emptySettlement,
    weather: testWeather,
    saveId: 'island-a',
    exportedAtUtc: '2026-09-04T00:00:00.000Z',
    spaceStation: { currentLevel: 0, highestLevelAchieved: 0 },
    logisticsZones: [], chickenFarms: [], cropFarms: [], machines: [],
    groundwater: { depletedPumpSpeedPercent: 40, replenishWhenLowPercent: 7 },
    contracts: { established: [], routes: [] },
    productionEntities: [], areaEntities: [], mineTowers: [],
    vehicles: { workersAssigned: 0 },
    research: defaultInfiniteResearchLevels,
    edicts: Object.fromEntries(edictCatalog.map(edict => [edict.id, {
      activeLevel: defaultEdictLevels[edict.id], enabledLevel: defaultEdictLevels[edict.id], inactiveReason: null,
    }])),
    reserves: { fuelGas: 0, gold: 0, sulfur: 0 },
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
