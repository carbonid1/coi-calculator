import { type CropFarmRuntime } from '../crop-farm-runtime';
import { getCropFarmTier, getCropFarmingData, type CropFarmingDefinitions } from '../crop-farming-state';
import { type ResourceId } from "./resources";
import { planningWeather } from "./weather";

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

export interface CropFarmTier { id: CropFarmTierId; name: string }

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
  currentFarms?: { schedule: CropSchedule; runtime: CropFarmRuntime }[];
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
  runtime?: CropFarmRuntime;
  entityId: number;
  tierId: Extract<CropFarmTierId, "greenhouse" | "greenhouseII">;
  schedule: readonly string[];
  fertilityTargetPercent: number;
  fertilizerId?: FertilizerId | null;
  running: boolean;
  zones?: readonly { id: number; name: string | null }[];
}

export const cropFarmTiers = {
  farm: { id: "farm", name: "Farm" },
  irrigatedFarm: { id: "irrigatedFarm", name: "Irrigated Farm" },
  greenhouse: { id: "greenhouse", name: "Greenhouse" },
  greenhouseII: { id: "greenhouseII", name: "Greenhouse II" },
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

export const isCropSchedule = (schedule: readonly string[]): schedule is CropSchedule =>
  schedule.length >= 1 && schedule.length <= 4 && schedule.every(id => id in crops);

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
  const tier = getCropFarmTier(definitions, group.tierId);
  const simulation = definitions.simulation;
  const fertilizer = group.fertilizer ? data.fertilizer(group.fertilizer.id) : null;
  const targetFertilityPercent = fertilizer && group.fertilizer
    ? Math.min(
        group.fertilizer.targetFertilityPercent,
        fertilizer.maximumFertilityPercent,
      )
    : 100;
  const targetFertilityMultiplier = targetFertilityPercent / 100;
  const cycleDays = group.schedule.reduce(
    (total, cropId) => total + data.crop(cropId).growthMonths * planningWeather.daysPerCycle,
    0,
  );
  const outputsPerCycle = new Map<ResourceId, number>();
  const totals = { waterPerCycle: 0, fertilityDemandPerCycle: 0 };

  group.schedule.forEach((cropId, index) => {
    const crop = data.crop(cropId);
    const cropDays = crop.growthMonths * planningWeather.daysPerCycle;
    const previousCropId = group.schedule[
      (index + group.schedule.length - 1) % group.schedule.length
    ];
    const repeatedCropPenalty = crop.fertilityPercentPerDay > 0
      && previousCropId === cropId
      ? 1 + simulation.repeatedCropFertilityPenalty
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
        targetFertilityPercent - 100,
      );
      const aboveNaturalDemandMultiplier = 1
        + aboveNaturalFertility / 100
        * simulation.aboveNaturalFertilityDemandMultiplier;
      const cropFertilityDemandPerDay = crop.fertilityPercentPerDay >= 0
        ? crop.fertilityPercentPerDay
          * tier.demandMultiplier
          * aboveNaturalDemandMultiplier
          * repeatedCropPenalty
        : crop.fertilityPercentPerDay * tier.yieldMultiplier;
      const naturalFertilityLossPerDay = aboveNaturalFertility
        * tier.naturalFertilityReplenishRate
        * simulation.aboveNaturalFertilityReplenishMultiplier;

      totals.fertilityDemandPerCycle += (
        cropFertilityDemandPerDay + naturalFertilityLossPerDay
      ) * cropDays;
    }
  });

  const cyclesPerMonth = planningWeather.daysPerCycle / cycleDays;
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
