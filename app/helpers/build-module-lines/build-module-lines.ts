import { type Module, type Preset } from "../../db/modules/modules";
import { recipes } from "../../db/recipes";
import { type ProductionLine } from "../calculate/calculate";
import { getRecipeOutputQuantity, type OutputModifierMultipliers } from "../modifiers/recipe-output";

export const buildModuleLines = (
  mod: Module,
  preset: Preset | null,
  outputModifiers: OutputModifierMultipliers = {},
): { lines: ProductionLine[] } => {
  const totals = preset?.buildingTotals ?? mod.buildingTotals;
  const visibleRecipes = recipes.filter((r) => r.id in totals);
  const fixedIds = preset ? new Set(preset.fixed) : new Set<string>();

  const lines: ProductionLine[] = visibleRecipes.map((recipe) => {
    const total = totals[recipe.id] ?? 0;
    const speedLevel = preset?.speedLevels?.[recipe.id] ?? 1;
    const configuredAvailable = preset && recipe.id in preset.available
      ? (preset.available[recipe.id] ?? total)
      : total;
    const targetRatios = recipe.outputs.flatMap((output) => {
      const target = preset?.outputTargets?.[output.resourceId];

      if (target == null) return [];

      const outputCapacity = getRecipeOutputQuantity(recipe, output, outputModifiers) * speedLevel;

      return outputCapacity > 0 ? [target / outputCapacity] : [];
    });
    const active = targetRatios.length > 0
      ? Math.min(total, Math.max(...targetRatios))
      : configuredAvailable;

    return {
      recipe,
      buildingCount: active,
      totalBuildings: total,
      speedLevel,
      operatingMode: fixedIds.has(recipe.id) ? "fixed" : "balanced",
    };
  });

  return { lines };
};
