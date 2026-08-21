import {
  emptyStaticInfrastructureConfig,
  clampStaticInfrastructureRunningConfig,
  normalizeStaticInfrastructureConfig,
  staticInfrastructureItems,
  type StaticInfrastructureConfig,
} from "../static-infrastructure";
import { type Module } from "./modules";

export const STATIC_INFRASTRUCTURE_MODULE_ID = "static-infrastructure";

export const createStaticInfrastructureModule = (
  builtConfig: StaticInfrastructureConfig,
  runningConfig: StaticInfrastructureConfig = builtConfig,
): Module => {
  const normalized = normalizeStaticInfrastructureConfig(builtConfig);
  const running = clampStaticInfrastructureRunningConfig(
    normalized,
    runningConfig,
  );
  const builtBuildings = Object.fromEntries(
    staticInfrastructureItems.map((item) => [item.recipeId, normalized[item.id]]),
  );
  const activeBuildings = Object.fromEntries(
    staticInfrastructureItems.map((item) => [item.recipeId, running[item.id]]),
  );

  return {
    id: STATIC_INFRASTRUCTURE_MODULE_ID,
    name: "Infrastructure",
    description: "Static worker and resource drains outside production-chain balancing",
    builtBuildings,
    presets: [
      {
        id: "configured-infrastructure",
        name: "Configured infrastructure",
        description: "Completed infrastructure with non-paused entities active",
        builtBuildings,
        activeBuildings,
        fixed: staticInfrastructureItems.map((item) => item.recipeId),
      },
    ],
    defaultPresetId: "configured-infrastructure",
  };
};

export const staticInfrastructure = createStaticInfrastructureModule(
  emptyStaticInfrastructureConfig,
);
