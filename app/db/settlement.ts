import { resolveSyncedResourceId } from '../helpers/synced-resources/synced-resources'
import { type PlanningDefinitions } from '../planning-state'
import { activeHousingServices, type HousingType } from './housing'
import { type Ingredient } from './recipes'
import { type ResourceId } from './resources'

export const getSettlementFoods = (definitions: PlanningDefinitions) =>
  definitions.settlement.foods.flatMap(food => {
    const resourceId = resolveSyncedResourceId({ productId: food.productId, name: food.productId })

    return resourceId
      ? [
          {
            resourceId,
            categoryId: food.categoryId,
            consumedPerHundredPopsPerMonth: food.perHundredPops,
            biomassPerUnit:
              definitions.settlement.biomassPerProduct.find(p => p.productId === food.productId)
                ?.quantity ?? 0,
          },
        ]
      : []
  })

export const settlementRecipeIds = {
  residents: 'housing-residents',
  residentsII: 'housing-ii-residents',
  foodMarket: 'housing-food-market',
  foodMarketII: 'housing-food-market-ii',
  transformer: 'housing-transformer',
  waterFacility: 'housing-water-facility',
  householdGoodsModule: 'housing-household-goods-module',
  wasteCollection: 'housing-waste-collection',
  recyclablesCollection: 'housing-recyclables-collection',
  biomassCollection: 'housing-biomass-collection',
  clinic: 'housing-clinic',
  internetModule: 'housing-internet-module',
  wastewaterTreatment: 'housing-wastewater-treatment',
  anaerobicDigester: 'housing-anaerobic-digester',
  biomassCompostMixer: 'housing-mixer-ii-biomass-compost',
} as const

export interface SettlementPopulationFlows {
  inputs: Ingredient[]
  outputs: Ingredient[]
  electricityKw: number
}

export interface SettlementSupply {
  foodResourceIds: ReadonlySet<ResourceId>
  householdGoods: boolean
  healthcare: boolean
}

export const calculateSettlementPopulationFlows = (
  definitions: PlanningDefinitions,
  population: number,
  housing: HousingType,
  supply?: SettlementSupply,
): SettlementPopulationFlows => {
  const settlementFoods = getSettlementFoods(definitions)
  const rates = definitions.settlement
  const normalizedPopulation = Math.max(0, population)
  const suppliedFoods = supply
    ? settlementFoods.filter(food => supply.foodResourceIds.has(food.resourceId))
    : settlementFoods
  const householdGoodsEnabled = supply?.householdGoods ?? activeHousingServices.householdGoods
  const foodsPerCategory = new Map<string, number>()

  for (const food of suppliedFoods) {
    foodsPerCategory.set(food.categoryId, (foodsPerCategory.get(food.categoryId) ?? 0) + 1)
  }

  const foodInputs = suppliedFoods.map(food => ({
    resourceId: food.resourceId,
    inputModifierId: 'foodConsumption' as const,
    quantity:
      (food.consumedPerHundredPopsPerMonth * (normalizedPopulation / 100)) /
      Math.max(1, foodsPerCategory.size) /
      (foodsPerCategory.get(food.categoryId) ?? 1),
  }))
  const medicalSupplies =
    ((rates.medicalPerHundredPops * normalizedPopulation) / 100) *
    (supply?.healthcare === false ? 0 : 1)
  const householdGoods =
    rates.goodsPerPop * normalizedPopulation * housing.serviceDemandMultipliers.householdGoods
  const householdGoodsBiomass = householdGoodsEnabled
    ? householdGoods *
      (rates.biomassPerProduct.find(p => p.productId === 'Product_HouseholdGoods')?.quantity ?? 0)
    : 0
  const biomass = foodInputs.reduce(
    (total, input, index) => total + input.quantity * (suppliedFoods[index]?.biomassPerUnit ?? 0),
    0,
  )

  return {
    inputs: [
      ...foodInputs,
      {
        resourceId: 'water',
        inputModifierId: 'settlementWater',
        quantity: rates.waterPerPop * housing.serviceDemandMultipliers.water * normalizedPopulation,
      },
      {
        resourceId: 'medicalSupplies',
        inputModifierId: 'settlementConsumption',
        quantity: medicalSupplies,
      },
      ...(householdGoodsEnabled
        ? [
            {
              resourceId: 'householdGoods' as const,
              inputModifierId: 'settlementConsumption' as const,
              quantity: householdGoods,
            },
          ]
        : []),
    ],
    outputs: [
      {
        resourceId: 'wasteWater',
        outputModifierId: 'settlementWater',
        quantity:
          rates.wasteWaterPerPop *
          housing.serviceDemandMultipliers.wasteWater *
          normalizedPopulation,
      },
      {
        resourceId: 'waste',
        quantity: rates.baseWastePerPop * normalizedPopulation,
      },
      {
        resourceId: 'biomass',
        quantity: biomass,
        modifierExemptQuantity: householdGoodsBiomass,
        modifierExemptOutputModifierId: 'settlementConsumption',
        outputModifierId: 'foodConsumption',
      },
      {
        resourceId: 'recyclables',
        // 4.3 derives this output from actual consumed-product provenance.
        quantity: 0,
      },
    ],
    electricityKw:
      rates.electricityKwPerPop *
      housing.serviceDemandMultipliers.electricity *
      normalizedPopulation,
  }
}
