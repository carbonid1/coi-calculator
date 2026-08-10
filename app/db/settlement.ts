import { type Ingredient } from "./recipes";
import { type ResourceId } from "./resources";

type FoodCategoryId = "carbohydrates" | "protein" | "vitamins" | "treats";

interface SettlementFood {
  resourceId: ResourceId;
  categoryId: FoodCategoryId;
  consumedPerHundredPopsPerMonth: number;
  /** Biomass source material retained by one unit on the selected v0.8.6 production path. */
  biomassSourcePerUnit: number;
}

/**
 * Captain of Industry v0.8.6 settlement data. When every supplied food is
 * available, population is split evenly between categories and then between
 * foods in each category.
 *
 * Biomass is provenance-based in the game. Processed-food values below follow
 * the ordinary v0.8.6 chains used by this calculator. Fluid products do not
 * retain source-product provenance, so Cooking Oil contributes no Biomass
 * source to Snack or Cake.
 */
export const settlementFoods: readonly SettlementFood[] = [
  { resourceId: "potato", categoryId: "carbohydrates", consumedPerHundredPopsPerMonth: 4.2, biomassSourcePerUnit: 1 },
  { resourceId: "corn", categoryId: "carbohydrates", consumedPerHundredPopsPerMonth: 3, biomassSourcePerUnit: 1 },
  { resourceId: "bread", categoryId: "carbohydrates", consumedPerHundredPopsPerMonth: 2, biomassSourcePerUnit: 16 / 27 },
  { resourceId: "meat", categoryId: "protein", consumedPerHundredPopsPerMonth: 2.7, biomassSourcePerUnit: 10 / 7 },
  { resourceId: "eggs", categoryId: "protein", consumedPerHundredPopsPerMonth: 3, biomassSourcePerUnit: 1 },
  { resourceId: "tofu", categoryId: "protein", consumedPerHundredPopsPerMonth: 1.8, biomassSourcePerUnit: 6 / 11 },
  { resourceId: "sausage", categoryId: "protein", consumedPerHundredPopsPerMonth: 3.35, biomassSourcePerUnit: 104 / 63 },
  { resourceId: "vegetables", categoryId: "vitamins", consumedPerHundredPopsPerMonth: 4.2, biomassSourcePerUnit: 1 },
  { resourceId: "fruit", categoryId: "vitamins", consumedPerHundredPopsPerMonth: 3.15, biomassSourcePerUnit: 1 },
  { resourceId: "snack", categoryId: "treats", consumedPerHundredPopsPerMonth: 2.6, biomassSourcePerUnit: 8 / 9 },
  { resourceId: "cake", categoryId: "treats", consumedPerHundredPopsPerMonth: 2.5, biomassSourcePerUnit: 58 / 63 },
];

export const settlementServiceBuildings = {
  foodMarket: 7,
  foodMarketII: 2,
  transformer: 1,
  waterFacility: 1,
  wasteCollection: 1,
  recyclablesCollection: 1,
  biomassCollection: 1,
  clinic: 1,
  wastewaterTreatment: 1,
  anaerobicDigester: 1,
  biomassCompostMixer: 1,
} as const;

export const settlementRecipeIds = {
  residents: "housing-ii-residents",
  foodMarket: "housing-food-market",
  foodMarketII: "housing-food-market-ii",
  transformer: "housing-transformer",
  waterFacility: "housing-water-facility",
  wasteCollection: "housing-waste-collection",
  recyclablesCollection: "housing-recyclables-collection",
  biomassCollection: "housing-biomass-collection",
  clinic: "housing-clinic",
  wastewaterTreatment: "housing-wastewater-treatment",
  anaerobicDigester: "housing-anaerobic-digester",
  biomassCompostMixer: "housing-mixer-ii-biomass-compost",
} as const;

export const settlementConfig = {
  activeFoodCategoryCount: 4,
  daysPerMonth: 30,
  waterPerPopPerMonth: 0.048,
  wasteWaterPerPopPerMonth: 0.04,
  housingIIWaterMultiplier: 1.05,
  electricityKwPerPop: 1.1,
  housingIIElectricityMultiplier: 1.1,
  medicalSuppliesPerHundredPopsPerMonth: 0.5,
  recyclablesPerMedicalSupply: 0.5,
  // v0.8.6 declares this as 0.0005, but Fix32 has 10 fractional bits and
  // rounds it to its smallest positive value, 1/1024. That matches the
  // observed 61.5 Waste / month for 2,100 people.
  baseWastePerPopPerDay: 1 / 1024,
  biomassRecoveryRatio: 0.12,
} as const;

export interface SettlementPopulationFlows {
  inputs: Ingredient[];
  outputs: Ingredient[];
  electricityKw: number;
}

export const calculateSettlementPopulationFlows = (
  population: number,
): SettlementPopulationFlows => {
  const normalizedPopulation = Math.max(0, population);
  const foodsPerCategory = new Map<FoodCategoryId, number>();

  for (const food of settlementFoods) {
    foodsPerCategory.set(
      food.categoryId,
      (foodsPerCategory.get(food.categoryId) ?? 0) + 1,
    );
  }

  const foodInputs = settlementFoods.map((food) => ({
    resourceId: food.resourceId,
    quantity: food.consumedPerHundredPopsPerMonth
      * (normalizedPopulation / 100)
      / settlementConfig.activeFoodCategoryCount
      / (foodsPerCategory.get(food.categoryId) ?? 1),
  }));
  const medicalSupplies = settlementConfig.medicalSuppliesPerHundredPopsPerMonth
    * normalizedPopulation
    / 100;
  const biomass = foodInputs.reduce((total, input, index) => (
    total
    + input.quantity
      * (settlementFoods[index]?.biomassSourcePerUnit ?? 0)
      * settlementConfig.biomassRecoveryRatio
  ), 0);

  return {
    inputs: [
      ...foodInputs,
      {
        resourceId: "water",
        quantity: settlementConfig.waterPerPopPerMonth
          * settlementConfig.housingIIWaterMultiplier
          * normalizedPopulation,
      },
      { resourceId: "medicalSupplies", quantity: medicalSupplies },
    ],
    outputs: [
      {
        resourceId: "wasteWater",
        quantity: settlementConfig.wasteWaterPerPopPerMonth
          * settlementConfig.housingIIWaterMultiplier
          * normalizedPopulation,
      },
      {
        resourceId: "waste",
        quantity: settlementConfig.baseWastePerPopPerDay
          * settlementConfig.daysPerMonth
          * normalizedPopulation,
      },
      { resourceId: "biomass", quantity: biomass },
      {
        resourceId: "recyclables",
        quantity: medicalSupplies * settlementConfig.recyclablesPerMedicalSupply,
      },
    ],
    electricityKw: settlementConfig.electricityKwPerPop
      * settlementConfig.housingIIElectricityMultiplier
      * normalizedPopulation,
  };
};
