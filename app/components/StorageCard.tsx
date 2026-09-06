import { Card } from "@carbonid1/design-system";

import { type ValueSource } from "../data-source";
import { type DecayStorage, type Recipe } from "../db/recipes";
import { resources } from "../db/resources";
import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import { type OperatingMode } from "../helpers/calculate/calculate";
import { BuildingCount } from "./BuildingCount";
import { KeepReadyMenu, KeepReadyNote, type KeepReadyChange } from "./KeepReadyMenu";
import { ProductionCard } from "./ProductionCard";

interface Props {
  recipe: Recipe;
  dataSource?: ValueSource;
  storage: DecayStorage;
  activeBuildings: number;
  currentActiveBuildings?: number;
  builtBuildings: number;
  constructionGhosts?: number;
  unplacedPlannedBuildings?: number;
  operatingMode: OperatingMode;
  diagnostic?: BuildingDiagnostic;
  onKeepReadyChange?: KeepReadyChange;
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2)).toLocaleString();

export const StorageCard: React.FC<Props> = ({ recipe, dataSource, storage, activeBuildings, currentActiveBuildings, builtBuildings, constructionGhosts, unplacedPlannedBuildings, operatingMode, diagnostic, onKeepReadyChange }) => {
  const input = recipe.inputs[0];

  if (!input) return null;

  const maxSustainedInput = storage.capacity / storage.decayCycles * activeBuildings;

  const card = (
    <ProductionCard dataSource={dataSource} operatingMode={operatingMode}>
      <Card.Content>
        <Card.Header>
          <Card.Title>{recipe.building}</Card.Title>
          <Card.Description>
            {resources[input.resourceId].name}
          </Card.Description>
          <Card.Action>
            <BuildingCount
              load={activeBuildings}
              active={activeBuildings}
              currentActive={currentActiveBuildings}
              built={builtBuildings}
              ghosts={constructionGhosts}
              planned={unplacedPlannedBuildings}
              attention={diagnostic?.attention}
              attentionCount={diagnostic?.attentionCount}
            />
          </Card.Action>
        </Card.Header>

        <KeepReadyNote enabled={diagnostic?.keepReady} />
        <dl className="flex items-baseline justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Max sustainable input</dt>
          <dd className="font-mono font-semibold text-foreground">
            {formatQuantity(maxSustainedInput)} / cycle
          </dd>
        </dl>
      </Card.Content>
    </ProductionCard>
  );

  return <KeepReadyMenu diagnostic={diagnostic} onChange={onKeepReadyChange}>{card}</KeepReadyMenu>;
};
