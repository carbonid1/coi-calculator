import { type ResourceId } from "../db/resources";
import { type RegularResult, type ResourceFlow } from "../helpers/calculate/calculate";

const BALANCE_THRESHOLD = 0.001;
const inGameMonitoredDeficitResourceIds = new Set<ResourceId>(["steamSuper"]);

export const isReportedFactoryDeficit = (flow: ResourceFlow) => (
  flow.net < -BALANCE_THRESHOLD
  && !inGameMonitoredDeficitResourceIds.has(flow.resourceId)
);

/** Intermittent construction allowances are satisfied by a ready producer. */
export const isReadyStandbyAllowance = (flow: ResourceFlow, results: readonly RegularResult[]) => {
  const readyAllowance = results.reduce((total, result) => {
    const plan = result.recipe.standbyPlan;
    const running = result.currentActiveBuildings ?? result.activeBuildings;

    return plan?.resourceId === flow.resourceId && running > 0 ? total + plan.quantity : total;
  }, 0);

  return readyAllowance > 0 && flow.net < 0 && -flow.net <= readyAllowance + BALANCE_THRESHOLD;
};
