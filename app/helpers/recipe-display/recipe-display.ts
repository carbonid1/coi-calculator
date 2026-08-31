import { type Recipe } from "../../db/recipes";

type DisplayableRecipe = Pick<
  Recipe,
  "building" | "displayName" | "gameRecipeId" | "name"
>;

/**
 * Returns the concise, user-facing recipe label used next to a building name.
 * An explicit concise label wins. Exact exported game IDs remain the fallback
 * for synced recipes that do not have a player-facing label yet.
 */
export const getRecipeDisplayName = (recipe: DisplayableRecipe) => {
  if (recipe.displayName) return recipe.displayName;
  if (recipe.gameRecipeId) return recipe.gameRecipeId;
  if (recipe.name === recipe.building) return recipe.building;

  const configuration = recipe.name.match(/\(([^()]*)\)$/)?.[1];

  if (configuration) return configuration;

  for (const separator of [" — ", " "]) {
    const buildingPrefix = `${recipe.building}${separator}`;

    if (recipe.name.startsWith(buildingPrefix)) {
      return recipe.name.slice(buildingPrefix.length);
    }
  }

  return recipe.name;
};
