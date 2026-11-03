import { type WeatherConfig } from '../../db/weather';

export const getAverageSunIntensityPercent = (config: WeatherConfig) => {
  const days = config.periods.reduce((total, period) => total + period.days, 0);

  return config.periods.reduce((total, period) => total + period.sunIntensityPercent * period.days, 0) / days;
};
