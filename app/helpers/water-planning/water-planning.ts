import { planningWeather, type WeatherConfig } from '../../db/weather';
import { type GameStateSnapshot, type SyncedGroundwaterSource, type SyncedGroundwaterState } from '../../game-state';
import { type PassiveResult } from '../calculate/calculate';
import { advanceAquiferDay, calculateAquiferPumpsForCeiling, calculateAquiferSustainableCeiling, calculateAquiferSustainableOutput, GROUNDWATER_PUMP_OUTPUT_PER_CYCLE } from '../groundwater/calculate-groundwater-production';

export const summarizeWeather = (weather: WeatherConfig) => {
  const state = { elapsedDays: 0, rainDays: 0, sunDays: 0, dryDays: 0, longestDryDays: 0,
    firstYearRainDays: 0, firstYearSunDays: 0 };
  const nextRain: { days: number | null } = { days: null };
  const cycles = Array.from({ length: 12 }, () => ({ rainIntensityPercent: 0, sunIntensityPercent: 0 }));

  for (const period of weather.periods) {
    if (period.rainIntensityPercent > 0) {
      nextRain.days ??= state.elapsedDays;
      state.dryDays = 0;
    } else {
      state.dryDays += period.days;
      state.longestDryDays = Math.max(state.longestDryDays, state.dryDays);
    }
    const yearDays = Math.max(0, Math.min(period.days, 360 - state.elapsedDays));

    state.firstYearRainDays += period.rainIntensityPercent / 100 * yearDays;
    state.firstYearSunDays += period.sunIntensityPercent / 100 * yearDays;
    for (const [index, cycle] of cycles.entries()) {
      const days = Math.max(0, Math.min(state.elapsedDays + period.days, (index + 1) * 30)
        - Math.max(state.elapsedDays, index * 30));

      cycle.rainIntensityPercent += period.rainIntensityPercent * days / 30;
      cycle.sunIntensityPercent += period.sunIntensityPercent * days / 30;
    }
    state.rainDays += period.rainIntensityPercent / 100 * period.days;
    state.sunDays += period.sunIntensityPercent / 100 * period.days;
    state.elapsedDays += period.days;
  }
  return {
    nextRainCycles: nextRain.days === null ? null : nextRain.days / 30,
    longestDryCycles: state.longestDryDays / 30,
    averageRainIntensityPercent: state.rainDays / state.elapsedDays * 100,
    averageSunIntensityPercent: state.sunDays / state.elapsedDays * 100,
    nextYearFullRainCycles: state.firstYearRainDays / 30,
    nextYearAverageSunIntensityPercent: state.firstYearSunDays / 360 * 100,
    cycles,
  };
};

export const simulateWaterSource = (
  source: SyncedGroundwaterSource,
  groundwater: SyncedGroundwaterState,
  weather: WeatherConfig,
  pumpCount: number,
  withdrawalPerCycle: number,
) => {
  const state = { reserve: source.quantity, emergencyReserve: source.emergencyQuantity };
  const totals = { day: 0, minimumReserve: source.quantity, shortfallQuantity: 0,
    firstYearShortfallQuantity: 0, daysBelowDemand: 0, skipCapturedDay: true, periodDay: 0 };
  const firstShortfall: { cycle: number | null } = { cycle: null };
  const requestedPerDay = Math.max(0, withdrawalPerCycle) / 30;
  const pumpCapacityPerDay = Math.max(0, pumpCount) * GROUNDWATER_PUMP_OUTPUT_PER_CYCLE / 30;

  if (weather.hasOverride) return null;
  for (const period of weather.periods) {
    for (totals.periodDay = 0; totals.periodDay < period.days; totals.periodDay += 1) {
      // The captured reserve already includes today's native daily recharge.
      // Start on the next day; continuous pumping within a day is an estimate.
      if (totals.skipCapturedDay) { totals.skipCapturedDay = false; continue; }
      const supplied = advanceAquiferDay(state, source, groundwater, period.rainIntensityPercent, pumpCapacityPerDay, requestedPerDay);
      const missing = Math.max(0, requestedPerDay - supplied);

      totals.day += 1;
      totals.minimumReserve = Math.min(totals.minimumReserve, state.reserve);
      if (missing > 0.000001) {
        firstShortfall.cycle ??= totals.day / 30;
        totals.daysBelowDemand += 1;
        totals.shortfallQuantity += missing;
        if (totals.day <= 360) totals.firstYearShortfallQuantity += missing;
      }
    }
  }
  return {
    minimumReserve: totals.minimumReserve,
    firstShortfallCycle: firstShortfall.cycle,
    shortfallQuantity: totals.shortfallQuantity,
    firstYearShortfallQuantity: totals.firstYearShortfallQuantity,
    cyclesBelowDemand: totals.daysBelowDemand / 30,
    horizonCycles: totals.day / 30,
    endingReserve: state.reserve,
  };
};

export const buildWaterSourceInventory = (snapshot: GameStateSnapshot, sourceResults: readonly PassiveResult[]) => {
  const allocation = new Map<string, { pumps: number; withdrawal: number }>();

  for (const result of sourceResults) {
    const constraint = result.recipe.groundwaterConstraint;

    if (!constraint?.aquiferAllocations) continue;
    const draw = result.actualOutputs.find(output => output.resourceId === 'water')?.quantity ?? 0;

    for (const aquifer of constraint.aquiferAllocations) {
      const current = allocation.get(aquifer.aquiferId) ?? { pumps: 0, withdrawal: 0 };
      const share = constraint.sustainableOutputPerCycle > 0
        ? aquifer.sustainableOutputPerCycle / constraint.sustainableOutputPerCycle : 0;

      current.pumps += aquifer.pumpCount;
      current.withdrawal += draw * share;
      allocation.set(aquifer.aquiferId, current);
    }
  }
  // Keep map numbers and table rows independent of demand and pump activity.
  return snapshot.groundwater.aquifers.map(source => {
    const pumps = snapshot.machines.filter(machine => machine.aquifer?.id === source.id);
    const projected = allocation.get(source.id);
    const projectedPumps = projected?.pumps ?? pumps.filter(pump => pump.running).length;
    const projectedWithdrawalPerCycle = projected?.withdrawal ?? 0;

    return {
      source, builtPumps: pumps.length, activePumps: pumps.filter(pump => pump.running).length,
      projectedPumps, projectedWithdrawalPerCycle,
      pumpsForCeiling: calculateAquiferPumpsForCeiling(source, snapshot.groundwater, snapshot.weather),
      sustainableCeilingPerCycle: calculateAquiferSustainableCeiling(source, snapshot.groundwater, snapshot.weather),
      sustainableOutputPerCycle: calculateAquiferSustainableOutput(source, projectedPumps, snapshot.groundwater, snapshot.weather),
      areas: [...new Set(pumps.flatMap(pump => pump.zones.map(zone => zone.name).filter((name): name is string => Boolean(name))))],
      areaIds: [...new Set(pumps.flatMap(pump => pump.zones.filter(zone => zone.name).map(zone => zone.id)))].toSorted((a, b) => a - b),
    };
  }).toSorted((left, right) => left.source.position.x - right.source.position.x
    || left.source.position.y - right.source.position.y);
};

// Installed 0.8.8 RainwaterHarvesterData.RegisterData: 1 water / full-rain day.
// This is collection potential before overflow and delivery limitations.
export const getRainwaterHarvesterPotential = (weather: ReturnType<typeof summarizeWeather>, rainwaterYieldMultiplier: number) => ({
  nextYearPerCycle: weather.nextYearFullRainCycles * planningWeather.daysPerCycle * rainwaterYieldMultiplier / 12,
  averagePerCycle: weather.averageRainIntensityPercent / 100 * planningWeather.daysPerCycle * rainwaterYieldMultiplier,
});
