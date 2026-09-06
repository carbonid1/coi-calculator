export interface ChickenFarmSettings {
  totalChickenCount: number;
  slaughtering: boolean;
}

export interface CurrentChickenFarmEntity {
  entityId: number;
  running: boolean;
  slaughtering: boolean;
  chickens: number;
  zones: readonly {
    id: number;
    name: string | null;
  }[];
}

/**
 * Captain of Industry v0.8.7 AnimalFarmsData and AnimalFarmInspector values.
 * Fix32 stores the per-animal rates rounded to the nearest 1/1024 before scaling.
 * One in-game month is the calculator's 60-second production cycle.
 */
export const chickenFarm = {
  capacity: 500,
  countStep: 50,
  feedPerChicken: 31 / 1024,
  waterPerChicken: 37 / 1024,
  eggsPerChicken: 15 / 1024,
  birthsPer100Chickens: 4,
  carcassPerSlaughteredChicken: 0.5,
} as const;

export const plannedChickenFarmSettings: ChickenFarmSettings = {
  totalChickenCount: 2_350,
  slaughtering: true,
};

export const getChickenFarmLayout = (totalChickenCount: number) => {
  const roundedChickenCount = Math.round(
    totalChickenCount / chickenFarm.countStep,
  ) * chickenFarm.countStep;
  const normalizedChickenCount = Math.max(0, roundedChickenCount);
  const fullFarmCount = Math.floor(normalizedChickenCount / chickenFarm.capacity);
  const partialFarmChickenCount = normalizedChickenCount % chickenFarm.capacity;

  return {
    totalChickenCount: normalizedChickenCount,
    farmCount: fullFarmCount + (partialFarmChickenCount > 0 ? 1 : 0),
    fullFarmCount,
    partialFarmChickenCount,
  };
};

export const getChickenFarmRates = (settings: ChickenFarmSettings) => {
  const { totalChickenCount } = getChickenFarmLayout(settings.totalChickenCount);
  const slaughteredChickens = settings.slaughtering
    ? totalChickenCount * chickenFarm.birthsPer100Chickens / 100
    : 0;

  return {
    animalFeed: totalChickenCount * chickenFarm.feedPerChicken,
    water: totalChickenCount * chickenFarm.waterPerChicken,
    eggs: totalChickenCount * chickenFarm.eggsPerChicken,
    chickenCarcass: slaughteredChickens * chickenFarm.carcassPerSlaughteredChicken,
  };
};
