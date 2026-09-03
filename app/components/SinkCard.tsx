import { type ValueSource } from "../data-source";
import { isUnboundedDemandSourceMode } from "../db/recipes";
import { resources } from "../db/resources";
import { type PassiveResult } from "../helpers/calculate/calculate";
import { getRecipeDisplayName } from "../helpers/recipe-display/recipe-display";
import { BuildingCount } from "./BuildingCount";
import { ProductionCard } from "./ProductionCard";

interface Props {
  result: PassiveResult;
  role: "source" | "sink";
  dataSource?: ValueSource;
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2));

export const SinkCard: React.FC<Props> = ({
  dataSource,
  result,
}) => {
  const hasWork = result.actualInputs.length > 0 || result.actualOutputs.length > 0;
  const inactive = result.activeBuildings === 0 || !hasWork;
  const recipeDisplayName = getRecipeDisplayName(result.recipe);
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

  return (
    <ProductionCard
      dataSource={dataSource}
      operatingMode="balanced"
      inactive={inactive}
      passive
      className="p-3"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {result.recipe.building}
          </h3>
          {recipeDisplayName !== result.recipe.building && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {recipeDisplayName}
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
        />
      </div>

      {!inactive && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="space-y-1">
            {result.actualInputs.map((input) => (
              <div key={input.resourceId} className="flex justify-between text-sm whitespace-nowrap gap-2">
                <span className="text-gray-600 dark:text-gray-300">
                  {resources[input.resourceId].name}
                </span>
                <span className="font-mono text-red-600 dark:text-red-400">
                  {formatQuantity(input.quantity)}
                </span>
              </div>
            ))}
            {result.actualInputs.length === 0 && (
              <p className="text-sm text-gray-400 italic">none</p>
            )}
          </div>

          <div className="text-xl text-gray-400">&rarr;</div>

          <div className="space-y-1">
            {result.actualOutputs.map((output) => (
              <div key={output.resourceId} className="flex justify-between text-sm whitespace-nowrap gap-2">
                <span className="text-gray-600 dark:text-gray-300">
                  {resources[output.resourceId].name}
                </span>
                <span className="font-mono text-green-600 dark:text-green-400">
                  {formatQuantity(output.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
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
};
