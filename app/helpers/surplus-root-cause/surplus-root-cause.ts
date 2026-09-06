import { type ResourceId, resources } from "../../db/resources";
import {
  type BlockedSurplusRoute,
  type RegularResult,
} from "../calculate/calculate";

const BALANCE_THRESHOLD = 0.001;
const formatQuantity = (value: number) => parseFloat(value.toFixed(2));

interface ConsumerCapacity {
  atCapacity: boolean;
  capacity: number;
  label: string;
  /** Products whose demand decides how much this consumer runs. */
  productIds: ResourceId[];
  recipeNames: string[];
  used: number;
}

export interface SurplusRootCause {
  /**
   * `terminal`: nothing active consumes the resource, so the surplus is a
   * genuine end product. `at-capacity`: every consumer pool is saturated.
   * `input-blocked`: a consumer had room but the solver cut it because another
   * input would fall into deficit. `demand-met`: consumers have room but their
   * own output is already covered, so the resource is overproduced.
   */
  kind: "terminal" | "at-capacity" | "input-blocked" | "demand-met";
  detail: string | null;
}

const getConsumerCapacities = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
): ConsumerCapacity[] => {
  const consumers = regularResults.filter((result) => (
    result.activeBuildings > 0
    && result.recipe.inputs.some((input) => input.resourceId === resourceId)
  ));
  const consumersByPool = new Map<string, { consumer: RegularResult; recipeNames: string[] }>();

  for (const consumer of consumers) {
    const poolId = consumer.capacityPoolId ?? `${consumer.moduleId}:${consumer.recipe.id}`;
    const pool = consumersByPool.get(poolId);

    if (pool) pool.recipeNames.push(consumer.recipe.name);
    else consumersByPool.set(poolId, { consumer, recipeNames: [consumer.recipe.name] });
  }

  const productIdsOf = (consumer: RegularResult) => (
    consumer.recipe.balanceOutputIds
      ?? consumer.recipe.outputs.map((output) => output.resourceId)
  );

  return [...consumersByPool.values()].map(({ consumer, recipeNames }) => {
    const capacityResults = consumer.capacityPoolId
      ? regularResults.filter((result) => result.capacityPoolId === consumer.capacityPoolId)
      : [consumer];
    const capacity = consumer.capacityPoolId
      ? Math.max(...capacityResults.map((result) => result.activeBuildings))
      : consumer.activeBuildings;
    const used = capacityResults.reduce((total, result) => (
      total + result.activeBuildings * result.supplyRatio
    ), 0);

    return {
      atCapacity: capacity > 0 && capacity - used <= BALANCE_THRESHOLD,
      capacity,
      label: consumer.recipe.sharedCapacity?.label ?? consumer.recipe.building,
      productIds: productIdsOf(consumer),
      recipeNames,
      used,
    };
  });
};

const describeBlockedRoute = (route: BlockedSurplusRoute) => {
  const blocker = route.blockedBy
    ? `${resources[route.blockedBy.resourceId].name} short by ${formatQuantity(route.blockedBy.deficitIncrease)}`
    : "another input short";

  return `${route.recipe.name} · ${blocker}`;
};

export const getSurplusRootCause = (
  resourceId: ResourceId,
  regularResults: RegularResult[],
  blockedRoutes: BlockedSurplusRoute[] = [],
): SurplusRootCause => {
  const consumers = getConsumerCapacities(resourceId, regularResults);

  if (consumers.length === 0) return { kind: "terminal", detail: null };

  const blocked = blockedRoutes.filter((route) => (
    route.surplusResourceIds.includes(resourceId)
    && route.wantedRatio - route.appliedRatio > BALANCE_THRESHOLD
  ));

  if (blocked.length > 0) {
    return {
      kind: "input-blocked",
      detail: blocked.map(describeBlockedRoute).join(", "),
    };
  }

  if (consumers.every((consumer) => consumer.atCapacity)) {
    const labelCounts = new Map<string, number>();

    for (const consumer of consumers) {
      labelCounts.set(consumer.label, (labelCounts.get(consumer.label) ?? 0) + 1);
    }

    return {
      kind: "at-capacity",
      detail: consumers
        .map((consumer) => {
          // Two pools of the same building type need the recipe to tell them apart.
          const label = (labelCounts.get(consumer.label) ?? 0) > 1
            ? consumer.recipeNames.join(", ")
            : consumer.label;

          return `${label} · at capacity ${formatQuantity(consumer.used)}/${formatQuantity(consumer.capacity)}`;
        })
        .join(", "),
    };
  }

  // A consumer with room that still does not run has nothing pulling on it:
  // the resource is overproduced relative to what its products are used for.
  const products = [...new Set(
    consumers
      .filter((consumer) => !consumer.atCapacity)
      .flatMap((consumer) => consumer.productIds),
  )].map((productId) => resources[productId].name);

  return {
    kind: "demand-met",
    detail: products.length > 0 ? `${products.join(", ")} demand met` : "Demand met",
  };
};
