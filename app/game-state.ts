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
  'captainOfficeI',
  'captainOfficeII',
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
  entities: SyncedChickenFarmEntity[]
}

export interface SyncedChickenFarmEntity {
  entityId: number
  prototypeId: 'ChickenFarm'
  running: boolean
  slaughtering: boolean
  chickens: number
  zones: SyncedLogisticsZoneRef[]
}

export interface SyncedCropFarmConfiguration {
  prototypeId: 'FarmT3' | 'FarmT4'
  built: number
  running: number
  fertilityTargetPercent: number
  schedule: (string | null)[]
}

export interface SyncedCropFarmEntity {
  entityId: number
  prototypeId: 'FarmT3' | 'FarmT4'
  running: boolean
  fertilityTargetPercent: number
  schedule: (string | null)[]
  zones?: SyncedLogisticsZoneRef[]
}

export interface SyncedCropFarmState {
  configurations: SyncedCropFarmConfiguration[]
  entities: SyncedCropFarmEntity[]
}

export interface SyncedMachineInventoryItem {
  entityId: number
  kind: 'groundwater-pump'
  prototypeId: string
  running: boolean
  customTitle: string | null
  tile: {
    x: number
    y: number
  }
  zones: SyncedLogisticsZoneRef[]
  aquifer: SyncedGroundwaterAquifer | null
}

export interface SyncedGroundwaterAquifer {
  id: string
  position: {
    x: number
    y: number
  }
  quantity: number
  capacity: number
  configuredCapacity: number
}

export interface SyncedGroundwaterState {
  depletedPumpSpeedPercent: number
  replenishWhenLowPercent: number
}

export interface SyncedNuclearReactorConfiguration {
  enrichmentStep: number
  targetPowerPercent: number
}

export interface SyncedProductRef {
  productId: string
  name: string
}

export interface SyncedTrainStationConfiguration {
  isForLoading: boolean
  selectedProduct: SyncedProductRef | null
}

export interface SyncedOreSorterProduct extends SyncedProductRef {
  /** Whether the game's terrain-conversion loss applies to this material. */
  canBeWasted: boolean
  sortedLastCycle: number
}

export interface SyncedOreSorterConfiguration {
  /** Effective focus-adjusted mixed input capacity per 60-second production cycle. */
  throughputPerCycle: number
  conversionLossPercent: number
  products: SyncedOreSorterProduct[]
}

/** Mine-tower inventory is provenance only; vehicles do not determine throughput. */
export interface SyncedMineTower {
  entityId: number
  assignedOreSorterEntityIds: number[]
}

/**
 * Stable, recipe-aware physical building identity exported for module binding.
 * The payload is intentionally module-neutral; vehicle-zone ownership decides
 * which calculator module may consume an entity.
 */
export interface SyncedProductionEntity {
  entityId: number
  prototypeId: string
  running: boolean
  recipeIds: string[]
  zones: SyncedLogisticsZoneRef[]
  nuclearReactor: SyncedNuclearReactorConfiguration | null
  dataCenterRacks?: number | null
  /** Present in schema 29 and newer. */
  trainStation?: SyncedTrainStationConfiguration | null
}

export interface SyncedAreaRecipeProduct {
  productId: string
  name: string
  quantity: number
}

export interface SyncedAreaRecipe {
  id: string
  name: string
  durationSeconds: number
  assigned: boolean
  inputs: SyncedAreaRecipeProduct[]
  outputs: SyncedAreaRecipeProduct[]
}

export type SyncedConstructionState =
  | 'NotInitialized'
  | 'NotStarted'
  | 'InConstruction'
  | 'Constructed'
  | 'PreparingUpgrade'
  | 'BeingUpgraded'
  | 'PendingDeconstruction'
  | 'InDeconstruction'
  | 'Deconstructed'
  | 'Invalid'

/** Runtime recipe and construction identity for a building inside a named game area. */
export interface SyncedAreaEntity {
  entityId: number
  prototypeId: string
  prototypeName: string
  constructionState: SyncedConstructionState
  constructed: boolean
  running: boolean
  tile: {
    x: number
    y: number
  }
  zones: SyncedLogisticsZoneRef[]
  recipes: SyncedAreaRecipe[]
  /** Present for ore sorting plants in schema 31 and newer. */
  oreSorter?: SyncedOreSorterConfiguration | null
  /** Present in schema 29 and newer. */
  trainStation?: SyncedTrainStationConfiguration | null
}

export interface SyncedLogisticsZoneRef {
  id: number
  name: string | null
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
export const MACHINE_INVENTORY_SCHEMA_VERSION = 17 as const
export const MACHINE_ZONE_SCHEMA_VERSION = 18 as const
export const CROP_FARM_ENTITY_SCHEMA_VERSION = 19 as const
export const CHICKEN_FARM_ENTITY_SCHEMA_VERSION = 20 as const
export const SAVE_ID_SCHEMA_VERSION = 21 as const
export const PRODUCTION_ENTITY_SCHEMA_VERSION = 22 as const
export const COMPUTING_ENTITY_SCHEMA_VERSION = 23 as const
export const AREA_INVENTORY_SCHEMA_VERSION = 24 as const
export const NAMED_AREA_ENTITY_SCHEMA_VERSION = 25 as const
export const GROUNDWATER_RESERVE_SCHEMA_VERSION = 26 as const
export const MAINTENANCE_ENTITY_SCHEMA_VERSION = 27 as const
export const AREA_GHOST_SCHEMA_VERSION = 28 as const
export const TRAIN_STATION_PRODUCT_SCHEMA_VERSION = 29 as const
export const CAPTAIN_OFFICE_SCHEMA_VERSION = 30 as const
export const TERRAIN_SORTER_SCHEMA_VERSION = 31 as const
export const CURRENT_GAME_STATE_SCHEMA_VERSION = 31 as const
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
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | typeof CURRENT_GAME_STATE_SCHEMA_VERSION

export interface GameStateSnapshot {
  schemaVersion: SupportedGameStateSchemaVersion
  saveId: string | null
  exportedAtUtc: string
  buildings: Record<SyncedBuildingId, SyncedBuildingCount>
  spaceStation: SyncedSpaceStationState | null
  computing: SyncedComputingState | null
  logisticsZones: SyncedLogisticsZoneRef[]
  chickenFarms: SyncedChickenFarmState | null
  cropFarms: SyncedCropFarmState | null
  machines: SyncedMachineInventoryItem[]
  groundwater: SyncedGroundwaterState | null
  productionEntities: SyncedProductionEntity[] | null
  areaEntities: SyncedAreaEntity[]
  mineTowers: SyncedMineTower[]
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

const isLogisticsZoneRef = (value: unknown): value is SyncedLogisticsZoneRef =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.id) &&
  (value.name === null || typeof value.name === 'string')

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

const isChickenFarmEntity = (value: unknown): value is SyncedChickenFarmEntity =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.entityId) &&
  value.prototypeId === 'ChickenFarm' &&
  typeof value.running === 'boolean' &&
  typeof value.slaughtering === 'boolean' &&
  isNonNegativeInteger(value.chickens) &&
  Array.isArray(value.zones) &&
  value.zones.every(isLogisticsZoneRef) &&
  new Set(value.zones.map(zone => zone.id)).size === value.zones.length

const normalizeChickenFarmState = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): SyncedChickenFarmState | null => {
  if (!isUnknownRecord(value) || !Array.isArray(value.configurations)) return null

  const configurations = value.configurations.filter(isChickenFarmConfiguration)

  if (
    configurations.length !== value.configurations.length ||
    new Set(configurations.map(({ slaughtering }) => slaughtering)).size !== configurations.length
  ) return null

  if (schemaVersion < CHICKEN_FARM_ENTITY_SCHEMA_VERSION) {
    return { configurations, entities: [] }
  }

  if (!Array.isArray(value.entities)) return null

  const entities = value.entities.filter(isChickenFarmEntity)

  if (
    entities.length !== value.entities.length
    || new Set(entities.map(({ entityId }) => entityId)).size !== entities.length
  ) return null

  for (const configuration of configurations) {
    const matching = entities.filter(entity => (
      entity.slaughtering === configuration.slaughtering
    ))
    const running = matching.filter(entity => entity.running)

    if (
      matching.length !== configuration.built
      || running.length !== configuration.running
      || matching.reduce((total, entity) => total + entity.chickens, 0)
        !== configuration.chickens
      || running.reduce((total, entity) => total + entity.chickens, 0)
        !== configuration.runningChickens
    ) return null
  }

  if (entities.length !== configurations.reduce((total, item) => total + item.built, 0)) {
    return null
  }

  return { configurations, entities }
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

const isCropFarmEntity = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): value is SyncedCropFarmEntity =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.entityId) &&
  (value.prototypeId === 'FarmT3' || value.prototypeId === 'FarmT4') &&
  typeof value.running === 'boolean' &&
  isNonNegativeInteger(value.fertilityTargetPercent) &&
  value.fertilityTargetPercent <= 200 &&
  Array.isArray(value.schedule) &&
  value.schedule.length === 4 &&
  value.schedule.every(cropId => cropId === null || (
    typeof cropId === 'string' && cropId.length > 0
  )) &&
  (
    schemaVersion < AREA_INVENTORY_SCHEMA_VERSION ||
    (
      Array.isArray(value.zones) &&
      value.zones.every(isLogisticsZoneRef) &&
      new Set(value.zones.map(zone => zone.id)).size === value.zones.length
    )
  )

const normalizeCropFarmState = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): SyncedCropFarmState | null => {
  if (!isUnknownRecord(value) || !Array.isArray(value.configurations)) return null

  const configurations = value.configurations.filter(isCropFarmConfiguration)

  if (configurations.length !== value.configurations.length) return null

  if (schemaVersion < CROP_FARM_ENTITY_SCHEMA_VERSION) {
    return { configurations, entities: [] }
  }

  if (!Array.isArray(value.entities)) return null

  const entities = value.entities.filter(entity => isCropFarmEntity(entity, schemaVersion))

  if (
    entities.length !== value.entities.length
    || new Set(entities.map(({ entityId }) => entityId)).size !== entities.length
  ) return null

  const configurationCounts = new Map(configurations.map(configuration => [
    JSON.stringify([
      configuration.prototypeId,
      configuration.schedule,
      configuration.fertilityTargetPercent,
    ]),
    { built: configuration.built, running: configuration.running },
  ]))
  const entityCounts = new Map<string, { built: number; running: number }>()

  for (const entity of entities) {
    const key = JSON.stringify([
      entity.prototypeId,
      entity.schedule,
      entity.fertilityTargetPercent,
    ])
    const count = entityCounts.get(key) ?? { built: 0, running: 0 }

    count.built++
    count.running += Number(entity.running)
    entityCounts.set(key, count)
  }

  if (
    configurationCounts.size !== entityCounts.size
    || [...configurationCounts].some(([key, count]) => {
      const entityCount = entityCounts.get(key)

      return !entityCount
        || entityCount.built !== count.built
        || entityCount.running !== count.running
    })
  ) return null

  return {
    configurations,
    entities: schemaVersion >= AREA_INVENTORY_SCHEMA_VERSION
      ? entities
      : entities.map(entity => ({ ...entity, zones: [] })),
  }
}

const normalizeLogisticsZones = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): SyncedLogisticsZoneRef[] | null => {
  if (schemaVersion < AREA_INVENTORY_SCHEMA_VERSION) return []
  if (!Array.isArray(value)) return null

  const zones = value.filter(isLogisticsZoneRef)

  return zones.length === value.length &&
      new Set(zones.map(zone => zone.id)).size === zones.length
    ? zones
    : null
}

const isMachineInventoryItem = (
  value: unknown,
): value is Omit<SyncedMachineInventoryItem, 'aquifer' | 'zones'> & {
  aquifer?: unknown
  zones?: unknown
} =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.entityId) &&
  value.kind === 'groundwater-pump' &&
  typeof value.prototypeId === 'string' &&
  value.prototypeId.length > 0 &&
  typeof value.running === 'boolean' &&
  (value.customTitle === null || typeof value.customTitle === 'string') &&
  isUnknownRecord(value.tile) &&
  typeof value.tile.x === 'number' &&
  Number.isInteger(value.tile.x) &&
  typeof value.tile.y === 'number' &&
  Number.isInteger(value.tile.y)

const isGroundwaterAquifer = (value: unknown): value is SyncedGroundwaterAquifer =>
  isUnknownRecord(value) &&
  typeof value.id === 'string' &&
  value.id.length > 0 &&
  isUnknownRecord(value.position) &&
  typeof value.position.x === 'number' &&
  Number.isInteger(value.position.x) &&
  typeof value.position.y === 'number' &&
  Number.isInteger(value.position.y) &&
  value.id === `${value.position.x}:${value.position.y}` &&
  isNonNegativeInteger(value.quantity) &&
  isNonNegativeInteger(value.capacity) &&
  value.capacity > 0 &&
  value.quantity <= value.capacity &&
  isNonNegativeInteger(value.configuredCapacity) &&
  value.configuredCapacity > 0

const isGroundwaterState = (value: unknown): value is SyncedGroundwaterState =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.depletedPumpSpeedPercent) &&
  value.depletedPumpSpeedPercent <= 100 &&
  isNonNegativeInteger(value.replenishWhenLowPercent) &&
  value.replenishWhenLowPercent <= 100

const normalizeMachineInventory = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): SyncedMachineInventoryItem[] | null => {
  if (!Array.isArray(value)) return null

  const machines: SyncedMachineInventoryItem[] = []

  for (const machine of value) {
    if (!isMachineInventoryItem(machine)) return null

    const rawZones = machine.zones
    const zones = schemaVersion >= MACHINE_ZONE_SCHEMA_VERSION
      && Array.isArray(rawZones)
      ? rawZones.filter(isLogisticsZoneRef)
      : []

    if (
      schemaVersion >= MACHINE_ZONE_SCHEMA_VERSION
      && (
        !Array.isArray(rawZones)
        || zones.length !== rawZones.length
        || new Set(zones.map(({ id }) => id)).size !== zones.length
      )
    ) return null

    const aquifer = schemaVersion >= GROUNDWATER_RESERVE_SCHEMA_VERSION
      && isGroundwaterAquifer(machine.aquifer)
      ? machine.aquifer
      : null

    if (schemaVersion >= GROUNDWATER_RESERVE_SCHEMA_VERSION && !aquifer) return null

    machines.push({ ...machine, aquifer, zones })
  }

  if (new Set(machines.map(({ entityId }) => entityId)).size !== machines.length) return null

  const aquifers = new Map<string, SyncedGroundwaterAquifer>()

  for (const { aquifer } of machines) {
    if (!aquifer) continue

    const existing = aquifers.get(aquifer.id)

    if (existing && (
      existing.quantity !== aquifer.quantity
      || existing.capacity !== aquifer.capacity
      || existing.configuredCapacity !== aquifer.configuredCapacity
      || existing.position.x !== aquifer.position.x
      || existing.position.y !== aquifer.position.y
    )) return null

    aquifers.set(aquifer.id, aquifer)
  }

  return machines
}

const isNuclearReactorConfiguration = (
  value: unknown,
): value is SyncedNuclearReactorConfiguration =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.enrichmentStep) &&
  value.enrichmentStep <= 2 &&
  isNonNegativeInteger(value.targetPowerPercent) &&
  value.targetPowerPercent <= 400

const trainStationPrototypeIds = new Set([
  'TrainStationFluid_ELEC',
  'TrainStationLoose_ELEC',
  'TrainStationMolten_ELEC',
  'TrainStationUnit_ELEC',
])

const isProductRef = (value: unknown): value is SyncedProductRef =>
  isUnknownRecord(value) &&
  typeof value.productId === 'string' &&
  value.productId.length > 0 &&
  typeof value.name === 'string' &&
  value.name.length > 0

const isTrainStationConfiguration = (
  value: unknown,
): value is SyncedTrainStationConfiguration =>
  isUnknownRecord(value) &&
  typeof value.isForLoading === 'boolean' &&
  (value.selectedProduct === null || isProductRef(value.selectedProduct))

const hasValidTrainStationConfiguration = (
  value: Record<string, unknown>,
  schemaVersion: SupportedGameStateSchemaVersion,
) => {
  if (schemaVersion < TRAIN_STATION_PRODUCT_SCHEMA_VERSION) return true

  return trainStationPrototypeIds.has(String(value.prototypeId))
    ? value.trainStation === null || isTrainStationConfiguration(value.trainStation)
    : value.trainStation === null
}

const isProductionEntity = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): value is SyncedProductionEntity =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.entityId) &&
  typeof value.prototypeId === 'string' &&
  value.prototypeId.length > 0 &&
  typeof value.running === 'boolean' &&
  Array.isArray(value.recipeIds) &&
  value.recipeIds.every(recipeId => typeof recipeId === 'string' && recipeId.length > 0) &&
  new Set(value.recipeIds).size === value.recipeIds.length &&
  Array.isArray(value.zones) &&
  value.zones.every(isLogisticsZoneRef) &&
  new Set(value.zones.map(zone => zone.id)).size === value.zones.length &&
  (value.prototypeId === 'FastBreederReactor'
    ? isNuclearReactorConfiguration(value.nuclearReactor)
    : value.nuclearReactor === null) &&
  (
    schemaVersion < COMPUTING_ENTITY_SCHEMA_VERSION ||
    (value.prototypeId === 'DataCenter' && isNonNegativeInteger(value.dataCenterRacks)) ||
    (value.prototypeId !== 'DataCenter' && value.dataCenterRacks === null)
  ) &&
  hasValidTrainStationConfiguration(value, schemaVersion)

const normalizeProductionEntities = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): SyncedProductionEntity[] | null => {
  if (schemaVersion < PRODUCTION_ENTITY_SCHEMA_VERSION) return null
  if (!Array.isArray(value)) return null

  const entities = value.filter(entity => isProductionEntity(entity, schemaVersion))

  return entities.length === value.length &&
      new Set(entities.map(entity => entity.entityId)).size === entities.length
    ? entities
    : null
}

const constructionStates = new Set<string>([
  'NotInitialized',
  'NotStarted',
  'InConstruction',
  'Constructed',
  'PreparingUpgrade',
  'BeingUpgraded',
  'PendingDeconstruction',
  'InDeconstruction',
  'Deconstructed',
  'Invalid',
])

const isAreaRecipeProduct = (value: unknown): value is SyncedAreaRecipeProduct =>
  isUnknownRecord(value) &&
  typeof value.productId === 'string' &&
  value.productId.length > 0 &&
  typeof value.name === 'string' &&
  value.name.length > 0 &&
  isNonNegativeInteger(value.quantity)

const isAreaRecipe = (value: unknown): value is SyncedAreaRecipe => {
  if (
    !isUnknownRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.name !== 'string' ||
    value.name.length === 0 ||
    !isNonNegativeFiniteNumber(value.durationSeconds) ||
    value.durationSeconds <= 0 ||
    typeof value.assigned !== 'boolean' ||
    !Array.isArray(value.inputs) ||
    !Array.isArray(value.outputs)
  ) return false

  const inputs = value.inputs.filter(isAreaRecipeProduct)
  const outputs = value.outputs.filter(isAreaRecipeProduct)

  return inputs.length === value.inputs.length &&
    outputs.length === value.outputs.length &&
    new Set(inputs.map(input => input.productId)).size === inputs.length &&
    new Set(outputs.map(output => output.productId)).size === outputs.length
}

const oreSorterPrototypeIds = new Set(['OreSortingPlantT1', 'OreSortingPlantT2'])

const isOreSorterProduct = (value: unknown): value is SyncedOreSorterProduct => (
  isUnknownRecord(value) &&
  typeof value.productId === 'string' &&
  value.productId.length > 0 &&
  typeof value.name === 'string' &&
  value.name.length > 0 &&
  typeof value.canBeWasted === 'boolean' &&
  isNonNegativeInteger(value.sortedLastCycle)
)

const isOreSorterConfiguration = (
  value: unknown,
): value is SyncedOreSorterConfiguration => {
  if (
    !isUnknownRecord(value) ||
    !isNonNegativeFiniteNumber(value.throughputPerCycle) ||
    value.throughputPerCycle <= 0 ||
    !isNonNegativeInteger(value.conversionLossPercent) ||
    value.conversionLossPercent > 100 ||
    !Array.isArray(value.products)
  ) return false

  const products = value.products.filter(isOreSorterProduct)

  return products.length === value.products.length &&
    new Set(products.map(product => product.productId)).size === products.length
}

const isAreaEntity = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): value is SyncedAreaEntity => {
  if (
    !isUnknownRecord(value) ||
    !isNonNegativeInteger(value.entityId) ||
    typeof value.prototypeId !== 'string' ||
    value.prototypeId.length === 0 ||
    typeof value.prototypeName !== 'string' ||
    value.prototypeName.length === 0 ||
    typeof value.constructionState !== 'string' ||
    !constructionStates.has(value.constructionState) ||
    typeof value.constructed !== 'boolean' ||
    typeof value.running !== 'boolean' ||
    (value.running && !value.constructed) ||
    !isUnknownRecord(value.tile) ||
    typeof value.tile.x !== 'number' ||
    !Number.isInteger(value.tile.x) ||
    typeof value.tile.y !== 'number' ||
    !Number.isInteger(value.tile.y) ||
    !Array.isArray(value.zones) ||
    !Array.isArray(value.recipes)
  ) return false

  const zones = value.zones.filter(isLogisticsZoneRef)
  const recipes = value.recipes.filter(isAreaRecipe)

  return zones.length === value.zones.length &&
    recipes.length === value.recipes.length &&
    new Set(zones.map(zone => zone.id)).size === zones.length &&
    new Set(recipes.map(recipe => recipe.id)).size === recipes.length &&
    (
      schemaVersion < TERRAIN_SORTER_SCHEMA_VERSION ||
      (oreSorterPrototypeIds.has(value.prototypeId)
        ? isOreSorterConfiguration(value.oreSorter)
        : value.oreSorter === null)
    ) &&
    hasValidTrainStationConfiguration(value, schemaVersion)
}

const normalizeAreaEntities = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): SyncedAreaEntity[] | null => {
  if (schemaVersion < AREA_GHOST_SCHEMA_VERSION) return []
  if (!Array.isArray(value)) return null

  const entities = value.filter(entity => isAreaEntity(entity, schemaVersion))

  return entities.length === value.length &&
    new Set(entities.map(entity => entity.entityId)).size === entities.length
    ? entities
    : null
}

const normalizeMineTowers = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): SyncedMineTower[] | null => {
  if (schemaVersion < TERRAIN_SORTER_SCHEMA_VERSION) return []
  if (!Array.isArray(value)) return null

  const towers: SyncedMineTower[] = []
  const assignedSorterIds = new Set<number>()

  for (const candidate of value) {
    if (
      !isUnknownRecord(candidate) ||
      !isNonNegativeInteger(candidate.entityId) ||
      !Array.isArray(candidate.assignedOreSorterEntityIds) ||
      !candidate.assignedOreSorterEntityIds.every(isNonNegativeInteger) ||
      new Set(candidate.assignedOreSorterEntityIds).size !==
        candidate.assignedOreSorterEntityIds.length ||
      candidate.assignedOreSorterEntityIds.some(entityId => assignedSorterIds.has(entityId))
    ) return null

    candidate.assignedOreSorterEntityIds.forEach(entityId => assignedSorterIds.add(entityId))
    towers.push({
      entityId: candidate.entityId,
      assignedOreSorterEntityIds: candidate.assignedOreSorterEntityIds,
    })
  }

  return new Set(towers.map(tower => tower.entityId)).size === towers.length
    ? towers
    : null
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
  | 'captainOfficeI'
  | 'captainOfficeII'
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
      | 'vehiclesDepotIII'
      | 'captainOfficeI'
      | 'captainOfficeII',
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
        (id === 'vehiclesDepot' || id === 'vehiclesDepotII' || id === 'vehiclesDepotIII')) ||
      (schemaVersion < CAPTAIN_OFFICE_SCHEMA_VERSION &&
        (id === 'captainOfficeI' || id === 'captainOfficeII'))

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
    schemaVersion !== 16 &&
    schemaVersion !== 17 &&
    schemaVersion !== 18 &&
    schemaVersion !== 19 &&
    schemaVersion !== 20 &&
    schemaVersion !== 21 &&
    schemaVersion !== 22 &&
    schemaVersion !== 23 &&
    schemaVersion !== 24 &&
    schemaVersion !== 25 &&
    schemaVersion !== 26 &&
    schemaVersion !== 27 &&
    schemaVersion !== 28 &&
    schemaVersion !== 29 &&
    schemaVersion !== 30 &&
    schemaVersion !== CURRENT_GAME_STATE_SCHEMA_VERSION
  ) {
    return null
  }

  const syncedBuildings = snapshot.buildings
  const saveId = typeof snapshot.saveId === 'string' && snapshot.saveId.trim().length > 0
    ? snapshot.saveId
    : null
  const spaceStation = isSpaceStationState(snapshot.spaceStation) ? snapshot.spaceStation : null
  const computing = isComputingState(snapshot.computing) ? snapshot.computing : null
  const logisticsZones = normalizeLogisticsZones(snapshot.logisticsZones, schemaVersion)
  const chickenFarms = normalizeChickenFarmState(snapshot.chickenFarms, schemaVersion)
  const cropFarms = normalizeCropFarmState(snapshot.cropFarms, schemaVersion)
  const machines = normalizeMachineInventory(snapshot.machines, schemaVersion)
  const groundwater = isGroundwaterState(snapshot.groundwater)
    ? snapshot.groundwater
    : null
  const productionEntities = normalizeProductionEntities(
    snapshot.productionEntities,
    schemaVersion,
  )
  const areaEntities = normalizeAreaEntities(snapshot.areaEntities, schemaVersion)
  const mineTowers = normalizeMineTowers(snapshot.mineTowers, schemaVersion)
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
    !logisticsZones ||
    (schemaVersion >= MACHINE_INVENTORY_SCHEMA_VERSION && !machines) ||
    (schemaVersion >= GROUNDWATER_RESERVE_SCHEMA_VERSION && !groundwater) ||
    (schemaVersion >= SAVE_ID_SCHEMA_VERSION && !saveId) ||
    (schemaVersion >= PRODUCTION_ENTITY_SCHEMA_VERSION && !productionEntities) ||
    (schemaVersion >= AREA_GHOST_SCHEMA_VERSION && !areaEntities) ||
    (schemaVersion >= TERRAIN_SORTER_SCHEMA_VERSION && !mineTowers) ||
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
    saveId: schemaVersion >= SAVE_ID_SCHEMA_VERSION ? saveId : null,
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
      captainOfficeI: syncedBuildings.captainOfficeI ?? {
        built: 0,
        running: 0,
      },
      captainOfficeII: syncedBuildings.captainOfficeII ?? {
        built: 0,
        running: 0,
      },
    },
    spaceStation: schemaVersion >= SPACE_STATION_SCHEMA_VERSION ? spaceStation : null,
    computing: schemaVersion >= PRODUCTION_CONFIG_SCHEMA_VERSION ? computing : null,
    logisticsZones,
    chickenFarms: schemaVersion >= PRODUCTION_CONFIG_SCHEMA_VERSION ? chickenFarms : null,
    cropFarms: schemaVersion >= PRODUCTION_CONFIG_SCHEMA_VERSION ? cropFarms : null,
    machines: schemaVersion >= MACHINE_INVENTORY_SCHEMA_VERSION ? (machines ?? []) : [],
    groundwater: schemaVersion >= GROUNDWATER_RESERVE_SCHEMA_VERSION ? groundwater : null,
    productionEntities,
    areaEntities: areaEntities ?? [],
    mineTowers: mineTowers ?? [],
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
