export interface WeatherDefinition {
  sunIntensityPercent: number;
  rainIntensityPercent: number;
}

export const weatherTypes = {
  sunny: { sunIntensityPercent: 100, rainIntensityPercent: 0 },
  cloudy: { sunIntensityPercent: 80, rainIntensityPercent: 0 },
  rainy: { sunIntensityPercent: 50, rainIntensityPercent: 50 },
  heavyRain: { sunIntensityPercent: 20, rainIntensityPercent: 100 },
} as const satisfies Record<string, WeatherDefinition>;

export interface WeatherConfig {
  gameSeed: string;
  difficulty: 'Easy' | 'Standard' | 'Dry';
  weatherRngInitialState: { state0: string; state1: string; warmupSteps: 100 };
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export const isWeatherConfig = (config: unknown): config is WeatherConfig => {
  if (!isRecord(config)) return false;
  const state = config.weatherRngInitialState;

  return typeof config.gameSeed === 'string' && config.gameSeed.length > 0
    && typeof config.difficulty === 'string' && ['Easy', 'Standard', 'Dry'].includes(config.difficulty)
    && isRecord(state) && typeof state.state0 === 'string' && /^0x[0-9a-f]{16}$/i.test(state.state0)
    && typeof state.state1 === 'string' && /^0x[0-9a-f]{16}$/i.test(state.state1) && state.warmupSteps === 100
    && (BigInt(state.state0) !== 0n || BigInt(state.state1) !== 0n);
};

/** Simulation horizon; island settings come exclusively from the exporter. */
export const planningWeather = {
  horizonYears: 100,
  weatherPeriodDays: 15,
} as const;
