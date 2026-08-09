import { defaultSolarPanelCounts, solarPanels, type SolarPanelCounts } from "../solar";
import { planningWeather } from "../weather";
import { type Module } from "./modules";

export const SOLAR_POWER_MODULE_ID = "solar-power";

export const createSolarPowerModule = (counts: SolarPanelCounts): Module => {
  const buildingTotals = {
    [solarPanels.standard.recipeId]: counts.standard,
    [solarPanels.mono.recipeId]: counts.mono,
  };

  return {
    id: SOLAR_POWER_MODULE_ID,
    name: "Solar Power",
    description: `${planningWeather.averageSunIntensityPercent}% average sunlight (${planningWeather.horizonYears}Y, ${planningWeather.difficulty})`,
    buildingTotals,
    presets: [
      {
        id: "installed",
        name: "Installed",
        description: "Installed solar panels",
        available: buildingTotals,
        fixed: Object.keys(buildingTotals),
      },
    ],
    defaultPresetId: "installed",
  };
};

export const solarPower = createSolarPowerModule(defaultSolarPanelCounts);
