import { Card } from "@carbonid1/design-system";

import { solarPanelOrder, solarPanels, type SolarPanelCounts } from "../db/solar";
import { planningWeather } from "../db/weather";

interface Props {
  averageGenerationMw: number;
  builtCounts: SolarPanelCounts;
  runningCounts: SolarPanelCounts;
}

const formatPower = (megawatts: number) => `${parseFloat(megawatts.toFixed(1))} MW`;

export const SolarPowerSettings: React.FC<Props> = ({
  averageGenerationMw,
  builtCounts,
  runningCounts,
}) => (
  <Card.Root className="max-w-xl">
    <Card.Content className="space-y-5">
      <Card.Header>
        <Card.Title>Solar power</Card.Title>
        <Card.Description>
          {planningWeather.averageSunIntensityPercent}% average sunlight ({planningWeather.horizonYears}Y, {planningWeather.difficulty})
        </Card.Description>
      </Card.Header>

      <div className="grid gap-3 sm:grid-cols-2">
        {solarPanelOrder.map((panel) => (
          <div key={panel} className="rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
            <p className="text-sm text-muted-foreground">{solarPanels[panel].name}</p>
            <p className="font-mono font-semibold tabular-nums text-foreground">
              {runningCounts[panel].toLocaleString()} running
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {builtCounts[panel].toLocaleString()} built
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
        <span className="text-sm text-muted-foreground">Average generation</span>
        <span className="font-mono font-semibold text-foreground">
          {formatPower(averageGenerationMw)}
        </span>
      </div>
    </Card.Content>
  </Card.Root>
);
