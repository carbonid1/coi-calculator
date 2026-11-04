import {
  type CropDefinition,
  type CropId,
  type CropFarmTierId,
  type FertilizerDefinition,
  type FertilizerId,
} from './db/crop-farming'
import { resolveSyncedResourceId } from './helpers/synced-resources/synced-resources'

export const gameCropIds: Readonly<Record<string, CropId>> = {
  Crop_NoCrop: 'none',
  Crop_GreenManure: 'greenManure',
  Crop_Potato: 'potato',
  Crop_Corn: 'corn',
  Crop_Wheat: 'wheat',
  Crop_TreeSapling: 'treeSapling',
  Crop_Soybeans: 'soybean',
  Crop_SugarCane: 'sugarCane',
  Crop_Vegetables: 'vegetables',
  Crop_Fruits: 'fruit',
  Crop_Canola: 'canola',
  Crop_Poppy: 'poppy',
  Crop_Flowers: 'flowers',
}
export const gameFertilizerIds: Readonly<Record<string, FertilizerId>> = {
  Product_FertilizerOrganic: 'organic',
  Product_Fertilizer: 'fertilizerI',
  Product_Fertilizer2: 'fertilizerII',
}

interface NativeCropDefinition {
  id: string
  name: string
  productId: string | null
  productName: string | null
  quantityPerHarvest: number
  waterPerDay: number
  fertilityPercentPerDay: number
  growthMonths: number
  survivesWithoutWaterMonths: number | null
  requiresGreenhouse: boolean
}
interface NativeFertilizerDefinition {
  productId: string
  fertilityPercentPerUnit: number
  maximumFertilityPercent: number
}
export interface CropFarmingDefinitions {
  crops: NativeCropDefinition[]
  fertilizers: NativeFertilizerDefinition[]
  tiers: NativeFarmTier[]
  simulation: FarmSimulation
}

interface NativeFarmTier {
  buildingId: string
  supportsIrrigation: boolean
  isGreenhouse: boolean
  yieldMultiplier: number
  demandMultiplier: number
  waterEvaporationPerDay: number
  rainwaterAtFullRainPerDay: number
  naturalFertilityReplenishRate: number
}
interface FarmSimulation {
  soilWaterCapacity: number
  repeatedCropFertilityPenalty: number
  aboveNaturalFertilityReplenishMultiplier: number
  aboveNaturalFertilityDemandMultiplier: number
  irrigationStartPercent: number
  irrigationStopPercent: number
  emptyCropIrrigationStopPercent: number
  minimumIrrigationPerDay: number
}
const farmTierIds: Record<CropFarmTierId, string> = {
  farm: 'FarmT1',
  irrigatedFarm: 'FarmT2',
  greenhouse: 'FarmT3',
  greenhouseII: 'FarmT4',
}

export const getCropFarmTier = (definitions: CropFarmingDefinitions, id: CropFarmTierId) => {
  const tier = definitions.tiers.find(tier => tier.buildingId === farmTierIds[id])

  if (!tier) throw new Error('Farm tier definition unavailable: ' + id)
  return {
    ...tier,
    supportsImportedWater: tier.supportsIrrigation,
    supportsFertilizer: tier.supportsIrrigation,
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const amount = (value: unknown): value is number => finite(value) && value >= 0
const simulation = (value: unknown): value is FarmSimulation =>
  record(value) &&
  [
    'soilWaterCapacity',
    'repeatedCropFertilityPenalty',
    'aboveNaturalFertilityReplenishMultiplier',
    'aboveNaturalFertilityDemandMultiplier',
    'irrigationStartPercent',
    'irrigationStopPercent',
    'emptyCropIrrigationStopPercent',
    'minimumIrrigationPerDay',
  ].every(key => amount(value[key])) &&
  finite(value.soilWaterCapacity) &&
  value.soilWaterCapacity > 0 &&
  finite(value.irrigationStartPercent) &&
  finite(value.irrigationStopPercent) &&
  value.irrigationStartPercent <= value.irrigationStopPercent &&
  value.irrigationStopPercent <= 100 &&
  finite(value.emptyCropIrrigationStopPercent) &&
  value.emptyCropIrrigationStopPercent <= 100
const crop = (value: unknown): value is NativeCropDefinition =>
  record(value) &&
  typeof value.id === 'string' &&
  value.id.length > 0 &&
  typeof value.name === 'string' &&
  amount(value.quantityPerHarvest) &&
  amount(value.waterPerDay) &&
  finite(value.fertilityPercentPerDay) &&
  finite(value.growthMonths) &&
  value.growthMonths > 0 &&
  (value.survivesWithoutWaterMonths === null ||
    (finite(value.survivesWithoutWaterMonths) && value.survivesWithoutWaterMonths > 0)) &&
  typeof value.requiresGreenhouse === 'boolean' &&
  (value.productId === null
    ? value.productName === null && value.quantityPerHarvest === 0
    : typeof value.productId === 'string' &&
      typeof value.productName === 'string' &&
      resolveSyncedResourceId({ productId: value.productId, name: value.productName }) !==
        undefined)
const fertilizer = (value: unknown): value is NativeFertilizerDefinition =>
  record(value) &&
  typeof value.productId === 'string' &&
  value.productId.length > 0 &&
  finite(value.fertilityPercentPerUnit) &&
  value.fertilityPercentPerUnit > 0 &&
  finite(value.maximumFertilityPercent) &&
  value.maximumFertilityPercent > 0

export const isCropFarmingDefinitions = (value: unknown): value is CropFarmingDefinitions => {
  if (
    !record(value) ||
    !Array.isArray(value.crops) ||
    !value.crops.every(crop) ||
    !Array.isArray(value.fertilizers) ||
    !value.fertilizers.every(fertilizer) ||
    !Array.isArray(value.tiers) ||
    !value.tiers.every(
      t =>
        record(t) &&
        typeof t.buildingId === 'string' &&
        typeof t.supportsIrrigation === 'boolean' &&
        typeof t.isGreenhouse === 'boolean' &&
        amount(t.yieldMultiplier) &&
        amount(t.demandMultiplier) &&
        amount(t.waterEvaporationPerDay) &&
        amount(t.rainwaterAtFullRainPerDay) &&
        amount(t.naturalFertilityReplenishRate),
    ) ||
    new Set(value.tiers.map(t => t.buildingId)).size !== value.tiers.length ||
    !simulation(value.simulation)
  )
    return false
  const tiers = value.tiers

  if (!Object.values(farmTierIds).every(id => tiers.some(t => t.buildingId === id))) return false
  const cropIds = new Set(value.crops.map(crop => crop.id))
  const fertilizerIds = new Set(value.fertilizers.map(fertilizer => fertilizer.productId))

  return (
    cropIds.size === value.crops.length &&
    fertilizerIds.size === value.fertilizers.length &&
    Object.keys(gameCropIds).every(id => cropIds.has(id)) &&
    Object.keys(gameFertilizerIds).every(id => fertilizerIds.has(id))
  )
}

const cache = new WeakMap<
  CropFarmingDefinitions,
  {
    crop: (id: CropId) => CropDefinition
    fertilizer: (id: FertilizerId) => FertilizerDefinition
  }
>()

export const getCropFarmingData = (definitions: CropFarmingDefinitions) => {
  const cached = cache.get(definitions)

  if (cached) return cached
  const crops = new Map<CropId, CropDefinition>()
  const fertilizers = new Map<FertilizerId, FertilizerDefinition>()

  for (const crop of definitions.crops) {
    const id = gameCropIds[crop.id]

    if (!id) continue
    const productId =
      crop.productId === null
        ? null
        : resolveSyncedResourceId({ productId: crop.productId, name: crop.productName ?? '' })

    if (productId === undefined) throw new Error(`Unsupported crop product ${crop.productId}`)
    crops.set(id, { ...crop, id, productId })
  }
  for (const fertilizer of definitions.fertilizers) {
    const id = gameFertilizerIds[fertilizer.productId]
    const resourceId = resolveSyncedResourceId({ productId: fertilizer.productId, name: '' })

    if (!id) continue
    if (!resourceId) throw new Error(`Unsupported fertilizer product ${fertilizer.productId}`)
    fertilizers.set(id, { ...fertilizer, id, resourceId })
  }
  const data = {
    crop: (id: CropId) => {
      const crop = crops.get(id)

      if (!crop) throw new Error(`Crop definition ${id} is unavailable`)
      return crop
    },
    fertilizer: (id: FertilizerId) => {
      const fertilizer = fertilizers.get(id)

      if (!fertilizer) throw new Error(`Fertilizer definition ${id} is unavailable`)
      return fertilizer
    },
  }

  cache.set(definitions, data)
  return data
}
