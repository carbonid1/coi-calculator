import {
  type Contract,
  contractInfrastructure,
} from "../../db/contracts";
import { type ResourceId, resources } from "../../db/resources";
import { type ResourceFlow } from "../calculate/calculate";

export interface ContractResult {
  contract: Contract;
  exported: number;
  imported: number;
}

export const calculateContractWorkers = (activeContracts: Contract[]) => (
  activeContracts.length * (
    contractInfrastructure.cargoShipWorkers
    + contractInfrastructure.cargoModuleCount
      * contractInfrastructure.workersPerCargoModule
  )
);

const getFlow = (
  flows: Map<ResourceId, { consumed: number; produced: number; recyclableSourceValueProduced: number }>,
  resourceId: ResourceId,
) => {
  const flow = flows.get(resourceId) ?? { consumed: 0, produced: 0, recyclableSourceValueProduced: 0 };

  flows.set(resourceId, flow);
  return flow;
};

export const applyContracts = (
  resourceFlows: ResourceFlow[],
  contracts: Contract[],
): { flows: ResourceFlow[]; contractResults: ContractResult[] } => {
  const combined = new Map<ResourceId, { consumed: number; produced: number; recyclableSourceValueProduced: number }>(
    resourceFlows.map((flow) => [flow.resourceId, {
      consumed: flow.consumed,
      produced: flow.produced,
      recyclableSourceValueProduced: flow.recyclableSourceValueProduced ?? 0,
    }]),
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
    });
  }

  const flows: ResourceFlow[] = [];

  for (const [resourceId, { consumed, produced, recyclableSourceValueProduced }] of combined) {
    const net = produced - consumed;
    const recyclingMetadata = resourceId === "recyclables"
      ? { recyclableSourceValueProduced }
      : {};

    flows.push({ resourceId, name: resources[resourceId].name, consumed, produced, net, ...recyclingMetadata });
  }

  return { flows, contractResults };
};
