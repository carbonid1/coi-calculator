import { type Module, type Preset } from "../../db/modules/modules";
import { recipes } from "../../db/recipes";
import { type ProductionLine } from "../calculate/calculate";
import { getRecipeOutputQuantity, type RecipeModifierMultipliers } from "../modifiers/recipe-output";

export const buildModuleLines = (
  mod: Module,
  preset: Preset | null,
  outputModifiers: RecipeModifierMultipliers = {},
): { lines: ProductionLine[] } => {
  const builtBuildings = preset?.builtBuildings ?? mod.builtBuildings;
  const visibleRecipes = recipes.filter((recipe) => recipe.id in builtBuildings);
  const fixedIds = preset ? new Set(preset.fixed) : new Set<string>();

  const lines: ProductionLine[] = visibleRecipes.map((recipe) => {
    const built = builtBuildings[recipe.id] ?? 0;
    const speedLevel = preset?.speedLevels?.[recipe.id] ?? 1;
    const active = Math.min(
      built,
      preset && recipe.id in preset.activeBuildings
        ? (preset.activeBuildings[recipe.id] ?? built)
        : built,
    );
    const targetRatios = recipe.outputs.flatMap((output) => {
      const target = preset?.outputTargets?.[output.resourceId];

      if (target == null) return [];

      const outputCapacity = getRecipeOutputQuantity(recipe, output, outputModifiers) * speedLevel;

      return outputCapacity > 0 ? [target / outputCapacity] : [];
    });
    const allocationRatio = targetRatios.length > 0 && active > 0
      ? Math.min(1, Math.max(...targetRatios) / active)
      : undefined;

    return {
      recipe,
      moduleId: mod.id,
      capacityPoolId: recipe.sharedCapacity
        ? `${mod.id}:${recipe.sharedCapacity.id}`
        : undefined,
      activeBuildings: active,
      builtBuildings: built,
      speedLevel,
      operatingMode: fixedIds.has(recipe.id) ? "fixed" : "balanced",
      allocationRatio,
    };
  });

  return { lines };
};
