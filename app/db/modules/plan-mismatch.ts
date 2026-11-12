import { type Recipe } from "../recipes";
import { type Module, type PlanMismatchAction } from "./modules";

interface AtLeastBuildingActionsOptions {
  built: number;
  name: string;
  pluralName?: string;
  running: number;
  target: number;
}

interface AtMostBuildingActionsOptions {
  name: string;
  pluralName?: string;
  running: number;
  target: number;
}

const pluralize = (
  name: string,
  count: number,
  pluralName?: string,
) => count === 1 ? name : pluralName ?? `${name}s`;

/**
 * Describes the independent operating changes needed to reach an at-least
 * building target. Paused capacity is consumed before new construction.
 */
export const createAtLeastBuildingActions = ({
  built,
  name,
  pluralName,
  running,
  target,
}: AtLeastBuildingActionsOptions): PlanMismatchAction[] => {
  const normalizedBuilt = Math.max(0, Math.trunc(built));
  const normalizedRunning = Math.min(
    normalizedBuilt,
    Math.max(0, Math.trunc(running)),
  );
  const normalizedTarget = Math.max(0, Math.ceil(target));
  const unpauseCount = Math.min(
    normalizedBuilt - normalizedRunning,
    Math.max(0, normalizedTarget - normalizedRunning),
  );
  const buildCount = Math.max(0, normalizedTarget - normalizedBuilt);

  return [
    ...(unpauseCount > 0
      ? [{
          type: "unpause" as const,
          label: `Unpause ${unpauseCount} ${pluralize(name, unpauseCount, pluralName)}`,
        }]
      : []),
    ...(buildCount > 0
      ? [{
          type: "build" as const,
          label: `Build ${buildCount} ${pluralize(name, buildCount, pluralName)}`,
        }]
      : []),
  ];
};

/** Describes the operating change needed to reach an at-most building target. */
export const createAtMostBuildingActions = ({
  name,
  pluralName,
  running,
  target,
}: AtMostBuildingActionsOptions): PlanMismatchAction[] => {
  const normalizedRunning = Math.max(0, Math.trunc(running));
  const normalizedTarget = Math.max(0, Math.floor(target));
  const pauseCount = Math.max(0, normalizedRunning - normalizedTarget);

  return pauseCount > 0
    ? [{
        type: "pause",
        label: `Pause ${pauseCount} ${pluralize(name, pauseCount, pluralName)}`,
      }]
    : [];
};

/** Pause dedicated buildings identified by recipe, leaving shared recipe pools available. */
export const pauseDedicatedProduction = (module: Module, matches: (recipe: Recipe) => boolean): Module => {
  const recipes = module.recipes?.filter(recipe => !recipe.sharedCapacity && matches(recipe)) ?? [];

  if (recipes.length === 0) return module;

  return { ...module, presets: module.presets.map(preset => {
    const activeBuildings = { ...preset.activeBuildings };
    const dataSources = { ...preset.dataSources };
    const planMismatches = [...(preset.planMismatches ?? [])];

    for (const recipe of recipes) {
      const active = activeBuildings[recipe.id] ?? 0;

      if (active <= 0) continue;
      const running = preset.currentActiveBuildings?.[recipe.id] ?? active;
      const actions = createAtMostBuildingActions({ name: recipe.building, running, target: 0 });

      activeBuildings[recipe.id] = 0;
      dataSources[recipe.id] = 'planned';
      if (actions.length > 0) planMismatches.push({
        recipeId: recipe.id, current: running, target: 0, direction: 'at-most', format: 'count', actions,
      });
    }

    return { ...preset, activeBuildings, dataSources, planMismatches };
  }) };
};
