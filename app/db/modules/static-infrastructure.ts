import {
  emptyStaticInfrastructureConfig,
  clampStaticInfrastructureRunningConfig,
  normalizeStaticInfrastructureConfig,
  staticInfrastructureItems,
  type StaticInfrastructureConfig,
} from "../static-infrastructure";
import { type Module } from "./modules";

export const STATIC_INFRASTRUCTURE_MODULE_ID = "static-infrastructure";

interface StaticInfrastructureDataSources {
  syncedCounts: boolean;
}

const modeledInfrastructureDataSources: StaticInfrastructureDataSources = {
  syncedCounts: false,
};

export const createStaticInfrastructureModule = (
  builtConfig: StaticInfrastructureConfig,
  runningConfig: StaticInfrastructureConfig = builtConfig,
  dataSources: StaticInfrastructureDataSources = modeledInfrastructureDataSources,
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
    description: "Static workforce and Fuel Gas loads outside production-chain balancing",
    builtBuildings,
    presets: [
      {
        id: "configured-infrastructure",
        name: "Configured infrastructure",
        description: "Completed infrastructure with non-paused entities active",
        builtBuildings,
        activeBuildings,
        dataSources: Object.fromEntries(
          staticInfrastructureItems.map((item) => [
            item.recipeId,
            dataSources.syncedCounts ? "synced" : "modeled",
          ]),
        ),
        fixed: staticInfrastructureItems.map((item) => item.recipeId),
      },
    ],
    defaultPresetId: "configured-infrastructure",
  };
};

export const staticInfrastructure = createStaticInfrastructureModule(
  emptyStaticInfrastructureConfig,
);
