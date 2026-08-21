import { emptySolarPanelCounts, solarPanels, type SolarPanelCounts } from "../solar";
import { planningWeather } from "../weather";
import { type Module } from "./modules";

export const SOLAR_POWER_MODULE_ID = "solar-power";

export const createSolarPowerModule = (
  builtCounts: SolarPanelCounts,
  runningCounts: SolarPanelCounts = builtCounts,
): Module => {
  const builtBuildings = {
    [solarPanels.standard.recipeId]: builtCounts.standard,
    [solarPanels.mono.recipeId]: builtCounts.mono,
  };
  const activeBuildings = {
    [solarPanels.standard.recipeId]: Math.min(
      builtCounts.standard,
      runningCounts.standard,
    ),
    [solarPanels.mono.recipeId]: Math.min(
      builtCounts.mono,
      runningCounts.mono,
    ),
  };

  return {
    id: SOLAR_POWER_MODULE_ID,
    name: "Solar Power",
    description: `${planningWeather.averageSunIntensityPercent}% average sunlight (${planningWeather.horizonYears}Y, ${planningWeather.difficulty})`,
    builtBuildings,
    presets: [
      {
        id: "installed",
        name: "Installed",
        description: "Installed solar panels",
        activeBuildings,
        fixed: Object.keys(builtBuildings),
      },
    ],
    defaultPresetId: "installed",
  };
};

export const solarPower = createSolarPowerModule(emptySolarPanelCounts);
