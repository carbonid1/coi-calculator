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
  requestedImported: number;
  requiredImported: number;
  uncoveredImported: number;
  capacityLimitedImported: number;
  importedPerTrip: number;
  maxImportedPerProductionCycle: number | null;
  fuelPerTrip: number;
  fuelPerProductionCycle: number;
}

/** v0.8.7 Quantity.ScaledBy(Percent) rounds to the nearest whole unit. */
const scaleQuantityLikeGame = (quantity: number, multiplier: number) => (
  Math.round(quantity * multiplier)
);

export const calculateContractShipping = (
  contract: ActiveContract,
  shipsFuelUseMultiplier = 1,
  contractsProfitMultiplier = 1,
) => {
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
  const exportModuleCount = contract.plan.infrastructure.cargoModules.reduce(
    (total, module) => total + (module.direction === "export" ? module.count : 0),
    0,
  );
  const importCargoCapacity = importModuleCount
    * cargoShipping.onboardLargeModuleCapacity
    * capacityMultiplier;
  const exportCargoCapacity = exportModuleCount
    * cargoShipping.onboardLargeModuleCapacity
    * capacityMultiplier;
  const effectiveImportedQuantity = scaleQuantityLikeGame(
    contract.exchange.imported.quantity,
    Math.max(0.01, contractsProfitMultiplier),
  );
  const exchangeLimitedImportedPerTrip = contract.exchange.exported.quantity > 0
    ? exportCargoCapacity
      * effectiveImportedQuantity
      / contract.exchange.exported.quantity
    : 0;
  const importedPerTrip = Math.min(
    importCargoCapacity,
    exchangeLimitedImportedPerTrip,
  );
  const fuelResourceMultiplier = contract.plan.shipping.fuelResourceId === "hydrogen"
    ? cargoShipping.hydrogenDieselEnergyRatio
    : 1;
  const fuelPerJourneyBase = scaleQuantityLikeGame(
    cargoShipping.fuelPerJourneyBase,
    fuelResourceMultiplier,
  );
  const fuelPerJourneyPerModule = scaleQuantityLikeGame(
    cargoShipping.fuelPerJourneyPerModule,
    fuelResourceMultiplier,
  );
  const saveFuelMultiplier = contract.plan.shipping.saveFuel
    ? cargoShipping.saveFuelMultiplier
    : 1;
  const loadedShipFuel = fuelPerJourneyBase + scaleQuantityLikeGame(
    fuelPerJourneyPerModule * installedModuleCount,
    capacityMultiplier,
  );
  const researchedFuel = scaleQuantityLikeGame(
    loadedShipFuel,
    shipsFuelUseMultiplier,
  );
  const fuelPerTrip = scaleQuantityLikeGame(researchedFuel, saveFuelMultiplier);
  const roundTripDuration = contract.plan.shipping.roundTripDurationProductionCycles;
  const maxImportedPerProductionCycle = roundTripDuration !== null
    && roundTripDuration > 0
    ? importedPerTrip / roundTripDuration
    : null;

  return { importedPerTrip, maxImportedPerProductionCycle, fuelPerTrip };
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
  shipsFuelUseMultiplier = 1,
  demandBalancedImports: ReadonlyMap<string, number> = new Map(),
  contractsProfitMultiplier = 1,
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
    const requestedImported = contract.plan.importedPerProductionCycle
      ?? demandBalancedImports.get(contract.id)
      ?? requiredImported;
    const effectiveImportedQuantity = scaleQuantityLikeGame(
      contract.exchange.imported.quantity,
      Math.max(0.01, contractsProfitMultiplier),
    );
    const shipping = calculateContractShipping(
      contract,
      shipsFuelUseMultiplier,
      contractsProfitMultiplier,
    );
    const imported = shipping.maxImportedPerProductionCycle === null
      ? requestedImported
      : Math.min(requestedImported, shipping.maxImportedPerProductionCycle);
    const exported = effectiveImportedQuantity > 0
      ? imported * contract.exchange.exported.quantity / effectiveImportedQuantity
      : 0;
    const fuelPerProductionCycle = shipping.importedPerTrip > 0
      ? imported / shipping.importedPerTrip * shipping.fuelPerTrip
      : 0;

    importedFlow.produced += imported;
    getFlow(combined, contract.exchange.exported.resourceId).consumed += exported;

    contractResults.push({
      contract,
      exported,
      imported,
      requestedImported,
      requiredImported,
      uncoveredImported: Math.max(0, requiredImported - imported),
      capacityLimitedImported: Math.max(0, requestedImported - imported),
      ...shipping,
      fuelPerProductionCycle,
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
