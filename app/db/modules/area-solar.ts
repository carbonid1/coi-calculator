import { type SyncedProductionEntity } from "../../game-state";
import { syncedBuildingPrototypeIds } from "../../helpers/area-building-sync/area-building-sync";
import { type CurrentValueSource } from "../../helpers/resolve-layered-value/resolve-layered-value";
import {
  emptySolarPanelCounts,
  resolveSolarPanelPlan,
  solarPanelOrder,
  solarPanels,
  type SolarPanelCounts,
} from "../solar";
import { type Module, type Preset } from "./modules";

export interface SolarPanelInventory {
  builtCounts: SolarPanelCounts;
  runningCounts: SolarPanelCounts;
}

export interface SolarPanelModuleAssignment extends SolarPanelInventory {
  plannedTargets: Partial<SolarPanelCounts>;
}

interface ResolveSolarPanelModuleAssignmentsOptions {
  defaultModuleId: string;
  fallbackInventory?: SolarPanelInventory;
  modules: readonly Pick<Module, "id" | "name">[];
  plannedTargets?: Partial<SolarPanelCounts>;
  productionEntities?: readonly SyncedProductionEntity[];
}

const panelByPrototypeId = new Map<string, keyof SolarPanelCounts>([
  [syncedBuildingPrototypeIds.solarPanel, "standard"],
  [syncedBuildingPrototypeIds.solarPanelMono, "mono"],
]);

const createCounts = (): SolarPanelCounts => ({ ...emptySolarPanelCounts });

const normalizeInventory = (
  inventory: SolarPanelInventory,
): SolarPanelInventory => {
  const builtCounts = createCounts();
  const runningCounts = createCounts();

  for (const panel of solarPanelOrder) {
    const built = Math.max(0, Math.trunc(inventory.builtCounts[panel]));

    builtCounts[panel] = built;
    runningCounts[panel] = Math.min(
      built,
      Math.max(0, Math.trunc(inventory.runningCounts[panel])),
    );
  }

  return { builtCounts, runningCounts };
};

/**
 * Assigns every physical panel to one module, then distributes each global plan
 * over existing running and paused capacity before proposing new construction.
 */
export const resolveSolarPanelModuleAssignments = ({
  defaultModuleId,
  fallbackInventory,
  modules,
  plannedTargets,
  productionEntities,
}: ResolveSolarPanelModuleAssignmentsOptions): Record<string, SolarPanelModuleAssignment> => {
  const assignments: Record<string, SolarPanelModuleAssignment> = {};

  for (const moduleDefinition of modules) {
    assignments[moduleDefinition.id] = {
      builtCounts: createCounts(),
      runningCounts: createCounts(),
      plannedTargets: {},
    };
  }

  const defaultAssignment = assignments[defaultModuleId];

  if (!defaultAssignment) {
    throw new Error(`Missing default solar owner module: ${defaultModuleId}`);
  }

  if (productionEntities === undefined) {
    const fallback = normalizeInventory(fallbackInventory ?? {
      builtCounts: emptySolarPanelCounts,
      runningCounts: emptySolarPanelCounts,
    });

    defaultAssignment.builtCounts = fallback.builtCounts;
    defaultAssignment.runningCounts = fallback.runningCounts;
  } else {
    const moduleIdsByAreaName = new Map<string, string[]>();

    for (const moduleDefinition of modules) {
      if (moduleDefinition.id === defaultModuleId) continue;
      const moduleIds = moduleIdsByAreaName.get(moduleDefinition.name) ?? [];

      moduleIds.push(moduleDefinition.id);
      moduleIdsByAreaName.set(moduleDefinition.name, moduleIds);
    }

    for (const entity of productionEntities) {
      const panel = panelByPrototypeId.get(entity.prototypeId);

      if (!panel) continue;

      const matchingModuleIds = new Set(entity.zones.flatMap(
        zone => moduleIdsByAreaName.get(zone.name ?? "") ?? [],
      ));
      const ownerId = matchingModuleIds.size === 1
        ? [...matchingModuleIds][0]
        : defaultModuleId;
      const owner = ownerId ? assignments[ownerId] : undefined;

      if (!owner) continue;

      owner.builtCounts[panel]++;
      owner.runningCounts[panel] += Number(entity.running);
    }
  }

  const moduleIds = modules.map(moduleDefinition => moduleDefinition.id);

  for (const panel of solarPanelOrder) {
    const rawTarget = plannedTargets?.[panel];

    if (rawTarget == null) continue;

    const target = Math.max(0, Math.trunc(rawTarget));
    const totalRunning = moduleIds.reduce(
      (total, moduleId) => total + (assignments[moduleId]?.runningCounts[panel] ?? 0),
      0,
    );
    let remaining = Math.max(0, target - totalRunning);

    if (remaining === 0) continue;

    const capacityOrder = moduleIds.toSorted((leftId, rightId) => {
      const left = assignments[leftId];
      const right = assignments[rightId];
      const leftPaused = left
        ? left.builtCounts[panel] - left.runningCounts[panel]
        : 0;
      const rightPaused = right
        ? right.builtCounts[panel] - right.runningCounts[panel]
        : 0;

      return rightPaused - leftPaused;
    });

    for (const moduleId of capacityOrder) {
      const assignment = assignments[moduleId];

      if (!assignment) continue;

      const paused = assignment.builtCounts[panel] - assignment.runningCounts[panel];
      const toStart = Math.min(paused, remaining);

      if (toStart <= 0) continue;

      assignment.plannedTargets[panel] = assignment.runningCounts[panel] + toStart;
      remaining -= toStart;

      if (remaining === 0) break;
    }

    if (remaining === 0) continue;

    const buildOwnerId = moduleIds.toSorted((leftId, rightId) => {
      const left = assignments[leftId];
      const right = assignments[rightId];
      const builtDifference = (right?.builtCounts[panel] ?? 0)
        - (left?.builtCounts[panel] ?? 0);

      if (builtDifference !== 0) return builtDifference;
      if (leftId === defaultModuleId) return -1;
      if (rightId === defaultModuleId) return 1;
      return 0;
    })[0] ?? defaultModuleId;
    const buildOwner = assignments[buildOwnerId];

    if (!buildOwner) continue;

    buildOwner.plannedTargets[panel] = (
      buildOwner.plannedTargets[panel]
      ?? buildOwner.runningCounts[panel]
    ) + remaining;
  }

  return assignments;
};

/** Adds live solar buildings to the calculator module that owns their game area. */
export const attachSolarPanelsToModule = (
  module: Module,
  builtCounts: SolarPanelCounts,
  runningCounts: SolarPanelCounts,
  plannedTargets?: Partial<SolarPanelCounts>,
  currentSource?: CurrentValueSource,
): Module => {
  const plan = resolveSolarPanelPlan(builtCounts, runningCounts, plannedTargets);
  const hasSolarPanels = solarPanelOrder.some(panel => (
    builtCounts[panel] > 0 || plan.activeCounts[panel] > 0
  ));

  if (!hasSolarPanels) return module;

  const builtBuildings = Object.fromEntries(solarPanelOrder.map(panel => [
    solarPanels[panel].recipeId,
    builtCounts[panel],
  ]));
  const activeBuildings = Object.fromEntries(solarPanelOrder.map(panel => [
    solarPanels[panel].recipeId,
    plan.activeCounts[panel],
  ]));
  const dataSources: NonNullable<Preset["dataSources"]> = {};

  for (const panel of solarPanelOrder) {
    if (plan.plannedPanels[panel]) {
      dataSources[solarPanels[panel].recipeId] = "planned";
    } else if (currentSource) {
      dataSources[solarPanels[panel].recipeId] = currentSource;
    }
  }

  const solarRecipeIds = solarPanelOrder.map(panel => solarPanels[panel].recipeId);

  return {
    ...module,
    builtBuildings: {
      ...module.builtBuildings,
      ...builtBuildings,
    },
    presets: module.presets.map(preset => ({
      ...preset,
      builtBuildings: preset.builtBuildings
        ? { ...preset.builtBuildings, ...builtBuildings }
        : undefined,
      activeBuildings: {
        ...preset.activeBuildings,
        ...activeBuildings,
      },
      dataSources: {
        ...preset.dataSources,
        ...dataSources,
      },
      fixed: [...new Set([...preset.fixed, ...solarRecipeIds])],
    })),
  };
};
