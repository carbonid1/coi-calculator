import { type ResourceId } from "../resources";
import { farms } from "./farms";
import { fbrPowerPlant } from "./fbr-power-plant";
import { general } from "./general";
import { maintenance } from "./maintenance";
import { mines } from "./mines";
import { solarPower } from "./solar-power";

export interface Preset {
  id: string;
  name: string;
  description: string;
  /** Maximum building capacity available to the calculator. Omitted recipes use the installed total. */
  available: Record<string, number>;
  /** Recipes forced to run at their available capacity. Every other recipe is automatically balanced. */
  fixed: string[];
  externalInputs?: Partial<Record<ResourceId, number>>;
  outputTargets?: Partial<Record<ResourceId, number>>;
  buildingTotals?: Record<string, number>;
  speedLevels?: Record<string, number>;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  buildingTotals: Record<string, number>;
  presets: Preset[];
  defaultPresetId: string | null;
  externalInputs?: Partial<Record<ResourceId, number>>;
  /** Resources reported inside this module but intentionally excluded from Factory Total. */
  localResources?: ResourceId[];
}

export const modules: [Module, ...Module[]] = [general, farms, mines, fbrPowerPlant, solarPower, maintenance];
