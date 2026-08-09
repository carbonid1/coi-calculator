import { recipes } from "../recipes";
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

const buildingCountForDemand = (recipeId: string, outputId: ResourceId, demand: number) => {
  const recipe = recipes.find((candidate) => candidate.id === recipeId);
  const output = recipe?.outputs.find((candidate) => candidate.resourceId === outputId);

  if (!output) throw new Error(`Missing ${outputId} output for ${recipeId}`);

  return demand / output.quantity;
};

const active = {
  [activeRecipeIds.maintenanceI]: buildingCountForDemand(
    activeRecipeIds.maintenanceI,
    "maintenanceI",
    maintenanceDemandPerCycle.maintenanceI,
  ),
  [activeRecipeIds.maintenanceII]: buildingCountForDemand(
    activeRecipeIds.maintenanceII,
    "maintenanceII",
    maintenanceDemandPerCycle.maintenanceII,
  ),
  [activeRecipeIds.maintenanceIII]: buildingCountForDemand(
    activeRecipeIds.maintenanceIII,
    "maintenanceIII",
    maintenanceDemandPerCycle.maintenanceIII,
  ),
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
    },
  ],
  defaultPresetId: "current-demand",
  localResources: ["maintenanceI", "maintenanceII", "maintenanceIII"],
};
