import { type ResourceId } from "../resources";
import { type Module } from "./modules";

// Baseline inferred from the 10-year average building loads at Maintenance
// Output III: I: 495 * 83%, II: 495 * 29%, III: 246 * 50%. The active
// Maintenance III plan includes 140 additional units per production cycle.
export const maintenanceDemandPerMonth = {
  maintenanceI: 410.85,
  maintenanceII: 143.55,
  maintenanceIII: 263,
} as const satisfies Partial<Record<ResourceId, number>>;

const activeRecipeIds = {
  maintenanceI: "maintenance-i-recycling",
  maintenanceII: "maintenance-ii-recycling",
  maintenanceIII: "maintenance-iii-recycling",
} as const;

const activeBuildings = {
  [activeRecipeIds.maintenanceI]: 1,
  [activeRecipeIds.maintenanceII]: 1,
  [activeRecipeIds.maintenanceIII]: 2,
};

export const maintenance: Module = {
  id: "maintenance",
  name: "Maintenance",
  description: "Manual factory demand using the highest-tier recycling recipes",
  builtBuildings: {
    [activeRecipeIds.maintenanceI]: 1,
    [activeRecipeIds.maintenanceII]: 1,
    [activeRecipeIds.maintenanceIII]: 2,
  },
  presets: [
    {
      id: "current-demand",
      name: "Current demand",
      description: "10-year average with 140 additional Maintenance III per production cycle",
      activeBuildings,
      fixed: Object.values(activeRecipeIds),
      outputTargets: maintenanceDemandPerMonth,
    },
  ],
  defaultPresetId: "current-demand",
  localResources: ["maintenanceI", "maintenanceII", "maintenanceIII"],
};
