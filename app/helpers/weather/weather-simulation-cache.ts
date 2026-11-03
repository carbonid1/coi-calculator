import { type WeatherConfig } from '../../db/weather';

const forecastKeys = new WeakMap<WeatherConfig, string>();

/** Reuse simulations across API/worker clones; retain only two forecast windows. */
export const createWeatherSimulationCache = <Value>() => {
  const inputs = new WeakMap<WeatherConfig, Map<string, Value>>();
  const forecasts = new Map<string, Map<string, Value>>();

  return (weather: WeatherConfig): Map<string, Value> => {
    const known = inputs.get(weather);

    if (known) return known;
    const key = forecastKeys.get(weather) ?? JSON.stringify(weather.periods);

    forecastKeys.set(weather, key);
    const cache = forecasts.get(key) ?? new Map<string, Value>();

    forecasts.delete(key);
    forecasts.set(key, cache);
    if (forecasts.size > 2) {
      const oldest = forecasts.keys().next().value;

      if (oldest !== undefined) forecasts.delete(oldest);
    }
    inputs.set(weather, cache);
    return cache;
  };
};
