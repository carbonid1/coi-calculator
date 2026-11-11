import { type ResourceId } from "../../db/resources";
import { type BlockedSurplusRoute } from "../calculate/calculate";

/**
 * Demand for a resource that refused surplus routes would add if accepted.
 * A failed retry stamps one shared shortfall object onto every retried route;
 * that shortfall is factory-wide, so it counts once however many routes carry it.
 */
export const getLatentRouteDemand = (
  blockedRoutes: readonly BlockedSurplusRoute[],
  resourceId: ResourceId,
): number => {
  const counted = new Set<object>();
  const demand = { total: 0 };

  for (const route of blockedRoutes) {
    const shortages = route.blockingResources ?? (route.blockedBy ? [route.blockedBy] : []);
    const shortage = shortages.find(candidate => candidate.resourceId === resourceId);

    if (!shortage || counted.has(shortage)) continue;
    counted.add(shortage);
    demand.total += shortage.deficitIncrease;
  }

  return demand.total;
};
