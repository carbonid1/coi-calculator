import { Card } from "@carbonid1/design-system";

import {
  isSeparatelyModeledGenerationPrototype,
  type PlanningBaselines,
} from "../db/planning-baselines";
import {
  type GameStateSnapshot,
  type SyncedHistoryAverage,
  syncedHydrogenFuelUseIds,
} from "../game-state";
import { formatHistoryWindow } from "../helpers/game-history/format-history-window";

interface Props {
  history: GameStateSnapshot["history"];
  values: PlanningBaselines;
}

const formatAverage = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString("en-US", { maximumFractionDigits });

const hydrogenUseLabels = {
  vehicles: "Vehicles",
  cargoShips: "Cargo ships",
  battleShip: "Battleship",
  powerGenerators: "Fuel generators",
  trains: "Trains",
} as const;

const HistoryRow: React.FC<{
  average: SyncedHistoryAverage;
  label: string;
}> = ({ average, label }) => (
  <div className="flex items-baseline justify-between gap-4 rounded-lg px-2 py-1.5">
    <div>
      <p className="text-xs text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        {formatHistoryWindow(average.sampleMonths)}
      </p>
    </div>
    <p className="font-mono text-sm tabular-nums text-foreground">
      {formatAverage(average.averagePerCycle)} / cycle
    </p>
  </div>
);

export const NuclearPlanningSettings: React.FC<Props> = ({ history, values }) => {
  const generationTypes = history.electricityGeneration.byType.filter(
    generation => generation.sampleMonths > 0,
  );
  const baselineGenerationTypes = generationTypes.filter(
    generation => !isSeparatelyModeledGenerationPrototype(generation.prototypeId),
  );
  const fuelUses = syncedHydrogenFuelUseIds.flatMap(id => {
    const average = history.hydrogenFuel.byUse[id];

    return average.sampleMonths > 0 && average.averagePerCycle > 0
      ? [{ average, id, label: hydrogenUseLabels[id] }]
      : [];
  });
  const generatorSampleMonths = baselineGenerationTypes.reduce(
    (sampleMonths, generation) => Math.max(sampleMonths, generation.sampleMonths),
    0,
  );

  return (
    <Card.Root className="max-w-3xl">
      <Card.Content className="space-y-5">
        <Card.Header>
          <Card.Title>Operating baselines</Card.Title>
          <Card.Description>
            Completed-cycle game history; solar remains modeled from synced panel counts
          </Card.Description>
        </Card.Header>

        <div className="grid gap-3 sm:grid-cols-2">
          {generatorSampleMonths > 0 && (
            <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
              <p className="text-sm text-muted-foreground">Average non-solar generation</p>
              <p className="font-mono font-semibold tabular-nums text-foreground">
                {formatAverage(values.averageGeneratorOutputMw)} MW
              </p>
              <p className="text-xs text-muted-foreground">
                {formatHistoryWindow(generatorSampleMonths)}
              </p>
            </div>
          )}

          {history.hydrogenFuel.total.sampleMonths > 0 && (
            <div className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
              <p className="text-sm text-muted-foreground">Hydrogen used as fuel</p>
              <p className="font-mono font-semibold tabular-nums text-foreground">
                {formatAverage(values.hydrogenFuelDemandPerCycle)} / cycle
              </p>
              <p className="text-xs text-muted-foreground">
                {formatHistoryWindow(history.hydrogenFuel.total.sampleMonths)}
              </p>
            </div>
          )}
        </div>

        {(generationTypes.length > 0 || fuelUses.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="generation-history-heading">
              <h3
                id="generation-history-heading"
                className="mb-2 text-sm font-semibold text-foreground"
              >
                Generation by type
              </h3>
              <div className="space-y-1 rounded-lg bg-surface-inset p-2 inset-shadow-surface">
                {generationTypes.map(generation => (
                  <div
                    key={generation.prototypeId}
                    className="flex items-baseline justify-between gap-4 rounded-lg px-2 py-1.5"
                  >
                    <div>
                      <p className="text-xs text-foreground">{generation.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatHistoryWindow(generation.sampleMonths)}
                      </p>
                    </div>
                    <p className="font-mono text-sm tabular-nums text-foreground">
                      {formatAverage(generation.averageMw)} MW
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="hydrogen-history-heading">
              <h3
                id="hydrogen-history-heading"
                className="mb-2 text-sm font-semibold text-foreground"
              >
                Hydrogen fuel by use
              </h3>
              <div className="space-y-1 rounded-lg bg-surface-inset p-2 inset-shadow-surface">
                {fuelUses.map(fuelUse => (
                  <HistoryRow key={fuelUse.id} average={fuelUse.average} label={fuelUse.label} />
                ))}
              </div>
            </section>
          </div>
        )}
      </Card.Content>
    </Card.Root>
  );
};
