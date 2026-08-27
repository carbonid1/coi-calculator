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
  const availableRecipes = [...new Map(
    [...recipes, ...(mod.recipes ?? [])].map(recipe => [recipe.id, recipe]),
  ).values()];
  const visibleRecipes = availableRecipes.filter((recipe) => (
    recipe.id in builtBuildings
    || Boolean(preset && recipe.id in preset.activeBuildings)
  ));
  const fixedIds = preset ? new Set(preset.fixed) : new Set<string>();

  const lines: ProductionLine[] = visibleRecipes.map((recipe) => {
    const built = builtBuildings[recipe.id] ?? 0;
    const speedLevel = preset?.speedLevels?.[recipe.id] ?? 1;
    const active = Math.max(
      0,
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
      dataSource: preset?.dataSources?.[recipe.id],
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
