import { housingTypes } from '../../db/housing'
import { type Module } from '../../db/modules/modules'
import { recipes, type Ingredient, type Recipe } from '../../db/recipes'
import { calculateSettlementPopulationFlows, settlementRecipeIds } from '../../db/settlement'
import { type SyncedProductionEntity } from '../../game-state'
import { type SyncedSettlementState } from '../../settlement-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'

/** Keep physical building counts, but derive resident demand from occupied housing. */
export const applySettlementState = (
  module: Module,
  state: SyncedSettlementState,
  entities: readonly SyncedProductionEntity[],
): Module => {
  const preset = module.presets.find(candidate => candidate.id === module.defaultPresetId)

  if (!preset || !module.liveArea) return module
  const zoneId = module.liveArea.zoneId
  const ownedIds = new Set(entities.filter(entity => (
    entity.running && entity.zones.some(zone => zone.id === zoneId)
  )).map(entity => entity.entityId))
  const speedLevels = { ...preset.speedLevels }
  const replacements: Recipe[] = []
  let projectedPopulation = 0
  const tiers = [
    { recipeId: settlementRecipeIds.residents, prototypeId: 'HousingT3', housing: housingTypes.housingIII },
    { recipeId: settlementRecipeIds.residentsII, prototypeId: 'HousingT2', housing: housingTypes.housingII },
  ]

  for (const { recipeId, prototypeId, housing } of tiers) {
    const base = recipes.find(recipe => recipe.id === recipeId)
    const active = preset.activeBuildings[recipeId] ?? 0

    if (!base || active <= 0) continue
    const tierIds = new Set(entities.filter(entity => (
      ownedIds.has(entity.entityId) && entity.prototypeId === prototypeId
    )).map(entity => entity.entityId))
    const groups = state.settlements.map(settlement => ({
      settlement,
      houses: settlement.housing.filter(house => tierIds.has(house.entityId)),
    })).filter(group => group.houses.length > 0)
    const occupants = groups.reduce((total, group) => (
      total + group.houses.reduce((sum, house) => sum + house.population, 0)
    ), 0)
    const hasPlan = preset.dataSources?.[recipeId] === 'planned'
      || (preset.constructionGhosts?.[recipeId] ?? 0) > 0
    const population = hasPlan
      ? active * housing.populationCapacity * (preset.speedLevels?.[recipeId] ?? 1)
      : occupants

    projectedPopulation += population
    const factor = population / housing.populationCapacity

    speedLevels[recipeId] = factor / active
    // Housing upgrades can introduce a tier absent from the current settlement.
    const suppliedGroups = groups.length > 0 ? groups : state.settlements.map(settlement => ({
      settlement, houses: settlement.housing.filter(house => ownedIds.has(house.entityId)),
    })).filter(group => group.houses.length > 0)
    const totalWeight = suppliedGroups.reduce((total, group) => total + group.houses.reduce(
      (sum, house) => sum + (occupants > 0 && !hasPlan ? house.population : house.capacity), 0,
    ), 0)
    const inputs = new Map<string, Ingredient>()
    const outputs = new Map<string, Ingredient>()
    const merge = (target: Map<string, Ingredient>, values: Ingredient[]) => {
      for (const value of values) {
        const previous = target.get(value.resourceId)

        target.set(value.resourceId, {
          ...value,
          quantity: (previous?.quantity ?? 0) + value.quantity / Math.max(factor, 1e-9),
          modifierExemptQuantity: (previous?.modifierExemptQuantity ?? 0)
            + (value.modifierExemptQuantity ?? 0) / Math.max(factor, 1e-9),
        })
      }
    }

    for (const { settlement, houses } of suppliedGroups) {
      const weight = houses.reduce((sum, house) => (
        sum + (occupants > 0 && !hasPlan ? house.population : house.capacity)
      ), 0)
      const foodResourceIds = new Set(settlement.foodProductIds.flatMap(productId => {
        const id = resolveSyncedResourceId({ productId, name: productId })

        return id ? [id] : []
      }))
      const flows = calculateSettlementPopulationFlows(
        totalWeight > 0 ? population * weight / totalWeight : 0,
        housing,
        {
          foodResourceIds,
          householdGoods: settlement.serviceIds.includes('HouseholdGoodsNeed'),
          healthcare: settlement.serviceIds.includes('HealthCareNeed'),
        },
      )

      merge(inputs, flows.inputs)
      merge(outputs, flows.outputs)
    }
    replacements.push({ ...base, inputs: [...inputs.values()], outputs: [...outputs.values()] })
  }
  speedLevels[settlementRecipeIds.internetModule] = projectedPopulation / 100
  return {
    ...module,
    recipes: [...(module.recipes ?? []).filter(recipe => !replacements.some(item => item.id === recipe.id)), ...replacements],
    presets: module.presets.map(candidate => candidate === preset ? { ...preset, speedLevels } : candidate),
  }
}
