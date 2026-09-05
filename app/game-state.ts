import { edictCatalog, type EdictId, type EdictLevel, mapEdictValues } from './db/edicts'
import {
  emptyInfiniteResearchLevels,
  infiniteResearchCatalog,
  type InfiniteResearchId,
} from './db/research'
import { type ReserveBalances } from './db/reserve-resources'
import { isWeatherConfig, type WeatherConfig } from './db/weather'
import { isSyncedSettlementState, type SyncedSettlementState } from './settlement-state'

interface SyncedSpaceStationState {
  currentLevel: number
  highestLevelAchieved: number
}

export interface SyncedChickenFarmEntity {
  entityId: number
  prototypeId: 'ChickenFarm'
  running: boolean
  slaughtering: boolean
  chickens: number
  zones: SyncedLogisticsZoneRef[]
}

type SyncedCropFarmFertilizerProductId =
  | 'Product_FertilizerOrganic'
  | 'Product_Fertilizer'
  | 'Product_Fertilizer2'

export interface SyncedCropFarmEntity {
  entityId: number
  prototypeId: 'FarmT3' | 'FarmT4'
  running: boolean
  fertilityTargetPercent: number
  /** Supplied fertilizer product. Present in schema 33 and newer. */
  fertilizerProductId?: SyncedCropFarmFertilizerProductId | null
  schedule: (string | null)[]
  zones?: SyncedLogisticsZoneRef[]
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

interface SyncedNuclearReactorConfiguration {
  enrichmentStep: number
  targetPowerPercent: number
}

interface SyncedProductRef {
  productId: string
  name: string
}

interface SyncedEstablishedContract {
  gameId: string
  exportedProduct: SyncedProductRef
  exportedQuantity: number
  importedProduct: SyncedProductRef
  importedQuantity: number
  unityPerCycle: number
  unityPer100Imported: number
  unityToEstablish: number
  minimumReputation: number
}

interface SyncedContractModule {
  entityId: number
  slot: number
  prototypeId: string
  prototypeName: string
  running: boolean
  workers: number
  selectedProduct: SyncedProductRef | null
  direction: 'import' | 'export' | null
  onboardCapacity: number
}

interface SyncedContractShip {
  entityId: number
  prototypeId: string
  prototypeName: string
  running: boolean
  workers: number
  fuelProduct: SyncedProductRef
  saveFuel: boolean
  journeyDurationSeconds: number | null
  fuelPerTrip: number | null
}

export interface SyncedContractRoute {
  depotEntityId: number
  depotPrototypeId: string
  depotPrototypeName: string
  depotCustomTitle: string | null
  running: boolean
  slotCount: number
  contractGameId: string
  zones: SyncedLogisticsZoneRef[]
  modules: SyncedContractModule[]
  ship: SyncedContractShip | null
}

export interface SyncedContractState {
  established: SyncedEstablishedContract[]
  routes: SyncedContractRoute[]
}

export interface SyncedTrainStationConfiguration {
  isForLoading: boolean
  selectedProduct: SyncedProductRef | null
}

interface SyncedOreSorterProduct extends SyncedProductRef {
  /** Whether the game's terrain-conversion loss applies to this material. */
  canBeWasted: boolean
}

interface SyncedOreSorterConfiguration {
  /** Effective focus-adjusted mixed input capacity per 60-second production cycle. */
  throughputPerCycle: number
  conversionLossPercent: number
  products: SyncedOreSorterProduct[]
}

interface SyncedForestryProduct extends SyncedProductRef {
  /** Sustainable output from the currently managed trees per production cycle. */
  quantityPerCycle: number
}

interface SyncedForestryConfiguration {
  treeCount: number
  cuttingEnabled: boolean
  targetHarvestPercent: number
  /** Sustainable tree replacements required per production cycle. */
  harvestsPerCycle: number
  /** Equivalent configured growth time. Null when the tower has no sustainable output. */
  harvestDurationMonths: number | null
  outputs: SyncedForestryProduct[]
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

interface SyncedAreaRecipeProduct {
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

type SyncedConstructionState =
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
  /** Total recipes offered by the machine. Present when schema 38 compacts unselected recipes. */
  availableRecipeCount?: number
  /** Present for ore sorting plants in schema 31 and newer. */
  oreSorter?: SyncedOreSorterConfiguration | null
  /** Present in schema 29 and newer. */
  trainStation?: SyncedTrainStationConfiguration | null
  /** Present for Forestry control towers in schema 34 and newer. */
  forestry?: SyncedForestryConfiguration | null
  /** Present for Office I–III buildings in schema 37 and newer. */
  office?: SyncedOfficeConfiguration | null
}

interface SyncedOfficeConfiguration {
  computingBoostStep: 0 | 1 | 2
}

export interface SyncedLogisticsZoneRef {
  id: number
  name: string | null
}

interface SyncedHistoryAverage {
  averagePerCycle: number
  sampleMonths: number
}

const syncedHydrogenFuelUseIds = [
  'vehicles',
  'cargoShips',
  'battleShip',
  'powerGenerators',
  'trains',
] as const

type SyncedHydrogenFuelUseId = (typeof syncedHydrogenFuelUseIds)[number]

interface SyncedGenerationHistory {
  prototypeId: string
  name: string
  averageMw: number
  sampleMonths: number
}

type SyncedResearchLevels = Record<InfiniteResearchId, number>

interface SyncedEdictState {
  enabledLevel: EdictLevel
  activeLevel: EdictLevel
  inactiveReason: string | null
}

type SyncedEdictStates = Record<EdictId, SyncedEdictState>

type SyncedReserves = ReserveBalances

export const CURRENT_GAME_STATE_SCHEMA_VERSION = 40 as const

export interface GameStateSnapshot {
  schemaVersion: typeof CURRENT_GAME_STATE_SCHEMA_VERSION
  saveId: string
  settlement: SyncedSettlementState
  weather: WeatherConfig
  exportedAtUtc: string
  spaceStation: SyncedSpaceStationState
  logisticsZones: SyncedLogisticsZoneRef[]
  chickenFarms: SyncedChickenFarmEntity[]
  cropFarms: SyncedCropFarmEntity[]
  machines: SyncedMachineInventoryItem[]
  groundwater: SyncedGroundwaterState
  contracts: SyncedContractState
  productionEntities: SyncedProductionEntity[]
  areaEntities: SyncedAreaEntity[]
  mineTowers: SyncedMineTower[]
  vehicles: {
    workersAssigned: number
  }
  research: SyncedResearchLevels
  edicts: SyncedEdictStates
  reserves: SyncedReserves
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

const isSyncedProductRef = (value: unknown): value is SyncedProductRef =>
  isUnknownRecord(value) &&
  typeof value.productId === 'string' &&
  value.productId.length > 0 &&
  typeof value.name === 'string' &&
  value.name.length > 0

const normalizeContractState = (value: unknown): SyncedContractState | null => {
  if (!isUnknownRecord(value)) return null

  const established = Array.isArray(value.established) ? value.established : null
  const routes = Array.isArray(value.routes) ? value.routes : null

  if (!established || !routes) return null

  const validEstablished = established.filter(
    (contract): contract is SyncedEstablishedContract =>
      isUnknownRecord(contract) &&
      typeof contract.gameId === 'string' &&
      contract.gameId.length > 0 &&
      isSyncedProductRef(contract.exportedProduct) &&
      isNonNegativeInteger(contract.exportedQuantity) &&
      contract.exportedQuantity > 0 &&
      isSyncedProductRef(contract.importedProduct) &&
      isNonNegativeInteger(contract.importedQuantity) &&
      contract.importedQuantity > 0 &&
      isNonNegativeFiniteNumber(contract.unityPerCycle) &&
      isNonNegativeFiniteNumber(contract.unityPer100Imported) &&
      isNonNegativeFiniteNumber(contract.unityToEstablish) &&
      isNonNegativeInteger(contract.minimumReputation),
  )
  const establishedIds = new Set(validEstablished.map(contract => contract.gameId))

  if (
    validEstablished.length !== established.length ||
    establishedIds.size !== validEstablished.length
  )
    return null

  const ownedEntityIds = new Set<number>()
  const validRoutes = routes.filter((route): route is SyncedContractRoute => {
    if (
      !isUnknownRecord(route) ||
      !isNonNegativeInteger(route.depotEntityId) ||
      ownedEntityIds.has(route.depotEntityId) ||
      typeof route.depotPrototypeId !== 'string' ||
      route.depotPrototypeId.length === 0 ||
      typeof route.depotPrototypeName !== 'string' ||
      route.depotPrototypeName.length === 0 ||
      (route.depotCustomTitle !== null && typeof route.depotCustomTitle !== 'string') ||
      typeof route.running !== 'boolean' ||
      !isNonNegativeInteger(route.slotCount) ||
      typeof route.contractGameId !== 'string' ||
      !establishedIds.has(route.contractGameId) ||
      !Array.isArray(route.zones) ||
      !route.zones.every(isLogisticsZoneRef) ||
      !Array.isArray(route.modules)
    )
      return false

    ownedEntityIds.add(route.depotEntityId)

    const slots = new Set<number>()

    for (const cargoModule of route.modules) {
      if (
        !isUnknownRecord(cargoModule) ||
        !isNonNegativeInteger(cargoModule.entityId) ||
        ownedEntityIds.has(cargoModule.entityId) ||
        !isNonNegativeInteger(cargoModule.slot) ||
        cargoModule.slot >= route.slotCount ||
        slots.has(cargoModule.slot) ||
        typeof cargoModule.prototypeId !== 'string' ||
        cargoModule.prototypeId.length === 0 ||
        typeof cargoModule.prototypeName !== 'string' ||
        cargoModule.prototypeName.length === 0 ||
        typeof cargoModule.running !== 'boolean' ||
        !isNonNegativeInteger(cargoModule.workers) ||
        (cargoModule.selectedProduct !== null &&
          !isSyncedProductRef(cargoModule.selectedProduct)) ||
        (cargoModule.direction !== null &&
          cargoModule.direction !== 'import' &&
          cargoModule.direction !== 'export') ||
        (cargoModule.selectedProduct === null) !== (cargoModule.direction === null) ||
        !isNonNegativeInteger(cargoModule.onboardCapacity)
      )
        return false

      slots.add(cargoModule.slot)
      ownedEntityIds.add(cargoModule.entityId)
    }

    if (route.modules.length > route.slotCount) return false
    if (route.ship === null) return true

    const ship = route.ship

    if (
      !isUnknownRecord(ship) ||
      !isNonNegativeInteger(ship.entityId) ||
      ownedEntityIds.has(ship.entityId) ||
      typeof ship.prototypeId !== 'string' ||
      ship.prototypeId.length === 0 ||
      typeof ship.prototypeName !== 'string' ||
      ship.prototypeName.length === 0 ||
      typeof ship.running !== 'boolean' ||
      !isNonNegativeInteger(ship.workers) ||
      !isSyncedProductRef(ship.fuelProduct) ||
      typeof ship.saveFuel !== 'boolean' ||
      (ship.journeyDurationSeconds !== null &&
        (!isNonNegativeFiniteNumber(ship.journeyDurationSeconds) ||
          ship.journeyDurationSeconds === 0)) ||
      (ship.fuelPerTrip !== null && !isNonNegativeInteger(ship.fuelPerTrip))
    )
      return false

    ownedEntityIds.add(ship.entityId)
    return true
  })

  if (validRoutes.length !== routes.length) return null

  return { established: validEstablished, routes: validRoutes }
}

const isSpaceStationState = (value: unknown): value is SyncedSpaceStationState =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.currentLevel) &&
  isNonNegativeInteger(value.highestLevelAchieved) &&
  value.currentLevel <= value.highestLevelAchieved

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

const normalizeChickenFarms = (value: unknown): SyncedChickenFarmEntity[] | null => {
  if (!Array.isArray(value)) return null

  const entities = value.filter(isChickenFarmEntity)

  if (
    entities.length !== value.length ||
    new Set(entities.map(({ entityId }) => entityId)).size !== entities.length
  )
    return null

  return entities
}

const isCropFarmFertilizerProductId = (
  value: unknown,
): value is SyncedCropFarmFertilizerProductId =>
  value === 'Product_FertilizerOrganic' ||
  value === 'Product_Fertilizer' ||
  value === 'Product_Fertilizer2'

const hasValidCropFarmFertilizerProduct = (value: unknown) =>
  value === null || isCropFarmFertilizerProductId(value)

const isCropFarmEntity = (value: unknown): value is SyncedCropFarmEntity =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.entityId) &&
  (value.prototypeId === 'FarmT3' || value.prototypeId === 'FarmT4') &&
  typeof value.running === 'boolean' &&
  isNonNegativeInteger(value.fertilityTargetPercent) &&
  value.fertilityTargetPercent <= 200 &&
  hasValidCropFarmFertilizerProduct(value.fertilizerProductId) &&
  Array.isArray(value.schedule) &&
  value.schedule.length === 4 &&
  value.schedule.every(
    cropId => cropId === null || (typeof cropId === 'string' && cropId.length > 0),
  ) &&
  Array.isArray(value.zones) &&
  value.zones.every(isLogisticsZoneRef) &&
  new Set(value.zones.map(zone => zone.id)).size === value.zones.length

const normalizeCropFarms = (value: unknown): SyncedCropFarmEntity[] | null => {
  if (!Array.isArray(value)) return null

  const entities = value.filter(isCropFarmEntity)

  if (
    entities.length !== value.length ||
    new Set(entities.map(({ entityId }) => entityId)).size !== entities.length
  )
    return null

  return entities
}

const normalizeLogisticsZones = (value: unknown): SyncedLogisticsZoneRef[] | null => {
  if (!Array.isArray(value)) return null

  const zones = value.filter(isLogisticsZoneRef)

  return zones.length === value.length && new Set(zones.map(zone => zone.id)).size === zones.length
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

const normalizeMachineInventory = (value: unknown): SyncedMachineInventoryItem[] | null => {
  if (!Array.isArray(value)) return null

  const machines: SyncedMachineInventoryItem[] = []

  for (const machine of value) {
    if (!isMachineInventoryItem(machine)) return null

    const rawZones = machine.zones
    const zones = Array.isArray(rawZones) ? rawZones.filter(isLogisticsZoneRef) : []

    if (
      !Array.isArray(rawZones) ||
        zones.length !== rawZones.length ||
        new Set(zones.map(({ id }) => id)).size !== zones.length
    )
      return null

    const aquifer = isGroundwaterAquifer(machine.aquifer) ? machine.aquifer : null

    if (!aquifer) return null

    machines.push({ ...machine, aquifer, zones })
  }

  if (new Set(machines.map(({ entityId }) => entityId)).size !== machines.length) return null

  const aquifers = new Map<string, SyncedGroundwaterAquifer>()

  for (const { aquifer } of machines) {
    if (!aquifer) continue

    const existing = aquifers.get(aquifer.id)

    if (
      existing &&
      (existing.quantity !== aquifer.quantity ||
        existing.capacity !== aquifer.capacity ||
        existing.configuredCapacity !== aquifer.configuredCapacity ||
        existing.position.x !== aquifer.position.x ||
        existing.position.y !== aquifer.position.y)
    )
      return null

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

const isTrainStationConfiguration = (value: unknown): value is SyncedTrainStationConfiguration =>
  isUnknownRecord(value) &&
  typeof value.isForLoading === 'boolean' &&
  (value.selectedProduct === null || isProductRef(value.selectedProduct))

const hasValidTrainStationConfiguration = (value: Record<string, unknown>) => {
  return trainStationPrototypeIds.has(String(value.prototypeId))
    ? value.trainStation === null || isTrainStationConfiguration(value.trainStation)
    : value.trainStation === null
}

const isProductionEntity = (
  value: unknown,
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
  ((value.prototypeId === 'DataCenter' && isNonNegativeInteger(value.dataCenterRacks)) ||
    (value.prototypeId !== 'DataCenter' && value.dataCenterRacks === null)) &&
  hasValidTrainStationConfiguration(value)

const normalizeProductionEntities = (value: unknown): SyncedProductionEntity[] | null => {
  if (!Array.isArray(value)) return null

  const entities = value.filter(isProductionEntity)

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
  )
    return false

  const inputs = value.inputs.filter(isAreaRecipeProduct)
  const outputs = value.outputs.filter(isAreaRecipeProduct)

  return (
    inputs.length === value.inputs.length &&
    outputs.length === value.outputs.length &&
    new Set(inputs.map(input => input.productId)).size === inputs.length &&
    new Set(outputs.map(output => output.productId)).size === outputs.length
  )
}

const oreSorterPrototypeIds = new Set(['OreSortingPlantT1', 'OreSortingPlantT2'])

const isOreSorterProduct = (value: unknown): value is SyncedOreSorterProduct =>
  isUnknownRecord(value) &&
  typeof value.productId === 'string' &&
  value.productId.length > 0 &&
  typeof value.name === 'string' &&
  value.name.length > 0 &&
  typeof value.canBeWasted === 'boolean'

const isOreSorterConfiguration = (value: unknown): value is SyncedOreSorterConfiguration => {
  if (
    !isUnknownRecord(value) ||
    !isNonNegativeFiniteNumber(value.throughputPerCycle) ||
    value.throughputPerCycle <= 0 ||
    !isNonNegativeInteger(value.conversionLossPercent) ||
    value.conversionLossPercent > 100 ||
    !Array.isArray(value.products)
  )
    return false

  const products = value.products.filter(isOreSorterProduct)

  return (
    products.length === value.products.length &&
    new Set(products.map(product => product.productId)).size === products.length
  )
}

const isForestryProduct = (value: unknown): value is SyncedForestryProduct =>
  isUnknownRecord(value) &&
  typeof value.productId === 'string' &&
  value.productId.length > 0 &&
  typeof value.name === 'string' &&
  value.name.length > 0 &&
  isNonNegativeFiniteNumber(value.quantityPerCycle)

const isForestryConfiguration = (value: unknown): value is SyncedForestryConfiguration => {
  if (
    !isUnknownRecord(value) ||
    !isNonNegativeInteger(value.treeCount) ||
    typeof value.cuttingEnabled !== 'boolean' ||
    !isNonNegativeInteger(value.targetHarvestPercent) ||
    value.targetHarvestPercent > 200 ||
    value.cuttingEnabled !== value.targetHarvestPercent < 200 ||
    !isNonNegativeFiniteNumber(value.harvestsPerCycle) ||
    !(
      value.harvestDurationMonths === null ||
      (isNonNegativeFiniteNumber(value.harvestDurationMonths) && value.harvestDurationMonths > 0)
    ) ||
    (value.harvestsPerCycle === 0) !== (value.harvestDurationMonths === null) ||
    !Array.isArray(value.outputs)
  )
    return false

  const outputs = value.outputs.filter(isForestryProduct)

  return (
    outputs.length === value.outputs.length &&
    new Set(outputs.map(output => output.productId)).size === outputs.length
  )
}

const officeBuildingPrototypeIds = new Set([
  'OfficeBuildingT1',
  'OfficeBuildingT2',
  'OfficeBuildingT3',
])

const isOfficeConfiguration = (value: unknown): value is SyncedOfficeConfiguration =>
  isUnknownRecord(value) &&
  (value.computingBoostStep === 0 ||
    value.computingBoostStep === 1 ||
    value.computingBoostStep === 2)

const isAreaEntity = (value: unknown): value is SyncedAreaEntity => {
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
  )
    return false

  const zones = value.zones.filter(isLogisticsZoneRef)
  const recipes = value.recipes.filter(isAreaRecipe)
  const availableRecipeCount = value.availableRecipeCount
  const hasValidCompactRecipes =
    isNonNegativeInteger(availableRecipeCount) &&
    availableRecipeCount >= recipes.length &&
    (availableRecipeCount !== 0 || recipes.length === 0) &&
    (availableRecipeCount !== 1 || recipes.length === 1) &&
    (availableRecipeCount <= 1 ||
      recipes.length === 0 ||
      recipes.every(recipe => recipe.assigned))

  return (
    zones.length === value.zones.length &&
    recipes.length === value.recipes.length &&
    hasValidCompactRecipes &&
    new Set(zones.map(zone => zone.id)).size === zones.length &&
    new Set(recipes.map(recipe => recipe.id)).size === recipes.length &&
    (oreSorterPrototypeIds.has(value.prototypeId)
      ? isOreSorterConfiguration(value.oreSorter)
      : value.oreSorter === null) &&
    hasValidTrainStationConfiguration(value) &&
    (value.prototypeId === 'ForestryTower'
      ? isForestryConfiguration(value.forestry)
      : value.forestry === null) &&
    (officeBuildingPrototypeIds.has(value.prototypeId)
      ? isOfficeConfiguration(value.office)
      : value.office === null)
  )
}

const normalizeAreaEntities = (value: unknown): SyncedAreaEntity[] | null => {
  if (!Array.isArray(value)) return null

  const entities = value.filter(isAreaEntity)

  return entities.length === value.length &&
    new Set(entities.map(entity => entity.entityId)).size === entities.length
    ? entities
    : null
}

const normalizeMineTowers = (value: unknown): SyncedMineTower[] | null => {
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
    )
      return null

    candidate.assignedOreSorterEntityIds.forEach(entityId => assignedSorterIds.add(entityId))
    towers.push({
      entityId: candidate.entityId,
      assignedOreSorterEntityIds: candidate.assignedOreSorterEntityIds,
    })
  }

  return new Set(towers.map(tower => tower.entityId)).size === towers.length ? towers : null
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

const normalizeReserves = (value: unknown): SyncedReserves | null => {
  if (!isUnknownRecord(value)) return null
  const { fuelGas, gold } = value

  if (!isNonNegativeInteger(fuelGas) || !isNonNegativeInteger(gold)) return null

  return { fuelGas, gold }
}

export const normalizeGameStateSnapshot = (value: unknown): GameStateSnapshot | null => {
  if (!isUnknownRecord(value)) return null

  const snapshot = value
  const schemaVersion = snapshot.schemaVersion

  if (schemaVersion !== CURRENT_GAME_STATE_SCHEMA_VERSION) return null
  if (!isSyncedSettlementState(snapshot.settlement) || !isWeatherConfig(snapshot.weather)) return null

  const saveId =
    typeof snapshot.saveId === 'string' && snapshot.saveId.trim().length > 0
      ? snapshot.saveId
      : null
  const spaceStation = isSpaceStationState(snapshot.spaceStation) ? snapshot.spaceStation : null
  const logisticsZones = normalizeLogisticsZones(snapshot.logisticsZones)
  const chickenFarms = normalizeChickenFarms(snapshot.chickenFarms)
  const cropFarms = normalizeCropFarms(snapshot.cropFarms)
  const machines = normalizeMachineInventory(snapshot.machines)
  const groundwater = isGroundwaterState(snapshot.groundwater) ? snapshot.groundwater : null
  const contracts = normalizeContractState(snapshot.contracts)
  const productionEntities = normalizeProductionEntities(snapshot.productionEntities)
  const areaEntities = normalizeAreaEntities(snapshot.areaEntities)
  const mineTowers = normalizeMineTowers(snapshot.mineTowers)
  const vehicles = isUnknownRecord(snapshot.vehicles) ? snapshot.vehicles : null
  const workersAssigned = vehicles?.workersAssigned
  const research = normalizeResearchLevels(snapshot.research)
  const edicts = normalizeEdictStates(snapshot.edicts)
  const reserves = normalizeReserves(snapshot.reserves)
  const history = isUnknownRecord(snapshot.history) ? snapshot.history : null

  if (
    typeof snapshot.exportedAtUtc !== 'string' ||
    Number.isNaN(Date.parse(snapshot.exportedAtUtc)) ||
    !spaceStation ||
    !chickenFarms ||
    !cropFarms ||
    !logisticsZones ||
    !machines ||
    !groundwater ||
    !contracts ||
    !saveId ||
    !productionEntities ||
    !areaEntities ||
    !mineTowers ||
    !vehicles ||
    !isNonNegativeInteger(workersAssigned) ||
    !research ||
    !edicts ||
    !reserves ||
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
    saveId,
    settlement: snapshot.settlement,
    weather: snapshot.weather,
    exportedAtUtc: snapshot.exportedAtUtc,
    spaceStation,
    logisticsZones,
    chickenFarms,
    cropFarms,
    machines,
    groundwater,
    contracts,
    productionEntities,
    areaEntities,
    mineTowers,
    vehicles: {
      workersAssigned,
    },
    research,
    edicts,
    reserves,
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
