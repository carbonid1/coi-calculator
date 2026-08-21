import { Card } from "@carbonid1/design-system";

import {
  calculateSpaceStationLevel,
  type RocketIiRecurringLogistics,
  type SpaceStationConfig,
} from "../db/space-station";

interface Props {
  config: SpaceStationConfig;
  logistics: RocketIiRecurringLogistics;
}

const formatQuantity = (value: number) => parseFloat(value.toFixed(2)).toLocaleString("en-US");

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-mono font-semibold tabular-nums text-foreground">{value}</p>
  </div>
);

export const SpaceStationView: React.FC<Props> = ({ config, logistics }) => {
  const station = calculateSpaceStationLevel(
    config.targetLevel,
    config.highestLevelAchieved,
  );

  return (
    <Card.Root>
      <Card.Content className="space-y-5">
        <Card.Header>
          <Card.Title>Space Station level {station.level}</Card.Title>
        </Card.Header>

        <div className="grid gap-3 lg:grid-cols-3">
          <section className="space-y-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recurring inputs
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Station Parts"
                value={`${formatQuantity(station.maintenancePartsPerCycle)} / cycle`}
              />
              <Metric
                label="Crew Supplies"
                value={`${formatQuantity(station.crewSuppliesPerCycle)} / cycle`}
              />
              <Metric
                label="Electronics IV"
                value={`up to ${formatQuantity(station.researchSuppliesPerCycle)} / cycle`}
              />
              <Metric label="Crew / population" value={formatQuantity(station.crew)} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Provides
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Space Research Points"
                value={`${formatQuantity(station.spaceResearchPointsPerCycle)} / cycle`}
              />
              <Metric
                label="Research efficiency"
                value={`+${formatQuantity(station.researchEfficiencyBonusPercent)}%`}
              />
              <Metric label="Unity" value={`+${formatQuantity(station.unityPerCycle)} / cycle`} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rocket II transport
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Payload"
                value={`${formatQuantity(logistics.cargoCapacity)} / launch`}
              />
              <Metric
                label="Capacity research"
                value={`Level ${logistics.researchLevel} (+${formatQuantity(logistics.payloadCapacityBonusPercent)}%)`}
              />
              <Metric
                label="Average launches"
                value={`${formatQuantity(logistics.launchesPerCycle)} / cycle`}
              />
              <Metric
                label="Average cadence"
                value={`${formatQuantity(logistics.cyclesPerLaunch)} cycles / launch`}
              />
            </div>
          </section>

        </div>

        <section className="space-y-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Amortized Rocket II inputs
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label="Aluminum"
              value={`${formatQuantity(logistics.aluminumPerCycle)} / cycle`}
            />
            <Metric
              label="Titanium Alloy"
              value={`${formatQuantity(logistics.titaniumAlloyPerCycle)} / cycle`}
            />
            <Metric
              label="Water"
              value={`${formatQuantity(logistics.waterPerCycle)} / cycle`}
            />
            <Metric
              label="Hydrogen"
              value={`${formatQuantity(logistics.hydrogenPerCycle)} / cycle`}
            />
            <Metric
              label="Oxygen"
              value={`${formatQuantity(logistics.oxygenPerCycle)} / cycle`}
            />
            <Metric
              label="Steel"
              value={`${formatQuantity(logistics.steelPerCycle)} / cycle`}
            />
            <Metric
              label="Plastic"
              value={`${formatQuantity(logistics.plasticPerCycle)} / cycle`}
            />
            <Metric
              label="Electronics III"
              value={`${formatQuantity(logistics.electronicsIiiPerCycle)} / cycle`}
            />
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Includes full cargo launches and the 24-cycle crew rotation. Composite Panel production
          is included and expands into Aluminum, Steel, and Plastic. Station construction costs are excluded.
        </p>
      </Card.Content>
    </Card.Root>
  );
};
