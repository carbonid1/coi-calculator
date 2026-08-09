import { type Contract } from "../../db/contracts";
import { type ResourceId, resources } from "../../db/resources";
import { type ResourceFlow } from "../calculate/calculate";

export interface ContractResult {
  contract: Contract;
  exported: number;
  imported: number;
  productionCyclesPerShipment: number | null;
}

const getFlow = (
  flows: Map<ResourceId, { consumed: number; produced: number }>,
  resourceId: ResourceId,
) => {
  const flow = flows.get(resourceId) ?? { consumed: 0, produced: 0 };

  flows.set(resourceId, flow);
  return flow;
};

export const applyContracts = (
  resourceFlows: ResourceFlow[],
  contracts: Contract[],
): { flows: ResourceFlow[]; contractResults: ContractResult[] } => {
  const combined = new Map<ResourceId, { consumed: number; produced: number }>(
    resourceFlows.map((flow) => [flow.resourceId, { consumed: flow.consumed, produced: flow.produced }]),
  );
  const contractResults: ContractResult[] = [];

  for (const contract of contracts) {
    const importedFlow = getFlow(combined, contract.exchange.imported.resourceId);
    const imported = Math.max(0, importedFlow.consumed - importedFlow.produced);
    const exported = imported * contract.exchange.exported.quantity / contract.exchange.imported.quantity;

    importedFlow.produced += imported;
    getFlow(combined, contract.exchange.exported.resourceId).consumed += exported;

    contractResults.push({
      contract,
      exported,
      imported,
      productionCyclesPerShipment: imported > 0 ? contract.shipment.imported / imported : null,
    });
  }

  const flows: ResourceFlow[] = [];

  for (const [resourceId, { consumed, produced }] of combined) {
    const net = produced - consumed;

    flows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net });
  }

  return { flows, contractResults };
};
