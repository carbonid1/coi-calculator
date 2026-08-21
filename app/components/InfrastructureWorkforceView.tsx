import { Card } from "@carbonid1/design-system";

import {
  calculateStaticInfrastructureTotals,
  clampStaticInfrastructureRunningConfig,
  normalizeStaticInfrastructureConfig,
  staticInfrastructureItems,
  type StaticInfrastructureConfig,
} from "../db/static-infrastructure";
import { type GameStateSnapshot } from "../game-state";

interface Props {
  builtConfig: StaticInfrastructureConfig;
  runningConfig: StaticInfrastructureConfig;
  gameState: GameStateSnapshot | null;
}

const trackedBuildings = staticInfrastructureItems.filter(
  (item) => item.id !== "vehicles",
);

export const InfrastructureWorkforceView: React.FC<Props> = ({
  builtConfig,
  runningConfig,
  gameState,
}) => {
  const built = normalizeStaticInfrastructureConfig(builtConfig);
  const running = clampStaticInfrastructureRunningConfig(
    built,
    runningConfig,
  );
  const totals = calculateStaticInfrastructureTotals(built, running);
  const categories = gameState
    ? [
        { id: "trucks", name: "Trucks", count: gameState.vehicles.trucks },
        { id: "excavators", name: "Excavators", count: gameState.vehicles.excavators },
        {
          id: "treeHarvesters",
          name: "Tree harvesters",
          count: gameState.vehicles.treeHarvesters,
        },
        {
          id: "treePlanters",
          name: "Tree planters",
          count: gameState.vehicles.treePlanters,
        },
      ]
    : [];
  const categorizedVehicles = categories.reduce((total, item) => total + item.count, 0);
  const otherVehicles = gameState
    ? Math.max(0, gameState.vehicles.total - categorizedVehicles)
    : 0;

  return (
    <div className="max-w-4xl space-y-4">
      <Card.Root>
        <Card.Content className="space-y-5">
          <Card.Header>
            <Card.Title>Infrastructure overview</Card.Title>
            <Card.Description>
              Mixed non-production loads included in the factory total
            </Card.Description>
          </Card.Header>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
              <p className="text-sm text-muted-foreground">Active workers</p>
              <p className="font-mono font-semibold tabular-nums text-foreground">
                {totals.workers.toLocaleString("en-US")}
              </p>
            </div>
            <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
              <p className="text-sm text-muted-foreground">Fuel Gas</p>
              <p className="font-mono font-semibold tabular-nums text-foreground">
                {totals.fuelGasPerCycle.toLocaleString("en-US")} / cycle
              </p>
            </div>
          </div>

          <section aria-labelledby="vehicle-status-heading">
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <h3
                  id="vehicle-status-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  Vehicles
                </h3>
                <p className="text-xs text-muted-foreground">
                  Workforce status only; movement and work fuel are variable
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {gameState ? "Synced" : "No synced data"}
              </span>
            </div>

            <div className="grid gap-1 rounded-lg bg-surface-inset p-2 inset-shadow-surface sm:grid-cols-3">
              <div className="rounded-lg px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Workers assigned</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {running.vehicles.toLocaleString("en-US")}
                </p>
              </div>
              <div className="rounded-lg px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Physical vehicles</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {gameState ? gameState.vehicles.total.toLocaleString("en-US") : "0"}
                </p>
              </div>
              <div className="rounded-lg px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Vehicle quota</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {gameState
                    ? `${gameState.vehicles.quotaUsed.toLocaleString("en-US")} / ${gameState.vehicles.quotaLimit.toLocaleString("en-US")}`
                    : "0 / 0"}
                </p>
              </div>
            </div>

            {gameState && (
              <dl className="mt-2 grid gap-x-6 gap-y-1 px-2 sm:grid-cols-2">
                {categories.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-1">
                    <dt className="text-xs text-muted-foreground">{item.name}</dt>
                    <dd className="font-mono text-xs font-medium tabular-nums text-foreground">
                      {item.count.toLocaleString("en-US")}
                    </dd>
                  </div>
                ))}
                {otherVehicles > 0 && (
                  <div className="flex items-center justify-between gap-4 py-1">
                    <dt className="text-xs text-muted-foreground">Other vehicles</dt>
                    <dd className="font-mono text-xs font-medium tabular-nums text-foreground">
                      {otherVehicles.toLocaleString("en-US")}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 py-1">
                  <dt className="text-xs text-muted-foreground">Quota remaining</dt>
                  <dd className="font-mono text-xs font-medium tabular-nums text-foreground">
                    {gameState.vehicles.quotaRemaining.toLocaleString("en-US")}
                  </dd>
                </div>
              </dl>
            )}
          </section>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Content className="space-y-4">
          <Card.Header>
            <Card.Title>Tracked buildings</Card.Title>
            <Card.Description>
              Running counts drive current loads; built counts show installed capacity
            </Card.Description>
          </Card.Header>

          <div
            aria-label="Tracked infrastructure counts"
            className="rounded-lg bg-surface-inset p-2 inset-shadow-surface"
            role="table"
          >
            <div
              className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-2 px-2 py-1 text-xs font-medium text-muted-foreground"
              role="row"
            >
              <span role="columnheader">Building</span>
              <span className="text-right" role="columnheader">Running</span>
              <span className="text-right" role="columnheader">Built</span>
            </div>
            <div className="space-y-1" role="rowgroup">
              {trackedBuildings.map((item) => {
                const builtCount = built[item.id];
                const runningCount = running[item.id];
                const pausedCount = builtCount - runningCount;

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-2 rounded-lg px-2 py-2"
                    role="row"
                  >
                    <div className="min-w-0" role="cell">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.detail}
                        {pausedCount > 0
                          ? ` · ${pausedCount.toLocaleString("en-US")} paused`
                          : ""}
                      </p>
                    </div>
                    <span
                      className="text-right font-mono text-sm font-semibold tabular-nums text-foreground"
                      role="cell"
                    >
                      {runningCount.toLocaleString("en-US")}
                    </span>
                    <span
                      className="text-right font-mono text-sm tabular-nums text-muted-foreground"
                      role="cell"
                    >
                      {builtCount.toLocaleString("en-US")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Running means a completed entity that is not manually paused. Input-starved or
            idle entities remain running because they still reserve their configured workers.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  );
};
