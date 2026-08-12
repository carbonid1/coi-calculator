import { Card, cn } from "@carbonid1/design-system";

import { type Contract, type ContractMode } from "../db/contracts";
import { resources } from "../db/resources";
import { type ContractResult } from "../helpers/contracts/calculate-contracts";

interface Props {
  activeContractIds: string[];
  contracts: Contract[];
  modes: Record<string, ContractMode>;
  results: ContractResult[];
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2)).toLocaleString();

const ContractTerms: React.FC<{ contract: Contract }> = ({ contract }) => {
  const importedResource = resources[contract.exchange.imported.resourceId];

  return (
    <p className="text-xs text-muted-foreground">
      {contract.unity.perProductionCycle} fixed/cycle
      {" + "}
      {contract.unity.per100Imported}/100 {importedResource.name}
      {" · "}
      {formatQuantity(contract.unity.establish)} establish
      {" · "}
      Rep {contract.minimumReputation}
    </p>
  );
};

const ModeSummary: React.FC<{ contractName: string; mode: ContractMode }> = ({
  contractName,
  mode,
}) => (
  <div className="flex gap-1" aria-label={`${contractName} planning mode`}>
    {(["temporary", "continuous"] as const).map((option) => (
      <span
        key={option}
        className={cn(
          "rounded-lg px-2 py-1 text-xs text-muted-foreground",
          option === mode && "bg-primary/10 text-foreground ring-1 ring-primary/20",
        )}
      >
        {option === "temporary" ? "Temporary" : "Continuous"}
      </span>
    ))}
  </div>
);

const ActiveContractCard: React.FC<{
  mode: ContractMode;
  result: ContractResult;
}> = ({ mode, result }) => {
  const { contract, exported, imported } = result;
  const exportedResource = resources[contract.exchange.exported.resourceId];
  const importedResource = resources[contract.exchange.imported.resourceId];
  const variableUnityPerCycle = imported * contract.unity.per100Imported / 100;
  const recurringUnityPerCycle = mode === "continuous"
    ? contract.unity.perProductionCycle + variableUnityPerCycle
    : 0;

  return (
    <Card.Root>
      <Card.Content>
        <Card.Header>
          <div className="space-y-1">
            <Card.Title>{contract.name}</Card.Title>
            <Card.Description>
              {contract.exchange.exported.quantity.toLocaleString()} for {contract.exchange.imported.quantity.toLocaleString()}
            </Card.Description>
          </div>
          <Card.Action>
            <span className="text-xs font-medium text-foreground">Active</span>
          </Card.Action>
        </Card.Header>

        <div className="rounded-lg bg-surface-inset p-3 inset-shadow-surface">
          {imported > 0 ? (
            <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-base font-semibold text-foreground">
              <span>{formatQuantity(exported)} {exportedResource.name}</span>
              <span className="text-muted-foreground" aria-hidden="true">→</span>
              <span>{formatQuantity(imported)} {importedResource.name}</span>
              <span className="text-xs font-normal text-muted-foreground">/ cycle</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No {importedResource.name} deficit
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <ModeSummary contractName={contract.name} mode={mode} />
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{formatQuantity(recurringUnityPerCycle)}</span> Unity/cycle included
          </p>
        </div>

        <ContractTerms contract={contract} />
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
  modes,
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
          Active contracts cover matching Factory Total deficits. Temporary mode omits recurring Unity; continuous mode includes it.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="active-contracts-heading">
        <h3 id="active-contracts-heading" className="text-sm font-semibold text-foreground">
          Active · {activeResults.length}
        </h3>
        {activeResults.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeResults.map((result) => (
              <ActiveContractCard
                key={result.contract.id}
                result={result}
                mode={modes[result.contract.id] ?? "temporary"}
              />
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
