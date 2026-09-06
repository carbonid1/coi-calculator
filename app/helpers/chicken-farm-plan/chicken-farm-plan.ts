import { type ValueSource } from "../../data-source";
import {
  getChickenFarmLayout,
  type ChickenFarmSettings,
  type CurrentChickenFarmEntity,
} from "../../db/chicken-farm";
import {
  type PlanMismatch,
  type PlanMismatchAction,
} from "../../db/modules/modules";
import { type PlanDirection } from "../resolve-directional-plan";

interface EffectiveChickenFarmMode {
  slaughtering: boolean;
  built: number;
  active: number;
  chickens: number;
  source: ValueSource;
}

export interface ResolvedChickenFarmEntityPlan {
  modes: EffectiveChickenFarmMode[];
  planMismatches: PlanMismatch[];
}

interface EffectiveEntity extends CurrentChickenFarmEntity {
  source: ValueSource;
}

const pluralize = (name: string, count: number) => `${name}${count === 1 ? "" : "s"}`;

const higherSource = (left: ValueSource, right: ValueSource): ValueSource => {
  return left === "planned" ? left : right;
};

const aggregateModes = (
  entities: readonly EffectiveEntity[],
  plannedChickenCount: number | null,
  plannedSlaughtering: boolean,
  plannedBuildCount = 0,
): EffectiveChickenFarmMode[] => {
  const modes = new Map<boolean, EffectiveChickenFarmMode>();

  for (const entity of entities) {
    const existing = modes.get(entity.slaughtering);

    if (existing) {
      existing.built++;
      existing.active += Number(entity.running);
      if (entity.running) existing.chickens += entity.chickens;
      existing.source = higherSource(existing.source, entity.source);
      continue;
    }

    modes.set(entity.slaughtering, {
      slaughtering: entity.slaughtering,
      built: 1,
      active: Number(entity.running),
      chickens: entity.running ? entity.chickens : 0,
      source: entity.source,
    });
  }

  if (plannedBuildCount > 0) {
    const existing = modes.get(plannedSlaughtering);

    if (existing) {
      existing.active += plannedBuildCount;
      existing.source = "planned";
    } else {
      modes.set(plannedSlaughtering, {
        slaughtering: plannedSlaughtering,
        built: 0,
        active: plannedBuildCount,
        chickens: 0,
        source: "planned",
      });
    }
  }

  const plannedMode = modes.get(plannedSlaughtering);

  if (plannedMode && plannedChickenCount !== null) {
    plannedMode.chickens = plannedChickenCount;
    plannedMode.source = "planned";
  }

  return [...modes.values()];
};

const createMismatch = (
  settings: ChickenFarmSettings,
  direction: PlanDirection,
  currentFarms: number,
  currentChickens: number,
  targetFarms: number,
  actions: PlanMismatchAction[],
): PlanMismatch => ({
  recipeId: settings.slaughtering
    ? "chicken-farm-slaughtering"
    : "chicken-farm-eggs-only",
  current: currentChickens,
  target: settings.totalChickenCount,
  direction,
  format: "animals",
  currentLabel: `${currentChickens.toLocaleString()} chickens · ${currentFarms} matching farms active`,
  targetLabel: `${direction === "at-least" ? "≥" : "≤"}${settings.totalChickenCount.toLocaleString()} chickens · ${direction === "at-least" ? "≥" : "≤"}${targetFarms} farms`,
  actions,
});

export const resolveChickenFarmEntityPlan = (
  settings: ChickenFarmSettings | null,
  currentEntities: readonly CurrentChickenFarmEntity[],
  direction: PlanDirection,
): ResolvedChickenFarmEntityPlan => {
  if (!settings) {
    return {
      modes: aggregateModes(
        currentEntities.map(entity => ({ ...entity, source: "synced" as const })),
        null,
        true,
      ),
      planMismatches: [],
    };
  }

  const targetLayout = getChickenFarmLayout(settings.totalChickenCount);
  const entities = [...currentEntities].toSorted((left, right) => left.entityId - right.entityId);
  const matchingRunning = entities.filter(entity => (
    entity.running && entity.slaughtering === settings.slaughtering
  ));
  const currentFarms = matchingRunning.length;
  const currentChickens = matchingRunning.reduce((total, entity) => total + entity.chickens, 0);
  const farmSatisfied = direction === "at-least"
    ? currentFarms >= targetLayout.farmCount
    : currentFarms <= targetLayout.farmCount;
  const chickensSatisfied = direction === "at-least"
    ? currentChickens >= targetLayout.totalChickenCount
    : currentChickens <= targetLayout.totalChickenCount;

  if (farmSatisfied && chickensSatisfied) {
    return {
      modes: aggregateModes(
        entities.map(entity => ({ ...entity, source: "synced" as const })),
        null,
        settings.slaughtering,
      ),
      planMismatches: [],
    };
  }

  const effective: EffectiveEntity[] = entities.map(entity => ({
    ...entity,
    source: "synced",
  }));

  if (direction === "at-most") {
    const activeMatching = effective.filter(entity => (
      entity.running && entity.slaughtering === settings.slaughtering
    ));
    const pauseCount = Math.max(0, activeMatching.length - targetLayout.farmCount);
    const pauseIds = new Set(
      (pauseCount > 0 ? activeMatching.slice(-pauseCount) : [])
        .map(entity => entity.entityId),
    );

    for (const entity of effective) {
      if (!pauseIds.has(entity.entityId)) continue;

      entity.running = false;
      entity.source = "planned";
    }

    const chickensAfterPause = effective.filter(entity => (
      entity.running && entity.slaughtering === settings.slaughtering
    )).reduce((total, entity) => total + entity.chickens, 0);
    const removeCount = Math.max(0, chickensAfterPause - targetLayout.totalChickenCount);
    const actions: PlanMismatchAction[] = [
      ...(pauseCount > 0
        ? [{
            type: "pause" as const,
            label: `Pause ${pauseCount} Chicken ${pluralize("Farm", pauseCount)}`,
          }]
        : []),
      ...(removeCount > 0
        ? [{
            type: "remove-animals" as const,
            label: `Remove ${removeCount.toLocaleString()} chickens`,
          }]
        : []),
    ];

    return {
      modes: aggregateModes(
        effective,
        Math.min(chickensAfterPause, targetLayout.totalChickenCount),
        settings.slaughtering,
      ),
      planMismatches: [
        createMismatch(
          settings,
          direction,
          currentFarms,
          currentChickens,
          targetLayout.farmCount,
          actions,
        ),
      ],
    };
  }

  const missingFarmCount = Math.max(0, targetLayout.farmCount - currentFarms);
  const candidateGroups = [
    entities.filter(entity => !entity.running && entity.slaughtering === settings.slaughtering),
    entities.filter(entity => entity.running && entity.slaughtering !== settings.slaughtering),
    entities.filter(entity => !entity.running && entity.slaughtering !== settings.slaughtering),
  ];
  const candidates = candidateGroups.flat().slice(0, missingFarmCount);
  let unpauseCount = 0;
  let configureCount = 0;

  for (const candidate of candidates) {
    const effectiveCandidate = effective.find(entity => entity.entityId === candidate.entityId);

    if (!effectiveCandidate) continue;
    if (!candidate.running) unpauseCount++;
    if (candidate.slaughtering !== settings.slaughtering) configureCount++;

    effectiveCandidate.running = true;
    effectiveCandidate.slaughtering = settings.slaughtering;
    effectiveCandidate.source = "planned";
  }

  const buildCount = Math.max(0, missingFarmCount - candidates.length);
  const availableChickens = effective.filter(entity => (
    entity.running && entity.slaughtering === settings.slaughtering
  )).reduce((total, entity) => total + entity.chickens, 0);
  const plannedChickenCount = Math.max(availableChickens, targetLayout.totalChickenCount);
  const addChickenCount = Math.max(0, targetLayout.totalChickenCount - availableChickens);
  const actions: PlanMismatchAction[] = [
    ...(unpauseCount > 0
      ? [{
          type: "unpause" as const,
          label: `Unpause ${unpauseCount} Chicken ${pluralize("Farm", unpauseCount)}`,
        }]
      : []),
    ...(configureCount > 0
      ? [{
          type: "configure" as const,
          label: `Set slaughtering ${settings.slaughtering ? "on" : "off"} for ${configureCount} Chicken ${pluralize("Farm", configureCount)}`,
        }]
      : []),
    ...(buildCount > 0
      ? [{
          type: "build" as const,
          label: `Build ${buildCount} Chicken ${pluralize("Farm", buildCount)}`,
        }]
      : []),
    ...(addChickenCount > 0
      ? [{
          type: "add-animals" as const,
          label: `Add ${addChickenCount.toLocaleString()} chickens`,
        }]
      : []),
  ];

  return {
    modes: aggregateModes(
      effective,
      plannedChickenCount,
      settings.slaughtering,
      buildCount,
    ),
    planMismatches: [
      createMismatch(
        settings,
        direction,
        currentFarms,
        currentChickens,
        targetLayout.farmCount,
        actions,
      ),
    ],
  };
};
