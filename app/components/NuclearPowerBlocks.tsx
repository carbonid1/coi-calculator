import { type RegularResult, type ProductionLine } from "../helpers/calculate/calculate";
import { type RecipeModifierMultipliers } from "../helpers/modifiers/recipe-output";
import { createNuclearPowerBlocks } from "../helpers/nuclear-power-blocks/nuclear-power-blocks";
import { RecipeCard } from "./RecipeCard";

interface Props {
  lines: ProductionLine[];
  results: RegularResult[];
  outputModifiers: RecipeModifierMultipliers;
}

const powerLevelLabels: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
};

export const NuclearPowerBlocks: React.FC<Props> = ({
  lines,
  results,
  outputModifiers,
}) => {
  const blocks = createNuclearPowerBlocks(lines, results);

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <section key={block.id} className="space-y-2 rounded-lg border border-border p-3">
          <h3 className="font-semibold text-foreground">
            {block.label} · Power {powerLevelLabels[block.reactor.line.speedLevel]
              ?? block.reactor.line.speedLevel} · Breeding {block.reactor.line.recipe.id === "fbr-3x"
              ? "3×"
              : "0×"}
          </h3>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {[block.reactor, ...block.turbineBank].map(({ line, result }) => (
              <RecipeCard
                key={`${block.id}:${line.recipe.id}`}
                recipe={line.recipe}
                activeBuildings={line.activeBuildings}
                builtBuildings={line.builtBuildings}
                supplyRatio={result?.supplyRatio ?? 0}
                operatingMode={result?.operatingMode ?? "balanced"}
                speedLevel={line.speedLevel}
                actualInputs={result?.actualInputs}
                actualOutputs={result?.actualOutputs}
                outputModifiers={outputModifiers}
                showConfigurationSummary={!line.recipe.id.startsWith("fbr-")}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
