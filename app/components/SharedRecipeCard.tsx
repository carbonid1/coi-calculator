import { cn } from "@carbonid1/design-system";

import { resources } from "../db/resources";
import {
  type ProductionLine,
  type RegularResult,
} from "../helpers/calculate/calculate";
import {
  getRecipeOutputQuantity,
  type OutputModifierMultipliers,
} from "../helpers/modifiers/recipe-output";
import { BuildingCount } from "./BuildingCount";
import { ProductionCard } from "./ProductionCard";

interface Props {
  lines: ProductionLine[];
  results: (RegularResult | undefined)[];
  outputModifiers?: OutputModifierMultipliers;
}

const getRecipeLabel = (line: ProductionLine) => {
  const match = line.recipe.name.match(/\((.+)\)$/);

  return match?.[1] ?? line.recipe.name;
};

const formatQuantity = (quantity: number) => parseFloat(quantity.toFixed(2));

export const SharedRecipeCard: React.FC<Props> = ({ lines, results, outputModifiers }) => {
  const firstLine = lines[0];

  if (!firstLine) return null;

  const effective = lines.reduce((total, line, index) => (
    total + line.buildingCount * (results[index]?.supplyRatio ?? 0)
  ), 0);
  const roundedEffective = Math.round(effective * 100) / 100;
  const totalBuildings = Math.max(...lines.map((line) => line.totalBuildings));
  const operatingMode = results.every((result) => result?.operatingMode === "fixed")
    ? "fixed"
    : "balanced";

  return (
    <ProductionCard
      operatingMode={operatingMode}
      inactive={roundedEffective === 0}
      className="p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground">
          {firstLine.recipe.building}
        </h3>
        <BuildingCount effective={roundedEffective} total={totalBuildings} />
      </div>

      <div className="space-y-2">
        {lines.map((line, index) => {
          const result = results[index];
          const supplyRatio = result?.supplyRatio ?? 0;
          const buildingMultiplier = line.buildingCount * supplyRatio;
          const ioMultiplier = buildingMultiplier * line.speedLevel;
          const inactive = buildingMultiplier === 0;

          return (
            <section
              key={line.recipe.id}
              className={cn(
                "rounded-lg p-3",
                inactive
                  ? "border border-dashed border-border"
                  : "bg-surface-inset inset-shadow-surface",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-sm font-medium text-foreground">
                  {getRecipeLabel(line)}
                </h4>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatQuantity(supplyRatio * 100)}% load
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
                        {formatQuantity(input.quantity * ioMultiplier)}
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
