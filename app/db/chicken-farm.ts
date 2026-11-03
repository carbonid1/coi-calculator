import { type ChickenFarmDefinition } from '../chicken-farm-state'

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

export const plannedChickenFarmSettings: ChickenFarmSettings = {
  totalChickenCount: 2_350,
  slaughtering: true,
};

export const getChickenFarmLayout = (totalChickenCount: number, chickenFarm: ChickenFarmDefinition) => {
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

export const getChickenFarmRates = (settings: ChickenFarmSettings, chickenFarm: ChickenFarmDefinition) => {
  // Synced livestock can fall between planning steps; rates use the exact flock.
  const totalChickenCount = Math.max(0, settings.totalChickenCount);
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
