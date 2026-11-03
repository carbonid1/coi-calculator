export interface WeatherDefinition {
  sunIntensityPercent: number;
  rainIntensityPercent: number;
}

export interface WeatherPeriod extends WeatherDefinition {
  days: number;
}

export interface WeatherConfig {
  gameSeed: string;
  difficulty: 'Easy' | 'Standard' | 'Dry';
  startDate: { year: number; month: number; day: number };
  hasOverride: boolean;
  currentRainIntensityPercent: number;
  currentSunIntensityPercent: number;
  periods: readonly WeatherPeriod[];
}

/** Planning horizon; calendar boundaries verified in installed 0.8.8. */
export const planningWeather = { horizonYears: 100, weatherPeriodDays: 15, daysPerCycle: 30 } as const;

const record = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);
const integer = (value: unknown, min: number, max: number): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
);
const percent = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
);

export const isWeatherConfig = (config: unknown): config is WeatherConfig => {
  if (!record(config) || typeof config.gameSeed !== 'string' || !config.gameSeed
    || !['Easy', 'Standard', 'Dry'].includes(String(config.difficulty))
    || !record(config.startDate) || !integer(config.startDate.year, 1, Number.MAX_SAFE_INTEGER)
    || !integer(config.startDate.month, 1, 12) || !integer(config.startDate.day, 1, 30)
    || typeof config.hasOverride !== 'boolean' || !percent(config.currentRainIntensityPercent)
    || !percent(config.currentSunIntensityPercent) || !Array.isArray(config.periods)
    || !config.periods.every((period: unknown): period is WeatherPeriod => record(period)
      && integer(period.days, 1, planningWeather.weatherPeriodDays)
      && percent(period.sunIntensityPercent) && percent(period.rainIntensityPercent))) return false;
  const firstDays = planningWeather.weatherPeriodDays - (config.startDate.day - 1) % planningWeather.weatherPeriodDays;
  const days = config.periods.reduce((total, period) => total + period.days, 0);

  return days === planningWeather.horizonYears * 12 * planningWeather.daysPerCycle
    && config.periods[0]?.days === firstDays
    && config.periods.slice(1, -1).every(period => period.days === planningWeather.weatherPeriodDays);
};
