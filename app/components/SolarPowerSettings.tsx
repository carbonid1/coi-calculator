import { Card, Field } from "@carbonid1/design-system";

import { solarPanelOrder, solarPanels, type SolarPanelCounts } from "../db/solar";

interface Props {
  counts: SolarPanelCounts;
  onChange: (panel: keyof SolarPanelCounts, count: number) => void;
}

export const SolarPowerSettings: React.FC<Props> = ({ counts, onChange }) => (
  <Card.Root className="max-w-xl">
    <Card.Content>
      <Card.Header>
        <Card.Title>Installed panels</Card.Title>
        <Card.Description>Used by Solar Power and Factory Total</Card.Description>
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
    </Card.Content>
  </Card.Root>
);
