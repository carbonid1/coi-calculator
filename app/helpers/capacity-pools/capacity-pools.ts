import { type ResourceId } from "../../db/resources";
import { type RegularResult } from "../calculate/calculate";

const BALANCE_THRESHOLD = 0.001;

export const formatQuantity = (value: number) => parseFloat(value.toFixed(2));

export interface CapacityPool {
  atCapacity: boolean;
  /** Active buildings the pool can run. */
  capacity: number;
  /** Buildings installed, including ones switched off. */
  built: number;
  label: string;
  /** Lead result of the pool; its recipe stands in for the pool's inputs and outputs. */
  lead: RegularResult;
  /** Every line sharing the pool's installed buildings. */
  members: RegularResult[];
  recipeNames: string[];
  used: number;
}

/**
 * Groups active lines touching a resource by physical building pool, so a
 * machine running several recipes counts once against its installed capacity.
 */
export const getCapacityPools = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
  side: "inputs" | "outputs",
): CapacityPool[] => {
  const lines = regularResults.filter((result) => (
    result.activeBuildings > 0
    && result.recipe[side].some((ingredient) => ingredient.resourceId === resourceId)
  ));
  const poolsById = new Map<string, { lead: RegularResult; recipeNames: string[] }>();

  for (const line of lines) {
    const poolId = line.capacityPoolId ?? `${line.moduleId}:${line.recipe.id}`;
    const pool = poolsById.get(poolId);

    if (pool) pool.recipeNames.push(line.recipe.name);
    else poolsById.set(poolId, { lead: line, recipeNames: [line.recipe.name] });
  }

  return [...poolsById.values()].map(({ lead, recipeNames }) => {
    const members = lead.capacityPoolId
      ? regularResults.filter((result) => result.capacityPoolId === lead.capacityPoolId)
      : [lead];
    const capacity = Math.max(...members.map((result) => result.activeBuildings));
    const built = Math.max(...members.map((result) => result.builtBuildings));
    const used = members.reduce((total, result) => (
      total + result.activeBuildings * result.supplyRatio
    ), 0);

    return {
      atCapacity: capacity > 0 && capacity - used <= BALANCE_THRESHOLD,
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
  const installed = pool.built > pool.capacity ? ` of ${pool.built} built` : "";

  return `at capacity ${formatQuantity(pool.used)}/${formatQuantity(pool.capacity)}${installed}`;
};
