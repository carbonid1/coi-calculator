import {
  cropFarmSimulation,
  cropFarmTiers,
  crops,
  type CropFarmGroup,
} from "../../db/crop-farming";
import { planningWeather, weatherTypes } from "../../db/weather";
import { getPlanningWeather } from "./generate-planning-weather";

export interface FarmIrrigationRates {
  /** Crop demand before any rainwater is captured. */
  grossWaterPerMonth: number;
  /** Water removed from the farm's imported-water buffer after rain. */
  importedWaterPerMonth: number;
  capturedRainwaterPerMonth: number;
}

const irrigationCache = new Map<string, FarmIrrigationRates>();
const FIX32_SCALE = 1_024;
const PERCENT_SCALE = 100_000;

const toFix32Raw = (value: number) => Math.round(value * FIX32_SCALE);

const applyMultiplierToFix32 = (rawValue: number, multiplier: number) => {
  const rawMultiplier = Math.round(multiplier * PERCENT_SCALE);

  return Math.trunc((rawValue * rawMultiplier + PERCENT_SCALE / 2) / PERCENT_SCALE);
};

const getCropWaterRawPerDay = (
  group: CropFarmGroup,
  scheduleIndex: number,
  cropWaterMultiplier: number,
) => {
  const tier = cropFarmTiers[group.tierId];
  const crop = getCropForScheduleIndex(group, scheduleIndex);
  const baseWaterRaw = toFix32Raw(crop.waterPerDay);
  const tierAdjustedRaw = applyMultiplierToFix32(baseWaterRaw, tier.demandMultiplier);

  return applyMultiplierToFix32(tierAdjustedRaw, cropWaterMultiplier);
};

const calculateGrossWaterPerMonth = (
  group: CropFarmGroup,
  cropWaterMultiplier: number,
) => {
  const cycleDays = group.schedule.reduce(
    (total, cropId) => total + crops[cropId].growthMonths
      * cropFarmSimulation.daysPerMonth,
    0,
  );
  const waterRawPerCycle = group.schedule.reduce(
    (total, _cropId, index) => total + getCropWaterRawPerDay(
      group,
      index,
      cropWaterMultiplier,
    ) * getCropForScheduleIndex(group, index).growthMonths
      * cropFarmSimulation.daysPerMonth,
    0,
  );
  const monthlyWaterRaw = Math.trunc(
    (waterRawPerCycle * cropFarmSimulation.daysPerMonth + Math.trunc(cycleDays / 2))
      / cycleDays,
  );

  return monthlyWaterRaw / FIX32_SCALE;
};

const getCropForScheduleIndex = (group: CropFarmGroup, index: number) => {
  const cropId = group.schedule[index];

  if (!cropId) throw new Error(`Missing crop ${index} in farm group ${group.id}`);

  return crops[cropId];
};

/**
 * Replays Captain of Industry v0.8.6's daily farm water-buffer algorithm for
 * the configured 100-year weather sequence. Rain fills the 50-unit soil
 * buffer before irrigation; irrigation runs only on dry days and follows the
 * game's 10% start / 65% stop hysteresis. This is why average rainfall cannot
 * simply be subtracted from gross crop demand.
 */
export const calculateFarmIrrigationRates = (
  group: CropFarmGroup,
  cropWaterMultiplier: number,
): FarmIrrigationRates => {
  const cacheKey = `${group.id}:${cropWaterMultiplier}`;
  const cached = irrigationCache.get(cacheKey);

  if (cached) return cached;

  const weatherPeriods = getPlanningWeather();
  const tier = cropFarmTiers[group.tierId];
  const horizonDays = planningWeather.horizonYears * 12 * cropFarmSimulation.daysPerMonth;
  const grossWaterPerMonth = calculateGrossWaterPerMonth(
    group,
    cropWaterMultiplier,
  );
  let soilWater = cropFarmSimulation.soilWaterCapacity;
  let waterCredit = 0;
  let rainPartial = 0;
  let importedWater = 0;
  let capturedRainwater = 0;
  let scheduleIndex = 0;
  let daysRemaining = getCropForScheduleIndex(group, scheduleIndex).growthMonths
    * cropFarmSimulation.daysPerMonth;
  let cropStarted = false;
  let wasIrrigating = false;

  for (let day = 0; day < horizonDays; day += 1) {
    const weatherPeriod = weatherPeriods[
      Math.trunc(day / planningWeather.weatherPeriodDays)
    ];

    if (!weatherPeriod) throw new Error(`Missing weather period for day ${day + 1}`);

    const rainIntensity = weatherTypes[weatherPeriod].rainIntensityPercent / 100;

    // RainHarvestingHelper runs before Farm.onNewDay in v0.8.6. It carries
    // fractional collection forward and stores only whole material units.
    if (rainIntensity > 0) {
      rainPartial += tier.rainwaterAtFullRainPerDay * rainIntensity;
      const availableRain = Math.trunc(rainPartial);

      rainPartial -= availableRain;
      const storedRain = Math.min(
        availableRain,
        cropFarmSimulation.soilWaterCapacity - soilWater,
      );

      soilWater += storedRain;
      capturedRainwater += storedRain;
    }

    const waterRawPerDay = getCropWaterRawPerDay(
      group,
      scheduleIndex,
      cropWaterMultiplier,
    );
    const waterPerDay = waterRawPerDay / FIX32_SCALE;
    const normalStartThreshold = cropFarmSimulation.soilWaterCapacity
      * cropFarmSimulation.irrigationStartPercent / 100;
    const irrigationStartThreshold = cropStarted
      ? normalStartThreshold
      : Math.max(normalStartThreshold, waterPerDay * 10);
    const continueIrrigating = wasIrrigating
      && soilWater / cropFarmSimulation.soilWaterCapacity
        < cropFarmSimulation.irrigationStopPercent / 100;
    const shouldIrrigate = continueIrrigating || soilWater < irrigationStartThreshold;
    let isIrrigating = false;

    if (rainIntensity === 0 && shouldIrrigate) {
      const irrigationAmount = Math.min(
        cropFarmSimulation.soilWaterCapacity - soilWater,
        Math.max(
          Math.ceil(waterPerDay * 2),
          cropFarmSimulation.minimumIrrigationPerDay,
        ),
      );

      soilWater += irrigationAmount;
      importedWater += irrigationAmount;
      isIrrigating = irrigationAmount > 0;
    }

    if (waterRawPerDay > waterCredit) {
      const waterToWithdraw = Math.ceil(
        (waterRawPerDay - waterCredit) / FIX32_SCALE,
      );

      if (soilWater >= waterToWithdraw) {
        soilWater -= waterToWithdraw;
        waterCredit += waterToWithdraw * FIX32_SCALE;
      }
    }

    const hasStartupBuffer = cropStarted
      || waterRawPerDay * 10 <= waterCredit + soilWater * FIX32_SCALE;

    if (hasStartupBuffer && waterRawPerDay <= waterCredit) {
      waterCredit -= waterRawPerDay;
      cropStarted = true;
      daysRemaining -= 1;

      if (daysRemaining === 0) {
        scheduleIndex = (scheduleIndex + 1) % group.schedule.length;
        daysRemaining = getCropForScheduleIndex(group, scheduleIndex).growthMonths
          * cropFarmSimulation.daysPerMonth;
        cropStarted = false;
      }
    }

    wasIrrigating = isIrrigating;
  }

  const horizonMonths = horizonDays / cropFarmSimulation.daysPerMonth;
  const rates = {
    grossWaterPerMonth,
    importedWaterPerMonth: importedWater / horizonMonths,
    capturedRainwaterPerMonth: capturedRainwater / horizonMonths,
  };

  irrigationCache.set(cacheKey, rates);

  return rates;
};
