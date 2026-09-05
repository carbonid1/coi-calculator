import { activeHousingServices, type HousingType } from "./housing";
import { type Ingredient } from "./recipes";
import { type ResourceId } from "./resources";

type FoodCategoryId = "carbohydrates" | "protein" | "vitamins" | "treats";

interface SettlementFood {
  resourceId: ResourceId;
  categoryId: FoodCategoryId;
  consumedPerHundredPopsPerMonth: number;
  /** Biomass source material retained by one unit on the selected v0.8.6 production path. */
  biomassSourcePerUnit: number;
  unityPerCycleWhenSupplied: number;
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
  { resourceId: "potato", categoryId: "carbohydrates", consumedPerHundredPopsPerMonth: 4.2, biomassSourcePerUnit: 1, unityPerCycleWhenSupplied: 0.15 },
  { resourceId: "corn", categoryId: "carbohydrates", consumedPerHundredPopsPerMonth: 3, biomassSourcePerUnit: 1, unityPerCycleWhenSupplied: 0.15 },
  { resourceId: "bread", categoryId: "carbohydrates", consumedPerHundredPopsPerMonth: 2, biomassSourcePerUnit: 16 / 27, unityPerCycleWhenSupplied: 0.3 },
  { resourceId: "meat", categoryId: "protein", consumedPerHundredPopsPerMonth: 2.7, biomassSourcePerUnit: 10 / 7, unityPerCycleWhenSupplied: 0.4 },
  { resourceId: "eggs", categoryId: "protein", consumedPerHundredPopsPerMonth: 3, biomassSourcePerUnit: 1, unityPerCycleWhenSupplied: 0.3 },
  { resourceId: "tofu", categoryId: "protein", consumedPerHundredPopsPerMonth: 1.8, biomassSourcePerUnit: 6 / 11, unityPerCycleWhenSupplied: 0.3 },
  { resourceId: "sausage", categoryId: "protein", consumedPerHundredPopsPerMonth: 3.35, biomassSourcePerUnit: 104 / 63, unityPerCycleWhenSupplied: 0.1 },
  { resourceId: "vegetables", categoryId: "vitamins", consumedPerHundredPopsPerMonth: 4.2, biomassSourcePerUnit: 1, unityPerCycleWhenSupplied: 0.2 },
  { resourceId: "fruit", categoryId: "vitamins", consumedPerHundredPopsPerMonth: 3.15, biomassSourcePerUnit: 1, unityPerCycleWhenSupplied: 0.3 },
  { resourceId: "snack", categoryId: "treats", consumedPerHundredPopsPerMonth: 2.6, biomassSourcePerUnit: 8 / 9, unityPerCycleWhenSupplied: 0.25 },
  { resourceId: "cake", categoryId: "treats", consumedPerHundredPopsPerMonth: 2.5, biomassSourcePerUnit: 58 / 63, unityPerCycleWhenSupplied: 0.55 },
];

export const settlementRecipeIds = {
  residents: "housing-residents",
  residentsII: "housing-ii-residents",
  foodMarket: "housing-food-market",
  foodMarketII: "housing-food-market-ii",
  transformer: "housing-transformer",
  waterFacility: "housing-water-facility",
  householdGoodsModule: "housing-household-goods-module",
  wasteCollection: "housing-waste-collection",
  recyclablesCollection: "housing-recyclables-collection",
  biomassCollection: "housing-biomass-collection",
  clinic: "housing-clinic",
  internetModule: "housing-internet-module",
  wastewaterTreatment: "housing-wastewater-treatment",
  anaerobicDigester: "housing-anaerobic-digester",
  biomassCompostMixer: "housing-mixer-ii-biomass-compost",
} as const;

export const settlementConfig = {
  activeFoodCategoryCount: 4,
  daysPerMonth: 30,
  waterPerPopPerMonth: 0.048,
  wasteWaterPerPopPerMonth: 0.04,
  electricityKwPerPop: 1.1,
  householdGoodsPerThousandPopsPerMonth: 10,
  medicalSuppliesPerHundredPopsPerMonth: 0.5,
  /** Internet Module demand from SettlementIspModuleProto in v0.8.6. */
  computingTflopsPerHundredPops: 5.76,
  recyclablesPerMedicalSupply: 0.5,
  recyclablesPerHouseholdGood: 0.5,
  biomassPerHouseholdGood: 0.4,
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

export interface SettlementSupply {
  foodResourceIds: ReadonlySet<ResourceId>
  householdGoods: boolean
  healthcare: boolean
}

export const calculateSettlementPopulationFlows = (
  population: number,
  housing: HousingType,
  supply?: SettlementSupply,
): SettlementPopulationFlows => {
  const normalizedPopulation = Math.max(0, population);
  const suppliedFoods = supply
    ? settlementFoods.filter(food => supply.foodResourceIds.has(food.resourceId))
    : settlementFoods;
  const householdGoodsEnabled = supply?.householdGoods ?? activeHousingServices.householdGoods;
  const foodsPerCategory = new Map<FoodCategoryId, number>();

  for (const food of suppliedFoods) {
    foodsPerCategory.set(
      food.categoryId,
      (foodsPerCategory.get(food.categoryId) ?? 0) + 1,
    );
  }

  const foodInputs = suppliedFoods.map((food) => ({
    resourceId: food.resourceId,
    inputModifierId: "foodConsumption" as const,
    quantity: food.consumedPerHundredPopsPerMonth
      * (normalizedPopulation / 100)
      / Math.max(1, foodsPerCategory.size)
      / (foodsPerCategory.get(food.categoryId) ?? 1),
  }));
  const medicalSupplies = settlementConfig.medicalSuppliesPerHundredPopsPerMonth
    * normalizedPopulation
    / 100 * (supply?.healthcare === false ? 0 : 1);
  const householdGoods = settlementConfig.householdGoodsPerThousandPopsPerMonth
    * normalizedPopulation
    / 1000
    * housing.serviceDemandMultipliers.householdGoods;
  const householdGoodsBiomass = householdGoodsEnabled
    ? householdGoods * settlementConfig.biomassPerHouseholdGood
    : 0;
  const biomass = foodInputs.reduce((total, input, index) => (
    total
    + input.quantity
      * (suppliedFoods[index]?.biomassSourcePerUnit ?? 0)
      * settlementConfig.biomassRecoveryRatio
  ), 0);

  return {
    inputs: [
      ...foodInputs,
      {
        resourceId: "water",
        inputModifierId: "settlementWater",
        quantity: settlementConfig.waterPerPopPerMonth
          * housing.serviceDemandMultipliers.water
          * normalizedPopulation,
      },
      {
        resourceId: "medicalSupplies",
        inputModifierId: "settlementConsumption",
        quantity: medicalSupplies,
      },
      ...(householdGoodsEnabled
        ? [{
            resourceId: "householdGoods" as const,
            inputModifierId: "settlementConsumption" as const,
            quantity: householdGoods,
          }]
        : []),
    ],
    outputs: [
      {
        resourceId: "wasteWater",
        outputModifierId: "settlementWater",
        quantity: settlementConfig.wasteWaterPerPopPerMonth
          * housing.serviceDemandMultipliers.wasteWater
          * normalizedPopulation,
      },
      {
        resourceId: "waste",
        quantity: settlementConfig.baseWastePerPopPerDay
          * settlementConfig.daysPerMonth
          * normalizedPopulation,
      },
      {
        resourceId: "biomass",
        quantity: biomass,
        modifierExemptQuantity: householdGoodsBiomass,
        modifierExemptOutputModifierId: "settlementConsumption",
        outputModifierId: "foodConsumption",
      },
      {
        resourceId: "recyclables",
        outputModifierId: "settlementConsumption",
        quantity:
          medicalSupplies * settlementConfig.recyclablesPerMedicalSupply
          + (householdGoodsEnabled
            ? householdGoods * settlementConfig.recyclablesPerHouseholdGood
            : 0),
      },
    ],
    electricityKw: settlementConfig.electricityKwPerPop
      * housing.serviceDemandMultipliers.electricity
      * normalizedPopulation,
  };
};
