import {
  type ActiveContract,
  cargoShipping,
} from "../../db/contracts";
import { type ResourceId, resources } from "../../db/resources";
import { type ResourceFlow } from "../calculate/calculate";

export interface ContractResult {
  contract: ActiveContract;
  exported: number;
  imported: number;
  requiredImported: number;
  uncoveredImported: number;
  importedPerTrip: number;
  fuelPerTrip: number;
  fuelPerProductionCycle: number;
}

export const calculateContractShipping = (contract: ActiveContract) => {
  const shipSize = contract.plan.infrastructure.cargoDepotSize;
  const capacityMultiplier = cargoShipping.capacityMultiplierByShipSize[shipSize];
  const installedModuleCount = contract.plan.infrastructure.cargoModules.reduce(
    (total, module) => total + module.count,
    0,
  );
  const importModuleCount = contract.plan.infrastructure.cargoModules.reduce(
    (total, module) => total + (module.direction === "import" ? module.count : 0),
    0,
  );
  const importedPerTrip = importModuleCount
    * cargoShipping.onboardLargeModuleCapacity
    * capacityMultiplier;
  const fuelResourceMultiplier = contract.plan.shipping.fuelResourceId === "hydrogen"
    ? cargoShipping.hydrogenDieselEnergyRatio
    : 1;
  const saveFuelMultiplier = contract.plan.shipping.saveFuel
    ? cargoShipping.saveFuelMultiplier
    : 1;
  const fuelPerTrip = Math.ceil((
    cargoShipping.fuelPerJourneyBase
    + cargoShipping.fuelPerJourneyPerModule * installedModuleCount * capacityMultiplier
  ) * fuelResourceMultiplier * saveFuelMultiplier);
  const fuelPerProductionCycle = importedPerTrip > 0
    ? contract.plan.importedPerProductionCycle / importedPerTrip * fuelPerTrip
    : 0;

  return { importedPerTrip, fuelPerTrip, fuelPerProductionCycle };
};

export const calculateContractWorkerBreakdown = (contract: ActiveContract) => {
  const cargoModuleWorkers = contract.plan.infrastructure.cargoModules.reduce(
    (total, module) => total + module.count * module.workersPerModule,
    0,
  );
  const cargoShipWorkers = contract.plan.infrastructure.cargoShipWorkers;

  return {
    cargoModuleWorkers,
    cargoShipWorkers,
    total: cargoShipWorkers + cargoModuleWorkers,
  };
};

export const calculateContractWorkers = (activeContracts: ActiveContract[]) => (
  activeContracts.reduce(
    (total, contract) => total + calculateContractWorkerBreakdown(contract).total,
    0,
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
  contracts: ActiveContract[],
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
    const requiredImported = Math.max(0, importedFlow.consumed - importedFlow.produced);
    const imported = contract.plan.importedPerProductionCycle;
    const exported = imported * contract.exchange.exported.quantity / contract.exchange.imported.quantity;
    const shipping = calculateContractShipping(contract);

    importedFlow.produced += imported;
    getFlow(combined, contract.exchange.exported.resourceId).consumed += exported;

    contractResults.push({
      contract,
      exported,
      imported,
      requiredImported,
      uncoveredImported: Math.max(0, requiredImported - imported),
      ...shipping,
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
