import { edictCatalog, type EdictId, type EdictLevel, mapEdictValues } from './db/edicts'
import {
  emptyInfiniteResearchLevels,
  infiniteResearchCatalog,
  type InfiniteResearchId,
} from './db/research'
import {
  mapReserveResources,
  type ReserveBalances,
  reserveResourceCatalog,
} from './db/reserve-resources'

export const syncedInfrastructureBuildingIds = [
  'electricLocomotiveII',
  'looseStationModuleElectrified',
  'fluidStationModuleElectrified',
  'unitStationModuleElectrified',
  'moltenStationModuleElectrified',
  'oreSortingPlant',
  'oreSortingPlantLarge',
  'stackerTower',
  'trainDepot',
  'vehiclesDepot',
  'vehiclesDepotII',
  'vehiclesDepotIII',
  'maintenanceStatue',
] as const

export type SyncedInfrastructureBuildingId = (typeof syncedInfrastructureBuildingIds)[number]

export const syncedRocketBuildingIds = [
  'rocketAssemblyDepot',
  'rocketLaunchPad',
] as const

export type SyncedRocketBuildingId = (typeof syncedRocketBuildingIds)[number]

export const syncedSolarBuildingIds = ['solarPanel', 'solarPanelMono'] as const

export type SyncedSolarBuildingId = (typeof syncedSolarBuildingIds)[number]

export const syncedBuildingIds = [
  ...syncedInfrastructureBuildingIds,
  ...syncedRocketBuildingIds,
  ...syncedSolarBuildingIds,
] as const

export type SyncedBuildingId = (typeof syncedBuildingIds)[number]

export interface SyncedBuildingCount {
  built: number
  running: number
}

export interface SyncedSpaceStationState {
  currentLevel: number
  highestLevelAchieved: number
  constructionPending: boolean
}

export interface SyncedComputingState {
  dataCenters: SyncedBuildingCount
  racks: SyncedBuildingCount
  waterChillers: SyncedBuildingCount
}

export interface SyncedChickenFarmConfiguration {
  slaughtering: boolean
  built: number
  running: number
  chickens: number
  runningChickens: number
}

export interface SyncedChickenFarmState {
  configurations: SyncedChickenFarmConfiguration[]
}

export interface SyncedCropFarmConfiguration {
  prototypeId: 'FarmT3' | 'FarmT4'
  built: number
  running: number
  fertilityTargetPercent: number
  schedule: (string | null)[]
}

export interface SyncedCropFarmState {
  configurations: SyncedCropFarmConfiguration[]
}

export interface SyncedHistoryAverage {
  averagePerCycle: number
  sampleMonths: number
}

export const syncedHydrogenFuelUseIds = [
  'vehicles',
  'cargoShips',
  'battleShip',
  'powerGenerators',
  'trains',
] as const

export type SyncedHydrogenFuelUseId = (typeof syncedHydrogenFuelUseIds)[number]

export interface SyncedGenerationHistory {
  prototypeId: string
  name: string
  averageMw: number
  sampleMonths: number
}

export type TrainTrafficSeverity = 'clear' | 'warning' | 'critical'

export interface SyncedTrainDelay {
  id: number
  name: string
  state: 'WaitingForFreeTrack' | 'WaitingForSuperBlock' | 'WaitingForBidirectionalSuperBlock'
  blockedForCycles: number
  blockingTrainId: number | null
}

export interface SyncedTrainTraffic {
  totalTrains: number
  activeTrains: number
  waitingForTrack: number
  stuckTrains: number
  criticalThreshold: number
  severity: TrainTrafficSeverity
  sustainedWaitCycles: 1
  trains: SyncedTrainDelay[]
}

export type SyncedResearchLevels = Record<InfiniteResearchId, number>

export interface SyncedEdictState {
  enabledLevel: EdictLevel
  activeLevel: EdictLevel
  inactiveReason: string | null
}

export type SyncedEdictStates = Record<EdictId, SyncedEdictState>

export type SyncedReserves = ReserveBalances

export const ROCKET_INFRASTRUCTURE_SCHEMA_VERSION = 14 as const
export const SPACE_STATION_SCHEMA_VERSION = 15 as const
export const PRODUCTION_CONFIG_SCHEMA_VERSION = 16 as const
export const CURRENT_GAME_STATE_SCHEMA_VERSION = 16 as const
export type SupportedGameStateSchemaVersion =
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | typeof CURRENT_GAME_STATE_SCHEMA_VERSION

export interface GameStateSnapshot {
  schemaVersion: SupportedGameStateSchemaVersion
  exportedAtUtc: string
  buildings: Record<SyncedBuildingId, SyncedBuildingCount>
  spaceStation: SyncedSpaceStationState | null
  computing: SyncedComputingState | null
  chickenFarms: SyncedChickenFarmState | null
  cropFarms: SyncedCropFarmState | null
  vehicles: {
    total: number
    workersAssigned: number
    trucks: number
    excavators: number
    treeHarvesters: number
    treePlanters: number
    quotaUsed: number
    quotaLimit: number
    quotaRemaining: number
  }
  trainTraffic: SyncedTrainTraffic | null
  research: SyncedResearchLevels | null
  edicts: SyncedEdictStates | null
  reserves: SyncedReserves | null
  history: {
    windowMonths: 120
    maintenance: Record<'maintenanceI' | 'maintenanceII' | 'maintenanceIII', SyncedHistoryAverage>
    hydrogenFuel: {
      total: SyncedHistoryAverage
      byUse: Record<SyncedHydrogenFuelUseId, SyncedHistoryAverage>
    }
    electricityGeneration: {
      byType: SyncedGenerationHistory[]
    }
  }
}

export type GameStateConnectionStatus = 'loading' | 'available' | 'missing' | 'error'
export type GameStateDataSource = 'live' | 'cached' | 'none'

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isBuildingCount = (value: unknown): value is SyncedBuildingCount =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.built) &&
  isNonNegativeInteger(value.running) &&
  value.running <= value.built

const isSpaceStationState = (value: unknown): value is SyncedSpaceStationState =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.currentLevel) &&
  isNonNegativeInteger(value.highestLevelAchieved) &&
  value.currentLevel <= value.highestLevelAchieved &&
  typeof value.constructionPending === 'boolean'

const isComputingState = (value: unknown): value is SyncedComputingState =>
  isUnknownRecord(value) &&
  isBuildingCount(value.dataCenters) &&
  isBuildingCount(value.racks) &&
  isBuildingCount(value.waterChillers)

const isChickenFarmConfiguration = (
  value: unknown,
): value is SyncedChickenFarmConfiguration =>
  isUnknownRecord(value) &&
  typeof value.slaughtering === 'boolean' &&
  isNonNegativeInteger(value.built) &&
  isNonNegativeInteger(value.running) &&
  value.running <= value.built &&
  isNonNegativeInteger(value.chickens) &&
  isNonNegativeInteger(value.runningChickens) &&
  value.runningChickens <= value.chickens

const normalizeChickenFarmState = (value: unknown): SyncedChickenFarmState | null => {
  if (!isUnknownRecord(value) || !Array.isArray(value.configurations)) return null

  const configurations = value.configurations.filter(isChickenFarmConfiguration)

  if (
    configurations.length !== value.configurations.length ||
    new Set(configurations.map(({ slaughtering }) => slaughtering)).size !== configurations.length
  ) return null

  return { configurations }
}

const isCropFarmConfiguration = (value: unknown): value is SyncedCropFarmConfiguration =>
  isUnknownRecord(value) &&
  (value.prototypeId === 'FarmT3' || value.prototypeId === 'FarmT4') &&
  isNonNegativeInteger(value.built) &&
  isNonNegativeInteger(value.running) &&
  value.running <= value.built &&
  isNonNegativeInteger(value.fertilityTargetPercent) &&
  value.fertilityTargetPercent <= 200 &&
  Array.isArray(value.schedule) &&
  value.schedule.length === 4 &&
  value.schedule.every(cropId => cropId === null || (
    typeof cropId === 'string' && cropId.length > 0
  ))

const normalizeCropFarmState = (value: unknown): SyncedCropFarmState | null => {
  if (!isUnknownRecord(value) || !Array.isArray(value.configurations)) return null

  const configurations = value.configurations.filter(isCropFarmConfiguration)

  return configurations.length === value.configurations.length ? { configurations } : null
}

type LegacySyncedBuildingId = Exclude<
  SyncedBuildingId,
  | 'rocketAssemblyDepot'
  | 'rocketLaunchPad'
  | 'moltenStationModuleElectrified'
  | 'trainDepot'
  | 'vehiclesDepot'
  | 'vehiclesDepotII'
  | 'vehiclesDepotIII'
>
type CompatibleBuildingCounts = Record<LegacySyncedBuildingId, SyncedBuildingCount> &
  Partial<
    Record<
      | 'rocketAssemblyDepot'
      | 'rocketLaunchPad'
      | 'moltenStationModuleElectrified'
      | 'trainDepot'
      | 'vehiclesDepot'
      | 'vehiclesDepotII'
      | 'vehiclesDepotIII',
      SyncedBuildingCount
    >
  >

const isCompatibleBuildingCounts = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): value is CompatibleBuildingCounts => {
  if (!isUnknownRecord(value)) return false

  return syncedBuildingIds.every(id => {
    const count = value[id]

    const isOptionalLegacyCount =
      (schemaVersion < ROCKET_INFRASTRUCTURE_SCHEMA_VERSION &&
        (id === 'rocketAssemblyDepot' || id === 'rocketLaunchPad')) ||
      (schemaVersion === 6 && id === 'moltenStationModuleElectrified') ||
      (schemaVersion <= 10 && id === 'trainDepot') ||
      (schemaVersion <= 11 &&
        (id === 'vehiclesDepot' || id === 'vehiclesDepotII' || id === 'vehiclesDepotIII'))

    return isOptionalLegacyCount
      ? count === undefined || isBuildingCount(count)
      : isBuildingCount(count)
  })
}

const isHistoryAverage = (value: unknown, windowMonths: number): value is SyncedHistoryAverage => {
  if (!isUnknownRecord(value)) return false

  return (
    isNonNegativeFiniteNumber(value.averagePerCycle) &&
    isNonNegativeInteger(value.sampleMonths) &&
    value.sampleMonths <= windowMonths &&
    (value.sampleMonths > 0 || value.averagePerCycle === 0)
  )
}

const isGenerationHistory = (
  value: unknown,
  windowMonths: number,
): value is SyncedGenerationHistory =>
  isUnknownRecord(value) &&
  typeof value.prototypeId === 'string' &&
  value.prototypeId.length > 0 &&
  typeof value.name === 'string' &&
  value.name.length > 0 &&
  isNonNegativeFiniteNumber(value.averageMw) &&
  isNonNegativeInteger(value.sampleMonths) &&
  value.sampleMonths <= windowMonths &&
  (value.sampleMonths > 0 || value.averageMw === 0)

const trainWaitStates = new Set([
  'WaitingForFreeTrack',
  'WaitingForSuperBlock',
  'WaitingForBidirectionalSuperBlock',
])

const isTrainTraffic = (value: unknown): value is SyncedTrainTraffic => {
  if (
    !isUnknownRecord(value) ||
    !isNonNegativeInteger(value.totalTrains) ||
    !isNonNegativeInteger(value.activeTrains) ||
    value.activeTrains > value.totalTrains ||
    !isNonNegativeInteger(value.waitingForTrack) ||
    value.waitingForTrack > value.activeTrains ||
    !isNonNegativeInteger(value.stuckTrains) ||
    value.stuckTrains > value.waitingForTrack ||
    value.sustainedWaitCycles !== 1 ||
    !Array.isArray(value.trains)
  ) {
    return false
  }

  const expectedThreshold = Math.max(3, Math.ceil(value.activeTrains * 0.1))
  let expectedSeverity: TrainTrafficSeverity = 'clear'

  if (value.stuckTrains >= expectedThreshold) {
    expectedSeverity = 'critical'
  } else if (value.stuckTrains > 0) {
    expectedSeverity = 'warning'
  }

  const validTrains = value.trains.filter(
    (train): train is SyncedTrainDelay =>
      isUnknownRecord(train) &&
      isNonNegativeInteger(train.id) &&
      typeof train.name === 'string' &&
      train.name.length > 0 &&
      typeof train.state === 'string' &&
      trainWaitStates.has(train.state) &&
      isNonNegativeFiniteNumber(train.blockedForCycles) &&
      train.blockedForCycles >= 1 &&
      (train.blockingTrainId === null || isNonNegativeInteger(train.blockingTrainId)),
  )

  return (
    value.criticalThreshold === expectedThreshold &&
    value.severity === expectedSeverity &&
    validTrains.length === Math.min(value.stuckTrains, 8) &&
    validTrains.length === value.trains.length &&
    new Set(validTrains.map(train => train.id)).size === validTrains.length
  )
}

const normalizeResearchLevels = (value: unknown): SyncedResearchLevels | null => {
  if (!isUnknownRecord(value)) return null

  const levels: SyncedResearchLevels = { ...emptyInfiniteResearchLevels }

  for (const research of infiniteResearchCatalog) {
    const level = value[research.id]

    if (!isNonNegativeInteger(level) || level > research.maxLevel) return null

    levels[research.id] = level
  }

  return levels
}

const isEdictLevel = (
  value: unknown,
  levels: readonly { level: EdictLevel }[],
): value is EdictLevel =>
  isNonNegativeInteger(value) && levels.some(candidate => candidate.level === value)

const normalizeEdictStates = (value: unknown): SyncedEdictStates | null => {
  if (!isUnknownRecord(value)) return null

  const states: SyncedEdictStates = mapEdictValues(() => ({
    enabledLevel: 0,
    activeLevel: 0,
    inactiveReason: null,
  }))

  for (const edict of edictCatalog) {
    const state = value[edict.id]

    if (!isUnknownRecord(state)) return null

    const enabledLevel = state.enabledLevel
    const activeLevel = state.activeLevel
    const inactiveReason = state.inactiveReason

    if (
      !isEdictLevel(enabledLevel, edict.levels) ||
      !isEdictLevel(activeLevel, edict.levels) ||
      (inactiveReason !== null && typeof inactiveReason !== 'string')
    ) {
      return null
    }

    states[edict.id] = {
      enabledLevel,
      activeLevel,
      inactiveReason,
    }
  }

  return states
}

const normalizeReserves = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): SyncedReserves | null => {
  if (!isUnknownRecord(value)) return null

  for (const reserve of reserveResourceCatalog) {
    if (schemaVersion < reserve.introducedInSchemaVersion) {
      continue
    }

    const balance = value[reserve.key]

    if (!isNonNegativeInteger(balance)) return null
  }

  return mapReserveResources(({ introducedInSchemaVersion, key }) => {
    const balance = value[key]

    return schemaVersion >= introducedInSchemaVersion && isNonNegativeInteger(balance)
      ? balance
      : null
  })
}

export const normalizeGameStateSnapshot = (value: unknown): GameStateSnapshot | null => {
  if (!isUnknownRecord(value)) return null

  const snapshot = value
  const schemaVersion = snapshot.schemaVersion

  if (
    schemaVersion !== 6 &&
    schemaVersion !== 7 &&
    schemaVersion !== 8 &&
    schemaVersion !== 9 &&
    schemaVersion !== 10 &&
    schemaVersion !== 11 &&
    schemaVersion !== 12 &&
    schemaVersion !== 13 &&
    schemaVersion !== 14 &&
    schemaVersion !== 15 &&
    schemaVersion !== CURRENT_GAME_STATE_SCHEMA_VERSION
  ) {
    return null
  }

  const syncedBuildings = snapshot.buildings
  const spaceStation = isSpaceStationState(snapshot.spaceStation) ? snapshot.spaceStation : null
  const computing = isComputingState(snapshot.computing) ? snapshot.computing : null
  const chickenFarms = normalizeChickenFarmState(snapshot.chickenFarms)
  const cropFarms = normalizeCropFarmState(snapshot.cropFarms)
  const vehicles = isUnknownRecord(snapshot.vehicles) ? snapshot.vehicles : null
  const total = vehicles?.total
  const trucks = vehicles?.trucks
  const workersAssigned = vehicles?.workersAssigned
  const excavators = vehicles?.excavators
  const treeHarvesters = vehicles?.treeHarvesters
  const treePlanters = vehicles?.treePlanters
  const quotaUsed = vehicles?.quotaUsed
  const quotaLimit = vehicles?.quotaLimit
  const quotaRemaining = vehicles?.quotaRemaining
  const trainTraffic = isTrainTraffic(snapshot.trainTraffic) ? snapshot.trainTraffic : null
  const research = normalizeResearchLevels(snapshot.research)
  const edicts = normalizeEdictStates(snapshot.edicts)
  const reserves = normalizeReserves(snapshot.reserves, schemaVersion)
  const history = isUnknownRecord(snapshot.history) ? snapshot.history : null

  if (
    typeof snapshot.exportedAtUtc !== 'string' ||
    Number.isNaN(Date.parse(snapshot.exportedAtUtc)) ||
    !isCompatibleBuildingCounts(syncedBuildings, schemaVersion) ||
    (schemaVersion >= SPACE_STATION_SCHEMA_VERSION && !spaceStation) ||
    (schemaVersion >= PRODUCTION_CONFIG_SCHEMA_VERSION && (
      !computing || !chickenFarms || !cropFarms
    )) ||
    !vehicles ||
    !isNonNegativeInteger(total) ||
    !isNonNegativeInteger(workersAssigned) ||
    workersAssigned > total ||
    !isNonNegativeInteger(trucks) ||
    !isNonNegativeInteger(excavators) ||
    !isNonNegativeInteger(treeHarvesters) ||
    !isNonNegativeInteger(treePlanters) ||
    trucks + excavators + treeHarvesters + treePlanters > total ||
    !isNonNegativeInteger(quotaUsed) ||
    !isNonNegativeInteger(quotaLimit) ||
    !isNonNegativeInteger(quotaRemaining) ||
    quotaUsed + quotaRemaining !== quotaLimit ||
    (schemaVersion >= 8 && !trainTraffic) ||
    (schemaVersion >= 9 && (!research || !edicts)) ||
    (schemaVersion >= 10 && !reserves) ||
    !history ||
    history.windowMonths !== 120
  ) {
    return null
  }

  const maintenance = isUnknownRecord(history.maintenance) ? history.maintenance : null
  const maintenanceI = maintenance?.maintenanceI
  const maintenanceII = maintenance?.maintenanceII
  const maintenanceIII = maintenance?.maintenanceIII
  const hydrogenFuel = isUnknownRecord(history.hydrogenFuel) ? history.hydrogenFuel : null
  const hydrogenFuelByUse = isUnknownRecord(hydrogenFuel?.byUse) ? hydrogenFuel.byUse : null
  const hydrogenTotal = hydrogenFuel?.total
  const hydrogenVehicles = hydrogenFuelByUse?.vehicles
  const hydrogenCargoShips = hydrogenFuelByUse?.cargoShips
  const hydrogenBattleShip = hydrogenFuelByUse?.battleShip
  const hydrogenPowerGenerators = hydrogenFuelByUse?.powerGenerators
  const hydrogenTrains = hydrogenFuelByUse?.trains

  if (
    !isHistoryAverage(maintenanceI, 120) ||
    !isHistoryAverage(maintenanceII, 120) ||
    !isHistoryAverage(maintenanceIII, 120) ||
    !isHistoryAverage(hydrogenTotal, 120) ||
    !isHistoryAverage(hydrogenVehicles, 120) ||
    !isHistoryAverage(hydrogenCargoShips, 120) ||
    !isHistoryAverage(hydrogenBattleShip, 120) ||
    !isHistoryAverage(hydrogenPowerGenerators, 120) ||
    !isHistoryAverage(hydrogenTrains, 120)
  ) {
    return null
  }

  const electricityGeneration = isUnknownRecord(history.electricityGeneration)
    ? history.electricityGeneration
    : null
  const generationByType = Array.isArray(electricityGeneration?.byType)
    ? electricityGeneration.byType
    : null

  if (!generationByType) return null

  const validGenerationByType = generationByType.filter(
    (generation): generation is SyncedGenerationHistory => isGenerationHistory(generation, 120),
  )

  if (
    validGenerationByType.length !== generationByType.length ||
    new Set(validGenerationByType.map(generation => generation.prototypeId)).size !==
      validGenerationByType.length
  ) {
    return null
  }

  return {
    schemaVersion,
    exportedAtUtc: snapshot.exportedAtUtc,
    buildings: {
      ...syncedBuildings,
      rocketAssemblyDepot: syncedBuildings.rocketAssemblyDepot ?? {
        built: 0,
        running: 0,
      },
      rocketLaunchPad: syncedBuildings.rocketLaunchPad ?? {
        built: 0,
        running: 0,
      },
      moltenStationModuleElectrified: syncedBuildings.moltenStationModuleElectrified ?? {
        built: 0,
        running: 0,
      },
      trainDepot: syncedBuildings.trainDepot ?? {
        built: 0,
        running: 0,
      },
      vehiclesDepot: syncedBuildings.vehiclesDepot ?? {
        built: 0,
        running: 0,
      },
      vehiclesDepotII: syncedBuildings.vehiclesDepotII ?? {
        built: 0,
        running: 0,
      },
      vehiclesDepotIII: syncedBuildings.vehiclesDepotIII ?? {
        built: 0,
        running: 0,
      },
    },
    spaceStation: schemaVersion >= SPACE_STATION_SCHEMA_VERSION ? spaceStation : null,
    computing: schemaVersion >= PRODUCTION_CONFIG_SCHEMA_VERSION ? computing : null,
    chickenFarms: schemaVersion >= PRODUCTION_CONFIG_SCHEMA_VERSION ? chickenFarms : null,
    cropFarms: schemaVersion >= PRODUCTION_CONFIG_SCHEMA_VERSION ? cropFarms : null,
    vehicles: {
      total,
      workersAssigned,
      trucks,
      excavators,
      treeHarvesters,
      treePlanters,
      quotaUsed,
      quotaLimit,
      quotaRemaining,
    },
    trainTraffic,
    research: schemaVersion >= 9 ? research : null,
    edicts: schemaVersion >= 9 ? edicts : null,
    reserves: schemaVersion >= 10 ? reserves : null,
    history: {
      windowMonths: 120,
      maintenance: { maintenanceI, maintenanceII, maintenanceIII },
      hydrogenFuel: {
        total: hydrogenTotal,
        byUse: {
          vehicles: hydrogenVehicles,
          cargoShips: hydrogenCargoShips,
          battleShip: hydrogenBattleShip,
          powerGenerators: hydrogenPowerGenerators,
          trains: hydrogenTrains,
        },
      },
      electricityGeneration: { byType: validGenerationByType },
    },
  }
}

export const isGameStateSnapshot = (value: unknown): boolean =>
  normalizeGameStateSnapshot(value) !== null
