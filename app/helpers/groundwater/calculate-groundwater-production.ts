import { cropFarmSimulation } from "../../db/crop-farming";
import { planningWeather, weatherTypes } from "../../db/weather";
import { type SyncedGroundwaterAquifer, type SyncedGroundwaterState, type SyncedMachineInventoryItem } from "../../game-state";
import { getPlanningWeather } from "../weather/generate-planning-weather";

export const GROUNDWATER_PUMP_OUTPUT_PER_CYCLE = 48;

// Installed v0.8.7 GroundWaterManager.CAPACITY_REPLENISH_PER_DAY.
const CAPACITY_REPLENISH_PER_DAY = 0.00185;
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
}

interface AquiferAllocation {
  aquifer: SyncedGroundwaterAquifer;
  pumpsByClaim: Map<string, number>;
}

const simulationCache = new Map<string, number>();
const aquiferCeilingCache = new Map<string, number>();

const applyPercentRaw = (value: number, rawPercent: number) => Math.trunc(
  (value * rawPercent + PERCENT_RAW_SCALE / 2) / PERCENT_RAW_SCALE,
);

const multiplyPercentRaw = (left: number, right: number) => Math.trunc(
  (left * right + PERCENT_RAW_SCALE / 2) / PERCENT_RAW_SCALE,
);

/**
 * Maximum long-run output of the physical aquifer with enough pumps to collect
 * every unit replenished by rain and low-reserve difficulty assistance.
 */
export const calculateAquiferSustainableCeiling = (
  aquifer: SyncedGroundwaterAquifer,
  groundwater: SyncedGroundwaterState,
) => {
  const cacheKey = [
    aquifer.capacity,
    aquifer.configuredCapacity,
    groundwater.depletedPumpSpeedPercent,
    groundwater.replenishWhenLowPercent,
  ].join(":");
  const cached = aquiferCeilingCache.get(cacheKey);

  if (cached != null) return cached;

  const weather = getPlanningWeather();
  const emergencyOutputPerDryDay = groundwater.depletedPumpSpeedPercent > 0
    ? Math.min(
        MAX_EMERGENCY_WATER,
        aquifer.configuredCapacity
          * CAPACITY_REPLENISH_PER_DAY
          * groundwater.replenishWhenLowPercent
          / 100,
      )
    : 0;
  let output = 0;

  for (const weatherId of weather) {
    const rainIntensityRaw = weatherTypes[weatherId].rainIntensityPercent * 1_000;
    let outputPerDay = emergencyOutputPerDryDay;

    if (rainIntensityRaw > 0) {
      const replenishPercentRaw = multiplyPercentRaw(
        CAPACITY_REPLENISH_RAW_PERCENT,
        rainIntensityRaw,
      );

      outputPerDay = Math.min(
        aquifer.capacity,
        applyPercentRaw(aquifer.configuredCapacity, replenishPercentRaw),
      );
    }

    output += outputPerDay * planningWeather.weatherPeriodDays;
  }

  const ceiling = output / (planningWeather.horizonYears * 12);

  aquiferCeilingCache.set(cacheKey, ceiling);
  return ceiling;
};

/**
 * Replays the installed v0.8.7 aquifer rules after a depleted-state warm-up.
 * Rain replenishes the normal reserve; dry days replenish the hidden emergency
 * reserve only while normal groundwater is empty. Pumps use normal capacity at
 * full speed and the emergency reserve at the configured depleted speed.
 */
export const calculateAquiferSustainableOutput = (
  aquifer: SyncedGroundwaterAquifer,
  pumpCount: number,
  groundwater: SyncedGroundwaterState,
) => {
  if (pumpCount <= 0) return 0;

  const cacheKey = [
    aquifer.capacity,
    aquifer.configuredCapacity,
    pumpCount,
    groundwater.depletedPumpSpeedPercent,
    groundwater.replenishWhenLowPercent,
  ].join(":");
  const cached = simulationCache.get(cacheKey);

  if (cached != null) return cached;

  const weather = getPlanningWeather();
  const daysPerCycle = cropFarmSimulation.daysPerMonth;
  const pumpCapacityPerDay = GROUNDWATER_PUMP_OUTPUT_PER_CYCLE
    * pumpCount
    / daysPerCycle;
  const depletedSpeed = groundwater.depletedPumpSpeedPercent / 100;
  const dryEmergencyReplenishPerDay = aquifer.configuredCapacity
    * CAPACITY_REPLENISH_PER_DAY
    * groundwater.replenishWhenLowPercent
    / 100;
  const replayHorizon = (initialReserve: number, initialEmergencyReserve: number) => {
    let reserve = initialReserve;
    let emergencyReserve = initialEmergencyReserve;
    let output = 0;

    for (const weatherId of weather) {
      const rainIntensityRaw = weatherTypes[weatherId].rainIntensityPercent * 1_000;

      for (let day = 0; day < planningWeather.weatherPeriodDays; day += 1) {
        if (rainIntensityRaw > 0) {
          const replenishPercentRaw = multiplyPercentRaw(
            CAPACITY_REPLENISH_RAW_PERCENT,
            rainIntensityRaw,
          );
          const replenished = applyPercentRaw(
            aquifer.configuredCapacity,
            replenishPercentRaw,
          );

          reserve = Math.min(aquifer.capacity, reserve + replenished);
        } else if (reserve <= 0 && groundwater.replenishWhenLowPercent > 0) {
          emergencyReserve = Math.min(
            MAX_EMERGENCY_WATER,
            emergencyReserve + dryEmergencyReplenishPerDay,
          );
        }

        const normalOutput = Math.min(reserve, pumpCapacityPerDay);
        const normalTime = normalOutput / pumpCapacityPerDay;
        const depletedCapacity = pumpCapacityPerDay
          * depletedSpeed
          * Math.max(0, 1 - normalTime);
        const emergencyOutput = Math.min(emergencyReserve, depletedCapacity);

        reserve -= normalOutput;
        emergencyReserve -= emergencyOutput;
        output += normalOutput + emergencyOutput;
      }
    }

    return { emergencyReserve, output, reserve };
  };

  // Use one complete horizon as a warm-up so the year-one dry startup is not
  // charged against every long-run rate. The second replay measures the
  // periodic state produced by the same deterministic planning weather.
  const warmup = replayHorizon(0, 0);
  const measured = replayHorizon(warmup.reserve, warmup.emergencyReserve);

  const horizonCycles = planningWeather.horizonYears * 12;
  const sustainableOutput = measured.output / horizonCycles;

  simulationCache.set(cacheKey, sustainableOutput);
  return sustainableOutput;
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

  for (let index = 0; index < plan.projectedPumpCount; index += 1) {
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

    const sustainableOutputPerCycle = ownedAquifers.reduce((total, allocation) => {
      const totalPumps = [...allocation.pumpsByClaim.values()].reduce(
        (pumpTotal, count) => pumpTotal + count,
        0,
      );
      const claimPumps = allocation.pumpsByClaim.get(plan.claimId) ?? 0;

      if (totalPumps <= 0 || claimPumps <= 0) return total;

      const aquiferOutput = calculateAquiferSustainableOutput(
        allocation.aquifer,
        totalPumps,
        groundwater,
      );

      return total + aquiferOutput * claimPumps / totalPumps;
    }, 0);

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
          total + calculateAquiferSustainableCeiling(aquifer, groundwater)
        ),
        0,
      ),
      pumpCapacityPerCycle: plan.projectedPumpCount * GROUNDWATER_PUMP_OUTPUT_PER_CYCLE,
      sustainableOutputPerCycle,
    };
  }

  return limits;
};
