import { Badge, Card } from "@carbonid1/design-system";
import { TriangleAlert } from "lucide-react";

import { type GameStateSnapshot } from "../game-state";

interface Props {
  isFresh: boolean;
  snapshot: GameStateSnapshot | null;
}

const formatDuration = (cycles: number) => {
  const roundedCycles = parseFloat(cycles.toFixed(1));
  const years = cycles / 12;
  const roundedYears = parseFloat(years.toFixed(years < 1 ? 2 : 1));

  return `${roundedCycles.toLocaleString("en-US")} production ${
    roundedCycles === 1 ? "cycle" : "cycles"
  } (${roundedYears.toLocaleString("en-US")} in-game years)`;
};

export const TrainTrafficAlert: React.FC<Props> = ({ isFresh, snapshot }) => {
  const traffic = snapshot?.trainTraffic;

  if (!isFresh || !traffic || traffic.severity === "clear") return null;

  const isCritical = traffic.severity === "critical";
  const longestDelay = traffic.trains[0];
  const delayedNames = traffic.trains
    .slice(0, 4)
    .map(train => train.name)
    .join(", ");

  return (
    <Card.Root
      aria-live={isCritical ? "assertive" : "polite"}
      className={isCritical ? "border-destructive/40" : "border-attention-border"}
      role={isCritical ? "alert" : "status"}
    >
      <Card.Content className="gap-2 py-3">
        <div className="flex items-start gap-3">
          <TriangleAlert
            aria-hidden="true"
            className={
              isCritical
                ? "mt-0.5 size-5 shrink-0 text-destructive"
                : "mt-0.5 size-5 shrink-0 text-attention-foreground"
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">
                {isCritical ? "Train traffic: red alert" : "Train traffic warning"}
              </p>
              <Badge variant={isCritical ? "destructive" : "attention"}>
                {traffic.stuckTrains.toLocaleString("en-US")} stuck
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {traffic.stuckTrains.toLocaleString("en-US")} of{" "}
              {traffic.activeTrains.toLocaleString("en-US")} active trains have waited for track
              clearance for at least {formatDuration(traffic.sustainedWaitCycles)}.
              {isCritical
                ? ` The fleet red-alert threshold is ${traffic.criticalThreshold.toLocaleString("en-US")}.`
                : null}
            </p>
            {longestDelay ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Longest delay: {longestDelay.name}, {formatDuration(longestDelay.blockedForCycles)}
                {longestDelay.blockingTrainId === null
                  ? "."
                  : `, blocked by Train #${longestDelay.blockingTrainId}.`}
              </p>
            ) : null}
            {delayedNames ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                Affected: {delayedNames}
                {traffic.stuckTrains > 4 ? `, +${traffic.stuckTrains - 4} more` : null}
              </p>
            ) : null}
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  );
};
