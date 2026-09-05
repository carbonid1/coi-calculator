import { type ValueSource } from "../../data-source";
import { type PlanDirection } from "../../helpers/resolve-directional-plan";
import { type Recipe } from "../recipes";
import { type ResourceId } from "../resources";

export interface Preset {
  id: string;
  name: string;
  description: string;
  /** Buildings that are switched on. Omitted recipes use every built building. */
  activeBuildings: Record<string, number>;
  /** Current active inventory, before projected ghosts or unplaced plans. */
  currentActiveBuildings?: Record<string, number>;
  /** Provenance for actionable recipe values that should receive state treatment. */
  dataSources?: Partial<Record<string, ValueSource>>;
  /** Recipes forced to run at active capacity. Every other recipe is automatically balanced. */
  fixed: string[];
  outputTargets?: Partial<Record<ResourceId, number>>;
  /** Per-recipe observed targets used when several recipes produce the same resource. */
  recipeOutputTargets?: Record<string, Partial<Record<ResourceId, number>>>;
  builtBuildings?: Record<string, number>;
  /** Observable game construction ghosts included as projected capacity. */
  constructionGhosts?: Record<string, number>;
  /** Planned buildings that have not yet become game construction ghosts. */
  unplacedPlannedBuildings?: Record<string, number>;
  /** Physical inventory shared by runtime recipes using the same machine prototype. */
  capacityPools?: Record<string, CapacityPoolInventory>;
  speedLevels?: Record<string, number>;
  /** Manually measured resource use outside the currently modeled recipes. */
  fixedDemands?: Partial<Record<ResourceId, number>>;
  /** Long-run planning allowances, independent of observed consumption. */
  plannedDemands?: Partial<Record<ResourceId, number>>;
  /** Planned product quantities imported directly into this module each production cycle. */
  requestedImports?: Partial<Record<ResourceId, number>>;
  /** Planned product quantities exported from this module each production cycle. */
  requestedExports?: Partial<Record<ResourceId, number>>;
  /** Minimum average output for a named electricity dispatch group. */
  electricityDispatchTargets?: Record<string, number>;
  /** Sequenced reminders that remain after the projected operating plan is applied. */
  plannedFollowUps?: PlannedFollowUp[];
  /** Planned calculation overrides that require no player action. */
  nonActionablePlanRecipeIds?: string[];
  /** Unmet directional targets shown only in the consolidated Factory Total checklist. */
  planMismatches?: PlanMismatch[];
}

interface CapacityPoolInventory {
  active: number;
  built: number;
  currentActive?: number;
  constructionGhosts: number;
  unplacedPlanned?: number;
}

export interface LiveAreaIssue {
  id: string;
  building: string;
  count: number;
  message: string;
}

export interface LiveAreaModuleState {
  zoneId: number;
  trackedBuildings: number;
  constructedBuildings: number;
  activeBuildings: number;
  pausedBuildings: number;
  constructionGhosts: number;
  issues: LiveAreaIssue[];
}

export type ModuleCapability =
  | "chicken-farming"
  | "computing"
  | "crop-farming"
  | "default"
  | "forestry"
  | "nuclear"
  | "offices"
  | "population"
  | "space-station";

export interface PlanMismatch {
  recipeId: string;
  current: number;
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
    | "cancel-build"
    | "pause"
    | "unpause"
    | "upgrade"
    | "configure"
    | "add-animals"
    | "remove-animals";
  label: string;
}

interface PlannedFollowUp {
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
  /** This module's physical inventory is sourced from the game snapshot. */
  gameSynced?: true;
  /** Modules calculated outside the global pool; their boundary flows may be added separately. */
  includedInFactoryTotals?: boolean;
  /** Physical buildings present in the factory, including paused buildings. */
  builtBuildings: Record<string, number>;
  /** Runtime-defined recipes owned by this module. */
  recipes?: readonly Recipe[];
  /** Stable semantic features inferred from game prototype IDs, never display names. */
  capabilities?: readonly ModuleCapability[];
  presets: Preset[];
  defaultPresetId: string | null;
  /** Resources reported inside this module but intentionally excluded from Factory Total. */
  localResources?: ResourceId[];
  /** Live named-area inventory supplied by the game exporter. */
  liveArea?: LiveAreaModuleState;
}

export const hasModuleCapability = (
  module: Pick<Module, "capabilities">,
  capability: ModuleCapability,
) => module.capabilities?.includes(capability) ?? false;
