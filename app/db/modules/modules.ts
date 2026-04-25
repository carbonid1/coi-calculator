import { type ResourceId } from "../resources";
import { fbrPowerPlant } from "./fbr-power-plant";
import { yellowcakePlant } from "./yellowcake-plant";

export interface Preset {
  id: string;
  name: string;
  description: string;
  active: Record<string, number>;
  pinned: string[];
  externalInputs?: Partial<Record<ResourceId, number>>;
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
}

export const modules: [Module, ...Module[]] = [fbrPowerPlant, yellowcakePlant];
