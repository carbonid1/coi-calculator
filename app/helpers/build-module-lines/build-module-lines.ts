import { type Module, type Preset } from "../../db/modules/modules";
import { recipes } from "../../db/recipes";
import { type ProductionLine } from "../calculate/calculate";
import { getRecipeOutputQuantity, type OutputModifierMultipliers } from "../modifiers/recipe-output";

export const buildModuleLines = (
  mod: Module,
  preset: Preset | null,
  outputModifiers: OutputModifierMultipliers = {},
): { lines: ProductionLine[]; pinnedIds: Set<string> } => {
  const totals = preset?.buildingTotals ?? mod.buildingTotals;
  const visibleRecipes = recipes.filter((r) => r.id in totals);

  const lines: ProductionLine[] = visibleRecipes.map((recipe) => {
    const total = totals[recipe.id] ?? 0;
    const speedLevel = preset?.speedLevels?.[recipe.id] ?? 1;
    const configuredActive = preset && recipe.id in preset.active
      ? (preset.active[recipe.id] ?? total)
      : total;
    const targetRatios = recipe.outputs.flatMap((output) => {
      const target = preset?.outputTargets?.[output.resourceId];

      if (target == null) return [];

      const outputCapacity = getRecipeOutputQuantity(recipe, output, outputModifiers) * speedLevel;

      return outputCapacity > 0 ? [target / outputCapacity] : [];
    });
    const active = targetRatios.length > 0
      ? Math.min(total, Math.max(...targetRatios))
      : configuredActive;

    return { recipe, buildingCount: active, totalBuildings: total, speedLevel };
  });

  const pinnedIds = preset ? new Set(preset.pinned) : new Set<string>();

  return { lines, pinnedIds };
};
