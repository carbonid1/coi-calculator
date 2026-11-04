import { type BuildingDefinition } from '../../building-state';
import {
  type Ingredient,
  type InputModifierId,
  type OutputModifierId,
  type Recipe,
} from "../../db/recipes";
import { type WeatherConfig } from "../../db/weather";
import { type OfficeFocusDefinitions } from '../../office-focus-state';
import { type PlanningDefinitions } from '../../planning-state';
import { type NativeProducts } from '../../product-state';
import { getProductRecyclingSources, type RecyclingData, type RecyclingSources } from '../recycling/recycling';
import { typedEntries } from '../typed-entries/typed-entries';
import { calculateFarmIrrigationRates } from "../weather/calculate-farm-irrigation";

export type RecipeModifierMultipliers = Partial<Record<
  InputModifierId | OutputModifierId | "rainwaterYield",
  number
>> & { weather?: WeatherConfig; recycling?: RecyclingData; products?: Pick<NativeProducts, 'catalog'>; buildingDefinitions?: BuildingDefinition[]; officeFocusDefinitions?: OfficeFocusDefinitions; planningDefinitions?: PlanningDefinitions };

const GAME_PERCENT_SCALE = 100_000;

const getWeatherAdjustedFarm = (input: Ingredient) => {
  if (input.weatherAdjustedFarm) return input.weatherAdjustedFarm;

  return null;
};

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
  modifiers: RecipeModifierMultipliers = {},
) => {
  const modifierExemptQuantity = output.modifierExemptQuantity ?? 0;
  const modifierExemptMultiplier = output.modifierExemptOutputModifierId
    ? modifiers[output.modifierExemptOutputModifierId] ?? 1
    : 1;
  const modifiedExemptQuantity = modifierExemptQuantity * modifierExemptMultiplier;

  if (!output.outputModifierId) return output.quantity + modifiedExemptQuantity;

  const multiplier = modifiers[output.outputModifierId] ?? 1;

  // SolarPanelsManager scales Electricity directly. Settlement food and
  // provenance-based Biomass are continuous population flows. These values are
  // not rounded to a whole material unit per recipe cycle.
  if (
    output.outputModifierId === "foodConsumption"
    || output.outputModifierId === "settlementConsumption"
    || output.outputModifierId === "settlementWater"
    || output.outputModifierId === "solarPower"
    || output.outputModifierId === "cropYield"
    || output.outputModifierId === "treeGrowthSpeed"
  ) {
    return output.quantity * multiplier + modifiedExemptQuantity;
  }

  const cyclesPer60Seconds = recipe.cycleDurationSeconds
    ? 60 / recipe.cycleDurationSeconds
    : 1;
  const quantityPerCycle = output.quantity / cyclesPer60Seconds;

  // The game scales each recipe-cycle output before reporting its /60 rate.
  return scaleGameQuantity(quantityPerCycle, multiplier) * cyclesPer60Seconds
    + modifiedExemptQuantity;
};

export const getRecipeInputQuantity = (
  input: Ingredient,
  modifiers: RecipeModifierMultipliers = {},
) => {
  const multiplier = input.inputModifierId
    ? modifiers[input.inputModifierId] ?? 1
    : 1;

  const farmGroup = getWeatherAdjustedFarm(input);

  if (farmGroup) {
    return calculateFarmIrrigationRates(
      farmGroup.group,
      farmGroup.definitions,
      multiplier,
      modifiers.rainwaterYield ?? 1,
      modifiers.weather,
    ).importedWaterPerMonth;
  }

  return input.quantity * multiplier;
};

export const getRecipeGrossInputQuantity = (
  input: Ingredient,
  modifiers: RecipeModifierMultipliers = {},
) => {
  const multiplier = input.inputModifierId
    ? modifiers[input.inputModifierId] ?? 1
    : 1;

  const farmGroup = getWeatherAdjustedFarm(input);

  if (farmGroup) {
    return calculateFarmIrrigationRates(farmGroup.group, farmGroup.definitions, multiplier).grossWaterPerMonth;
  }

  if (!input.inputModifierId) return input.quantity;

  return input.quantity * multiplier;
};

/** 4.3 computes recyclable volume from live source provenance, not recipe output quantities. */
export const withRecipeRecycling = (
  recipe: Recipe,
  modifiers: RecipeModifierMultipliers,
  efficiencyPercent = modifiers.recycling?.efficiencyPercent ?? 0,
): Recipe => {
  const recyclingOutput = recipe.outputs.find(output => output.resourceId === 'recyclables')

  if (!recyclingOutput || recipe.recyclesInputs === false) return recipe
  const data = modifiers.recycling
  const efficiency = Math.min(100, Math.max(0, efficiencyPercent)) / 100
  const sources: RecyclingSources = {}

  for (const input of recipe.inputs) {
    for (const [id, quantity] of typedEntries(data ? getProductRecyclingSources(data, input.resourceId) ?? {} : {})) {
      sources[id] = (sources[id] ?? 0) + quantity * getRecipeInputQuantity(input, modifiers) * efficiency
    }
  }
  const quantity = Object.values(sources).reduce((total, value) => total + (value ?? 0), 0)
    / (data?.scrapPerRecyclable ?? 2)

  return {
    ...recipe,
    recyclingSources: sources,
    outputs: recipe.outputs.map(output => output === recyclingOutput
      ? { resourceId: output.resourceId, quantity }
      : output),
  }
}
