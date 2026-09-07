import { isUnboundedDemandSourceMode } from "../../db/recipes";
import { type ResourceId } from "../../db/resources";
import { type PassiveResult, type RegularResult } from "../calculate/calculate";

const BALANCE_THRESHOLD = 0.001;

export type PoolResult = RegularResult | PassiveResult;

export interface CapacityPool {
  atCapacity: boolean;
  /** Active buildings the pool can run. */
  capacity: number;
  /** Buildings installed, including ones switched off. */
  built: number;
  label: string;
  /** Lead result of the pool; its recipe stands in for the pool's inputs and outputs. */
  lead: PoolResult;
  /** Every line sharing the pool's installed buildings. */
  members: PoolResult[];
  used: number;
}

/** Lines whose buildings are a real, countable limit on throughput. */
const tracksPhysicalCapacity = (result: PoolResult) => (
  result.recipe.tracksPhysicalCapacity !== false
  && result.recipe.sinkMode !== "unbounded"
  && !(isUnboundedDemandSourceMode(result.recipe.sourceMode) && result.recipe.sourceKind != null)
);

/**
 * Groups lines touching a resource by physical building pool, so a machine
 * running several recipes counts once against its installed capacity. A pool
 * that is built but fully paused still counts: unpausing it is the fix.
 */
export const getCapacityPools = (
  resourceId: ResourceId,
  results: PoolResult[],
  side: "inputs" | "outputs",
): CapacityPool[] => {
  const lines = results.filter((result) => (
    tracksPhysicalCapacity(result)
    && (result.activeBuildings > 0 || result.builtBuildings > 0)
    && result.recipe[side].some((ingredient) => ingredient.resourceId === resourceId)
  ));
  const poolsById = new Map<string, PoolResult>();

  for (const line of lines) {
    const poolId = line.capacityPoolId ?? `${line.moduleId}:${line.recipe.id}`;

    if (!poolsById.has(poolId)) poolsById.set(poolId, line);
  }

  return [...poolsById.values()].map((lead) => {
    const members = lead.capacityPoolId
      ? results.filter((result) => result.capacityPoolId === lead.capacityPoolId)
      : [lead];
    const capacity = Math.max(...members.map((result) => result.activeBuildings));
    const built = Math.max(...members.map((result) => result.builtBuildings));
    const used = members.reduce((total, result) => (
      total + result.activeBuildings * result.supplyRatio
    ), 0);

    return {
      atCapacity: (capacity > 0 || built > 0) && capacity - used <= BALANCE_THRESHOLD,
      capacity,
      built,
      label: lead.recipe.sharedCapacity?.label ?? lead.recipe.building,
      lead,
      members,
      used,
    };
  });
};

/** Throughput of one building for `resourceId` across pools that share a building type. */
const getRateForBuilding = (pools: CapacityPool[], resourceId: ResourceId, side: "inputs" | "outputs") => {
  const actualKey = side === "inputs" ? "actualInputs" : "actualOutputs";
  const members = pools.flatMap((pool) => pool.members);
  const measured = members.reduce((total, result) => (
    total + (result[actualKey].find((candidate) => candidate.resourceId === resourceId)?.quantity ?? 0)
  ), 0);
  const used = pools.reduce((total, pool) => total + pool.used, 0);

  if (used > 0 && measured > 0) return measured / used;

  // Nothing measured, so the recipe rate at the lead line's speed stands in.
  const lead = pools[0]?.lead;

  if (!lead) return 0;

  return (lead.recipe[side].find((ingredient) => ingredient.resourceId === resourceId)?.quantity ?? 0)
    * ("speedLevel" in lead ? lead.speedLevel : 1);
};

export interface CapacityAction {
  label: string;
  unpause: number;
  build: number;
}

/**
 * One alternative per building type to cover the gap per production cycle,
 * merged across modules, with paused buildings counted before new ones.
 */
export const getCapacityActions = (
  pools: CapacityPool[],
  resourceId: ResourceId,
  side: "inputs" | "outputs",
  gap: number,
): CapacityAction[] => {
  const groups = new Map<string, CapacityPool[]>();

  for (const pool of pools) {
    groups.set(pool.label, [...(groups.get(pool.label) ?? []), pool]);
  }

  return [...groups.entries()]
    .map(([label, group]) => {
      const rate = getRateForBuilding(group, resourceId, side);
      const needed = rate > 0 ? Math.ceil(gap / rate - BALANCE_THRESHOLD) : 0;

      if (needed <= 0) return { label, unpause: 0, build: 0 };

      const paused = group.reduce((total, pool) => total + Math.max(0, pool.built - pool.capacity), 0);
      const unpause = Math.min(paused, needed);
      const build = needed - unpause;

      return { label, unpause, build };
    });
};
