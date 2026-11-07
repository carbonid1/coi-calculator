import { type ValueSource } from "../data-source";
import { getRecipeBuildingData } from "../db/buildings";
import { type Recipe } from "../db/recipes";
import type { resources } from "../db/resources";
import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import { type OperatingMode } from "../helpers/calculate/calculate";
import {
  getRecipeGrossInputQuantity,
  getRecipeInputQuantity,
  getRecipeOutputQuantity,
  type RecipeModifierMultipliers,
} from "../helpers/modifiers/recipe-output";
import { getRecipePresentation } from "../helpers/recipe-display/recipe-display";
import { BuildingCount } from "./BuildingCount";
import { KeepReadyMenu, KeepReadyNote, type KeepReadyChange } from './KeepReadyMenu';
import { ProductionCard } from "./ProductionCard";
import { RecipeFlow } from "./RecipeFlow";
import { RecipeLabel } from "./RecipeLabel";
import { RecipeTitle } from "./RecipeTitle";

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
  onKeepReadyChange?: KeepReadyChange;
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

export const RecipeCard: React.FC<Props> = ({ recipe, dataSource, activeBuildings, currentActiveBuildings, builtBuildings, constructionGhosts, unplacedPlannedBuildings, supplyRatio, operatingMode, speedLevel, actualInputs, actualOutputs, outputModifiers, diagnostic, onKeepReadyChange, showConfigurationSummary = true }) => {
  const buildingMultiplier = activeBuildings * supplyRatio;
  const ioMultiplier = buildingMultiplier * speedLevel;
  const inactive = buildingMultiplier === 0;
  const hasFlows = recipe.inputs.length > 0 || recipe.outputs.length > 0;
  const compactSyncedElectricitySource = isCompactSyncedElectricitySource(
    recipe,
    dataSource,
  );
  const displaysFlows = !inactive && hasFlows && !compactSyncedElectricitySource;
  const tflopsPerMachine = getRecipeBuildingData(recipe)?.computingTflops ?? 0;
  const computingTflops = recipe.computingScalesWithSpeed
    ? tflopsPerMachine * buildingMultiplier * speedLevel
    : tflopsPerMachine;
  const recipePresentation = getRecipePresentation(recipe);
  const recipeDisplayName = recipePresentation.name;
  const sustainableInput = recipe.decayStorage
    ? recipe.decayStorage.capacity / recipe.decayStorage.decayCycles * activeBuildings
    : undefined;
  const displaysConfiguration = showConfigurationSummary
    && recipe.showConfigurationSummary !== false
    && !compactSyncedElectricitySource;

  const card = (
    <ProductionCard
      dataSource={dataSource}
      operatingMode={operatingMode}
      inactive={inactive && !diagnostic?.keepReady && diagnostic?.attention !== 'can-pause'}
      className="p-3"
    >
      <div className={displaysFlows
        ? "mb-2 flex items-start justify-between gap-3"
        : "flex items-start justify-between gap-3"}
      >
        <div>
          <h3 className="font-semibold text-foreground">
            <RecipeTitle title={recipe.building} descriptions={[
              recipeDisplayName,
              ...(sustainableInput != null ? [`Sustainable limit · ${parseFloat(sustainableInput.toFixed(2))} / cycle`] : []),
            ]} />
          </h3>
          {displaysConfiguration && (recipePresentation.configuration || (!displaysFlows && recipeDisplayName !== recipe.building)) && (
            <p className="text-sm text-muted-foreground">
              <RecipeLabel recipe={recipePresentation} />
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
          level={diagnostic?.level}
          animalPopulation={diagnostic?.animalPopulation ?? (
            recipe.animalPopulationCapacity
              ? {
                  current: recipe.animalPopulationCapacity * activeBuildings * speedLevel,
                  capacity: recipe.animalPopulationCapacity * (
                    builtBuildings + (constructionGhosts ?? 0) + (unplacedPlannedBuildings ?? 0)
                  ),
                  label: recipe.animalPopulationLabel ?? "animals",
                  additionalBuildings: 0,
                }
              : undefined
          )}
        />
      </div>

      <KeepReadyNote enabled={diagnostic?.keepReady} />
      {displaysFlows && (
        <RecipeFlow name={recipeDisplayName}
          inputs={recipe.inputs.map(input => {
            const quantity = actualInputs?.find(actual => actual.resourceId === input.resourceId)?.quantity
              ?? getRecipeInputQuantity(input, outputModifiers) * ioMultiplier;
            const grossQuantity = getRecipeGrossInputQuantity(input, outputModifiers) * ioMultiplier;
            const detail = (() => {
              if (input.weatherAdjustedFarmId) {
                return `Import after rain · ${parseFloat(quantity.toFixed(2))}\nGross demand · ${parseFloat(grossQuantity.toFixed(2))}`;
              }
              if (sustainableInput != null) {
                return `Input · ${parseFloat(quantity.toFixed(2))}\nSustainable limit · ${parseFloat(sustainableInput.toFixed(2))}`;
              }
              return undefined;
            })();

            return {
              resourceId: input.resourceId, quantity, detail,
            };
          })}
          outputs={recipe.outputs.map(output => ({
            resourceId: output.resourceId,
            quantity: actualOutputs?.find(actual => actual.resourceId === output.resourceId)?.quantity
              ?? getRecipeOutputQuantity(recipe, output, outputModifiers) * ioMultiplier,
          }))}
        />
      )}
    </ProductionCard>
  );

  return <KeepReadyMenu diagnostic={diagnostic} onChange={onKeepReadyChange}>{card}</KeepReadyMenu>;
};
