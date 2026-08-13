import {
  defaultStaticInfrastructureConfig,
  normalizeStaticInfrastructureConfig,
  staticInfrastructureItems,
  type StaticInfrastructureConfig,
} from "../static-infrastructure";
import { type Module } from "./modules";

export const STATIC_INFRASTRUCTURE_MODULE_ID = "static-infrastructure";

export const createStaticInfrastructureModule = (
  config: StaticInfrastructureConfig,
): Module => {
  const normalized = normalizeStaticInfrastructureConfig(config);
  const builtBuildings = Object.fromEntries(
    staticInfrastructureItems.map((item) => [item.recipeId, normalized[item.id]]),
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
        description: "Manually counted active infrastructure",
        builtBuildings,
        activeBuildings: builtBuildings,
        fixed: staticInfrastructureItems.map((item) => item.recipeId),
      },
    ],
    defaultPresetId: "configured-infrastructure",
  };
};

export const staticInfrastructure = createStaticInfrastructureModule(
  defaultStaticInfrastructureConfig,
);
