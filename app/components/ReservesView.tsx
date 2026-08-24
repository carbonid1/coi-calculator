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
}

const formatQuantity = (value: number) => value.toLocaleString("en-US", {
  maximumFractionDigits: 2,
});

const formatYears = (value: number) => value > 0 && value < 0.01
  ? "<0.01"
  : formatQuantity(value);

const statusPresentation = {
  unavailable: {
    label: "Waiting for a reserves-capable game sync",
    valueClassName: "text-muted-foreground",
  },
  empty: {
    label: "",
    valueClassName: "text-destructive",
  },
  idle: {
    label: "Not being drawn by the current plan",
    valueClassName: "text-success",
  },
  draining: {
    label: "Actively covering current factory demand",
    valueClassName: "text-foreground",
  },
} as const;

const ReserveCard: React.FC<{
  balance: number | null;
  drawPerProductionCycle: number;
  name: string;
}> = ({ balance, drawPerProductionCycle, name }) => {
  const runway = calculateReserveRunway(balance, drawPerProductionCycle);
  const status = statusPresentation[runway.status];
  const statusLabel = runway.status === "empty"
    ? `No eligible ${name} is stored`
    : status.label;
  const metrics = [
    {
      label: "In-game years remaining",
      value: runway.inGameYearsRemaining === null
        ? "—"
        : formatYears(runway.inGameYearsRemaining),
    },
    {
      label: `Eligible stored ${name}`,
      value: runway.balance === null ? "Unavailable" : formatQuantity(runway.balance),
    },
    {
      label: "Monthly draw",
      value: runway.balance === null
        ? "—"
        : formatQuantity(runway.drawPerProductionCycle),
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
        <dl className="grid gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface"
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
}) => (
  <div className="grid gap-3 lg:grid-cols-2">
    {reserveResourceCatalog.map(({ key, name }) => (
      <ReserveCard
        key={key}
        balance={balances?.[key] ?? null}
        drawPerProductionCycle={drawsPerProductionCycle[key]}
        name={name}
      />
    ))}
  </div>
);
