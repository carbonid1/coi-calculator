import { Card } from "@carbonid1/design-system";

import { type DecayStorage, type Recipe } from "../db/recipes";
import { resources } from "../db/resources";
import { BuildingCount } from "./BuildingCount";

interface Props {
  recipe: Recipe;
  storage: DecayStorage;
  activeCount: number;
  totalCount: number;
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2)).toLocaleString();

export const StorageCard: React.FC<Props> = ({ recipe, storage, activeCount, totalCount }) => {
  const input = recipe.inputs[0];

  if (!input) return null;

  const maxSustainedInput = storage.capacity / storage.decayCycles * activeCount;

  return (
    <Card.Root>
      <Card.Content>
        <Card.Header>
          <Card.Title>{recipe.building}</Card.Title>
          <Card.Description>
            {resources[input.resourceId].name}
          </Card.Description>
          <Card.Action>
            <BuildingCount effective={activeCount} total={totalCount} />
          </Card.Action>
        </Card.Header>

        <dl className="flex items-baseline justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Max sustainable input</dt>
          <dd className="font-mono font-semibold text-foreground">
            {formatQuantity(maxSustainedInput)} / cycle
          </dd>
        </dl>
      </Card.Content>
    </Card.Root>
  );
};
