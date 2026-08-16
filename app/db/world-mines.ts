import { type ResourceId } from './resources'

export type WorldMineId =
  | 'oilRig'
  | 'groundwaterWell'
  | 'sulfurMine'
  | 'coalMine'
  | 'quartzMine'
  | 'uraniumMine'
  | 'rockMine'
  | 'limestoneQuarry'
  | 'bauxiteQuarry'

export type WorldMineKind = 'oil-rig' | 'groundwater-well' | 'mine' | 'quarry'

export interface WorldMineDefinition {
  id: WorldMineId
  /** Installed-game prototype IDs represented by this production configuration. */
  gamePrototypeIds: readonly string[]
  name: string
  kind: WorldMineKind
  resourceId: ResourceId
  /** Game-native output whenever the internal production timer completes at level I. */
  baseOutputPerCompletion: number
  completionDurationSeconds: number
  /** Repaired sites start at level II and upgrades add two available production levels. */
  startingMineLevel: number
  levelsPerUpgrade: number
  maxProductionLevel: number
  unityPerProductionLevelPerCycle: number
  workersPerProductionLevel: number
  /** Base finite deposit before difficulty modifiers; null means unlimited. */
  baseReserve: number | null
  gameVersion: string
}

const shared = {
  startingMineLevel: 2,
  levelsPerUpgrade: 2,
  gameVersion: '0.8.7',
} as const

/**
 * Dormant world-map extraction data. These definitions are intentionally not
 * registered as recipes or active module buildings yet.
 */
export const worldMines = {
  oilRig: {
    ...shared,
    id: 'oilRig',
    gamePrototypeIds: ['OilRigCost1', 'OilRigCost2', 'OilRigCost3'],
    name: 'Oil Rig',
    kind: 'oil-rig',
    resourceId: 'crudeOil',
    baseOutputPerCompletion: 10,
    completionDurationSeconds: 20,
    maxProductionLevel: 16,
    unityPerProductionLevelPerCycle: 0.4,
    workersPerProductionLevel: 18,
    baseReserve: 1_000_000,
  },
  groundwaterWell: {
    ...shared,
    id: 'groundwaterWell',
    gamePrototypeIds: ['WaterWell'],
    name: 'Groundwater Well',
    kind: 'groundwater-well',
    resourceId: 'water',
    baseOutputPerCompletion: 8,
    completionDurationSeconds: 10,
    maxProductionLevel: 8,
    unityPerProductionLevelPerCycle: 0.2,
    workersPerProductionLevel: 16,
    baseReserve: null,
  },
  sulfurMine: {
    ...shared,
    id: 'sulfurMine',
    gamePrototypeIds: ['SulfurMine'],
    name: 'Sulfur Mine',
    kind: 'mine',
    resourceId: 'sulfur',
    baseOutputPerCompletion: 18,
    completionDurationSeconds: 20,
    maxProductionLevel: 8,
    unityPerProductionLevelPerCycle: 0.2,
    workersPerProductionLevel: 12,
    baseReserve: null,
  },
  coalMine: {
    ...shared,
    id: 'coalMine',
    gamePrototypeIds: ['CoalMine'],
    name: 'Coal Mine',
    kind: 'mine',
    resourceId: 'coal',
    baseOutputPerCompletion: 16,
    completionDurationSeconds: 20,
    maxProductionLevel: 24,
    unityPerProductionLevelPerCycle: 0.4,
    workersPerProductionLevel: 25,
    baseReserve: 1_500_000,
  },
  quartzMine: {
    ...shared,
    id: 'quartzMine',
    gamePrototypeIds: ['QuartzMine'],
    name: 'Quartz Mine',
    kind: 'mine',
    resourceId: 'quartz',
    baseOutputPerCompletion: 12,
    completionDurationSeconds: 20,
    maxProductionLevel: 20,
    unityPerProductionLevelPerCycle: 0.3,
    workersPerProductionLevel: 25,
    baseReserve: 1_000_000,
  },
  uraniumMine: {
    ...shared,
    id: 'uraniumMine',
    gamePrototypeIds: ['UraniumMine'],
    name: 'Uranium Mine',
    kind: 'mine',
    resourceId: 'uraniumOre',
    baseOutputPerCompletion: 12,
    completionDurationSeconds: 20,
    maxProductionLevel: 20,
    unityPerProductionLevelPerCycle: 0.4,
    workersPerProductionLevel: 25,
    baseReserve: 800_000,
  },
  rockMine: {
    ...shared,
    id: 'rockMine',
    gamePrototypeIds: ['RockMine'],
    name: 'Rock Mine',
    kind: 'mine',
    resourceId: 'rock',
    baseOutputPerCompletion: 12,
    completionDurationSeconds: 20,
    maxProductionLevel: 32,
    unityPerProductionLevelPerCycle: 0.2,
    workersPerProductionLevel: 25,
    baseReserve: null,
  },
  limestoneQuarry: {
    ...shared,
    id: 'limestoneQuarry',
    gamePrototypeIds: ['LimestoneMine'],
    name: 'Limestone Quarry',
    kind: 'quarry',
    resourceId: 'limestone',
    baseOutputPerCompletion: 8,
    completionDurationSeconds: 20,
    maxProductionLevel: 16,
    unityPerProductionLevelPerCycle: 0.4,
    workersPerProductionLevel: 25,
    baseReserve: 500_000,
  },
  bauxiteQuarry: {
    ...shared,
    id: 'bauxiteQuarry',
    gamePrototypeIds: ['BauxiteMine'],
    name: 'Bauxite Quarry',
    kind: 'quarry',
    resourceId: 'bauxite',
    baseOutputPerCompletion: 12,
    completionDurationSeconds: 20,
    maxProductionLevel: 24,
    unityPerProductionLevelPerCycle: 0.3,
    workersPerProductionLevel: 25,
    baseReserve: 750_000,
  },
} as const satisfies Record<WorldMineId, WorldMineDefinition>

export const worldMineCatalog: readonly WorldMineDefinition[] = Object.values(worldMines)

export const getWorldMineBaseOutputPerCycle = (
  mine: WorldMineDefinition,
  productionLevel: number,
) => {
  const normalizedLevel = Math.min(
    mine.maxProductionLevel,
    Math.max(0, Math.trunc(productionLevel)),
  )
  const completionsPerCycle = 60 / mine.completionDurationSeconds

  return mine.baseOutputPerCompletion * normalizedLevel * completionsPerCycle
}

export const getWorldMineProductionLevels = (mine: WorldMineDefinition) =>
  Array.from({ length: mine.maxProductionLevel + 1 }, (_, productionLevel) => ({
    productionLevel,
    baseOutputPerCycle: getWorldMineBaseOutputPerCycle(mine, productionLevel),
    unityPerCycle: mine.unityPerProductionLevelPerCycle * productionLevel,
    workers: mine.workersPerProductionLevel * productionLevel,
  }))
