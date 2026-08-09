import { type Ingredient, type OutputModifierId, type Recipe } from "../../db/recipes";

export type OutputModifierMultipliers = Partial<Record<OutputModifierId, number>>;

const GAME_PERCENT_SCALE = 100_000;

const scaleGameQuantity = (quantity: number, multiplier: number) => {
  const rawPercent = Math.round(multiplier * GAME_PERCENT_SCALE);
  const product = quantity * rawPercent;

  /**
   * Captain of Industry v0.8.6's Percent.Apply(long), used by
   * Quantity.ScaledBy, calculates:
   *
   *   (value * rawPercent + sign(value * rawPercent) * 50_000) / 100_000
   *
   * with integer division. Recipe quantities are positive, so this rounds to
   * the nearest whole unit, with exact halves rounded up. For example,
   * Maintenance Output III is round((480 / 3) * 1.03) * 3 = 495 per 60s,
   * rather than rounding the final 494.4 rate.
   */
  return Math.trunc(
    (product + Math.sign(product) * GAME_PERCENT_SCALE / 2) / GAME_PERCENT_SCALE,
  );
};

export const getRecipeOutputQuantity = (
  recipe: Recipe,
  output: Ingredient,
  modifiers: OutputModifierMultipliers = {},
) => {
  if (!output.outputModifierId) return output.quantity;

  const multiplier = modifiers[output.outputModifierId] ?? 1;

  // SolarPanelsManager scales Electricity directly. Unlike material Quantity,
  // Electricity is not rounded to a whole material unit per recipe cycle.
  if (output.outputModifierId === "solarPower") return output.quantity * multiplier;

  const cyclesPer60Seconds = recipe.cycleDurationSeconds
    ? 60 / recipe.cycleDurationSeconds
    : 1;
  const quantityPerCycle = output.quantity / cyclesPer60Seconds;

  // The game scales each recipe-cycle output before reporting its /60 rate.
  return scaleGameQuantity(quantityPerCycle, multiplier) * cyclesPer60Seconds;
};
