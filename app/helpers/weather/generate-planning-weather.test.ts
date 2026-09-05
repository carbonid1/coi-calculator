import { expect, it } from "vitest";

import { isWeatherConfig } from "../../db/weather";
import { testWeather } from "../../test-fixtures/synced-island-settings";
import { getAverageSunIntensityPercent, getPlanningWeather } from "./generate-planning-weather";

it("uses the synced climate and isolates the cache between islands", () => {
  const standard = getPlanningWeather(testWeather);

  expect(getPlanningWeather(testWeather)).toBe(standard);
  const easy = getAverageSunIntensityPercent({ ...testWeather, difficulty: "Easy" });
  const dry = getAverageSunIntensityPercent({ ...testWeather, difficulty: "Dry" });

  expect(easy).toBeLessThan(getAverageSunIntensityPercent(testWeather));
  expect(dry).toBeGreaterThan(getAverageSunIntensityPercent(testWeather));
  expect(getPlanningWeather({ ...testWeather, gameSeed: "another island",
    weatherRngInitialState: { ...testWeather.weatherRngInitialState, state0: "0x1234567890abcdef" },
  })).not.toEqual(standard);
  expect(getPlanningWeather(testWeather)).toEqual(standard);
});

it("rejects missing or invalid island weather rather than applying an old seed", () => {
  expect(isWeatherConfig(testWeather)).toBe(true);
  for (const value of [undefined, {}, { ...testWeather, difficulty: "unknown" },
    { ...testWeather, weatherRngInitialState: {} },
    { ...testWeather, weatherRngInitialState: { state0: "0x0000000000000000", state1: "0x0000000000000000", warmupSteps: 100 } },
  ]) expect(isWeatherConfig(value)).toBe(false);
});
