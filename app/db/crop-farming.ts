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
  workers: number;
  electricityKw: number;
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
    workers: 8,
    electricityKw: 0,
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
    workers: 10,
    electricityKw: 0,
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
    workers: 16,
    electricityKw: 0,
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
    workers: 20,
    electricityKw: 0,
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

export const fertilizers = {
  organic: {
    id: "organic",
    resourceId: "fertilizerOrganic",
    fertilityPercentPerUnit: 1,
    maximumFertilityPercent: 100,
  },
  fertilizerI: {
    id: "fertilizerI",
    resourceId: "fertilizerI",
    fertilityPercentPerUnit: 2,
    maximumFertilityPercent: 120,
  },
  fertilizerII: {
    id: "fertilizerII",
    resourceId: "fertilizerII",
    fertilityPercentPerUnit: 2.5,
    maximumFertilityPercent: 140,
  },
} as const satisfies Record<FertilizerId, FertilizerDefinition>;

export const crops = {
  none: {
    id: "none",
    name: "No Crop",
    productId: null,
    quantityPerHarvest: 0,
    waterPerDay: 0,
    fertilityPercentPerDay: 0,
    growthMonths: 3,
    survivesWithoutWaterMonths: null,
    requiresGreenhouse: false,
  },
  greenManure: {
    id: "greenManure",
    name: "Green Manure",
    productId: null,
    quantityPerHarvest: 0,
    waterPerDay: 0.9,
    fertilityPercentPerDay: -0.12,
    growthMonths: 2,
    survivesWithoutWaterMonths: null,
    requiresGreenhouse: false,
  },
  potato: {
    id: "potato",
    name: "Potato",
    productId: "potato",
    quantityPerHarvest: 58,
    waterPerDay: 1.2,
    fertilityPercentPerDay: 0.35,
    growthMonths: 3,
    survivesWithoutWaterMonths: 3,
    requiresGreenhouse: false,
  },
  corn: {
    id: "corn",
    name: "Corn",
    productId: "corn",
    quantityPerHarvest: 66,
    waterPerDay: 1.33,
    fertilityPercentPerDay: 0.4,
    growthMonths: 4,
    survivesWithoutWaterMonths: 1,
    requiresGreenhouse: false,
  },
  wheat: {
    id: "wheat",
    name: "Wheat",
    productId: "wheat",
    quantityPerHarvest: 58,
    waterPerDay: 1.06,
    fertilityPercentPerDay: 0.35,
    growthMonths: 6,
    survivesWithoutWaterMonths: 2,
    requiresGreenhouse: false,
  },
  treeSapling: {
    id: "treeSapling",
    name: "Tree Sapling",
    productId: "treeSapling",
    quantityPerHarvest: 60,
    waterPerDay: 0.9,
    fertilityPercentPerDay: 0.2,
    growthMonths: 12,
    survivesWithoutWaterMonths: 10,
    requiresGreenhouse: false,
  },
  soybean: {
    id: "soybean",
    name: "Soybean",
    productId: "soybean",
    quantityPerHarvest: 22,
    waterPerDay: 1.2,
    fertilityPercentPerDay: 0.5,
    growthMonths: 4,
    survivesWithoutWaterMonths: 1,
    requiresGreenhouse: false,
  },
  sugarCane: {
    id: "sugarCane",
    name: "Sugar Cane",
    productId: "sugarCane",
    quantityPerHarvest: 198,
    waterPerDay: 1.6,
    fertilityPercentPerDay: 0.5,
    growthMonths: 9,
    survivesWithoutWaterMonths: 3,
    requiresGreenhouse: true,
  },
  vegetables: {
    id: "vegetables",
    name: "Vegetables",
    productId: "vegetables",
    quantityPerHarvest: 60,
    waterPerDay: 1.07,
    fertilityPercentPerDay: 0.35,
    growthMonths: 4,
    survivesWithoutWaterMonths: 3,
    requiresGreenhouse: false,
  },
  fruit: {
    id: "fruit",
    name: "Fruit",
    productId: "fruit",
    quantityPerHarvest: 80,
    waterPerDay: 1.33,
    fertilityPercentPerDay: 0.3,
    growthMonths: 8,
    survivesWithoutWaterMonths: 3,
    requiresGreenhouse: true,
  },
  canola: {
    id: "canola",
    name: "Canola",
    productId: "canola",
    quantityPerHarvest: 36,
    waterPerDay: 0.93,
    fertilityPercentPerDay: 0.3,
    growthMonths: 3,
    survivesWithoutWaterMonths: 1,
    requiresGreenhouse: false,
  },
  poppy: {
    id: "poppy",
    name: "Poppy",
    productId: "poppy",
    quantityPerHarvest: 25,
    waterPerDay: 0.9,
    fertilityPercentPerDay: 0.3,
    growthMonths: 4,
    survivesWithoutWaterMonths: 1,
    requiresGreenhouse: true,
  },
  flowers: {
    id: "flowers",
    name: "Flowers",
    productId: "flowers",
    quantityPerHarvest: 24,
    waterPerDay: 1.5,
    fertilityPercentPerDay: 0.5,
    growthMonths: 4,
    survivesWithoutWaterMonths: 1,
    requiresGreenhouse: true,
  },
} as const satisfies Record<CropId, CropDefinition>;

export const cropProductResourceIds: ReadonlySet<ResourceId> = new Set(
  Object.values(crops).flatMap((crop) => crop.productId ? [crop.productId] : []),
);

export interface NominalCropRates {
  quantityPerHarvest: number;
  quantityPerMonth: number;
  waterPerDay: number;
  waterPerMonth: number;
  fertilityPercentPerDay: number;
}

export interface CropFarmGroupRates {
  waterPerMonth: number;
  fertilizerPerMonth: number;
  outputsPerMonth: ReadonlyMap<ResourceId, number>;
}

/**
 * Fixed end-game layout sized for the current factory snapshot.
 * Identical fertility-consuming crops are never adjacent, including across
 * the wrap. Six Greenhouse II buildings remain sufficient for the current
 * factory, including Poppy for the Medical Supplies III chain. Each crop's
 * primary surplus stays at or below 5 per production cycle before digestion.
 */
export const activeCropFarmGroups: readonly CropFarmGroup[] = [
  {
    id: "greenhouse-ii-vegetables-corn-vegetables-soybean",
    name: "Vegetables / Corn / Vegetables / Soybean",
    farmCount: 1,
    tierId: "greenhouseII",
    schedule: ["vegetables", "corn", "vegetables", "soybean"],
    fertilizer: { id: "fertilizerII", targetFertilityPercent: 140 },
  },
  {
    id: "greenhouse-ii-potato-fruit-canola-wheat",
    name: "Potato / Fruit / Canola / Wheat",
    farmCount: 1,
    tierId: "greenhouseII",
    schedule: ["potato", "fruit", "canola", "wheat"],
    fertilizer: { id: "fertilizerII", targetFertilityPercent: 140 },
  },
  {
    id: "greenhouse-ii-wheat-corn-wheat-corn",
    name: "Wheat / Corn / Wheat / Corn",
    farmCount: 1,
    tierId: "greenhouseII",
    schedule: ["wheat", "corn", "wheat", "corn"],
    fertilizer: { id: "fertilizerII", targetFertilityPercent: 140 },
  },
  {
    id: "greenhouse-ii-wheat-corn-wheat-potato",
    name: "Wheat / Corn / Wheat / Potato",
    farmCount: 1,
    tierId: "greenhouseII",
    schedule: ["wheat", "corn", "wheat", "potato"],
    fertilizer: { id: "fertilizerII", targetFertilityPercent: 130 },
  },
  {
    id: "greenhouse-ii-corn-poppy-corn-wheat",
    name: "Corn / Poppy / Corn / Wheat",
    farmCount: 1,
    tierId: "greenhouseII",
    schedule: ["corn", "poppy", "corn", "wheat"],
    fertilizer: { id: "fertilizerII", targetFertilityPercent: 140 },
  },
  {
    id: "greenhouse-ii-fruit-sugar-cane-wheat-tree-sapling",
    name: "Fruit / Sugar Cane / Wheat / Tree Sapling",
    farmCount: 1,
    tierId: "greenhouseII",
    schedule: ["fruit", "sugarCane", "wheat", "treeSapling"],
    fertilizer: { id: "fertilizerII", targetFertilityPercent: 140 },
  },
] as const;

/**
 * Returns long-run /60 rates for one farm in a group. With a full irrigation
 * supply, the 100-year output average reduces to the repeating schedule's
 * cycle average. Water is the conservative full-pipe requirement; verified
 * seed-specific rain savings can be introduced without changing crop output.
 *
 * The v0.8.6 fertility rules are still applied to Fertilizer II demand,
 * including the 50% repeated-crop penalty and the faster demand above 100%.
 */
export const calculateCropFarmGroupRates = (
  group: CropFarmGroup,
): CropFarmGroupRates => {
  const tier = cropFarmTiers[group.tierId];
  const fertilizer = group.fertilizer ? fertilizers[group.fertilizer.id] : null;
  const targetFertilityPercent = group.fertilizer?.targetFertilityPercent
    ?? cropFarmSimulation.naturalFertilityEquilibriumPercent;
  const targetFertilityMultiplier = targetFertilityPercent / 100;
  const cycleDays = group.schedule.reduce(
    (total, cropId) => total + crops[cropId].growthMonths * cropFarmSimulation.daysPerMonth,
    0,
  );
  const outputsPerCycle = new Map<ResourceId, number>();
  let waterPerCycle = 0;
  let fertilityDemandPerCycle = 0;

  group.schedule.forEach((cropId, index) => {
    const crop = crops[cropId];
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

    // In v0.8.6, farm evaporation applies while nothing is growing. These
    // fixed rotations keep a crop active, so their displayed water value is
    // gross crop demand only. Idle-period evaporation belongs in the future
    // daily soil-buffer simulation, where its buffer-dependent multiplier can
    // be represented correctly.
    waterPerCycle += crop.waterPerDay * tier.demandMultiplier * cropDays;

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

      fertilityDemandPerCycle += (
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
    waterPerMonth: waterPerCycle * cyclesPerMonth,
    fertilizerPerMonth: fertilizer
      ? Math.max(0, fertilityDemandPerCycle)
        / fertilizer.fertilityPercentPerUnit
        * cyclesPerMonth
      : 0,
    outputsPerMonth,
  };
};

/**
 * Fully watered rates at constant 100% fertility, before rotation penalties,
 * rainwater, fertilizer control, or global farm modifiers are simulated.
 */
export const getNominalCropRates = (
  tierId: CropFarmTierId,
  cropId: CropId,
): NominalCropRates => {
  const tier = cropFarmTiers[tierId];
  const crop = crops[cropId];
  const fertilityMultiplier = crop.fertilityPercentPerDay < 0
    ? tier.yieldMultiplier
    : tier.demandMultiplier;
  const quantityPerHarvest = crop.quantityPerHarvest * tier.yieldMultiplier;
  const waterPerDay = crop.waterPerDay * tier.demandMultiplier;
  const fertilityPercentPerDay = crop.fertilityPercentPerDay * fertilityMultiplier;

  return {
    quantityPerHarvest,
    quantityPerMonth: quantityPerHarvest / crop.growthMonths,
    waterPerDay,
    waterPerMonth: waterPerDay * cropFarmSimulation.daysPerMonth,
    fertilityPercentPerDay,
  };
};
