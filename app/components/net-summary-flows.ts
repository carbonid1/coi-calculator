import { type ResourceId } from "../db/resources";
import { type ResourceFlow } from "../helpers/calculate/calculate";

const BALANCE_THRESHOLD = 0.001;
const inGameMonitoredDeficitResourceIds = new Set<ResourceId>(["steamSuper"]);

export const isReportedFactoryDeficit = (flow: ResourceFlow) => (
  flow.net < -BALANCE_THRESHOLD
  && !inGameMonitoredDeficitResourceIds.has(flow.resourceId)
);
