import { cn } from "@carbonid1/design-system";

import { resources } from "../db/resources";
import { type BuildingDiagnostic } from "../helpers/building-diagnostics/building-diagnostics";
import {
  type PassiveResult,
  type ProductionLine,
  type RegularResult,
} from "../helpers/calculate/calculate";
import {
  getRecipeInputQuantity,
  getRecipeOutputQuantity,
  type RecipeModifierMultipliers,
} from "../helpers/modifiers/recipe-output";
import { getRecipeDisplayName } from "../helpers/recipe-display/recipe-display";
import { type ValueSource } from "../helpers/resolve-layered-value/resolve-layered-value";
import { BuildingCount } from "./BuildingCount";
import { ProductionCard } from "./ProductionCard";

interface Props {
  lines: ProductionLine[];
  dataSource?: ValueSource;
  results: (RegularResult | PassiveResult | undefined)[];
  outputModifiers?: RecipeModifierMultipliers;
  diagnostic?: BuildingDiagnostic;
}

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2));

export const SharedRecipeCard: React.FC<Props> = ({ lines, dataSource, results, outputModifiers, diagnostic }) => {
  const firstLine = lines[0];

  if (!firstLine) return null;

  const effective = lines.reduce((total, line, index) => (
    total + line.activeBuildings * (results[index]?.supplyRatio ?? 0)
  ), 0);
  const totalBuildings = Math.max(...lines.map((line) => line.builtBuildings));
  const operatingMode = results.every((result) => (
    result && "operatingMode" in result && result.operatingMode === "fixed"
  ))
    ? "fixed"
    : "balanced";

  return (
    <ProductionCard
      dataSource={dataSource}
      operatingMode={operatingMode}
      inactive={effective === 0}
      className="p-3"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-semibold text-foreground">
          {firstLine.recipe.sharedCapacity?.label ?? firstLine.recipe.building}
        </h3>
        <BuildingCount
          load={effective}
          active={Math.max(...lines.map((line) => line.activeBuildings))}
          built={totalBuildings}
          attention={diagnostic?.attention}
          attentionCount={diagnostic?.attentionCount}
        />
      </div>

      <div className="space-y-1">
        {lines.map((line, index) => {
          const result = results[index];
          const supplyRatio = result?.supplyRatio ?? 0;
          const buildingMultiplier = line.activeBuildings * supplyRatio;
          const ioMultiplier = buildingMultiplier * line.speedLevel;
          const inactive = buildingMultiplier === 0;

          return (
            <section
              key={line.recipe.id}
              className={cn(
                "rounded-lg p-2.5",
                inactive
                  ? "border border-dashed border-border"
                  : "bg-surface-inset inset-shadow-surface",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-sm font-medium text-foreground">
                  {getRecipeDisplayName(line.recipe)}
                </h4>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatQuantity(supplyRatio * 100)}% load
                  {line.recipe.electricityMultiplier != null
                    && line.recipe.electricityMultiplier !== 1
                    ? ` · ${formatQuantity(line.recipe.electricityMultiplier)}× power`
                    : ""}
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="min-w-0 space-y-1">
                  {line.recipe.inputs.map((input) => (
                    <div key={input.resourceId} className="flex justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">
                        {resources[input.resourceId].name}
                      </span>
                      <span className="shrink-0 font-mono text-destructive">
                        {formatQuantity(
                          getRecipeInputQuantity(input, outputModifiers) * ioMultiplier,
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-xl text-muted-foreground">&rarr;</div>

                <div className="min-w-0 space-y-1">
                  {line.recipe.outputs.map((output) => (
                    <div key={output.resourceId} className="flex justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">
                        {resources[output.resourceId].name}
                      </span>
                      <span className="shrink-0 font-mono text-success">
                        {formatQuantity(
                          getRecipeOutputQuantity(line.recipe, output, outputModifiers)
                            * ioMultiplier,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </ProductionCard>
  );
};
