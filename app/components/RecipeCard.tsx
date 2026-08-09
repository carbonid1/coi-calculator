import { type Recipe } from "../db/recipes";
import { resources } from "../db/resources";
import { type OperatingMode } from "../helpers/calculate/calculate";
import { getRecipeOutputQuantity, type OutputModifierMultipliers } from "../helpers/modifiers/recipe-output";
import { BuildingCount } from "./BuildingCount";
import { ProductionCard } from "./ProductionCard";

interface Props {
  recipe: Recipe;
  activeCount: number;
  totalCount: number;
  supplyRatio: number;
  operatingMode: OperatingMode;
  speedLevel: number;
  outputModifiers?: OutputModifierMultipliers;
}

export const RecipeCard: React.FC<Props> = ({ recipe, activeCount, totalCount, supplyRatio, operatingMode, speedLevel, outputModifiers }) => {
  const buildingMultiplier = activeCount * supplyRatio;
  const effective = Math.round(buildingMultiplier * 100) / 100;
  const ioMultiplier = buildingMultiplier * speedLevel;
  const inactive = effective === 0;

  return (
    <ProductionCard operatingMode={operatingMode} inactive={inactive} className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {recipe.building}
          </h3>
          {recipe.name !== recipe.building && (() => {
            const match = recipe.name.match(/\((.+)\)$/);

            return match ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{match[1]}</p>
            ) : null;
          })()}
          {speedLevel !== 1 && (
            <p className="text-xs font-medium text-attention-foreground">
              Reactor speed ×{speedLevel}
            </p>
          )}
        </div>
        <BuildingCount effective={effective} total={totalCount} />
      </div>

      {!inactive && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0 space-y-1">
            {recipe.inputs.map((input) => (
              <div key={input.resourceId} className="flex justify-between text-sm gap-2">
                <span className="truncate text-gray-600 dark:text-gray-300">
                  {resources[input.resourceId].name}
                </span>
                <span className="shrink-0 font-mono text-red-600 dark:text-red-400">
                  {parseFloat((input.quantity * ioMultiplier).toFixed(2))}
                </span>
              </div>
            ))}
          </div>

          <div className="text-xl text-gray-400">&rarr;</div>

          <div className="min-w-0 space-y-1">
            {recipe.outputs.map((output) => (
              <div key={output.resourceId} className="flex justify-between text-sm gap-2">
                <span className="truncate text-gray-600 dark:text-gray-300">
                  {resources[output.resourceId].name}
                </span>
                <span className="shrink-0 font-mono text-green-600 dark:text-green-400">
                  {parseFloat((getRecipeOutputQuantity(recipe, output, outputModifiers) * ioMultiplier).toFixed(2))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ProductionCard>
  );
};
