import { type Module } from "../../db/modules/modules";
import { type ResourceId } from "../../db/resources";
import {
  type PassiveResult,
  type RegularResult,
  type ResourceFlow,
} from "../calculate/calculate";

export type BuildingAttention = "build" | "can-pause" | "unpause";

export interface BuildingDiagnostic {
  key: string;
  moduleId: string;
  moduleName: string;
  buildingName: string;
  load: number;
  active: number;
  built: number;
  attention: BuildingAttention | null;
  attentionCount: number;
  affectedResources: string[];
}

type Result = RegularResult | PassiveResult;

const EPSILON = 0.001;

export const getBuildingKey = (result: Result) => (
  "capacityPoolId" in result && result.capacityPoolId
    ? result.capacityPoolId
    : `${result.moduleId}:${result.recipe.id}`
);

const isRegularResult = (result: Result): result is RegularResult => (
  "operatingMode" in result
);

const getAttention = ({
  tracksPhysicalCapacity,
  hasShortage,
  active,
  built,
  paused,
  atCapacity,
  canPause,
}: {
  tracksPhysicalCapacity: boolean;
  hasShortage: boolean;
  active: number;
  built: number;
  paused: number;
  atCapacity: boolean;
  canPause: number;
}): BuildingAttention | null => {
  if (!tracksPhysicalCapacity) return null;
  if (hasShortage && active === 0 && paused >= 1) return "unpause";
  if (hasShortage && active === 0 && built === 0) return "build";

  if (hasShortage && atCapacity) {
    return paused >= 1 ? "unpause" : "build";
  }

  return canPause >= 1 ? "can-pause" : null;
};

const getAttentionCount = (
  attention: BuildingAttention | null,
  canPause: number,
  paused: number,
  active: number,
  load: number,
) => {
  if (attention === "can-pause") return canPause;
  if (attention === "unpause") {
    return Math.min(paused, Math.max(1, Math.ceil(load + EPSILON) - active));
  }
  if (attention === "build") return 1;

  return 0;
};

export const calculateBuildingDiagnostics = (
  modules: Module[],
  flows: ResourceFlow[],
  regularResults: RegularResult[],
  sourceResults: PassiveResult[] = [],
  sinkResults: PassiveResult[] = [],
): BuildingDiagnostic[] => {
  const moduleNames = new Map(modules.map((module) => [module.id, module.name]));
  const flowsById = new Map(flows.map((flow) => [flow.resourceId, flow]));
  const groups = new Map<string, Result[]>();

  for (const result of [...regularResults, ...sourceResults, ...sinkResults]) {
    const key = getBuildingKey(result);
    const group = groups.get(key) ?? [];

    group.push(result);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, results]) => {
    const first = results[0];

    if (!first) throw new Error(`Building group ${key} has no results`);

    const tracksPhysicalCapacity = results.some((result) => (
      result.recipe.sinkMode !== "unbounded"
      && !(result.recipe.sourceMode === "demand" && result.recipe.sourceKind != null)
    ));
    const active = Math.max(...results.map((result) => result.activeBuildings));
    const built = Math.max(...results.map((result) => result.builtBuildings));
    const load = results.reduce(
      (total, result) => total + result.activeBuildings * result.supplyRatio,
      0,
    );
    const affectedResourceIds = new Set<ResourceId>();

    for (const result of results) {
      for (const output of result.recipe.outputs) {
        if ((flowsById.get(output.resourceId)?.net ?? 0) < -EPSILON) {
          affectedResourceIds.add(output.resourceId);
        }
      }

      const consumesSurplus = result.recipe.group === "sink"
        || result.recipe.allocation === "fallback"
        || result.recipe.allocation === "surplus";

      if (!consumesSurplus) continue;

      for (const input of result.recipe.inputs) {
        if ((flowsById.get(input.resourceId)?.net ?? 0) > EPSILON) {
          affectedResourceIds.add(input.resourceId);
        }
      }
    }

    const atCapacity = active > 0 && load >= active - EPSILON;
    const paused = Math.max(0, built - active);
    const canPause = Math.max(0, active - Math.ceil(Math.max(0, load - EPSILON)));
    const hasShortage = affectedResourceIds.size > 0;
    const attention = getAttention({
      tracksPhysicalCapacity,
      hasShortage,
      active,
      built,
      paused,
      atCapacity,
      canPause,
    });
    const attentionCount = getAttentionCount(attention, canPause, paused, active, load);

    return {
      key,
      moduleId: first.moduleId,
      moduleName: moduleNames.get(first.moduleId) ?? first.moduleId,
      buildingName: isRegularResult(first)
        ? first.recipe.sharedCapacity?.label ?? first.recipe.building
        : first.recipe.building,
      load,
      active,
      built,
      attention,
      attentionCount,
      affectedResources: [...affectedResourceIds].map(
        (resourceId) => flowsById.get(resourceId)?.name ?? resourceId,
      ),
    };
  });
};
