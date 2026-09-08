import { type ResourceId } from "../../db/resources";
import {
  type BlockedSurplusRoute,
  type PassiveResult,
  type RegularResult,
} from "../calculate/calculate";
import {
  type CapacityPool,
  getCapacityActions,
  getCapacityPools,
  type PoolResult,
} from "../capacity-pools/capacity-pools";
import { formatDiagnosticMessages } from "../diagnostic-display/diagnostic-display";
import { isModuleInput } from "../recipe-input-scope/recipe-input-scope";

const BALANCE_THRESHOLD = 0.001;

export interface SurplusRootCause {
  /**
   * `terminal`: nothing active consumes the resource, so the surplus is a
   * genuine end product. `at-capacity`: the configured surplus-handling pools
   * (or all consumers when none are configured) are saturated or paused.
   * `input-blocked`: a consumer had room but the solver cut it because
   * another input would fall into deficit. `demand-met`: consumers have room
   * but their own output is already covered, so the resource is overproduced.
   */
  kind: "terminal" | "at-capacity" | "input-blocked" | "demand-met";
  detail: string | null;
}

const getModuleNet = (moduleId: string, resourceId: ResourceId, results: PoolResult[]) => (
  results
    .filter((result) => result.moduleId === moduleId)
    .reduce((total, result) => (
      total
      + (result.actualOutputs.find((output) => output.resourceId === resourceId)?.quantity ?? 0)
      - (result.actualInputs.find((input) => input.resourceId === resourceId)?.quantity ?? 0)
    ), 0)
);

/**
 * Consumer pools that could take more of the resource. A module-scoped line
 * only draws on its own module, so with nothing left over there it is not a
 * candidate, however much room it has.
 */
const getReachableConsumers = (resourceId: ResourceId, results: PoolResult[]) => {
  const pools = getCapacityPools(resourceId, results, "inputs");
  const reachable = pools.filter((pool) => {
    const { recipe, moduleId } = pool.lead;
    const moduleScoped = isModuleInput(recipe, resourceId)
      || (recipe.consumeSurplusInputScope === "module"
        && recipe.consumeSurplusInputIds?.includes(resourceId));

    return !moduleScoped || getModuleNet(moduleId, resourceId, results) > BALANCE_THRESHOLD;
  });

  return reachable.length > 0 ? reachable : pools;
};

const getProducts = (result: PoolResult) => (
  result.recipe.balanceOutputIds ?? result.recipe.outputs.map((output) => output.resourceId)
);

const handlesSurplus = (resourceId: ResourceId, pool: CapacityPool) => (
  pool.members.some(({ recipe, activeBuildings, builtBuildings }) => (
    (activeBuildings > 0 || builtBuildings > 0)
    && recipe.inputs.some(input => input.resourceId === resourceId)
    && (
      recipe.group === "sink"
      || recipe.consumeSurplusInputIds?.includes(resourceId)
      || (recipe.allocation === "surplus"
        && (recipe.balanceInputIds == null || recipe.balanceInputIds.includes(resourceId)))
    )
  ))
);

/** A per-resource build count cannot cover competing recipes in a shared pool. */
const hasCompetingInputs = (resourceId: ResourceId, pool: CapacityPool) => (
  pool.members.some(({ recipe, activeBuildings, builtBuildings }) => (
    (activeBuildings > 0 || builtBuildings > 0)
    && recipe.inputs.length > 0
    && !recipe.inputs.some(input => input.resourceId === resourceId)
  ))
);

/**
 * Follows a product down the slack path: through consumers that have room
 * and still do not run, until a product nothing idle is waiting to take.
 * Intermediates such as Compost are not what the factory is after; the end
 * of that chain is.
 */
const getEndProducts = (
  productId: ResourceId,
  results: PoolResult[],
  seen = new Set<ResourceId>(),
): ResourceId[] => {
  if (seen.has(productId)) return [];
  seen.add(productId);

  // A product something dumps is where the chain ends, whatever else takes it.
  const dumped = results.some((result) => (
    result.activeBuildings > 0
    && result.recipe.outputs.length === 0
    && result.recipe.inputs.some((input) => input.resourceId === productId)
  ));

  if (dumped) return [productId];

  const downstream = getReachableConsumers(productId, results)
    .filter((consumer) => !consumer.atCapacity)
    .flatMap((consumer) => getProducts(consumer.lead));
  const ends = [...new Set(downstream)].flatMap((next) => getEndProducts(next, results, seen));

  return ends.length > 0 ? ends : [productId];
};

export const getSurplusRootCause = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
  blockedRoutes: BlockedSurplusRoute[] = [],
  passiveResults: PassiveResult[] = [],
  surplus = 0,
): SurplusRootCause => {
  const results = [...regularResults, ...passiveResults];
  const consumers = getReachableConsumers(resourceId, results);

  if (consumers.length === 0) return { kind: "terminal", detail: null };

  const blocked = blockedRoutes.filter((route) => (
    route.surplusResourceIds.includes(resourceId)
    && route.wantedRatio - route.appliedRatio > 1e-9
  ));

  if (blocked.length > 0) {
    return {
      kind: "input-blocked",
      detail: formatDiagnosticMessages(blocked.map(route => ({
        kind: "blocked-route", recipe: route.recipe, blockedBy: route.blockedBy,
      }))),
    };
  }

  // An idle food or manufacturing line does not remove the bottleneck in the
  // routes configured to process leftovers. Diagnose those routes first.
  const surplusConsumers = consumers.filter(consumer => handlesSurplus(resourceId, consumer));
  const capacityConsumers = surplusConsumers.length > 0 ? surplusConsumers : consumers;

  if (capacityConsumers.every((consumer) => consumer.atCapacity)) {
    const sharedInputs = capacityConsumers.some(consumer => hasCompetingInputs(resourceId, consumer));

    return {
      kind: "at-capacity",
      detail: formatDiagnosticMessages([
        { kind: "capacity", actions: getCapacityActions(
          capacityConsumers, resourceId, "inputs", sharedInputs ? 0 : surplus,
        ) },
      ]),
    };
  }

  // A consumer with room that still does not run has nothing pulling on it:
  // the resource is overproduced relative to what its products are used for.
  const products = [...new Set(
    consumers
      .filter((consumer) => !consumer.atCapacity)
      .flatMap((consumer) => getProducts(consumer.lead))
      .flatMap((productId) => getEndProducts(productId, results)),
  )];

  return {
    kind: "demand-met",
    detail: formatDiagnosticMessages([{ kind: "demand-met", productIds: products }]),
  };
};
