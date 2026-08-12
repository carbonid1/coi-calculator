import { Card } from "@carbonid1/design-system";

import {
  type ChickenFarmSettings as ChickenFarmSettingsValue,
  getChickenFarmLayout,
  getChickenFarmRates,
} from "../db/chicken-farm";

interface Props {
  settings: ChickenFarmSettingsValue;
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2));

export const ChickenFarmSettings: React.FC<Props> = ({ settings }) => {
  const layout = getChickenFarmLayout(settings.totalChickenCount);
  const rates = getChickenFarmRates(settings);

  return (
    <Card.Root className="max-w-xl">
      <Card.Content className="space-y-5">
        <Card.Header>
          <Card.Title>Chicken Farms</Card.Title>
          <Card.Description>Aggregate rates per cycle</Card.Description>
        </Card.Header>

        <div className="max-w-xs rounded-lg bg-surface-inset px-3 py-2 inset-shadow-surface">
          <p className="text-sm text-muted-foreground">Total chickens</p>
          <p className="font-mono font-semibold text-foreground">
            {settings.totalChickenCount.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {layout.farmCount} farms · {layout.fullFarmCount} full
            {layout.partialFarmChickenCount > 0
              ? ` + 1 with ${layout.partialFarmChickenCount} chickens`
              : ""}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">Slaughtering</p>
            <p className="text-sm text-muted-foreground">
              Converts replacement chickens into carcasses
            </p>
          </div>
          <p className="font-mono font-semibold text-foreground">
            {settings.slaughtering ? "On" : "Off"}
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
