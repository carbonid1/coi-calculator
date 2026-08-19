import { Card } from "@carbonid1/design-system";

import {
  calculatePopulationCapacity,
  type HousingType,
} from "../db/housing";

interface Props {
  buildingCount: number;
  capacityBonusPercent: number;
  capacityMultiplier: number;
  housing: HousingType;
  serviceMultiplier: number;
}

const formatQuantity = (quantity: number) => quantity.toLocaleString("en-US");

export const HousingView: React.FC<Props> = ({
  buildingCount,
  capacityBonusPercent,
  capacityMultiplier,
  housing,
  serviceMultiplier,
}) => {
  const capacityPerBuilding = calculatePopulationCapacity(
    housing,
    1,
    capacityMultiplier,
  );
  const populationCapacity = calculatePopulationCapacity(
    housing,
    buildingCount,
    capacityMultiplier,
  );
  const activeUnityTier = housing.unityBonusTiers.find(
    (tier) => tier.multiplier === serviceMultiplier,
  );

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
            <p className="text-xs text-muted-foreground">
              Capacity per building (+{capacityBonusPercent}%)
            </p>
            <p className="font-mono font-semibold text-foreground">
              {formatQuantity(capacityPerBuilding)}
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
              <p className="text-xs text-muted-foreground">Configured service multiplier</p>
              <p className="font-mono font-semibold text-foreground">
                ×{serviceMultiplier}
              </p>
            </div>
          </div>
          {activeUnityTier && (
            <p className="text-xs text-muted-foreground">
              Requires {activeUnityTier.requirements.join(", ")} to stay fully supplied.
            </p>
          )}
        </div>
      </Card.Content>
    </Card.Root>
  );
};
