import { Card } from "@carbonid1/design-system";

import { type MaintenanceDemand } from "../db/modules/maintenance";
import { type GameStateSnapshot } from "../game-state";
import { formatHistoryWindow } from "../helpers/game-history/format-history-window";

interface Props {
  demand: MaintenanceDemand;
  history: GameStateSnapshot["history"]["maintenance"];
}

const maintenanceTiers = [
  ["maintenanceI", "Maintenance I"],
  ["maintenanceII", "Maintenance II"],
  ["maintenanceIII", "Maintenance III"],
] as const;

export const MaintenancePlanningSettings: React.FC<Props> = ({ demand, history }) => (
  <Card.Root className="max-w-3xl">
    <Card.Content className="space-y-5">
      <Card.Header>
        <Card.Title>Maintenance demand</Card.Title>
        <Card.Description>
          Actual maintenance consumed across completed game cycles
        </Card.Description>
      </Card.Header>

      <div className="grid gap-3 sm:grid-cols-3">
        {maintenanceTiers
          .filter(([id]) => history[id].sampleMonths > 0)
          .map(([id, label]) => {
            const average = history[id];

            return (
              <div key={id} className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-mono font-semibold tabular-nums text-foreground">
                  {demand[id].toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  {" / cycle"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatHistoryWindow(average.sampleMonths)}
                </p>
              </div>
            );
          })}
      </div>
    </Card.Content>
  </Card.Root>
);
