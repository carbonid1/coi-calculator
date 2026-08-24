import { type ResourceId } from "../resources";
import { computing } from "./computing";
import { chickenFarms, greenhouses } from "./farms";
import { forestry } from "./forestry";
import { general } from "./general";
import { housing } from "./housing";
import { maintenance } from "./maintenance";
import { mines } from "./mines";
import { nuclear } from "./nuclear";
import { offices } from "./offices";
import { processSteam } from "./process-steam";
import { research } from "./research";
import { reserves } from "./reserves";
import { solarPower } from "./solar-power";
import { spacePointsExpansion } from "./space-points-expansion";
import { spaceStation } from "./space-station";
import { staticInfrastructure } from "./static-infrastructure";

export interface Preset {
  id: string;
  name: string;
  description: string;
  /** Buildings that are switched on. Omitted recipes use every built building. */
  activeBuildings: Record<string, number>;
  /** Recipes forced to run at active capacity. Every other recipe is automatically balanced. */
  fixed: string[];
  externalInputs?: Partial<Record<ResourceId, number>>;
  outputTargets?: Partial<Record<ResourceId, number>>;
  builtBuildings?: Record<string, number>;
  speedLevels?: Record<string, number>;
  /** Manually measured resource use outside the currently modeled recipes. */
  fixedDemands?: Partial<Record<ResourceId, number>>;
  /** Minimum average output for a named electricity dispatch group. */
  electricityDispatchTargets?: Record<string, number>;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  /** Planning-only modules stay browsable but do not affect Factory Total. */
  includedInFactoryTotals?: boolean;
  /** Physical buildings present in the factory, including paused buildings. */
  builtBuildings: Record<string, number>;
  presets: Preset[];
  defaultPresetId: string | null;
  externalInputs?: Partial<Record<ResourceId, number>>;
  /** Resources reported inside this module but intentionally excluded from Factory Total. */
  localResources?: ResourceId[];
}

export const modules: [Module, ...Module[]] = [
  general,
  forestry,
  processSteam,
  research,
  offices,
  spaceStation,
  spacePointsExpansion,
  greenhouses,
  chickenFarms,
  housing,
  staticInfrastructure,
  mines,
  reserves,
  nuclear,
  solarPower,
  computing,
  maintenance,
];
