export interface ChickenFarmSettings {
  farmCount: number;
  chickenCount: number;
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
  farmCount: 3,
  chickenCount: chickenFarm.capacity,
  slaughtering: true,
};

export const getChickenFarmRates = (settings: ChickenFarmSettings) => {
  const farmCount = Math.max(1, Math.trunc(settings.farmCount));
  const chickenCount = Math.min(
    chickenFarm.capacity,
    Math.max(chickenFarm.countStep, settings.chickenCount),
  );
  const slaughteredChickens = settings.slaughtering
    ? chickenCount * chickenFarm.birthsPer100Chickens / 100
    : 0;

  return {
    animalFeed: farmCount * chickenCount * chickenFarm.feedPerChicken,
    water: farmCount * chickenCount * chickenFarm.waterPerChicken,
    eggs: farmCount * chickenCount * chickenFarm.eggsPerChicken,
    chickenCarcass: farmCount * slaughteredChickens * chickenFarm.carcassPerSlaughteredChicken,
  };
};
