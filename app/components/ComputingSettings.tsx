import { Card } from "@carbonid1/design-system";

import {
  dataCenter,
  type ComputingConfig,
  getRackAllocation,
} from "../db/computing";

interface Props {
  config: ComputingConfig;
  computingCapacityTflops: number;
}

const NumberFact: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="font-mono font-semibold text-foreground">{value.toLocaleString()}</p>
  </div>
);

export const ComputingSettings: React.FC<Props> = ({ config, computingCapacityTflops }) => {
  const rackAllocation = getRackAllocation(config.rackCount, config.dataCenterCount);
  const dataCenterLabel = `${rackAllocation.length} data center${rackAllocation.length === 1 ? "" : "s"}`;

  return (
    <Card.Root className="max-w-2xl">
    <Card.Content className="space-y-5">
      <Card.Header>
        <Card.Title>Computing capacity</Card.Title>
        <Card.Description>
          Racks fill each data center to its {dataCenter.rackCapacity}-rack capacity before another center is used.
        </Card.Description>
      </Card.Header>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberFact label="Racks" value={config.rackCount} />
        <NumberFact label="Water chillers" value={config.waterChillers} />
      </div>

      <p className="text-sm text-muted-foreground">
        {config.rackCount === 0
          ? "No data centers needed"
          : `${dataCenterLabel} · ${rackAllocation.join(" + ")} racks`}
      </p>

      <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
        <span className="text-sm text-muted-foreground">Generation capacity</span>
        <span className="font-mono font-semibold text-foreground">
          {parseFloat(computingCapacityTflops.toFixed(2))} TFLOPS
        </span>
      </div>
    </Card.Content>
  </Card.Root>
  );
};
