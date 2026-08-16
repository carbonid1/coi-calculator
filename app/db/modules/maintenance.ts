import { type ResourceId } from "../resources";
import { type Module } from "./modules";

// Inferred from the 10-year average building loads at Maintenance Output IV.
// The game rounds each recipe-cycle output before converting it to a /60 rate:
// I: 2 depots * 498 * 55%, II: 498 * 39%, III: 249 * 95%.
export const maintenanceDemandPerMonth = {
  maintenanceI: 547.8,
  maintenanceII: 194.22,
  maintenanceIII: 236.55,
} as const satisfies Partial<Record<ResourceId, number>>;

const activeRecipeIds = {
  maintenanceI: "maintenance-i-recycling",
  maintenanceII: "maintenance-ii-recycling",
  maintenanceIII: "maintenance-iii-recycling",
} as const;

const activeBuildings = {
  [activeRecipeIds.maintenanceI]: 2,
  [activeRecipeIds.maintenanceII]: 1,
  [activeRecipeIds.maintenanceIII]: 1,
};

export const maintenance: Module = {
  id: "maintenance",
  name: "Maintenance",
  description: "Manual factory demand using the highest-tier recycling recipes",
  builtBuildings: {
    [activeRecipeIds.maintenanceI]: 2,
    [activeRecipeIds.maintenanceII]: 1,
    [activeRecipeIds.maintenanceIII]: 1,
  },
  presets: [
    {
      id: "current-demand",
      name: "Current demand",
      description: "10-year average: two Maintenance I depots at 55%, Maintenance II at 39%, and Maintenance III at 95% load",
      activeBuildings,
      fixed: Object.values(activeRecipeIds),
      outputTargets: maintenanceDemandPerMonth,
    },
  ],
  defaultPresetId: "current-demand",
  localResources: ["maintenanceI", "maintenanceII", "maintenanceIII"],
};
