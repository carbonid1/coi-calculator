import { getCropFarmingData, type CropFarmingDefinitions } from '../crop-farming-state';
import { type ResourceId } from "./resources";

export type CropFarmTierId = "farm" | "irrigatedFarm" | "greenhouse" | "greenhouseII";
export type FertilizerId = "organic" | "fertilizerI" | "fertilizerII";
export type CropId =
  | "none"
  | "greenManure"
  | "potato"
  | "corn"
  | "wheat"
  | "treeSapling"
  | "soybean"
  | "sugarCane"
  | "vegetables"
  | "fruit"
  | "canola"
  | "poppy"
  | "flowers";

export type CropSchedule =
  | readonly [CropId]
  | readonly [CropId, CropId]
  | readonly [CropId, CropId, CropId]
  | readonly [CropId, CropId, CropId, CropId];

export interface CropFarmTier {
  id: CropFarmTierId;
  name: string;
  maintenanceIPerMonth: number;
  supportsImportedWater: boolean;
  supportsFertilizer: boolean;
  isGreenhouse: boolean;
  yieldMultiplier: number;
  demandMultiplier: number;
  waterEvaporationPerDay: number;
  rainwaterAtFullRainPerDay: number;
}

export interface FertilizerDefinition {
  id: FertilizerId;
  resourceId: ResourceId;
  fertilityPercentPerUnit: number;
  maximumFertilityPercent: number;
}

export interface CropDefinition {
  id: CropId;
  name: string;
  productId: ResourceId | null;
  quantityPerHarvest: number;
  waterPerDay: number;
  /** Positive values consume fertility; Green Manure uses a negative value. */
  fertilityPercentPerDay: number;
  growthMonths: number;
  survivesWithoutWaterMonths: number | null;
  requiresGreenhouse: boolean;
}

/** A group represents farms that share the same in-game configuration. */
export interface CropFarmGroup {
  id: string;
  name: string;
  farmCount: number;
  tierId: CropFarmTierId;
  schedule: CropSchedule;
  fertilizer: {
    id: FertilizerId;
    targetFertilityPercent: number;
  } | null;
}

export interface CurrentCropFarmEntity {
  entityId: number;
  tierId: Extract<CropFarmTierId, "greenhouse" | "greenhouseII">;
  schedule: readonly string[];
  fertilityTargetPercent: number;
  fertilizerId?: FertilizerId | null;
  running: boolean;
  zones?: readonly { id: number; name: string | null }[];
}

/**
 * Captain of Industry v0.8.6 farm prototypes and runtime constants.
 * The game advances crop growth daily; one calculator month is 30 game days.
 */
export const cropFarmSimulation = {
  daysPerMonth: 30,
  scheduleSlots: 4,
  startingFertilityPercent: 80,
  soilWaterCapacity: 50,
  importedWaterCapacity: 60,
  fertilizerCapacity: 40,
  fertilityTargetStepPercent: 10,
  maximumFertilityTargetPercent: 140,
  repeatedCropFertilityPenaltyMultiplier: 1.5,
  naturalFertilityEquilibriumPercent: 100,
  naturalFertilityReplenishRate: 0.01,
  drySoilNaturalReplenishMultiplier: 0.5,
  aboveNaturalFertilityReplenishMultiplier: 0.2,
  aboveNaturalFertilityDemandMultiplier: 2,
  irrigationStartPercent: 10,
  irrigationStopPercent: 65,
  emptyCropIrrigationStopPercent: 35,
  minimumIrrigationPerDay: 1,
  minimumGrowthForHarvestPercent: 50,
} as const;

export const cropFarmTiers = {
  farm: {
    id: "farm",
    name: "Farm",
    maintenanceIPerMonth: 0,
    supportsImportedWater: false,
    supportsFertilizer: false,
    isGreenhouse: false,
    yieldMultiplier: 1,
    demandMultiplier: 1,
    waterEvaporationPerDay: 0.2,
    rainwaterAtFullRainPerDay: 6,
  },
  irrigatedFarm: {
    id: "irrigatedFarm",
    name: "Irrigated Farm",
    maintenanceIPerMonth: 2,
    supportsImportedWater: true,
    supportsFertilizer: true,
    isGreenhouse: false,
    yieldMultiplier: 1,
    demandMultiplier: 1,
    waterEvaporationPerDay: 0.2,
    rainwaterAtFullRainPerDay: 6,
  },
  greenhouse: {
    id: "greenhouse",
    name: "Greenhouse",
    maintenanceIPerMonth: 6,
    supportsImportedWater: true,
    supportsFertilizer: true,
    isGreenhouse: true,
    yieldMultiplier: 1.25,
    demandMultiplier: 1.125,
    waterEvaporationPerDay: 0.1,
    rainwaterAtFullRainPerDay: 6,
  },
  greenhouseII: {
    id: "greenhouseII",
    name: "Greenhouse II",
    maintenanceIPerMonth: 8,
    supportsImportedWater: true,
    supportsFertilizer: true,
    isGreenhouse: true,
    yieldMultiplier: 1.5,
    demandMultiplier: 1.25,
    waterEvaporationPerDay: 0.1,
    rainwaterAtFullRainPerDay: 6,
  },
} as const satisfies Record<CropFarmTierId, CropFarmTier>;

export const crops = {
  none: {
    id: "none",
    name: "No Crop",
    productId: null,
  },
  greenManure: {
    id: "greenManure",
    name: "Green Manure",
    productId: null,
  },
  potato: {
    id: "potato",
    name: "Potato",
    productId: "potato",
  },
  corn: {
    id: "corn",
    name: "Corn",
    productId: "corn",
  },
  wheat: {
    id: "wheat",
    name: "Wheat",
    productId: "wheat",
  },
  treeSapling: {
    id: "treeSapling",
    name: "Tree Sapling",
    productId: "treeSapling",
  },
  soybean: {
    id: "soybean",
    name: "Soybean",
    productId: "soybean",
  },
  sugarCane: {
    id: "sugarCane",
    name: "Sugar Cane",
    productId: "sugarCane",
  },
  vegetables: {
    id: "vegetables",
    name: "Vegetables",
    productId: "vegetables",
  },
  fruit: {
    id: "fruit",
    name: "Fruit",
    productId: "fruit",
  },
  canola: {
    id: "canola",
    name: "Canola",
    productId: "canola",
  },
  poppy: {
    id: "poppy",
    name: "Poppy",
    productId: "poppy",
  },
  flowers: {
    id: "flowers",
    name: "Flowers",
    productId: "flowers",
  },
} as const satisfies Record<CropId, Pick<CropDefinition, "id" | "name" | "productId">>;

export const cropProductResourceIds: ReadonlySet<ResourceId> = new Set(
  Object.values(crops).flatMap((crop) => crop.productId ? [crop.productId] : []),
);

export interface CropFarmGroupRates {
  waterPerMonth: number;
  fertilizerPerMonth: number;
  outputsPerMonth: ReadonlyMap<ResourceId, number>;
}

/**
 * Returns rotation-average rates for one fully irrigated farm. Crop and
 * fertilizer coefficients come from the snapshot; the existing fertility
 * simulation remains separate. The daily irrigation replay applies rain
 * savings to the gross water demand calculated here.
 */
export const calculateCropFarmGroupRates = (
  group: CropFarmGroup,
  definitions: CropFarmingDefinitions,
): CropFarmGroupRates => {
  const data = getCropFarmingData(definitions);
  const tier = cropFarmTiers[group.tierId];
  const fertilizer = group.fertilizer ? data.fertilizer(group.fertilizer.id) : null;
  const targetFertilityPercent = fertilizer && group.fertilizer
    ? Math.min(
        group.fertilizer.targetFertilityPercent,
        fertilizer.maximumFertilityPercent,
      )
    : cropFarmSimulation.naturalFertilityEquilibriumPercent;
  const targetFertilityMultiplier = targetFertilityPercent / 100;
  const cycleDays = group.schedule.reduce(
    (total, cropId) => total + data.crop(cropId).growthMonths * cropFarmSimulation.daysPerMonth,
    0,
  );
  const outputsPerCycle = new Map<ResourceId, number>();
  const totals = { waterPerCycle: 0, fertilityDemandPerCycle: 0 };

  group.schedule.forEach((cropId, index) => {
    const crop = data.crop(cropId);
    const cropDays = crop.growthMonths * cropFarmSimulation.daysPerMonth;
    const previousCropId = group.schedule[
      (index + group.schedule.length - 1) % group.schedule.length
    ];
    const repeatedCropPenalty = crop.fertilityPercentPerDay > 0
      && previousCropId === cropId
      ? cropFarmSimulation.repeatedCropFertilityPenaltyMultiplier
      : 1;

    if (crop.productId) {
      outputsPerCycle.set(
        crop.productId,
        (outputsPerCycle.get(crop.productId) ?? 0)
          + crop.quantityPerHarvest
          * tier.yieldMultiplier
          * targetFertilityMultiplier,
      );
    }

    // Gross crop demand; the irrigation replay accounts for rain and soil water.
    totals.waterPerCycle += crop.waterPerDay * tier.demandMultiplier * cropDays;

    if (fertilizer) {
      const aboveNaturalFertility = Math.max(
        0,
        targetFertilityPercent - cropFarmSimulation.naturalFertilityEquilibriumPercent,
      );
      const aboveNaturalDemandMultiplier = 1
        + aboveNaturalFertility / 100
        * cropFarmSimulation.aboveNaturalFertilityDemandMultiplier;
      const cropFertilityDemandPerDay = crop.fertilityPercentPerDay >= 0
        ? crop.fertilityPercentPerDay
          * tier.demandMultiplier
          * aboveNaturalDemandMultiplier
          * repeatedCropPenalty
        : crop.fertilityPercentPerDay * tier.yieldMultiplier;
      const naturalFertilityLossPerDay = aboveNaturalFertility
        * cropFarmSimulation.naturalFertilityReplenishRate
        * cropFarmSimulation.aboveNaturalFertilityReplenishMultiplier;

      totals.fertilityDemandPerCycle += (
        cropFertilityDemandPerDay + naturalFertilityLossPerDay
      ) * cropDays;
    }
  });

  const cyclesPerMonth = cropFarmSimulation.daysPerMonth / cycleDays;
  const outputsPerMonth = new Map(
    [...outputsPerCycle].map(([resourceId, quantity]) => [
      resourceId,
      quantity * cyclesPerMonth,
    ]),
  );

  return {
    waterPerMonth: totals.waterPerCycle * cyclesPerMonth,
    fertilizerPerMonth: fertilizer
      ? Math.max(0, totals.fertilityDemandPerCycle)
        / fertilizer.fertilityPercentPerUnit
        * cyclesPerMonth
      : 0,
    outputsPerMonth,
  };
};
