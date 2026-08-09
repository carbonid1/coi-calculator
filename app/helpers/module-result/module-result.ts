import { resources, type ResourceId } from "../../db/resources";
import type {
  calculateNet,
  PassiveResult,
  RegularResult,
  ResourceFlow,
} from "../calculate/calculate";

type CalculationResult = ReturnType<typeof calculateNet>;

export interface ModuleResult {
  resourceFlows: ResourceFlow[];
  regularResults: RegularResult[];
  sourceResults: PassiveResult[];
  sinkResults: PassiveResult[];
}

export const extractModuleResult = (
  moduleId: string,
  calculation: CalculationResult,
): ModuleResult => {
  const regularResults = calculation.regularResults.filter((result) => result.moduleId === moduleId);
  const sourceResults = calculation.sourceResults.filter((result) => result.moduleId === moduleId);
  const sinkResults = calculation.sinkResults.filter((result) => result.moduleId === moduleId);
  const flows = new Map<ResourceId, { consumed: number; produced: number }>();
  const getFlow = (resourceId: ResourceId) => {
    const flow = flows.get(resourceId) ?? { consumed: 0, produced: 0 };

    flows.set(resourceId, flow);
    return flow;
  };

  for (const result of regularResults) {
    for (const input of result.actualInputs) getFlow(input.resourceId).consumed += input.quantity;
    for (const output of result.actualOutputs) getFlow(output.resourceId).produced += output.quantity;
  }
  for (const result of [...sourceResults, ...sinkResults]) {
    for (const input of result.actualInputs) getFlow(input.resourceId).consumed += input.quantity;
    for (const output of result.actualOutputs) getFlow(output.resourceId).produced += output.quantity;
  }

  const recyclableSourceValueProduced = regularResults.reduce((total, result) => {
    if (result.appliedRecyclingEfficiencyPercent == null) return total;

    const recyclables = result.actualOutputs
      .filter((output) => output.resourceId === "recyclables")
      .reduce((quantity, output) => quantity + output.quantity, 0);

    return total + recyclables * result.appliedRecyclingEfficiencyPercent / 100;
  }, 0);

  const resourceFlows = [...flows].flatMap<ResourceFlow>(([
    resourceId,
    { consumed, produced },
  ]) => {
    const net = produced - consumed;

    if (Math.abs(net) <= 0.001) return [];

    return [{
      resourceId,
      name: resources[resourceId].name,
      consumed,
      produced,
      net,
      ...(resourceId === "recyclables" ? { recyclableSourceValueProduced } : {}),
    }];
  });

  return { resourceFlows, regularResults, sourceResults, sinkResults };
};
