import { type ResourceId } from "../resources";
import { fbrPowerPlant } from "./fbr-power-plant";
import { general } from "./general";
import { maintenance } from "./maintenance";
import { solarPower } from "./solar-power";

export interface Preset {
  id: string;
  name: string;
  description: string;
  active: Record<string, number>;
  pinned: string[];
  incomingFromModules?: ResourceId[];
  incomingFromContracts?: ResourceId[];
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
  incomingFromModules?: ResourceId[];
  incomingFromContracts?: ResourceId[];
  externalInputs?: Partial<Record<ResourceId, number>>;
  /** Resources reported inside this module but intentionally excluded from Factory Total. */
  localResources?: ResourceId[];
}

export const modules: [Module, ...Module[]] = [general, fbrPowerPlant, solarPower, maintenance];
