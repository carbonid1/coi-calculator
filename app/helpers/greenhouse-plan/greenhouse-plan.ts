import {
  crops,
  fertilizers,
  type CropFarmGroup,
  type CropFarmTierId,
  type CropId,
  type CropSchedule,
  type CurrentCropFarmEntity,
  type FertilizerId,
} from "../../db/crop-farming";
import { type PlanMismatch, type PlanMismatchAction } from "../../db/modules/modules";
import { type PlanDirection } from "../resolve-layered-value/resolve-directional-plan";
import { type CurrentValueSource, type ValueSource } from "../resolve-layered-value/resolve-layered-value";

export interface GreenhousePlanOptions {
  defaultDirection: PlanDirection;
  directions?: Partial<Record<string, PlanDirection>>;
  totalDirection: PlanDirection;
}

interface PlanSlot {
  group: CropFarmGroup;
  direction: PlanDirection;
  entity: CurrentCropFarmEntity | null;
}

export interface EffectiveGreenhouseGroup {
  group: CropFarmGroup;
  built: number;
  active: number;
  source: ValueSource;
  entityIds: number[];
}

export interface ResolvedGreenhouseEntityPlan {
  groups: EffectiveGreenhouseGroup[];
  planMismatches: PlanMismatch[];
}

const pluralize = (name: string, count: number) => `${name}${count === 1 ? "" : "s"}`;
const isCropId = (value: string): value is CropId => value in crops;

const toCropSchedule = (values: readonly string[]): CropSchedule => {
  const normalized = values.slice(0, 4).map(value => isCropId(value) ? value : "none");
  const first = normalized[0] ?? "none";
  const second = normalized[1] ?? "none";
  const third = normalized[2] ?? "none";
  const fourth = normalized[3] ?? "none";

  if (normalized.length >= 4) return [first, second, third, fourth];
  if (normalized.length === 3) return [first, second, third];
  if (normalized.length === 2) return [first, second];

  return [first];
};

const getFertilizerId = (targetFertilityPercent: number): FertilizerId | null => {
  if (targetFertilityPercent <= 0) return null;
  if (targetFertilityPercent <= fertilizers.organic.maximumFertilityPercent) return "organic";
  if (targetFertilityPercent <= fertilizers.fertilizerI.maximumFertilityPercent) {
    return "fertilizerI";
  }

  return "fertilizerII";
};

export const greenhouseConfigurationKey = (configuration: {
  tierId: CropFarmTierId;
  schedule: readonly string[];
  fertilityTargetPercent: number;
}) => [
  configuration.tierId,
  configuration.schedule.join("/"),
  configuration.fertilityTargetPercent,
].join("|");

const groupKey = (group: CropFarmGroup) => greenhouseConfigurationKey({
  tierId: group.tierId,
  schedule: group.schedule,
  fertilityTargetPercent: group.fertilizer?.targetFertilityPercent ?? 100,
});

const entityKey = (entity: CurrentCropFarmEntity) => greenhouseConfigurationKey(entity);

const createCurrentGroup = (entity: CurrentCropFarmEntity): CropFarmGroup => {
  const schedule = toCropSchedule(entity.schedule);
  const fertilizerId = getFertilizerId(entity.fertilityTargetPercent);
  const name = schedule.map(cropId => crops[cropId].name).join(" / ");

  return {
    id: [
      "greenhouse-live",
      entity.tierId,
      schedule.join("-"),
      `fertility-${entity.fertilityTargetPercent}`,
    ].join("-"),
    name,
    farmCount: 1,
    tierId: entity.tierId,
    schedule,
    fertilizer: fertilizerId
      ? { id: fertilizerId, targetFertilityPercent: entity.fertilityTargetPercent }
      : null,
  };
};

const sourcePriority: Record<ValueSource, number> = {
  default: 0,
  modeled: 1,
  synced: 2,
  planned: 3,
};

const higherSource = (left: ValueSource, right: ValueSource) => (
  sourcePriority[right] > sourcePriority[left] ? right : left
);

const assignFirst = (
  slots: PlanSlot[],
  entities: CurrentCropFarmEntity[],
  assignedIds: Set<number>,
  predicate: (slot: PlanSlot, entity: CurrentCropFarmEntity) => boolean,
) => {
  for (const slot of slots) {
    if (slot.entity) continue;

    const entity = entities.find(candidate => (
      !assignedIds.has(candidate.entityId) && predicate(slot, candidate)
    ));

    if (!entity) continue;

    slot.entity = entity;
    assignedIds.add(entity.entityId);
  }
};

const createBindingActions = (slots: PlanSlot[]): PlanMismatchAction[] => {
  let unpause = 0;
  let configure = 0;
  let upgrade = 0;
  let build = 0;

  for (const slot of slots) {
    const entity = slot.entity;

    if (!entity) {
      build++;
      continue;
    }

    if (!entity.running) unpause++;
    if (entity.tierId !== slot.group.tierId) upgrade++;
    else if (entityKey(entity) !== groupKey(slot.group)) configure++;
  }

  return [
    ...(unpause > 0
      ? [{ type: "unpause" as const, label: `Unpause ${unpause} ${pluralize("Greenhouse", unpause)}` }]
      : []),
    ...(configure > 0
      ? [{ type: "configure" as const, label: `Configure ${configure} ${pluralize("Greenhouse", configure)}` }]
      : []),
    ...(upgrade > 0
      ? [{
          type: "upgrade" as const,
          label: `Upgrade and configure ${upgrade} ${pluralize("Greenhouse", upgrade)} to Greenhouse II`,
        }]
      : []),
    ...(build > 0
      ? [{ type: "build" as const, label: `Build ${build} ${pluralize("Greenhouse II", build)}` }]
      : []),
  ];
};

export const resolveGreenhouseEntityPlan = (
  plannedGroups: readonly CropFarmGroup[],
  currentEntities: readonly CurrentCropFarmEntity[],
  currentSource: CurrentValueSource,
  planOptions: GreenhousePlanOptions,
): ResolvedGreenhouseEntityPlan => {
  const entities = [...currentEntities].toSorted((left, right) => (
    Number(right.running) - Number(left.running) || left.entityId - right.entityId
  ));
  const slots: PlanSlot[] = plannedGroups.flatMap(group => {
    const direction = planOptions.directions?.[group.id] ?? planOptions.defaultDirection;
    const exactRunning = entities.filter(entity => (
      entity.running && entityKey(entity) === groupKey(group)
    )).length;
    const slotCount = direction === "at-most"
      ? Math.min(group.farmCount, exactRunning)
      : group.farmCount;

    return Array.from(
      { length: slotCount },
      () => ({ group, direction, entity: null }),
    );
  });
  const assignedIds = new Set<number>();

  // Preserve exact live matches first, then layer remaining plans over running
  // buildings so the projected list never counts both old and new production.
  assignFirst(slots, entities, assignedIds, (slot, entity) => (
    entity.running && entityKey(entity) === groupKey(slot.group)
  ));
  assignFirst(slots, entities, assignedIds, (slot, entity) => (
    slot.direction === "at-least"
    && entity.running
    && entity.tierId === slot.group.tierId
  ));
  assignFirst(slots, entities, assignedIds, (slot, entity) => (
    slot.direction === "at-least"
    && entity.running
    && slot.group.tierId === "greenhouseII"
    && entity.tierId === "greenhouse"
  ));
  assignFirst(slots, entities, assignedIds, (slot, entity) => (
    slot.direction === "at-least"
    && !entity.running
    && entityKey(entity) === groupKey(slot.group)
  ));
  assignFirst(slots, entities, assignedIds, (slot, entity) => (
    slot.direction === "at-least"
    && !entity.running
    && entity.tierId === slot.group.tierId
  ));
  assignFirst(slots, entities, assignedIds, (slot, entity) => (
    slot.direction === "at-least"
    && !entity.running
    && slot.group.tierId === "greenhouseII"
    && entity.tierId === "greenhouse"
  ));

  const plannedByKey = new Map(plannedGroups.map(group => [groupKey(group), group]));
  const effective = new Map<string, EffectiveGreenhouseGroup>();
  const addEffective = (
    group: CropFarmGroup,
    built: number,
    active: number,
    source: ValueSource,
    entityId?: number,
  ) => {
    const key = groupKey(group);
    const existing = effective.get(key);

    if (existing) {
      existing.built += built;
      existing.active += active;
      existing.source = higherSource(existing.source, source);
      if (entityId !== undefined) existing.entityIds.push(entityId);
      return;
    }

    effective.set(key, {
      group,
      built,
      active,
      source,
      entityIds: entityId === undefined ? [] : [entityId],
    });
  };

  for (const slot of slots) {
    const entity = slot.entity;
    const satisfied = Boolean(
      entity && entity.running && entityKey(entity) === groupKey(slot.group),
    );

    addEffective(
      slot.group,
      entity ? 1 : 0,
      1,
      satisfied ? currentSource : "planned",
      entity?.entityId,
    );
  }

  const unboundRunning = entities.filter(entity => (
    entity.running && !assignedIds.has(entity.entityId)
  ));
  const plannedPauseIds = new Set<number>();

  for (const group of plannedGroups) {
    const direction = planOptions.directions?.[group.id] ?? planOptions.defaultDirection;

    if (direction !== "at-most") continue;

    for (const entity of unboundRunning) {
      if (entityKey(entity) === groupKey(group)) plannedPauseIds.add(entity.entityId);
    }
  }

  const totalTarget = plannedGroups.reduce((total, group) => total + group.farmCount, 0);
  const totalPauseCount = planOptions.totalDirection === "at-most"
    ? Math.max(0, entities.filter(entity => entity.running).length - totalTarget)
    : 0;
  const additionalPauseCount = Math.max(0, totalPauseCount - plannedPauseIds.size);
  const additionalPauseEntities = unboundRunning
    .filter(entity => !plannedPauseIds.has(entity.entityId))
    .slice(0, additionalPauseCount);

  for (const entity of additionalPauseEntities) plannedPauseIds.add(entity.entityId);

  for (const entity of entities) {
    if (assignedIds.has(entity.entityId)) continue;

    const currentGroup = plannedByKey.get(entityKey(entity)) ?? createCurrentGroup(entity);
    const plannedPause = plannedPauseIds.has(entity.entityId);

    addEffective(
      currentGroup,
      1,
      plannedPause ? 0 : Number(entity.running),
      plannedPause ? "planned" : currentSource,
      entity.entityId,
    );
  }

  const planMismatches: PlanMismatch[] = [];

  for (const group of plannedGroups) {
    const direction = planOptions.directions?.[group.id] ?? planOptions.defaultDirection;
    const current = entities.filter(entity => (
      entity.running && entityKey(entity) === groupKey(group)
    )).length;
    const satisfied = direction === "at-least"
      ? current >= group.farmCount
      : current <= group.farmCount;

    if (satisfied) continue;

    const groupSlots = slots.filter(slot => slot.group.id === group.id);
    const pauseCount = direction === "at-most"
      ? unboundRunning.filter(entity => entityKey(entity) === groupKey(group)).length
      : 0;

    if (direction === "at-most" && pauseCount === 0) continue;

    planMismatches.push({
      recipeId: group.id,
      current,
      currentSource,
      target: group.farmCount,
      direction,
      format: "configuration",
      actions: direction === "at-most"
        ? [{
            type: "pause",
            label: `Pause ${pauseCount} ${pluralize("Greenhouse", pauseCount)}`,
          }]
        : createBindingActions(groupSlots),
    });
  }

  if (additionalPauseEntities.length > 0) {
    const first = additionalPauseEntities[0];

    if (first) {
      const anchor = plannedByKey.get(entityKey(first)) ?? createCurrentGroup(first);

      planMismatches.push({
        recipeId: anchor.id,
        current: entities.filter(entity => entity.running).length,
        currentSource,
        target: slots.length,
        direction: "at-most",
        format: "configuration",
        currentLabel: `${entities.filter(entity => entity.running).length} running Greenhouses`,
        targetLabel: `≤${slots.length} planned configurations`,
        actions: [{
          type: "pause",
          label: `Pause ${additionalPauseEntities.length} additional ${pluralize("Greenhouse", additionalPauseEntities.length)}`,
        }],
      });
    }
  }

  return {
    groups: [...effective.values()],
    planMismatches,
  };
};
