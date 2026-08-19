import {
  defaultSpaceStationConfig,
  type SpaceStationConfig,
} from "../space-station";
import { type Module } from "./modules";

export const SPACE_STATION_MODULE_ID = "space-station";

export const createSpaceStationModule = (
  config: SpaceStationConfig,
): Module => {
  const hasStation = config.targetLevel > 0;
  const hasOrbitalResearch = config.targetLevel >= 3;
  const builtBuildings = {
    "space-station-operations": hasStation ? 1 : 0,
    "space-station-orbital-research": hasOrbitalResearch ? 1 : 0,
    "assembly-v-composite-panel": hasStation ? 2 : 0,
    "rocket-ii-assembly": hasStation ? 1 : 0,
    "rocket-ii-launch-amortized": hasStation ? 1 : 0,
  };

  return {
    id: SPACE_STATION_MODULE_ID,
    name: "Space Station",
    description: "Level 4 orbital research with amortized Rocket II supply launches",
    includedInFactoryTotals: false,
    builtBuildings,
    presets: [
      {
        id: "target-level",
        name: "Target level",
        description: `Space Station level ${config.targetLevel}`,
        activeBuildings: builtBuildings,
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
