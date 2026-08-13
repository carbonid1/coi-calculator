import { Card } from "@carbonid1/design-system";

import { type Contract } from "../db/contracts";
import { resources } from "../db/resources";
import {
  calculateContractWorkerBreakdown,
  type ContractResult,
} from "../helpers/contracts/calculate-contracts";

interface Props {
  activeContractIds: string[];
  contracts: Contract[];
  results: ContractResult[];
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(3)).toLocaleString();

const ContractTerms: React.FC<{ contract: Contract }> = ({ contract }) => {
  const importedResource = resources[contract.exchange.imported.resourceId];

  return (
    <p className="text-xs text-muted-foreground">
      {contract.unity.perProductionCycle} Unity/month
      {" + "}
      {contract.unity.per100Imported}/100 {importedResource.name}
      {" · "}
      Rep {contract.minimumReputation}
    </p>
  );
};

const DataRow: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 rounded-lg px-2 py-1.5 hover:bg-accent">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-right font-mono text-sm font-semibold tabular-nums text-foreground">
      {value}
    </dd>
  </div>
);

const ActiveContractCard: React.FC<{ result: ContractResult }> = ({ result }) => {
  const {
    contract,
    exported,
    imported,
  } = result;
  const exportedResource = resources[contract.exchange.exported.resourceId];
  const importedResource = resources[contract.exchange.imported.resourceId];
  const fuelResource = resources[contract.plan.shipping.fuelResourceId];
  const workerBreakdown = calculateContractWorkerBreakdown(contract);
  const variableUnityPerCycle = imported * contract.unity.per100Imported / 100;
  const recurringUnityPerCycle = contract.unity.perProductionCycle + variableUnityPerCycle;
  const fuelPerProductionCycle = imported > 0
    ? imported / contract.plan.shipping.importedPerTrip * contract.plan.shipping.fuelPerTrip
    : 0;

  return (
    <Card.Root>
      <Card.Content className="space-y-4">
        <Card.Header>
          <div className="space-y-1">
            <Card.Title>{contract.name}</Card.Title>
          </div>
          <Card.Action>
            <span className="text-xs font-medium text-foreground">Active</span>
          </Card.Action>
        </Card.Header>

        <div className="rounded-lg bg-surface-inset p-3 inset-shadow-surface">
          <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-base font-semibold text-foreground">
            <span>{formatQuantity(exported)} {exportedResource.name}</span>
            <span className="text-muted-foreground" aria-hidden="true">→</span>
            <span>{formatQuantity(imported)} {importedResource.name}</span>
            <span className="text-xs font-normal text-muted-foreground">/ month</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-2" aria-labelledby={`${contract.id}-build-heading`}>
            <h4 id={`${contract.id}-build-heading`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Build
            </h4>
            <dl className="rounded-lg bg-surface-inset p-1 inset-shadow-surface">
              <DataRow
                label={`1× Cargo Depot (${contract.plan.infrastructure.cargoDepotSize}) + Cargo Ship`}
                value={`${workerBreakdown.cargoShipWorkers} workers`}
              />
              {contract.plan.infrastructure.cargoModules.map((module) => (
                <DataRow
                  key={`${module.direction}-${module.resourceId}`}
                  label={`${module.count}× ${module.buildingName} · ${resources[module.resourceId].name} ${module.direction}`}
                  value={`${module.count * module.workersPerModule} workers`}
                />
              ))}
              <DataRow label="Total" value={`${workerBreakdown.total} workers`} />
            </dl>
          </section>

          <section className="space-y-2" aria-labelledby={`${contract.id}-operating-heading`}>
            <h4 id={`${contract.id}-operating-heading`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Operating
            </h4>
            <dl className="rounded-lg bg-surface-inset p-1 inset-shadow-surface">
              <DataRow label="Unity" value={`${formatQuantity(recurringUnityPerCycle)} / month`} />
              <DataRow
                label="Ship fuel"
                value={`${formatQuantity(fuelPerProductionCycle)} ${fuelResource.name} / month`}
              />
            </dl>
          </section>
        </div>
      </Card.Content>
    </Card.Root>
  );
};

const InactiveContractCard: React.FC<{ contract: Contract }> = ({ contract }) => (
  <Card.Root>
    <Card.Content className="space-y-3">
      <Card.Header>
        <div className="space-y-1">
          <Card.Title>{contract.name}</Card.Title>
          <Card.Description>
            {contract.exchange.exported.quantity.toLocaleString()} for {contract.exchange.imported.quantity.toLocaleString()}
          </Card.Description>
        </div>
        <Card.Action>
          <span className="text-xs text-muted-foreground">Inactive</span>
        </Card.Action>
      </Card.Header>
      <ContractTerms contract={contract} />
    </Card.Content>
  </Card.Root>
);

export const ContractsView: React.FC<Props> = ({
  activeContractIds,
  contracts,
  results,
}) => {
  const activeIdSet = new Set(activeContractIds);
  const resultsById = new Map(results.map((result) => [result.contract.id, result]));
  const activeResults = activeContractIds.flatMap((contractId) => {
    const result = resultsById.get(contractId);

    return result ? [result] : [];
  });
  const inactiveContracts = contracts
    .filter((contract) => !activeIdSet.has(contract.id))
    .toSorted((a, b) => {
      const importedComparison = resources[a.exchange.imported.resourceId].name
        .localeCompare(resources[b.exchange.imported.resourceId].name);

      return importedComparison || a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Contracts</h2>
        <p className="text-sm text-muted-foreground">
          Fixed import plans. Factory growth leaves uncovered demand visible.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="active-contracts-heading">
        <h3 id="active-contracts-heading" className="text-sm font-semibold text-foreground">
          Active · {activeResults.length}
        </h3>
        {activeResults.length > 0 ? (
          <div className="grid gap-3">
            {activeResults.map((result) => (
              <ActiveContractCard key={result.contract.id} result={result} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No contracts enabled.
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="inactive-contracts-heading">
        <h3 id="inactive-contracts-heading" className="text-sm font-semibold text-foreground">
          Inactive · {inactiveContracts.length}
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {inactiveContracts.map((contract) => (
            <InactiveContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      </section>
    </div>
  );
};
