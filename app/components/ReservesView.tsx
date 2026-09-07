import { Card } from "@carbonid1/design-system";

import {
  type ReserveBalances,
  type ReserveValues,
  reserveResourceCatalog,
} from "../db/reserve-resources";
import { calculateReserveRunway } from "../helpers/reserves/reserves";

interface Props {
  balances: ReserveBalances | null;
  drawsPerProductionCycle: ReserveValues<number>;
  growthPerProductionCycle?: ReserveValues<number>;
  burstCyclesRemaining?: number | null;
}

const formatQuantity = (value: number) => value.toLocaleString("en-US", {
  maximumFractionDigits: 2,
});

const formatYears = (value: number) => value > 0 && value < 0.01
  ? "<0.01"
  : formatQuantity(value);

const statusPresentation = {
  unavailable: {
    label: "Unavailable",
    valueClassName: "text-muted-foreground",
  },
  empty: {
    label: "",
    valueClassName: "text-destructive",
  },
  idle: {
    label: "Idle",
    valueClassName: "text-muted-foreground",
  },
  draining: {
    label: "Drawing reserves",
    valueClassName: "text-foreground",
  },
} as const;

const ReserveCard: React.FC<{
  balance: number | null;
  drawPerProductionCycle: number;
  name: string;
  growth: number;
}> = ({ balance, drawPerProductionCycle, name, growth }) => {
  const replenishing = growth > 0.000001;
  const runway = calculateReserveRunway(balance, drawPerProductionCycle);
  const status = statusPresentation[runway.status];
  let statusLabel = runway.status === "empty"
    ? `No eligible ${name} is stored`
    : status.label;

  if (replenishing && balance !== null) statusLabel = "Replenishing";
  const metrics = [
    {
      label: `Stored ${name}`,
      value: runway.balance === null ? "Unavailable" : formatQuantity(runway.balance),
    },
    {
      label: replenishing ? "Growth / cycle" : "Draw / cycle",
      value: runway.balance === null
        ? "—"
        : formatQuantity(replenishing ? growth : runway.drawPerProductionCycle),
    },
    {
      label: "Reserve runway",
      value: runway.inGameYearsRemaining === null
        ? "—"
        : `${formatQuantity(runway.inGameYearsRemaining * 12)} cycles · ${formatYears(runway.inGameYearsRemaining)} in-game years`,
    },
  ];

  return (
    <Card.Root>
      <Card.Content className="gap-3 p-4">
        <Card.Header>
          <Card.Title>{name}</Card.Title>
          <Card.Action>
            <span className={`text-xs font-medium ${status.valueClassName}`}>
              {statusLabel}
            </span>
          </Card.Action>
        </Card.Header>
        <dl className="grid gap-2 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface ${metric.label === "Reserve runway" ? "sm:col-span-2" : ""}`}
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </dt>
              <dd className="mt-0.5 font-mono font-semibold tabular-nums text-foreground">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card.Content>
    </Card.Root>
  );
};

export const ReservesView: React.FC<Props> = ({
  balances,
  drawsPerProductionCycle,
  growthPerProductionCycle,
  burstCyclesRemaining,
}) => (
  <div className="space-y-3">
    {burstCyclesRemaining !== null && burstCyclesRemaining !== undefined && (
      <p className="text-sm text-muted-foreground">Current delivery burst: {formatQuantity(burstCyclesRemaining)} cycles · {formatYears(burstCyclesRemaining / 12)} in-game years remaining.</p>
    )}
    <div className="grid gap-3 lg:grid-cols-2">
    {reserveResourceCatalog.map(({ key, name }) => (
      <ReserveCard
        key={key}
        balance={balances?.[key] ?? null}
        drawPerProductionCycle={drawsPerProductionCycle[key]}
        name={name}
        growth={growthPerProductionCycle?.[key] ?? 0}
      />
    ))}
    </div>
  </div>
);
