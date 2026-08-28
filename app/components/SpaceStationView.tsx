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
      <Card.Content className="space-y-4">
        <Card.Header>
          <Card.Title>Space Station level {station.level} plan</Card.Title>
        </Card.Header>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="space-y-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Station effects
            </h3>
            <div className="grid grid-cols-2 gap-3">
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

        <p className="text-xs text-muted-foreground">
          Net Summary and the production cards below carry resource pressure, Space Research
          Points, workforce, power, and computing. Launch demand includes full cargo launches,
          the 24-cycle crew rotation, and Composite Panels supplied by Default.
          Station construction costs are excluded.
        </p>
      </Card.Content>
    </Card.Root>
  );
};
