import { Card, Field, Slider, Switch } from "@carbonid1/design-system";

import {
  chickenFarm,
  type ChickenFarmSettings as ChickenFarmSettingsValue,
  getChickenFarmRates,
} from "../db/chicken-farm";

interface Props {
  settings: ChickenFarmSettingsValue;
  onChange: (settings: ChickenFarmSettingsValue) => void;
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2));

export const ChickenFarmSettings: React.FC<Props> = ({ settings, onChange }) => {
  const rates = getChickenFarmRates(settings);

  return (
    <Card.Root className="max-w-xl">
      <Card.Content className="space-y-5">
        <Card.Header>
          <Card.Title>Chicken Farms</Card.Title>
          <Card.Description>Shared settings · aggregate rates per 60s</Card.Description>
        </Card.Header>

        <Field.Root className="max-w-32">
          <Field.Label>Farm count</Field.Label>
          <Field.Control
            aria-label="Chicken farm count"
            type="number"
            min={1}
            step={1}
            value={settings.farmCount}
            onChange={(event) => {
              const farmCount = event.currentTarget.valueAsNumber;

              if (Number.isFinite(farmCount)) {
                onChange({ ...settings, farmCount: Math.max(1, Math.trunc(farmCount)) });
              }
            }}
          />
        </Field.Root>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">Slaughtering</p>
            <p className="text-sm text-muted-foreground">
              Converts replacement chickens into carcasses
            </p>
          </div>
          <Switch.Root
            aria-label="Enable chicken slaughtering"
            checked={settings.slaughtering}
            onCheckedChange={(slaughtering) => onChange({ ...settings, slaughtering })}
          >
            <Switch.Thumb />
          </Switch.Root>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-medium text-foreground">
              Chicken count
            </span>
            <span className="font-mono font-semibold text-foreground">
              {settings.chickenCount} / {chickenFarm.capacity}
            </span>
          </div>
          <Slider
            aria-label="Chicken count"
            className="w-full"
            min={chickenFarm.countStep}
            max={chickenFarm.capacity}
            step={chickenFarm.countStep}
            value={settings.chickenCount}
            onChange={(chickenCount) => onChange({ ...settings, chickenCount })}
          />
          <p className="text-xs text-muted-foreground">
            50-chicken steps. Below 500 with slaughtering off assumes growth is paused.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface sm:grid-cols-4">
          {([
            ["Animal Feed", rates.animalFeed],
            ["Water", rates.water],
            ["Eggs", rates.eggs],
            ["Carcass", rates.chickenCarcass],
          ] as const).map(([label, quantity]) => (
            <div key={label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-mono font-semibold text-foreground">
                {formatQuantity(quantity)}
              </p>
            </div>
          ))}
        </div>
      </Card.Content>
    </Card.Root>
  );
};
