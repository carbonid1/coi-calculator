import { type ResourceId, resources } from "../../db/resources";
import {
  type BlockedSurplusRoute,
  type RegularResult,
} from "../calculate/calculate";
import {
  describeCapacity,
  formatQuantity,
  getCapacityPools,
  getPoolLabels,
} from "../capacity-pools/capacity-pools";

const BALANCE_THRESHOLD = 0.001;

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
  const consumers = getCapacityPools(resourceId, regularResults, "inputs");

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
    const labels = getPoolLabels(consumers);

    return {
      kind: "at-capacity",
      detail: consumers
        .map((consumer, index) => `${labels[index]} · ${describeCapacity(consumer)}`)
        .join(", "),
    };
  }

  // A consumer with room that still does not run has nothing pulling on it:
  // the resource is overproduced relative to what its products are used for.
  const products = [...new Set(
    consumers
      .filter((consumer) => !consumer.atCapacity)
      .flatMap((consumer) => (
        consumer.lead.recipe.balanceOutputIds
          ?? consumer.lead.recipe.outputs.map((output) => output.resourceId)
      )),
  )].map((productId) => resources[productId].name);

  return {
    kind: "demand-met",
    detail: products.length > 0 ? `${products.join(", ")} demand met` : "Demand met",
  };
};
