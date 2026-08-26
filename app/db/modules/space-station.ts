import {
  emptyRocketInfrastructureConfig,
  normalizeRocketInfrastructureConfig,
  plannedRocketInfrastructureConfig,
  rocketInfrastructureItems,
  type RocketInfrastructureConfig,
} from "../rocket-infrastructure";
import {
  defaultSpaceStationConfig,
  type SpaceStationConfig,
} from "../space-station";
import { type Module } from "./modules";

export const SPACE_STATION_MODULE_ID = "space-station";

export const createSpaceStationModule = (
  config: SpaceStationConfig,
  rocketBuiltConfig: RocketInfrastructureConfig = emptyRocketInfrastructureConfig,
  rocketPlanConfig: RocketInfrastructureConfig = plannedRocketInfrastructureConfig,
): Module => {
  const hasCurrentStation = config.currentLevel > 0;
  const hasCurrentOrbitalResearch = config.currentLevel >= 3;
  const hasStation = config.targetLevel > 0;
  const hasOrbitalResearch = config.targetLevel >= 3;
  const rocketBuilt = normalizeRocketInfrastructureConfig(rocketBuiltConfig);
  const rocketPlan = normalizeRocketInfrastructureConfig(rocketPlanConfig);
  const rocketBuiltBuildings = Object.fromEntries(
    rocketInfrastructureItems.map((item) => [item.recipeId, rocketBuilt[item.id]]),
  );
  const rocketPlannedBuildings = Object.fromEntries(
    rocketInfrastructureItems.map((item) => [
      item.recipeId,
      hasStation ? rocketPlan[item.id] : 0,
    ]),
  );
  const builtBuildings = {
    "space-station-operations": hasCurrentStation ? 1 : 0,
    "space-station-orbital-research": hasCurrentOrbitalResearch ? 1 : 0,
    ...rocketBuiltBuildings,
  };
  const activeBuildings = {
    "space-station-operations": hasStation ? 1 : 0,
    "space-station-orbital-research": hasOrbitalResearch ? 1 : 0,
    ...rocketPlannedBuildings,
  };
  const plannedRecipeIds = Object.keys(activeBuildings);

  return {
    id: SPACE_STATION_MODULE_ID,
    name: "Space Station",
    description: "Level 4 station and rocket infrastructure plan; projected resources and workforce are included in Factory Total",
    includedInFactoryTotals: true,
    builtBuildings,
    presets: [
      {
        id: "target-level",
        name: "Target level",
        description: `Space Station level ${config.targetLevel}`,
        activeBuildings,
        dataSources: Object.fromEntries(
          plannedRecipeIds.map((recipeId) => [recipeId, "planned"]),
        ),
        // Orbital research remains demand-balanced: the station produces
        // points only while Research Lab IV is explicitly in Space Research.
        fixed: [
          "space-station-operations",
          "rocket-ii-launch-amortized",
        ],
      },
    ],
    defaultPresetId: "target-level",
  };
};

export const spaceStation = createSpaceStationModule(defaultSpaceStationConfig);
