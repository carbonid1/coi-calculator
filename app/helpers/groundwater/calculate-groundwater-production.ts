import { cropFarmSimulation } from "../../db/crop-farming";
import { planningWeather, type WeatherConfig } from "../../db/weather";
import { type SyncedGroundwaterAquifer, type SyncedGroundwaterState, type SyncedMachineInventoryItem } from "../../game-state";

// Installed 0.8.8 WellPumpsData: 8 Water every 10s = 48 / production cycle.
export const GROUNDWATER_PUMP_OUTPUT_PER_CYCLE = 48;

// Installed v0.8.8 GroundWaterManager.CAPACITY_REPLENISH_PER_DAY.
const MAX_EMERGENCY_WATER = 200;
const PERCENT_RAW_SCALE = 100_000;
const CAPACITY_REPLENISH_RAW_PERCENT = 185;

export interface GroundwaterClaimPlan {
  claimId: string;
  projectedPumpCount: number;
  machines: readonly SyncedMachineInventoryItem[];
}

export interface GroundwaterSourceConstraint {
  aquiferCount: number;
  currentReserve: number;
  reserveCapacity: number;
  projectedPumpCount: number;
  aquiferSustainableCeilingPerCycle: number;
  pumpCapacityPerCycle: number;
  sustainableOutputPerCycle: number;
  aquiferAllocations?: { aquiferId: string; pumpCount: number; sustainableOutputPerCycle: number }[];
}

interface AquiferAllocation {
  aquifer: SyncedGroundwaterAquifer;
  pumpsByClaim: Map<string, number>;
}

const simulationCache = new WeakMap<WeatherConfig, Map<string, number>>();
const aquiferCeilingCache = new WeakMap<WeatherConfig, Map<string, number>>();

const applyPercentRaw = (value: number, rawPercent: number) => Math.trunc(
  (value * rawPercent + PERCENT_RAW_SCALE / 2) / PERCENT_RAW_SCALE,
);

const multiplyPercentRaw = (left: number, right: number) => Math.trunc(
  left * right / PERCENT_RAW_SCALE,
);

// Installed 0.8.8 GroundWaterManager.onNewDay rounds the base recharge to a
// whole unit BEFORE applying the low-water difficulty multiplier as Fix32.
export const getDryEmergencyRechargePerDay = (aquifer: SyncedGroundwaterAquifer, groundwater: SyncedGroundwaterState) => (
  Math.round(applyPercentRaw(aquifer.configuredCapacity, CAPACITY_REPLENISH_RAW_PERCENT)
    * groundwater.replenishWhenLowPercent / 100 * 1_024) / 1_024
);

export const getAquiferRainRechargePerDay = (aquifer: SyncedGroundwaterAquifer, rainIntensityPercent: number) => (
  applyPercentRaw(aquifer.configuredCapacity, multiplyPercentRaw(CAPACITY_REPLENISH_RAW_PERCENT,
    Math.round(rainIntensityPercent * 1_000)))
);

export interface AquiferReserveState { reserve: number; emergencyReserve: number }

/** Daily estimate; native fixed-point recharge, with continuous average pumping. */
export const advanceAquiferDay = (
  state: AquiferReserveState,
  aquifer: SyncedGroundwaterAquifer,
  groundwater: SyncedGroundwaterState,
  rainIntensityPercent: number,
  pumpCapacityPerDay: number,
  requestedPerDay = pumpCapacityPerDay,
) => {
  if (rainIntensityPercent > 0) {
    state.reserve = Math.min(aquifer.capacity, state.reserve + getAquiferRainRechargePerDay(aquifer, rainIntensityPercent));
  } else if (state.reserve <= 0 && groundwater.replenishWhenLowPercent > 0
    && Math.trunc(state.emergencyReserve) <= MAX_EMERGENCY_WATER) {
    state.emergencyReserve += getDryEmergencyRechargePerDay(aquifer, groundwater);
  }
  if (pumpCapacityPerDay <= 0) return 0;
  const normalOutput = Math.min(state.reserve, pumpCapacityPerDay, requestedPerDay);
  const depletedCapacity = pumpCapacityPerDay * groundwater.depletedPumpSpeedPercent / 100
    * Math.max(0, 1 - normalOutput / pumpCapacityPerDay);
  const emergencyOutput = Math.min(state.emergencyReserve, depletedCapacity, Math.max(0, requestedPerDay - normalOutput));

  state.reserve = Math.max(0, state.reserve - normalOutput);
  state.emergencyReserve = Math.max(0, state.emergencyReserve - emergencyOutput);
  return normalOutput + emergencyOutput;
};

/**
 * Maximum long-run output of the physical aquifer with enough pumps to collect
 * every unit replenished by rain and low-reserve difficulty assistance.
 */
export const calculateAquiferSustainableCeiling = (
  aquifer: SyncedGroundwaterAquifer,
  groundwater: SyncedGroundwaterState,
  weatherConfig: WeatherConfig,
) => {
  const cacheKey = [
    aquifer.capacity,
    aquifer.configuredCapacity,
    groundwater.depletedPumpSpeedPercent,
    groundwater.replenishWhenLowPercent,
  ].join(":");
  const cache = aquiferCeilingCache.get(weatherConfig) ?? new Map<string, number>();

  aquiferCeilingCache.set(weatherConfig, cache);
  const cached = cache.get(cacheKey);

  if (cached != null) return cached;

  const weather = weatherConfig.periods;
  const emergencyOutputPerDryDay = groundwater.depletedPumpSpeedPercent > 0
    ? getDryEmergencyRechargePerDay(aquifer, groundwater)
    : 0;
  const output = weather.reduce((total, period) => {
    const outputPerDay = period.rainIntensityPercent > 0
      ? Math.min(aquifer.capacity, getAquiferRainRechargePerDay(aquifer, period.rainIntensityPercent))
      : emergencyOutputPerDryDay;

    return total + outputPerDay * period.days;
  }, 0);

  const ceiling = output / (planningWeather.horizonYears * 12);

  cache.set(cacheKey, ceiling);
  return ceiling;
};

/**
 * Replays the installed v0.8.8 aquifer rules after a depleted-state warm-up.
 * Rain replenishes the normal reserve; dry days replenish the hidden emergency
 * reserve only while normal groundwater is empty. Pumps use normal capacity at
 * full speed and the emergency reserve at the configured depleted speed.
 */
export const calculateAquiferSustainableOutput = (
  aquifer: SyncedGroundwaterAquifer,
  pumpCount: number,
  groundwater: SyncedGroundwaterState,
  weatherConfig: WeatherConfig,
) => {
  if (pumpCount <= 0) return 0;

  const cacheKey = [
    aquifer.capacity,
    aquifer.configuredCapacity,
    pumpCount,
    groundwater.depletedPumpSpeedPercent,
    groundwater.replenishWhenLowPercent,
  ].join(":");
  const cache = simulationCache.get(weatherConfig) ?? new Map<string, number>();

  simulationCache.set(weatherConfig, cache);
  const cached = cache.get(cacheKey);

  if (cached != null) return cached;

  const weather = weatherConfig.periods;
  const daysPerCycle = cropFarmSimulation.daysPerMonth;
  const pumpCapacityPerDay = GROUNDWATER_PUMP_OUTPUT_PER_CYCLE
    * pumpCount
    / daysPerCycle;
  const replayHorizon = (initialReserve: number, initialEmergencyReserve: number) => {
    const state = { reserve: initialReserve, emergencyReserve: initialEmergencyReserve, output: 0, day: 0 };

    for (const period of weather) {
      for (state.day = 0; state.day < period.days; state.day += 1) {
        state.output += advanceAquiferDay(state, aquifer, groundwater, period.rainIntensityPercent, pumpCapacityPerDay);
      }
    }

    return state;
  };

  // Use one complete horizon as a warm-up so the year-one dry startup is not
  // charged against every long-run rate. The second replay measures the
  // periodic state produced by the same deterministic planning weather.
  const warmup = replayHorizon(0, 0);
  const measured = replayHorizon(warmup.reserve, warmup.emergencyReserve);

  const horizonCycles = planningWeather.horizonYears * 12;
  const sustainableOutput = measured.output / horizonCycles;

  cache.set(cacheKey, sustainableOutput);
  return sustainableOutput;
};

/** Smallest pump count that reaches the physical ceiling at displayed precision. */
export const calculateAquiferPumpsForCeiling = (
  aquifer: SyncedGroundwaterAquifer,
  groundwater: SyncedGroundwaterState,
  weather: WeatherConfig,
) => {
  const ceiling = calculateAquiferSustainableCeiling(aquifer, groundwater, weather);

  if (ceiling <= 0) return 0;
  const dailyPumpCapacity = GROUNDWATER_PUMP_OUTPUT_PER_CYCLE / planningWeather.daysPerCycle;
  const maximumRainRecharge = weather.periods.reduce((maximum, period) => Math.max(maximum,
    getAquiferRainRechargePerDay(aquifer, period.rainIntensityPercent)), 0);
  const depletedDailyPumpCapacity = dailyPumpCapacity * groundwater.depletedPumpSpeedPercent / 100;
  // Enough capacity to clear each day's rain and dry-weather assistance is a
  // safe upper bound. Searching the replay also accounts for aquifer storage;
  // average recharge / pump output alone can miss difficulty assistance.
  const bounds = { lower: 1, upper: Math.max(1,
    Math.ceil(maximumRainRecharge / dailyPumpCapacity),
    depletedDailyPumpCapacity > 0 ? Math.ceil(getDryEmergencyRechargePerDay(aquifer, groundwater) / depletedDailyPumpCapacity) : 0) };

  while (bounds.lower < bounds.upper) {
    const pumps = Math.floor((bounds.lower + bounds.upper) / 2);
    const output = calculateAquiferSustainableOutput(aquifer, pumps, groundwater, weather);

    if (output >= ceiling - 0.005) bounds.upper = pumps;
    else bounds.lower = pumps + 1;
  }
  return bounds.lower;
};

const assignProjectedPumps = (plan: GroundwaterClaimPlan) => {
  const candidates = [...new Map(plan.machines
    .filter((machine): machine is SyncedMachineInventoryItem & {
      aquifer: SyncedGroundwaterAquifer
    } => machine.aquifer != null)
    .map(machine => [machine.entityId, machine]))
    .values()]
    .toSorted((left, right) => (
      Number(right.running) - Number(left.running) || left.entityId - right.entityId
    ));
  const pumpsByAquifer = new Map<string, {
    aquifer: SyncedGroundwaterAquifer
    count: number
  }>();

  // Preserve every physical aquifer represented by the assigned pumps even
  // when the projected plan keeps all of those pumps paused.
  for (const candidate of candidates) {
    if (!pumpsByAquifer.has(candidate.aquifer.id)) {
      pumpsByAquifer.set(candidate.aquifer.id, {
        aquifer: candidate.aquifer,
        count: 0,
      });
    }
  }

  for (const index of Array.from({ length: plan.projectedPumpCount }, (_, index) => index)) {
    const candidate = candidates[index] ?? candidates[index % candidates.length];

    if (!candidate?.aquifer) break;

    const current = pumpsByAquifer.get(candidate.aquifer.id) ?? {
      aquifer: candidate.aquifer,
      count: 0,
    };

    current.count += 1;
    pumpsByAquifer.set(candidate.aquifer.id, current);
  }

  return pumpsByAquifer;
};

/**
 * Resolves one sustainable source ceiling per calculator claim. If two claims
 * draw from the same physical aquifer, its output is apportioned by projected
 * pump count so the shared recharge is never counted twice.
 */
export const calculateGroundwaterClaimLimits = (
  plans: readonly GroundwaterClaimPlan[],
  groundwater: SyncedGroundwaterState | null,
  weatherConfig: WeatherConfig,
) => {
  const limits: Record<string, GroundwaterSourceConstraint | undefined> = {};

  if (!groundwater) return limits;

  const aquifers = new Map<string, AquiferAllocation>();

  for (const plan of plans) {
    for (const { aquifer, count } of assignProjectedPumps(plan).values()) {
      const allocation = aquifers.get(aquifer.id) ?? {
        aquifer,
        pumpsByClaim: new Map<string, number>(),
      };

      allocation.pumpsByClaim.set(
        plan.claimId,
        (allocation.pumpsByClaim.get(plan.claimId) ?? 0) + count,
      );
      aquifers.set(aquifer.id, allocation);
    }
  }

  for (const plan of plans) {
    const ownedAquifers = [...aquifers.values()].filter(
      ({ pumpsByClaim }) => pumpsByClaim.has(plan.claimId),
    );

    if (ownedAquifers.length === 0) continue;

    const aquiferAllocations = ownedAquifers.map(allocation => {
      const totalPumps = [...allocation.pumpsByClaim.values()].reduce(
        (pumpTotal, count) => pumpTotal + count,
        0,
      );
      const claimPumps = allocation.pumpsByClaim.get(plan.claimId) ?? 0;

      const aquiferOutput = totalPumps <= 0 || claimPumps <= 0 ? 0 : calculateAquiferSustainableOutput(
        allocation.aquifer,
        totalPumps,
        groundwater,
        weatherConfig,
      );

      return { aquiferId: allocation.aquifer.id, pumpCount: claimPumps,
        sustainableOutputPerCycle: totalPumps > 0 ? aquiferOutput * claimPumps / totalPumps : 0 };
    });

    limits[plan.claimId] = {
      aquiferCount: ownedAquifers.length,
      currentReserve: ownedAquifers.reduce(
        (total, { aquifer }) => total + aquifer.quantity,
        0,
      ),
      reserveCapacity: ownedAquifers.reduce(
        (total, { aquifer }) => total + aquifer.capacity,
        0,
      ),
      projectedPumpCount: plan.projectedPumpCount,
      aquiferSustainableCeilingPerCycle: ownedAquifers.reduce(
        (total, { aquifer }) => (
          total + calculateAquiferSustainableCeiling(aquifer, groundwater, weatherConfig)
        ),
        0,
      ),
      pumpCapacityPerCycle: plan.projectedPumpCount * GROUNDWATER_PUMP_OUTPUT_PER_CYCLE,
      sustainableOutputPerCycle: aquiferAllocations.reduce((total, source) => total + source.sustainableOutputPerCycle, 0),
      aquiferAllocations,
    };
  }

  return limits;
};
