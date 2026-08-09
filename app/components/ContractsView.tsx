import { Card } from "@carbonid1/design-system";

import { resources } from "../db/resources";
import { type ContractResult } from "../helpers/contracts/calculate-contracts";

interface Props {
  results: ContractResult[];
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2)).toLocaleString();

export const ContractsView: React.FC<Props> = ({ results }) => (
  <div className="space-y-4">
    <div>
      <h2 className="text-xl font-semibold text-foreground">
        Contracts
      </h2>
      <p className="text-sm text-muted-foreground">
        Active contracts are averaged against current factory demand.
      </p>
    </div>

    {results.map(({ contract, exported, imported, productionCyclesPerShipment }) => {
      const exportedResource = resources[contract.exchange.exported.resourceId];
      const importedResource = resources[contract.exchange.imported.resourceId];
      const coverage = productionCyclesPerShipment == null
        ? null
        : { cycles: productionCyclesPerShipment, years: productionCyclesPerShipment / 12 };

      return (
        <Card.Root key={contract.id} className="max-w-3xl">
          <Card.Content>
            <Card.Header>
              <Card.Title>{contract.name}</Card.Title>
              <Card.Description>
                Demand-balanced average for the active 8-module contract
              </Card.Description>
            </Card.Header>

            <div className="rounded-lg bg-surface-inset p-4 inset-shadow-surface">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current flow
              </p>
              <div className="flex flex-wrap items-baseline gap-3 font-mono text-lg font-semibold text-foreground">
                <span>{formatQuantity(exported)} {exportedResource.name}</span>
                <span className="text-muted-foreground" aria-hidden="true">→</span>
                <span>{formatQuantity(imported)} {importedResource.name}</span>
                <span className="text-sm font-normal text-muted-foreground">per production cycle</span>
              </div>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="space-y-1">
                <dt className="text-muted-foreground">Full shipment</dt>
                <dd className="font-mono text-foreground">
                  {contract.shipment.exported.toLocaleString()} → {contract.shipment.imported.toLocaleString()}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground">Shipment coverage</dt>
                <dd className="font-mono text-foreground">
                  {coverage == null
                    ? "No current demand"
                    : `${formatQuantity(coverage.cycles)} cycles / ${formatQuantity(coverage.years)} years`}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground">Unity</dt>
                <dd className="font-mono text-foreground">
                  {contract.unity.perProductionCycle}/cycle + {contract.unity.perShip}/ship
                </dd>
              </div>
            </dl>
          </Card.Content>
        </Card.Root>
      );
    })}
  </div>
);
