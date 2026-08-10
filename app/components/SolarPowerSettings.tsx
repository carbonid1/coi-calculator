import { Card, Field } from "@carbonid1/design-system";

import { solarPanelOrder, solarPanels, type SolarPanelCounts } from "../db/solar";
import { planningWeather } from "../db/weather";

interface Props {
  counts: SolarPanelCounts;
  averageGenerationMw: number;
  onChange: (panel: keyof SolarPanelCounts, count: number) => void;
}

const formatPower = (megawatts: number) => `${parseFloat(megawatts.toFixed(1))} MW`;

export const SolarPowerSettings: React.FC<Props> = ({ counts, averageGenerationMw, onChange }) => (
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
          <Field.Root key={panel}>
            <Field.Label>{solarPanels[panel].name}</Field.Label>
            <Field.Control
              aria-label={`${solarPanels[panel].name} installed count`}
              type="number"
              min={0}
              step={1}
              value={counts[panel]}
              onChange={(event) => {
                const nextCount = event.currentTarget.valueAsNumber;

                if (Number.isFinite(nextCount)) onChange(panel, Math.max(0, Math.trunc(nextCount)));
              }}
            />
          </Field.Root>
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
