import { type PlanDirection } from "../../helpers/resolve-layered-value/resolve-directional-plan";
import { type ValueSource } from "../../helpers/resolve-layered-value/resolve-layered-value";
import { type Recipe } from "../recipes";
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
import { spaceStation } from "./space-station";
import { staticInfrastructure } from "./static-infrastructure";

export interface Preset {
  id: string;
  name: string;
  description: string;
  /** Buildings that are switched on. Omitted recipes use every built building. */
  activeBuildings: Record<string, number>;
  /** Provenance for actionable recipe values that should receive state treatment. */
  dataSources?: Partial<Record<string, ValueSource>>;
  /** Recipes forced to run at active capacity. Every other recipe is automatically balanced. */
  fixed: string[];
  outputTargets?: Partial<Record<ResourceId, number>>;
  builtBuildings?: Record<string, number>;
  speedLevels?: Record<string, number>;
  /** Manually measured resource use outside the currently modeled recipes. */
  fixedDemands?: Partial<Record<ResourceId, number>>;
  /** Minimum average output for a named electricity dispatch group. */
  electricityDispatchTargets?: Record<string, number>;
  /** Sequenced reminders that remain after the projected operating plan is applied. */
  plannedFollowUps?: PlannedFollowUp[];
  /** Unmet directional targets shown only in the consolidated Factory Total checklist. */
  planMismatches?: PlanMismatch[];
}

export interface PlanMismatch {
  recipeId: string;
  current: number;
  currentSource: Exclude<ValueSource, "planned">;
  target: number;
  direction: PlanDirection;
  format: "count" | "level" | "animals" | "configuration";
  currentLabel?: string;
  targetLabel?: string;
  actions: PlanMismatchAction[];
}

export interface PlanMismatchAction {
  type:
    | "assign"
    | "build"
    | "pause"
    | "unpause"
    | "upgrade"
    | "configure"
    | "add-animals"
    | "remove-animals";
  label: string;
}

export interface PlannedFollowUp {
  id: string;
  recipeId: string;
  action: "pause";
  count: number;
  note: string;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  /** Planning-only modules stay browsable but do not affect Factory Total. */
  includedInFactoryTotals?: boolean;
  /** Physical buildings present in the factory, including paused buildings. */
  builtBuildings: Record<string, number>;
  /** Runtime-defined recipes owned by this module. */
  recipes?: readonly Recipe[];
  presets: Preset[];
  defaultPresetId: string | null;
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
