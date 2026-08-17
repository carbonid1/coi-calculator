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
  };

  return {
    id: SPACE_STATION_MODULE_ID,
    name: "Space Station",
    description: "One scalable orbital station; level 4 supports two Research Lab IV buildings",
    builtBuildings,
    presets: [
      {
        id: "target-level",
        name: "Target level",
        description: `Space Station level ${config.targetLevel}`,
        activeBuildings: builtBuildings,
        fixed: ["space-station-operations"],
      },
    ],
    defaultPresetId: "target-level",
  };
};

export const spaceStation = createSpaceStationModule(defaultSpaceStationConfig);
