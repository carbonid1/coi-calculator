import {
  emptySolarPanelCounts,
  solarPanelOrder,
  solarPanels,
  type SolarPanelCounts,
} from "../solar";
import { planningWeather } from "../weather";
import { type Module, type Preset } from "./modules";

export const SOLAR_POWER_MODULE_ID = "solar-power";

export const plannedSolarPanelTargets: Partial<SolarPanelCounts> = {
  // The current save started this plan at 195 panels. Keep the target fixed so
  // newly synced construction reduces the remaining work instead of moving it.
  mono: 245,
};

export interface ResolvedSolarPanelPlan {
  activeCounts: SolarPanelCounts;
  plannedPanels: Partial<Record<keyof SolarPanelCounts, true>>;
}

export const resolveSolarPanelPlan = (
  builtCounts: SolarPanelCounts,
  runningCounts: SolarPanelCounts,
  plannedTargets?: Partial<SolarPanelCounts>,
): ResolvedSolarPanelPlan => {
  const activeCounts = { ...emptySolarPanelCounts };
  const plannedPanels: ResolvedSolarPanelPlan["plannedPanels"] = {};

  for (const panel of solarPanelOrder) {
    const built = Math.max(0, Math.trunc(builtCounts[panel]));
    const running = Math.min(built, Math.max(0, Math.trunc(runningCounts[panel])));
    const plannedTarget = plannedTargets?.[panel];
    const target = plannedTarget == null
      ? null
      : Math.max(0, Math.trunc(plannedTarget));
    const hasPendingPlan = target != null && running < target;

    activeCounts[panel] = hasPendingPlan ? target : running;

    if (hasPendingPlan) plannedPanels[panel] = true;
  }

  return { activeCounts, plannedPanels };
};

export const createSolarPowerModule = (
  builtCounts: SolarPanelCounts,
  runningCounts: SolarPanelCounts = builtCounts,
  plannedTargets?: Partial<SolarPanelCounts>,
): Module => {
  const plan = resolveSolarPanelPlan(builtCounts, runningCounts, plannedTargets);
  const builtBuildings = {
    [solarPanels.standard.recipeId]: builtCounts.standard,
    [solarPanels.mono.recipeId]: builtCounts.mono,
  };
  const activeBuildings = {
    [solarPanels.standard.recipeId]: plan.activeCounts.standard,
    [solarPanels.mono.recipeId]: plan.activeCounts.mono,
  };
  const dataSources: NonNullable<Preset["dataSources"]> = {};

  for (const panel of solarPanelOrder) {
    if (plan.plannedPanels[panel]) {
      dataSources[solarPanels[panel].recipeId] = "planned";
    }
  }

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
        dataSources: Object.keys(dataSources).length > 0 ? dataSources : undefined,
        fixed: Object.keys(builtBuildings),
      },
    ],
    defaultPresetId: "installed",
  };
};

export const solarPower = createSolarPowerModule(emptySolarPanelCounts);
