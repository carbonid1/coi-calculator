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

/**
 * Planning weather for the current island. Captain of Industry v0.8.6c seeds
 * an independent weather RNG from the game seed. The sunlight value is the
 * 100-year average produced by that scheduler under the stable Standard
 * climate. This keeps production balancing stable instead of making it depend
 * on the current 15-day weather period.
 */
export const planningWeather = {
  gameVersion: "0.8.6c",
  gameBuild: "b612",
  gameSeed: "ywaruuxpx8oo",
  difficulty: "Standard",
  horizonYears: 100,
  averageSunIntensityPercent: 83.1,
} as const;
