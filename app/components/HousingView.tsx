import { Card, Field } from "@carbonid1/design-system";

import {
  calculatePopulationCapacity,
  type HousingType,
} from "../db/housing";

interface Props {
  buildingCount: number;
  housing: HousingType;
  onBuildingCountChange: (count: number) => void;
}

const formatQuantity = (quantity: number) => quantity.toLocaleString("en-US");

export const HousingView: React.FC<Props> = ({
  buildingCount,
  housing,
  onBuildingCountChange,
}) => {
  const populationCapacity = calculatePopulationCapacity(housing, buildingCount);

  return (
    <Card.Root className="max-w-2xl">
      <Card.Content className="space-y-5">
        <Card.Header>
          <Card.Title>{housing.name}</Card.Title>
          <Card.Description>
            Population cap only · resource requirements are not modeled yet
          </Card.Description>
        </Card.Header>

        <Field.Root className="max-w-32">
          <Field.Label>Built</Field.Label>
          <Field.Control
            type="number"
            min={0}
            step={1}
            value={buildingCount}
            onChange={(event) => {
              const count = event.currentTarget.valueAsNumber;

              if (Number.isFinite(count)) {
                onBuildingCountChange(Math.max(0, Math.trunc(count)));
              }
            }}
          />
        </Field.Root>

        <div className="grid gap-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Buildings</p>
            <p className="font-mono font-semibold text-foreground">
              {formatQuantity(buildingCount)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Capacity per building</p>
            <p className="font-mono font-semibold text-foreground">
              {formatQuantity(housing.populationCapacity)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Population cap</p>
            <p className="font-mono font-semibold text-foreground">
              {formatQuantity(populationCapacity)}
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  );
};
