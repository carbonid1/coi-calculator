import { type PlanMismatchAction } from "./modules";

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
