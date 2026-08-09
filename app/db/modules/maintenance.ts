import { type ResourceId } from "../resources";
import { type Module } from "./modules";

const productionCyclesPerGameYear = 12;

export const maintenanceDemandPerGameYear = {
  maintenanceI: 4_700,
  maintenanceII: 1_600,
  maintenanceIII: 1_600,
} as const satisfies Partial<Record<ResourceId, number>>;

export const maintenanceDemandPerCycle = {
  maintenanceI: maintenanceDemandPerGameYear.maintenanceI / productionCyclesPerGameYear,
  maintenanceII: maintenanceDemandPerGameYear.maintenanceII / productionCyclesPerGameYear,
  maintenanceIII: maintenanceDemandPerGameYear.maintenanceIII / productionCyclesPerGameYear,
} as const satisfies Partial<Record<ResourceId, number>>;

const activeRecipeIds = {
  maintenanceI: "maintenance-i-recycling",
  maintenanceII: "maintenance-ii-recycling",
  maintenanceIII: "maintenance-iii-recycling",
} as const;

const active = {
  [activeRecipeIds.maintenanceI]: 1,
  [activeRecipeIds.maintenanceII]: 1,
  [activeRecipeIds.maintenanceIII]: 1,
};

export const maintenance: Module = {
  id: "maintenance",
  name: "Maintenance",
  description: "Manual factory demand using the highest-tier recycling recipes",
  buildingTotals: {
    [activeRecipeIds.maintenanceI]: 1,
    [activeRecipeIds.maintenanceII]: 1,
    [activeRecipeIds.maintenanceIII]: 1,
  },
  presets: [
    {
      id: "current-demand",
      name: "Current demand",
      description: "4.7k Maintenance I, 1.6k Maintenance II, and 1.6k Maintenance III per game year",
      active,
      pinned: Object.values(activeRecipeIds),
      incomingFromModules: ["mechanicalParts", "electronicsI", "electronicsII", "electronicsIII"],
      outputTargets: maintenanceDemandPerCycle,
    },
  ],
  defaultPresetId: "current-demand",
  localResources: ["maintenanceI", "maintenanceII", "maintenanceIII"],
};
