import { Card } from "@carbonid1/design-system";

import { type DecayStorage, type Recipe } from "../db/recipes";
import { resources } from "../db/resources";
import { type OperatingMode } from "../helpers/calculate/calculate";
import { BuildingCount } from "./BuildingCount";
import { ProductionCard } from "./ProductionCard";

interface Props {
  recipe: Recipe;
  storage: DecayStorage;
  activeBuildings: number;
  builtBuildings: number;
  operatingMode: OperatingMode;
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2)).toLocaleString();

export const StorageCard: React.FC<Props> = ({ recipe, storage, activeBuildings, builtBuildings, operatingMode }) => {
  const input = recipe.inputs[0];

  if (!input) return null;

  const maxSustainedInput = storage.capacity / storage.decayCycles * activeBuildings;

  return (
    <ProductionCard operatingMode={operatingMode}>
      <Card.Content>
        <Card.Header>
          <Card.Title>{recipe.building}</Card.Title>
          <Card.Description>
            {resources[input.resourceId].name}
          </Card.Description>
          <Card.Action>
            <BuildingCount load={activeBuildings} active={activeBuildings} built={builtBuildings} />
          </Card.Action>
        </Card.Header>

        <dl className="flex items-baseline justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Max sustainable input</dt>
          <dd className="font-mono font-semibold text-foreground">
            {formatQuantity(maxSustainedInput)} / cycle
          </dd>
        </dl>
      </Card.Content>
    </ProductionCard>
  );
};
