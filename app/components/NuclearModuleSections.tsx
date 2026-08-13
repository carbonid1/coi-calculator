import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import {
  type PassiveResult,
  type ProductionLine,
  type RegularResult,
} from "../helpers/calculate/calculate";
import { type RecipeModifierMultipliers } from "../helpers/modifiers/recipe-output";
import { NuclearPowerBlocks } from "./NuclearPowerBlocks";
import { RecipeCard } from "./RecipeCard";
import { SharedRecipeCard } from "./SharedRecipeCard";
import { SinkCard } from "./SinkCard";
import { StorageCard } from "./StorageCard";

interface Props {
  lines: ProductionLine[];
  regularResults: RegularResult[];
  sourceResults: PassiveResult[];
  sinkResults: PassiveResult[];
  diagnostics: BuildingDiagnostic[];
  outputModifiers: RecipeModifierMultipliers;
}

const nuclearAndWasteRecipeIds = [
  "nuclear-reprocessing",
  "enrichment-plant",
  "chemical-plant-yellowcake",
  "radioactive-waste-storage",
  "shredder-retired-waste",
] as const;

const waterAndSteamRecipeIds = [
  "hydrogen-reformer-super",
  "seawater-pump",
  "thermal-desalinator-depleted",
  "thermal-desalinator-super",
  "cooling-tower-large-super",
  "cooling-tower-large-depleted",
] as const;

const selectLines = (lines: ProductionLine[], recipeIds: readonly string[]) => (
  recipeIds.flatMap((recipeId) => {
    const line = lines.find((candidate) => candidate.recipe.id === recipeId);

    return line ? [line] : [];
  })
);

export const NuclearModuleSections: React.FC<Props> = ({
  lines,
  regularResults,
  sourceResults,
  sinkResults,
  diagnostics,
  outputModifiers,
}) => {
  const renderLine = (line: ProductionLine) => {
    if (line.recipe.group === "source") {
      const result = sourceResults.find((candidate) => candidate.recipe.id === line.recipe.id);

      return result ? <SinkCard key={line.recipe.id} result={result} role="source" /> : null;
    }

    if (line.recipe.group === "sink") {
      const result = sinkResults.find((candidate) => candidate.recipe.id === line.recipe.id);

      return result ? <SinkCard key={line.recipe.id} result={result} role="sink" /> : null;
    }

    const result = regularResults.find((candidate) => candidate.recipe.id === line.recipe.id);

    if (line.recipe.decayStorage) {
      return (
        <StorageCard
          key={line.recipe.id}
          recipe={line.recipe}
          storage={line.recipe.decayStorage}
          activeBuildings={line.activeBuildings}
          builtBuildings={line.builtBuildings}
          operatingMode={result?.operatingMode ?? "balanced"}
        />
      );
    }

    return (
      <RecipeCard
        key={line.recipe.id}
        recipe={line.recipe}
        activeBuildings={line.activeBuildings}
        builtBuildings={line.builtBuildings}
        diagnostic={diagnostics.find(
          (diagnostic) => diagnostic.key === `${line.moduleId}:${line.recipe.id}`,
        )}
        supplyRatio={result?.supplyRatio ?? 1}
        operatingMode={result?.operatingMode ?? "balanced"}
        speedLevel={line.speedLevel}
        actualInputs={result?.actualInputs}
        actualOutputs={result?.actualOutputs}
        outputModifiers={outputModifiers}
      />
    );
  };

  const electricityLines = lines.filter((line) => line.recipe.group === "electricity");
  const nuclearAndWasteLines = selectLines(lines, nuclearAndWasteRecipeIds);
  const waterAndSteamLines = selectLines(lines, waterAndSteamRecipeIds);
  const coolingLines = waterAndSteamLines.filter((line) => line.capacityPoolId);
  const waterProductionLines = waterAndSteamLines.filter((line) => !line.capacityPoolId);

  return (
    <>
      <section className="space-y-2" aria-labelledby="nuclear-and-waste-heading">
        <h2
          id="nuclear-and-waste-heading"
          className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Nuclear &amp; waste
        </h2>
        <NuclearPowerBlocks
          lines={electricityLines}
          results={regularResults}
          outputModifiers={outputModifiers}
        />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {nuclearAndWasteLines.map(renderLine)}
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="water-and-steam-heading">
        <h2
          id="water-and-steam-heading"
          className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
        >
          Water &amp; steam
        </h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {waterProductionLines.map(renderLine)}
          <SharedRecipeCard
            lines={coolingLines}
            results={coolingLines.map((line) => (
              sinkResults.find((result) => result.recipe.id === line.recipe.id)
            ))}
            outputModifiers={outputModifiers}
            diagnostic={diagnostics.find(
              (diagnostic) => diagnostic.key === coolingLines[0]?.capacityPoolId,
            )}
          />
        </div>
      </section>
    </>
  );
};
