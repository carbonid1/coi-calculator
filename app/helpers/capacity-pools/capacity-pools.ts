import { isUnboundedDemandSourceMode } from "../../db/recipes";
import { type ResourceId } from "../../db/resources";
import { type PassiveResult, type RegularResult } from "../calculate/calculate";

const BALANCE_THRESHOLD = 0.001;

export type PoolResult = RegularResult | PassiveResult;

export const formatQuantity = (value: number) => parseFloat(value.toFixed(2));

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
  recipeNames: string[];
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
  const poolsById = new Map<string, { lead: PoolResult; recipeNames: string[] }>();

  for (const line of lines) {
    const poolId = line.capacityPoolId ?? `${line.moduleId}:${line.recipe.id}`;
    const pool = poolsById.get(poolId);

    if (pool) pool.recipeNames.push(line.recipe.name);
    else poolsById.set(poolId, { lead: line, recipeNames: [line.recipe.name] });
  }

  return [...poolsById.values()].map(({ lead, recipeNames }) => {
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
      recipeNames,
      used,
    };
  });
};

/** Pool label, falling back to recipe names when several pools share a building type. */
export const getPoolLabels = (pools: CapacityPool[]) => {
  const labelCounts = new Map<string, number>();

  for (const pool of pools) {
    labelCounts.set(pool.label, (labelCounts.get(pool.label) ?? 0) + 1);
  }

  return pools.map((pool) => (
    (labelCounts.get(pool.label) ?? 0) > 1 ? pool.recipeNames.join(", ") : pool.label
  ));
};

export const describeCapacity = (pool: CapacityPool) => {
  if (pool.capacity === 0) return `all ${pool.built} paused`;

  const installed = pool.built > pool.capacity ? ` of ${pool.built} built` : "";

  return `at capacity ${formatQuantity(pool.used)}/${formatQuantity(pool.capacity)}${installed}`;
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

/**
 * What to do about saturated pools so they move `gap` more of `resourceId`
 * per cycle: one action per building type, merged across modules, with
 * paused buildings counted before new ones. Building types are alternatives,
 * so they are joined with "or".
 */
export const describeCapacityFix = (
  pools: CapacityPool[],
  resourceId: ResourceId,
  side: "inputs" | "outputs",
  gap: number,
) => {
  const groups = new Map<string, CapacityPool[]>();

  for (const pool of pools) {
    groups.set(pool.label, [...(groups.get(pool.label) ?? []), pool]);
  }

  return [...groups.entries()]
    .map(([label, group]) => {
      const rate = getRateForBuilding(group, resourceId, side);
      const needed = rate > 0 ? Math.ceil(gap / rate - BALANCE_THRESHOLD) : 0;

      if (needed <= 0) return `${label} · at capacity`;

      const paused = group.reduce((total, pool) => total + Math.max(0, pool.built - pool.capacity), 0);
      const unpause = Math.min(paused, needed);
      const build = needed - unpause;
      const actions = [
        ...(unpause > 0 ? [`unpause ${unpause}`] : []),
        ...(build > 0 ? [`build ${build}`] : []),
      ];

      return `${label} · ${actions.join(", ")}`;
    })
    .join(" or ");
};
