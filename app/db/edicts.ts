import { type ValueSource } from '../data-source'
import { resolveDirectionalPlan } from '../helpers/resolve-directional-plan'
import { getEdictEffects, type PlanningDefinitions } from '../planning-state'
import { edictCatalog, type EdictId } from './edict-catalog'

export { edictCatalog, type EdictId } from './edict-catalog'
const edictLevelOrder = [0, 1, 2, 3, 4, 5] as const

export type EdictLevel = (typeof edictLevelOrder)[number]
export type CleanPanelsLevel = EdictLevel
export type FarmingBoostLevel = EdictLevel
export type MaintenanceReducerLevel = EdictLevel

interface EdictLevelDefinition {
  level: EdictLevel
  label: string
  effect: string
  unityCostPerCycle: number
  unityProductionPerCycle?: number
  unityProductionIncreasePercent?: number
  unityProductionServiceId?: 'householdGoods' | 'householdAppliances' | 'consumerElectronics'
  modeledEffects?: {
    foodConsumptionPercent?: number
    recyclingEfficiencyIncreasePercent?: number
    solarPowerIncreasePercent?: number
    cropYieldIncreasePercent?: number
    cropWaterDemandIncreasePercent?: number
    waterDemandReductionPercent?: number
    maintenanceDemandReductionPercent?: number
    researchEfficiencyBonusPercent?: number
  }
}
export interface EdictDefinition {
  id: EdictId
  name: string
  category: 'population' | 'industrial'
  levels: readonly EdictLevelDefinition[]
}
const number = (value = 0) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })
const signed = (value = 0) => `${value > 0 ? '+' : ''}${number(value)}%`
const describe = (id: EdictId, e: Record<string, number>): string => {
  switch (id) {
    case 'growthPause':
      return 'Population growth paused'
    case 'growthBoost':
      return `${signed(e.PopulationGrowth)} population growth`
    case 'eviction':
      return `${number(e.PopulationEviction)}% of population leaves per cycle`
    case 'quarantine':
      return `-${number(e.DiseaseReduction)}% disease impact · -${number(e.WorkersWithheld)}% workforce`
    case 'foodSaver':
    case 'plentyOfFood':
      return `${signed(e.FoodConsumptionMultiplier)} food consumption`
    case 'healthBoost':
      return `+${number(e.BaseHealthDiffEdicts)} health`
    case 'moreHouseholdGoods':
      return `${signed(e.HouseholdGoodsConsumptionMultiplier)} consumption · ${signed(e.HouseholdGoodsUnityMultiplier)} service Unity`
    case 'moreAirConditioners':
      return `${signed(e.HouseholdAppliancesConsumptionMultiplier)} consumption · ${signed(e.HouseholdAppliancesUnityMultiplier)} service Unity`
    case 'moreConsumerElectronics':
      return `${signed(e.ConsumerElectronicsConsumptionMultiplier)} consumption · ${signed(e.ConsumerElectronicsUnityMultiplier)} service Unity`
    case 'vehiclesFuelSaver':
      return `${signed(e.VehiclesFuelConsumptionMultiplier)} vehicle fuel consumption`
    case 'shipsFuelSaver':
      return `${signed(e.ShipsFuelConsumptionMultiplier)} cargo ship fuel consumption`
    case 'overloadedTrucks':
      return `${signed(e.TrucksCapacityMultiplier)} capacity · ${signed(e.TrucksMaintenanceMultiplier)} maintenance`
    case 'maintenanceReducer':
      return `${signed(e.MaintenanceConsumptionMultiplier)} maintenance demand`
    case 'recyclingIncrease':
      return `${signed(e.RecyclingRatioDiff)} recycling efficiency`
    case 'farmingBoost':
      return `${signed(e.FarmYieldMultiplier)} crop yield · ${signed(e.FarmWaterConsumptionMultiplier)} water demand`
    case 'waterSaver':
      return `${signed(e.SettlementWaterConsumptionMultiplier)} settlement and farm water demand`
    case 'cleanPanels':
      return `${signed(e.SolarPowerMultiplier)} solar power`
    case 'researchEfficiency':
      return `${signed(e.ResearchEfficiencyMultiplier)} research efficiency`
  }
}

export const getEdictCatalog = (definitions: PlanningDefinitions): EdictDefinition[] =>
  edictCatalog.map(binding => {
    const max = Math.max(...definitions.edicts.filter(e => e.id === binding.id).map(e => e.level))

    return {
      ...binding,
      levels: edictLevelOrder
        .filter(level => level <= max)
        .map(level => {
          const { unityCost, effects: e } = getEdictEffects(definitions, binding.id, level)

          return {
            level,
            label: ['0', 'I', 'II', 'III', 'IV', 'V'][level] ?? String(level),
            effect: level === 0 ? 'Inactive' : describe(binding.id, e),
            unityCostPerCycle: Math.max(0, unityCost),
            unityProductionPerCycle: unityCost < 0 ? -unityCost : undefined,
            modeledEffects: {
              foodConsumptionPercent: e.FoodConsumptionMultiplier ?? 0,
              recyclingEfficiencyIncreasePercent: e.RecyclingRatioDiff ?? 0,
              solarPowerIncreasePercent: e.SolarPowerMultiplier ?? 0,
              cropYieldIncreasePercent: e.FarmYieldMultiplier ?? 0,
              cropWaterDemandIncreasePercent: e.FarmWaterConsumptionMultiplier ?? 0,
              waterDemandReductionPercent: -(e.SettlementWaterConsumptionMultiplier ?? 0),
              maintenanceDemandReductionPercent: -(e.MaintenanceConsumptionMultiplier ?? 0),
              researchEfficiencyBonusPercent: e.ResearchEfficiencyMultiplier ?? 0,
            },
          }
        }),
    }
  })
export const getEdict = (id: EdictId, definitions: PlanningDefinitions): EdictDefinition => {
  const value = getEdictCatalog(definitions).find(e => e.id === id)

  if (!value) throw new Error(`Edict unavailable for ${id}`)
  return value
}
export const mapEdictValues = <T>(getValue: (id: EdictId) => T): Record<EdictId, T> => ({
  growthPause: getValue('growthPause'),
  growthBoost: getValue('growthBoost'),
  eviction: getValue('eviction'),
  quarantine: getValue('quarantine'),
  foodSaver: getValue('foodSaver'),
  healthBoost: getValue('healthBoost'),
  plentyOfFood: getValue('plentyOfFood'),
  moreHouseholdGoods: getValue('moreHouseholdGoods'),
  moreAirConditioners: getValue('moreAirConditioners'),
  moreConsumerElectronics: getValue('moreConsumerElectronics'),
  vehiclesFuelSaver: getValue('vehiclesFuelSaver'),
  shipsFuelSaver: getValue('shipsFuelSaver'),
  overloadedTrucks: getValue('overloadedTrucks'),
  maintenanceReducer: getValue('maintenanceReducer'),
  recyclingIncrease: getValue('recyclingIncrease'),
  farmingBoost: getValue('farmingBoost'),
  waterSaver: getValue('waterSaver'),
  cleanPanels: getValue('cleanPanels'),
  researchEfficiency: getValue('researchEfficiency'),
})

export const defaultEdictLevels: Record<EdictId, EdictLevel> = {
  growthPause: 0,
  growthBoost: 0,
  eviction: 0,
  quarantine: 0,
  foodSaver: 0,
  healthBoost: 0,
  plentyOfFood: 2,
  moreHouseholdGoods: 0,
  moreAirConditioners: 0,
  moreConsumerElectronics: 0,
  vehiclesFuelSaver: 0,
  shipsFuelSaver: 0,
  overloadedTrucks: 0,
  maintenanceReducer: 3,
  recyclingIncrease: 5,
  farmingBoost: 1,
  waterSaver: 0,
  cleanPanels: 0,
  researchEfficiency: 5,
}

/** Future policy levels applied until the current synced value reaches them. */
export const plannedEdictLevels: Partial<Record<EdictId, EdictLevel>> = {
  recyclingIncrease: 5,
}

export const resolveEdictLevel = (
  id: EdictId,
  synced: EdictLevel,
  includePlan = true,
): { source: ValueSource; value: EdictLevel } => {
  const target = includePlan ? plannedEdictLevels[id] : undefined

  if (target === undefined) return { source: 'synced' as const, value: synced }

  const resolved = resolveDirectionalPlan(synced, {
    direction: 'at-least',
    target,
  })
  const value = edictLevelOrder.find(level => level === resolved.value) ?? synced

  return { source: resolved.source, value }
}

export const normalizeCleanPanelsLevel = (value: EdictLevel): CleanPanelsLevel =>
  edictLevelOrder.find(candidate => candidate === value) ?? 0

export const normalizeFarmingBoostLevel = (value: EdictLevel): FarmingBoostLevel =>
  edictLevelOrder.find(candidate => candidate === value) ?? 0

export const normalizeMaintenanceReducerLevel = (value: EdictLevel): MaintenanceReducerLevel =>
  edictLevelOrder.find(candidate => candidate === value) ?? 0
