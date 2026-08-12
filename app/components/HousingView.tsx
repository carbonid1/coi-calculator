import { Card } from "@carbonid1/design-system";

import {
  calculatePopulationCapacity,
  type HousingType,
} from "../db/housing";

interface Props {
  buildingCount: number;
  housing: HousingType;
}

const formatQuantity = (quantity: number) => quantity.toLocaleString("en-US");

export const HousingView: React.FC<Props> = ({
  buildingCount,
  housing,
}) => {
  const populationCapacity = calculatePopulationCapacity(housing, buildingCount);

  return (
    <Card.Root className="max-w-2xl">
      <Card.Content className="space-y-5">
        <Card.Header>
          <Card.Title>{housing.name}</Card.Title>
          <Card.Description>
            Resource planning assumes every available home is occupied
          </Card.Description>
        </Card.Header>

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
            <p className="text-xs text-muted-foreground">Planning population</p>
            <p className="font-mono font-semibold text-foreground">
              {formatQuantity(populationCapacity)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Unity
          </p>
          <div className="grid gap-3 rounded-lg bg-surface-inset p-3 inset-shadow-surface sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Storage from housing</p>
              <p className="font-mono font-semibold text-foreground">
                {formatQuantity(buildingCount * housing.unityStorage)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Best service multiplier</p>
              <p className="font-mono font-semibold text-foreground">
                ×{housing.unityBonusTiers.at(-1)?.multiplier ?? 1}
              </p>
            </div>
          </div>
          {housing.unityBonusTiers.at(-1) && (
            <p className="text-xs text-muted-foreground">
              Requires {housing.unityBonusTiers.at(-1)?.requirements.join(", ")} to stay fully supplied.
            </p>
          )}
        </div>
      </Card.Content>
    </Card.Root>
  );
};
