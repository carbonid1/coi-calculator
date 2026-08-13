export interface ChickenFarmSettings {
  totalChickenCount: number;
  slaughtering: boolean;
}

/**
 * Captain of Industry v0.8.6 AnimalFarmsData and AnimalFarm runtime values.
 * One in-game month is the calculator's 60-second production cycle.
 */
export const chickenFarm = {
  capacity: 500,
  countStep: 50,
  feedPerChicken: 0.03,
  waterPerChicken: 0.036,
  eggsPerChicken: 0.015,
  birthsPer100Chickens: 4,
  carcassPerSlaughteredChicken: 0.5,
} as const;

export const defaultChickenFarmSettings: ChickenFarmSettings = {
  totalChickenCount: 1_700,
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
