import { type Recipe } from "../../db/recipes";
import { resources } from "../../db/resources";

export type DisplayableRecipe = Pick<
  Recipe,
  "building" | "displayName" | "gameRecipeId" | "name"
> & Partial<Pick<Recipe, "inputs" | "outputs">>;

/** Last resort for exported labels that contain an identifier instead of a name. */
export const getReadableLabel = (name: string) => {
  const label = name.trim();

  if (/\s/.test(label)) return label;

  return label
    .replace(/[_-]+/g, " ")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2");
};

const getConfigurationName = (name: string, building: string) => {
  if (name === building) return name;

  const configuration = name.startsWith(`${building} (`)
    ? name.match(/\(([^()]*)\)$/)?.[1]
    : undefined;

  if (configuration?.trim()) return configuration.trim();

  for (const separator of [" — ", " "]) {
    const buildingPrefix = `${building}${separator}`;

    if (name.startsWith(buildingPrefix)) return name.slice(buildingPrefix.length).trim();
  }

  return name;
};

const getMaterialLabel = (ingredients: Recipe["inputs"] = []) => (
  [...new Set(ingredients
    .filter(ingredient => ingredient.quantity > 0)
    .map(ingredient => resources[ingredient.resourceId]?.name)
    .filter(Boolean))].join(" + ")
);

/**
 * Returns the concise, user-facing recipe label used next to a building name.
 * Prefer authored copy, then readable game names. ID-only recipes use their
 * materials so routes stay distinguishable without exposing internal IDs.
 */
export const getRecipeDisplayName = (recipe: DisplayableRecipe) => {
  if (recipe.displayName?.trim()) return recipe.displayName.trim();

  const name = getConfigurationName(recipe.name.trim(), recipe.building);
  const isIdentifier = name === recipe.gameRecipeId
    || (!/\s/.test(name) && /[a-z\d][A-Z]|[A-Z]{2}[a-z]|_/.test(name));

  if (!name || isIdentifier) {
    const inputs = getMaterialLabel(recipe.inputs);
    const outputs = getMaterialLabel(recipe.outputs);

    if (inputs && outputs) return `${inputs} → ${outputs}`;
    if (inputs || outputs) return inputs || outputs;

    // A building is the useful fallback when even the materials are unavailable.
    return recipe.building.trim() || "Recipe";
  }

  return name;
};

/** The configuration shown beside a physical building group. */
export const getRecipeGroupDisplayName = (recipes: Recipe[]) => {
  const first = recipes[0];

  if (!first) return "Recipe";
  if (first.sharedCapacity?.label) {
    return getRecipeDisplayName({ building: first.building, name: first.sharedCapacity.label });
  }

  return [...new Set(recipes.map(getRecipeDisplayName))].join(" / ");
};
