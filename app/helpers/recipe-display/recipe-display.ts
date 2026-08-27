import { type Recipe } from "../../db/recipes";

type DisplayableRecipe = Pick<Recipe, "building" | "displayName" | "name">;

/**
 * Returns the concise, user-facing recipe label used next to a building name.
 * Explicit labels win; legacy names retain their parenthesized configuration.
 */
export const getRecipeDisplayName = (recipe: DisplayableRecipe) => {
  if (recipe.displayName) return recipe.displayName;

  const configuration = recipe.name.match(/\((.+)\)$/)?.[1];

  if (configuration) return configuration;

  for (const separator of [" — ", " "]) {
    const buildingPrefix = `${recipe.building}${separator}`;

    if (recipe.name.startsWith(buildingPrefix)) {
      return recipe.name.slice(buildingPrefix.length);
    }
  }

  return recipe.name;
};
