import { planningWeather, weatherTypes } from "../../db/weather";

export type PlanningWeatherId = keyof typeof weatherTypes;

const UINT64_MASK = (1n << 64n) - 1n;
const NEXT_DOUBLE_MASK = 0xfffffffffffff800n;
const NEXT_DOUBLE_SCALE = 5.421010862427522e-20;
const PERIODS_PER_YEAR = 24;

const rotateLeft64 = (value: bigint, count: bigint) => (
  ((value << count) | (value >> (64n - count))) & UINT64_MASK
);

/** Captain of Industry v0.8.6's xoroshiro128+ weather RNG. */
class WeatherRandom {
  private state0: bigint;
  private state1: bigint;

  constructor() {
    this.state0 = BigInt(planningWeather.weatherRngInitialState.state0);
    this.state1 = BigInt(planningWeather.weatherRngInitialState.state1);

    for (
      let step = 0;
      step < planningWeather.weatherRngInitialState.warmupSteps;
      step += 1
    ) {
      this.nextUlong();
    }
  }

  private nextUlong() {
    const state0 = this.state0;
    let state1 = this.state1;
    const result = (state0 + state1) & UINT64_MASK;

    state1 ^= state0;
    this.state0 = (
      rotateLeft64(state0, 55n) ^ state1 ^ ((state1 << 14n) & UINT64_MASK)
    ) & UINT64_MASK;
    this.state1 = rotateLeft64(state1, 36n);

    return result;
  }

  private nextDouble() {
    return Number(this.nextUlong() & NEXT_DOUBLE_MASK) * NEXT_DOUBLE_SCALE;
  }

  nextInt(maxExclusive: number) {
    return Math.trunc(this.nextDouble() * maxExclusive);
  }

  testPercent(rawPercent: number) {
    return this.nextInt(100_000) < rawPercent * 1_000;
  }
}

const getRainTargetPercent = (year: number) => {
  if (year < 10) return 400;
  if (year < 50) return 350;
  return 300;
};

const isRain = (weather: PlanningWeatherId) => (
  weatherTypes[weather].rainIntensityPercent > 0
);

const getWeatherAt = (
  schedule: readonly PlanningWeatherId[],
  index: number,
) => {
  const weather = schedule[index];

  if (!weather) throw new Error(`Missing weather period ${index}`);

  return weather;
};

const hasTripleRain = (schedule: readonly PlanningWeatherId[]) => {
  for (let index = 0; index < schedule.length - 2; index += 1) {
    if (
      isRain(getWeatherAt(schedule, index))
      && isRain(getWeatherAt(schedule, index + 1))
      && isRain(getWeatherAt(schedule, index + 2))
    ) {
      return true;
    }
  }

  return false;
};

const takeRandomPair = (pairs: number[], random: WeatherRandom) => {
  const pairIndex = random.nextInt(pairs.length);
  const [pair] = pairs.splice(pairIndex, 1);

  if (pair == null) throw new Error("Weather pair pool was exhausted");

  return pair;
};

const getMaximumCompletedSunnyRun = (schedule: readonly PlanningWeatherId[]) => {
  let currentRun = 0;
  let maximumRun = 0;

  // This deliberately matches v0.8.6: a sunny run at the end of the year is
  // not committed until a non-sunny period is encountered.
  schedule.forEach((weather) => {
    if (weather === "sunny") {
      currentRun += 1;
    } else {
      maximumRun = Math.max(maximumRun, currentRun);
      currentRun = 0;
    }
  });

  return maximumRun;
};

const generateScheduleAttempt = (
  rainTargetPercent: number,
  previousWeather: PlanningWeatherId | null,
  random: WeatherRandom,
) => {
  let heavyRains = 0;

  if (rainTargetPercent >= 450) {
    heavyRains = random.testPercent(80) ? 2 : 1;
  } else if (rainTargetPercent >= 400) {
    heavyRains = random.testPercent(50) ? 1 : 0;
  } else if (rainTargetPercent >= 250) {
    heavyRains = random.testPercent(80) ? 1 : 0;
  }

  let doubleRainPercent = 10;

  if (rainTargetPercent >= 400) {
    doubleRainPercent = 90;
  } else if (rainTargetPercent >= 300) {
    doubleRainPercent = 70;
  }
  const rainBesideHeavyPercent = rainTargetPercent >= 300 ? 80 : 10;
  const mediumRains = Math.trunc((rainTargetPercent - heavyRains * 100) / 50);
  let result: PlanningWeatherId[] = [];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    result = Array.from<PlanningWeatherId>({ length: PERIODS_PER_YEAR }).fill("sunny");
    const firstPair = previousWeather != null && isRain(previousWeather) ? 1 : 0;
    const availablePairs = Array.from(
      { length: 12 - firstPair },
      (_, index) => index + firstPair,
    );
    let remainingMediumRains = mediumRains;

    for (let index = 0; index < heavyRains; index += 1) {
      const pair = takeRandomPair(availablePairs, random);

      if (pair === 0 && previousWeather === "sunny") {
        result[0] = "cloudy";
        result[1] = "heavyRain";
      } else {
        const heavyFirst = random.testPercent(50);

        result[pair * 2 + (heavyFirst ? 0 : 1)] = "heavyRain";

        if (random.testPercent(rainBesideHeavyPercent)) {
          result[pair * 2 + (heavyFirst ? 1 : 0)] = "rainy";
          remainingMediumRains -= 1;
        }
      }
    }

    while (remainingMediumRains > 0) {
      const pair = takeRandomPair(availablePairs, random);

      if (pair === 0 && previousWeather === "sunny") {
        result[0] = "cloudy";
        result[1] = "rainy";
        remainingMediumRains -= 1;
      } else {
        result[pair * 2] = "rainy";
        remainingMediumRains -= 1;

        if (remainingMediumRains > 0 && random.testPercent(doubleRainPercent)) {
          result[pair * 2 + 1] = "rainy";
          remainingMediumRains -= 1;
        }
      }
    }

    result.forEach((weather, index) => {
      if (weather !== "sunny") return;

      if (
        index < result.length - 1
        && isRain(getWeatherAt(result, index + 1))
      ) {
        result[index] = "cloudy";
      } else if (index > 0 && isRain(getWeatherAt(result, index - 1))) {
        result[index] = "cloudy";
      }
    });

    if (rainTargetPercent < 250 || getMaximumCompletedSunnyRun(result) < 12) {
      break;
    }
  }

  return result;
};

const generateYear = (
  year: number,
  previousWeather: PlanningWeatherId | null,
  random: WeatherRandom,
) => {
  const rainTargetPercent = getRainTargetPercent(year);
  let schedule = generateScheduleAttempt(rainTargetPercent, previousWeather, random);
  let retry = 0;

  while (hasTripleRain(schedule) && retry < 6) {
    schedule = generateScheduleAttempt(rainTargetPercent, previousWeather, random);
    retry += 1;
  }

  if (year === 1) {
    schedule.fill("sunny", 0, 4);
  }

  return schedule;
};

let cachedPlanningWeather: readonly PlanningWeatherId[] | null = null;

/** Exact 15-day weather periods for the configured v0.8.6 seed. */
export const getPlanningWeather = () => {
  if (cachedPlanningWeather) return cachedPlanningWeather;

  const random = new WeatherRandom();
  const periods: PlanningWeatherId[] = [];
  let previousWeather: PlanningWeatherId | null = null;

  for (let year = 1; year <= planningWeather.horizonYears; year += 1) {
    const annualSchedule = generateYear(year, previousWeather, random);

    periods.push(...annualSchedule);
    previousWeather = annualSchedule.at(-1) ?? null;
  }

  cachedPlanningWeather = periods;
  return cachedPlanningWeather;
};
