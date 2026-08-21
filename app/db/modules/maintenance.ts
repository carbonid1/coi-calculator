import { type ResourceId } from "../resources";
import { type Module } from "./modules";

export interface MaintenanceDemand {
  maintenanceI: number;
  maintenanceII: number;
  maintenanceIII: number;
}

export const emptyMaintenanceDemand = {
  maintenanceI: 0,
  maintenanceII: 0,
  maintenanceIII: 0,
} as const satisfies MaintenanceDemand & Partial<Record<ResourceId, number>>;

export const MAINTENANCE_MODULE_ID = "maintenance";

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

export const createMaintenanceModule = (
  demand: MaintenanceDemand = emptyMaintenanceDemand,
): Module => ({
  id: MAINTENANCE_MODULE_ID,
  name: "Maintenance",
  description: "Observed factory demand using the highest-tier recycling recipes",
  builtBuildings: {
    [activeRecipeIds.maintenanceI]: 2,
    [activeRecipeIds.maintenanceII]: 1,
    [activeRecipeIds.maintenanceIII]: 1,
  },
  presets: [
    {
      id: "current-demand",
      name: "Current demand",
      description: "Rolling game average from synced history",
      activeBuildings,
      fixed: Object.values(activeRecipeIds),
      outputTargets: demand,
    },
  ],
  defaultPresetId: "current-demand",
  localResources: ["maintenanceI", "maintenanceII", "maintenanceIII"],
});

export const maintenance: Module = createMaintenanceModule();
