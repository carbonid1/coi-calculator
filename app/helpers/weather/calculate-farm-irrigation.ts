import { type CropFarmRuntime } from '../../crop-farm-runtime';
import { getCropFarmTier, getCropFarmingData, type CropFarmingDefinitions } from '../../crop-farming-state';
import {
  crops, type CropId, type CropFarmGroup,
} from "../../db/crop-farming";
import { planningWeather, type WeatherConfig } from "../../db/weather";
import { createWeatherSimulationCache } from './weather-simulation-cache';

export interface FarmIrrigationRates {
  /** Crop demand before any rainwater is captured. */
  grossWaterPerMonth: number;
  /** Water removed from the farm's imported-water buffer after rain. */
  importedWaterPerMonth: number;
}

const irrigationCache = createWeatherSimulationCache<FarmIrrigationRates>();
const forecastCache = createWeatherSimulationCache<readonly number[]>();
const FIX32_SCALE = 1_024;
const PERCENT_SCALE = 100_000;

const toFix32Raw = (value: number) => Math.round(value * FIX32_SCALE);

const applyMultiplierToFix32 = (rawValue: number, multiplier: number) => {
  const rawMultiplier = Math.round(multiplier * PERCENT_SCALE);

  return Math.trunc((rawValue * rawMultiplier + PERCENT_SCALE / 2) / PERCENT_SCALE);
};

const getCropWaterRawPerDay = (
  group: CropFarmGroup,
  definitions: CropFarmingDefinitions,
  scheduleIndex: number,
  cropWaterMultiplier: number,
  currentCropId?: CropId,
) => {
  const tier = getCropFarmTier(definitions, group.tierId);
  const crop = currentCropId ? getCropFarmingData(definitions).crop(currentCropId) : getCropForScheduleIndex(group, definitions, scheduleIndex);
  const baseWaterRaw = toFix32Raw(crop.waterPerDay);
  const tierAdjustedRaw = applyMultiplierToFix32(baseWaterRaw, tier.demandMultiplier);

  return applyMultiplierToFix32(tierAdjustedRaw, cropWaterMultiplier);
};

const calculateGrossWaterPerMonth = (
  group: CropFarmGroup,
  definitions: CropFarmingDefinitions,
  cropWaterMultiplier: number,
) => {
  const cycleDays = group.schedule.reduce(
    (total, cropId) => total + getCropFarmingData(definitions).crop(cropId).growthMonths
      * planningWeather.daysPerCycle,
    0,
  );
  const waterRawPerCycle = group.schedule.reduce(
    (total, _cropId, index) => total + getCropWaterRawPerDay(
      group,
      definitions,
      index,
      cropWaterMultiplier,
    ) * getCropForScheduleIndex(group, definitions, index).growthMonths
      * planningWeather.daysPerCycle,
    0,
  );
  const monthlyWaterRaw = Math.trunc(
    (waterRawPerCycle * planningWeather.daysPerCycle + Math.trunc(cycleDays / 2))
      / cycleDays,
  );

  return monthlyWaterRaw / FIX32_SCALE;
};

const getCropForScheduleIndex = (group: CropFarmGroup, definitions: CropFarmingDefinitions, index: number) => {
  const cropId = group.schedule[index];

  if (!cropId) throw new Error(`Missing crop ${index} in farm group ${group.id}`);

  return getCropFarmingData(definitions).crop(cropId);
};

/**
 * Replays installed 0.8.8 Farm.onNewDay with the native weather forecast.
 * Replays native soil capacity and irrigation thresholds instead of subtracting average rain.
 */
export const calculateFarmIrrigationRates = (
  group: CropFarmGroup,
  definitions: CropFarmingDefinitions,
  cropWaterMultiplier: number,
  rainwaterYieldMultiplier = 1,
  weatherConfig?: WeatherConfig,
): FarmIrrigationRates => {
  const grossWaterPerMonth = calculateGrossWaterPerMonth(group, definitions, cropWaterMultiplier);

  // Without island weather, retain gross demand instead of inventing rain savings.
  if (!weatherConfig) return { grossWaterPerMonth, importedWaterPerMonth: grossWaterPerMonth };
  const cacheKey = JSON.stringify([definitions, { ...group, currentFarms: undefined }, cropWaterMultiplier, rainwaterYieldMultiplier]);
  const cache = irrigationCache(weatherConfig);
  const cached = cache.get(cacheKey);

  if (cached) return cached;

  const horizonDays = planningWeather.horizonYears * 12 * planningWeather.daysPerCycle;
  const replay = replayFarmIrrigation(group, definitions, cropWaterMultiplier, rainwaterYieldMultiplier, weatherConfig, horizonDays);
  const horizonMonths = horizonDays / planningWeather.daysPerCycle;
  const rates = {
    grossWaterPerMonth,
    importedWaterPerMonth: replay.importedWater / horizonMonths,
  };

  cache.set(cacheKey, rates);

  return rates;
};

const replayFarmIrrigation = (group: CropFarmGroup, definitions: CropFarmingDefinitions,
  cropWaterMultiplier: number, rainwaterYieldMultiplier: number, weatherConfig: WeatherConfig,
  horizonDays: number, initial?: CropFarmRuntime) => {
  const weatherPeriods = weatherConfig.periods;
  const tier = getCropFarmTier(definitions, group.tierId);
  const simulation = definitions.simulation;
  const dailyImportedWater = initial ? Array.from({ length: horizonDays }, () => 0) : [];
  const startIndex = (initial?.scheduleIndex ?? 0) % group.schedule.length;
  const firstCropId = initial?.cropId ?? group.schedule[startIndex];

  if (!firstCropId || !(firstCropId in crops)) throw new Error("Unsupported current crop");
  const currentCropId = group.schedule.find(id => id === firstCropId) ?? Object.values(crops).find(crop => crop.id === firstCropId)?.id;

  if (!currentCropId) throw new Error("Unsupported current crop");
  const state = {
    soilWater: initial?.soilWater ?? simulation.soilWaterCapacity, waterCredit: toFix32Raw(initial?.waterCredit ?? 0), rainPartial: initial?.rainPartial ?? 0,
    importedWater: 0, scheduleIndex: startIndex, cropId: currentCropId, day: 0,
    daysRemaining: initial?.cropId ? Math.max(1, initial.daysRemaining) : getCropFarmingData(definitions).crop(currentCropId).growthMonths * planningWeather.daysPerCycle,
    cropStarted: initial?.cropStarted ?? false, wasIrrigating: initial?.irrigating ?? false, isIrrigating: false,
    weatherIndex: 0, weatherDaysRemaining: weatherPeriods[0]?.days ?? 0,
    evaporatedWater: initial?.evaporatedWater ?? 0,
  };

  const advanceWeather = () => {
    state.weatherDaysRemaining -= 1;
    if (state.weatherDaysRemaining === 0) {
      state.weatherIndex += 1;
      state.weatherDaysRemaining = weatherPeriods[state.weatherIndex]?.days ?? 0;
    }
  };

  for (; state.day < horizonDays; state.day += 1) {
    const day = state.day;

    if (initial && day === 0) { advanceWeather(); continue; }
    const importedBefore = state.importedWater;
    const weatherPeriod = weatherPeriods[
      state.weatherIndex
    ];

    if (!weatherPeriod) throw new Error(`Missing weather period for day ${day + 1}`);

    const rainIntensity = weatherPeriod.rainIntensityPercent / 100;

    // RainHarvestingHelper runs before Farm.onNewDay. It carries
    // fractional collection forward and stores only whole material units.
    if (rainIntensity > 0) {
      state.rainPartial += tier.rainwaterAtFullRainPerDay
        * rainwaterYieldMultiplier
        * rainIntensity;
      const availableRain = Math.trunc(state.rainPartial);

      state.rainPartial -= availableRain;
      const storedRain = Math.min(
        availableRain,
        simulation.soilWaterCapacity - state.soilWater,
      );

      state.soilWater += storedRain;
    }

    const emptyCrop = state.cropId === 'none';

    if (emptyCrop && state.soilWater > 0) {
      state.evaporatedWater += toFix32Raw(tier.waterEvaporationPerDay) / FIX32_SCALE
        * (state.soilWater > simulation.soilWaterCapacity / 2 ? 2 : 1);
      if (state.evaporatedWater >= 1) { state.soilWater -= 1; state.evaporatedWater -= 1; }
    }
    const waterRawPerDay = getCropWaterRawPerDay(
      group,
      definitions,
      state.scheduleIndex,
      cropWaterMultiplier,
      state.cropId,
    );
    const waterPerDay = waterRawPerDay / FIX32_SCALE;
    const normalStartThreshold = simulation.soilWaterCapacity
      * simulation.irrigationStartPercent / 100;
    const irrigationStartThreshold = state.cropStarted
      ? normalStartThreshold
      : Math.max(normalStartThreshold, waterPerDay * 10);
    const continueIrrigating = state.wasIrrigating
      && state.soilWater / simulation.soilWaterCapacity
        < (emptyCrop ? simulation.emptyCropIrrigationStopPercent : simulation.irrigationStopPercent) / 100;
    const shouldIrrigate = continueIrrigating || state.soilWater < irrigationStartThreshold;

    state.isIrrigating = false;

    if (rainIntensity === 0 && shouldIrrigate) {
      const irrigationAmount = Math.min(
        simulation.soilWaterCapacity - state.soilWater,
        Math.max(
          Math.ceil(waterPerDay * 2),
          simulation.minimumIrrigationPerDay,
        ),
      );

      state.soilWater += irrigationAmount;
      state.importedWater += irrigationAmount;
      state.isIrrigating = irrigationAmount > 0;
    }

    if (waterRawPerDay > state.waterCredit) {
      const waterToWithdraw = Math.ceil(
        (waterRawPerDay - state.waterCredit) / FIX32_SCALE,
      );

      if (state.soilWater >= waterToWithdraw) {
        state.soilWater -= waterToWithdraw;
        state.waterCredit += waterToWithdraw * FIX32_SCALE;
      }
    }

    const hasStartupBuffer = state.cropStarted
      || waterRawPerDay * 10 <= state.waterCredit + state.soilWater * FIX32_SCALE;

    if (hasStartupBuffer && waterRawPerDay <= state.waterCredit) {
      state.waterCredit -= waterRawPerDay;
      state.cropStarted = true;
      state.daysRemaining -= 1;

      if (state.daysRemaining === 0) {
        state.scheduleIndex = (state.scheduleIndex + 1) % group.schedule.length;
        state.cropId = group.schedule[state.scheduleIndex] ?? state.cropId;
        state.daysRemaining = getCropForScheduleIndex(group, definitions, state.scheduleIndex).growthMonths
          * planningWeather.daysPerCycle;
        state.cropStarted = false;
      }
    }

    state.wasIrrigating = state.isIrrigating;
    if (initial) dailyImportedWater[day] = state.importedWater - importedBefore;
    advanceWeather();
  }
  return { importedWater: state.importedWater, dailyImportedWater };
};

/** The captured day has already run. Index 1 is the next native farm day. */
export const calculateFarmIrrigationForecast = (group: CropFarmGroup, definitions: CropFarmingDefinitions,
  cropWaterMultiplier: number, rainwaterYieldMultiplier: number, weather: WeatherConfig,
  farm: NonNullable<CropFarmGroup['currentFarms']>[number]) => {
  const cache = forecastCache(weather);
  const key = JSON.stringify([definitions, group.tierId, cropWaterMultiplier, rainwaterYieldMultiplier, farm]);
  const cached = cache.get(key);

  if (cached) return cached;
  const forecast = replayFarmIrrigation({ ...group, schedule: farm.schedule }, definitions, cropWaterMultiplier,
    rainwaterYieldMultiplier, weather, planningWeather.daysPerCycle * 12 + 1, farm.runtime).dailyImportedWater;

  cache.set(key, forecast);
  return forecast;
};
