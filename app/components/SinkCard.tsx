import { type ValueSource } from "../data-source";
import { isUnboundedDemandSourceMode } from "../db/recipes";
import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import { type PassiveResult } from "../helpers/calculate/calculate";
import { getRecipePresentation } from "../helpers/recipe-display/recipe-display";
import { BuildingCount } from "./BuildingCount";
import { KeepReadyMenu, KeepReadyNote, type KeepReadyChange } from "./KeepReadyMenu";
import { ProductionCard } from "./ProductionCard";
import { RecipeFlow } from "./RecipeFlow";
import { RecipeLabel } from "./RecipeLabel";
import { RecipeTitle } from "./RecipeTitle";

interface Props {
  result: PassiveResult;
  role: "source" | "sink";
  dataSource?: ValueSource;
  diagnostic?: BuildingDiagnostic;
  onKeepReadyChange?: KeepReadyChange;
}

const formatQuantity = (quantity: number) => (
  quantity > 0 && quantity < 0.01 ? 0.01 : parseFloat(quantity.toFixed(2))
);

export const SinkCard: React.FC<Props> = ({
  dataSource,
  result,
  diagnostic,
  onKeepReadyChange,
}) => {
  const hasWork = result.actualInputs.length > 0 || result.actualOutputs.length > 0;
  const inactive = result.activeBuildings === 0 || !hasWork;
  const recipePresentation = getRecipePresentation(result.recipe);
  const recipeDisplayName = recipePresentation.name;
  const groundwaterConstraint = result.recipe.groundwaterConstraint;

  // Effective building count based on the first produced or consumed resource.
  const effectiveCount = hasWork
    ? (() => {
        if (isUnboundedDemandSourceMode(result.recipe.sourceMode)) {
          return result.activeBuildings;
        }

        const referenceQuantity = result.recipe.outputs[0]?.quantity
          ?? result.recipe.inputs[0]?.quantity
          ?? 0;
        const actualQuantity = result.actualOutputs[0]?.quantity
          ?? result.actualInputs[0]?.quantity
          ?? 0;
        const maxQuantity = groundwaterConstraint
          ? groundwaterConstraint.pumpCapacityPerCycle
          : referenceQuantity * result.activeBuildings;

        return maxQuantity > 0
          ? result.activeBuildings * actualQuantity / maxQuantity
          : result.activeBuildings;
      })()
    : 0;

  const card = (
    <ProductionCard
      dataSource={dataSource}
      operatingMode="balanced"
      inactive={inactive && !diagnostic?.keepReady && diagnostic?.attention !== "can-pause"}
      passive
      className="p-3"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">
            <RecipeTitle title={result.recipe.building} descriptions={[recipeDisplayName]} />
          </h3>
          {(recipePresentation.configuration || (inactive && recipeDisplayName !== result.recipe.building)) && (
            <p className="text-sm text-muted-foreground">
              <RecipeLabel recipe={recipePresentation} />
            </p>
          )}
        </div>
        <BuildingCount
          load={effectiveCount}
          active={result.activeBuildings}
          currentActive={result.currentActiveBuildings}
          built={result.builtBuildings}
          ghosts={result.constructionGhosts}
          planned={result.unplacedPlannedBuildings}
          attention={diagnostic?.attention}
          attentionCount={diagnostic?.attentionCount}
        />
      </div>

      <KeepReadyNote enabled={diagnostic?.keepReady} />
      {!inactive && (
        <RecipeFlow name={recipeDisplayName} inputs={result.actualInputs} outputs={result.actualOutputs}
          formatQuantity={formatQuantity} />
      )}

      {groundwaterConstraint && (
        <dl className="mt-2 space-y-1 rounded-lg bg-surface-inset px-2 py-1.5 inset-shadow-surface">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-muted-foreground">
              Synced {groundwaterConstraint.aquiferCount === 1 ? "aquifer" : "aquifers"} reserve
            </dt>
            <dd className="shrink-0 font-mono text-foreground">
              {formatQuantity(groundwaterConstraint.currentReserve)} / {formatQuantity(groundwaterConstraint.reserveCapacity)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-muted-foreground">Aquifer ceiling</dt>
            <dd className="shrink-0 font-mono text-foreground">
              {formatQuantity(groundwaterConstraint.aquiferSustainableCeilingPerCycle)} Water / cycle
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <dt>Active pump ceiling</dt>
            <dd className="shrink-0 font-mono">
              {formatQuantity(groundwaterConstraint.pumpCapacityPerCycle)} Water / cycle
            </dd>
          </div>
        </dl>
      )}
    </ProductionCard>
  );

  return <KeepReadyMenu diagnostic={diagnostic} onChange={onKeepReadyChange}>{card}</KeepReadyMenu>;
};
