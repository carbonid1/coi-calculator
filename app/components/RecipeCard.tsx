import { getBuildingData } from "../db/buildings";
import { type Recipe } from "../db/recipes";
import { resources } from "../db/resources";
import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import { type OperatingMode } from "../helpers/calculate/calculate";
import {
  getRecipeGrossInputQuantity,
  getRecipeInputQuantity,
  getRecipeOutputQuantity,
  type RecipeModifierMultipliers,
} from "../helpers/modifiers/recipe-output";
import { getRecipeDisplayName } from "../helpers/recipe-display/recipe-display";
import { type ValueSource } from "../helpers/resolve-layered-value/resolve-layered-value";
import { BuildingCount } from "./BuildingCount";
import { ProductionCard } from "./ProductionCard";

interface Props {
  recipe: Recipe;
  dataSource?: ValueSource;
  activeBuildings: number;
  currentActiveBuildings?: number;
  builtBuildings: number;
  constructionGhosts?: number;
  unplacedPlannedBuildings?: number;
  supplyRatio: number;
  operatingMode: OperatingMode;
  speedLevel: number;
  actualInputs?: { resourceId: keyof typeof resources; quantity: number }[];
  actualOutputs?: { resourceId: keyof typeof resources; quantity: number }[];
  outputModifiers?: RecipeModifierMultipliers;
  diagnostic?: BuildingDiagnostic;
  showConfigurationSummary?: boolean;
}

export const isCompactSyncedElectricitySource = (
  recipe: Recipe,
  dataSource?: ValueSource,
) => (
  dataSource === "synced"
  && recipe.inputs.length === 0
  && recipe.outputs.length === 1
  && recipe.outputs[0]?.resourceId === "electricity"
);

export const RecipeCard: React.FC<Props> = ({ recipe, dataSource, activeBuildings, currentActiveBuildings, builtBuildings, constructionGhosts, unplacedPlannedBuildings, supplyRatio, operatingMode, speedLevel, actualInputs, actualOutputs, outputModifiers, diagnostic, showConfigurationSummary = true }) => {
  const buildingMultiplier = activeBuildings * supplyRatio;
  const ioMultiplier = buildingMultiplier * speedLevel;
  const inactive = buildingMultiplier === 0;
  const hasFlows = recipe.inputs.length > 0 || recipe.outputs.length > 0;
  const compactSyncedElectricitySource = isCompactSyncedElectricitySource(
    recipe,
    dataSource,
  );
  const displaysFlows = !inactive && hasFlows && !compactSyncedElectricitySource;
  const tflopsPerMachine = getBuildingData(recipe.building)?.computingTflops ?? 0;
  const computingTflops = recipe.computingScalesWithSpeed
    ? tflopsPerMachine * buildingMultiplier * speedLevel
    : tflopsPerMachine;
  const recipeDisplayName = getRecipeDisplayName(recipe);
  const displaysConfiguration = showConfigurationSummary
    && recipe.showConfigurationSummary !== false
    && !compactSyncedElectricitySource;

  return (
    <ProductionCard
      dataSource={dataSource}
      operatingMode={operatingMode}
      inactive={inactive}
      className="p-3"
    >
      <div className={displaysFlows
        ? "mb-2 flex items-start justify-between gap-3"
        : "flex items-start justify-between gap-3"}
      >
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {recipe.building}
          </h3>
          {displaysConfiguration && recipeDisplayName !== recipe.building && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {recipeDisplayName}
            </p>
          )}
          {recipe.farmFertilizer && (
            <p className="text-xs text-muted-foreground">
              Fertility target{" "}
              <span className="font-mono font-medium text-foreground">
                {recipe.farmFertilizer.targetFertilityPercent}%
              </span>
              {recipe.farmFertilizer.targetFertilityPercent
                === recipe.farmFertilizer.maximumFertilityPercent
                ? " (maximum)"
                : ""}
            </p>
          )}
          {displaysConfiguration
            && speedLevel !== 1
            && !recipe.computingScalesWithSpeed
            && !recipe.animalPopulationCapacity
            && (
            <p className="text-xs font-medium text-attention-foreground">
              Throughput ×{speedLevel}
            </p>
          )}
          {recipe.computingScalesWithSpeed && computingTflops > 0 && (
            <p className="text-xs text-muted-foreground">
              {Math.round(speedLevel * 100).toLocaleString("en-US")} population cap · Computing {parseFloat(computingTflops.toFixed(2))} TFLOPS
            </p>
          )}
        </div>
        <BuildingCount
          load={buildingMultiplier}
          active={activeBuildings}
          currentActive={currentActiveBuildings}
          built={builtBuildings}
          ghosts={constructionGhosts}
          planned={unplacedPlannedBuildings}
          attention={diagnostic?.attention}
          attentionCount={diagnostic?.attentionCount}
          animalPopulation={diagnostic?.animalPopulation ?? (
            recipe.animalPopulationCapacity
              ? {
                  current: recipe.animalPopulationCapacity * activeBuildings * speedLevel,
                  capacity: recipe.animalPopulationCapacity * builtBuildings,
                  label: recipe.animalPopulationLabel ?? "animals",
                  additionalBuildings: 0,
                }
              : undefined
          )}
        />
      </div>

      {displaysFlows && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0 space-y-1">
            {recipe.inputs.map((input) => {
              const actualQuantity = actualInputs?.find(
                (actual) => actual.resourceId === input.resourceId,
              )?.quantity ?? getRecipeInputQuantity(input, outputModifiers) * ioMultiplier;
              const grossQuantity = getRecipeGrossInputQuantity(input, outputModifiers)
                * ioMultiplier;
              const weatherAdjusted = Boolean(input.weatherAdjustedFarmId);

              if (weatherAdjusted) {
                return (
                  <div key={input.resourceId} className="space-y-1 text-sm">
                    <span className="block truncate text-muted-foreground">
                      {resources[input.resourceId].name}
                    </span>
                    <dl className="space-y-1 rounded-lg bg-surface-inset px-2 py-1.5 inset-shadow-surface">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="min-w-0 text-xs text-muted-foreground">Import after rain</dt>
                        <dd className="shrink-0 font-mono text-destructive">
                          {parseFloat(actualQuantity.toFixed(2))}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                        <dt className="min-w-0">Gross demand</dt>
                        <dd className="shrink-0 font-mono">
                          {parseFloat(grossQuantity.toFixed(2))}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              }

              return (
                <div key={input.resourceId} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-gray-600 dark:text-gray-300">
                    {resources[input.resourceId].name}
                  </span>
                  <span className="shrink-0 font-mono text-red-600 dark:text-red-400">
                    {parseFloat(actualQuantity.toFixed(2))}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-xl text-gray-400">&rarr;</div>

          <div className="min-w-0 space-y-1">
            {recipe.outputs.map((output) => (
              <div key={output.resourceId} className="flex justify-between text-sm gap-2">
                <span className="truncate text-gray-600 dark:text-gray-300">
                  {resources[output.resourceId].name}
                </span>
                <span className="shrink-0 font-mono text-green-600 dark:text-green-400">
                  {parseFloat((actualOutputs?.find((actual) => actual.resourceId === output.resourceId)?.quantity
                    ?? getRecipeOutputQuantity(recipe, output, outputModifiers) * ioMultiplier).toFixed(2))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ProductionCard>
  );
};
