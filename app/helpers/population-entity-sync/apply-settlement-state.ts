import { housingTypes } from '../../db/housing'
import { type Module, type Preset } from '../../db/modules/modules'
import { recipes, type Ingredient, type Recipe } from '../../db/recipes'
import { calculateSettlementPopulationFlows, settlementRecipeIds } from '../../db/settlement'
import { type SyncedProductionEntity } from '../../game-state'
import { type SyncedSettlementState } from '../../settlement-state'
import { resolveSyncedResourceId } from '../synced-resources/synced-resources'

const housingTiers = [
  { recipeId: settlementRecipeIds.residents, prototypeId: 'HousingT3', housing: housingTypes.housingIII },
  { recipeId: settlementRecipeIds.residentsII, prototypeId: 'HousingT2', housing: housingTypes.housingII },
]

const hasHousingPlan = (preset: Preset, recipeId: string) => (
  preset.dataSources?.[recipeId] === 'planned'
  || (preset.constructionGhosts?.[recipeId] ?? 0) > 0
)

/** Replace only planned housing occupancy, using modules after applySettlementState. */
export const resolveProjectedPopulation = (
  modules: readonly Module[],
  state: SyncedSettlementState,
  entities: readonly SyncedProductionEntity[],
) => {
  const replacedHousingIds = new Set<number>()
  let plannedPopulation = 0
  let isPlanned = false

  for (const area of modules) {
    const preset = area.presets.find(candidate => candidate.id === area.defaultPresetId)

    if (!preset || !area.liveArea || area.includedInFactoryTotals === false) continue
    const zoneId = area.liveArea.zoneId

    for (const { recipeId, prototypeId, housing } of housingTiers) {
      if (!hasHousingPlan(preset, recipeId)) continue
      isPlanned = true
      plannedPopulation += (preset.activeBuildings[recipeId] ?? 0)
        * (preset.speedLevels?.[recipeId] ?? 1) * housing.populationCapacity
      for (const entity of entities) {
        if (entity.prototypeId === prototypeId && entity.zones.some(zone => zone.id === zoneId)) {
          replacedHousingIds.add(entity.entityId)
        }
      }
    }
  }
  const replacedPopulation = state.settlements.reduce((total, settlement) => (
    total + settlement.housing.reduce((sum, house) => (
      sum + (replacedHousingIds.has(house.entityId) ? house.population : 0)
    ), 0)
  ), 0)

  return {
    population: Math.max(0, Math.round(state.population - replacedPopulation + plannedPopulation)),
    isPlanned,
  }
}

/** Keep physical building counts, but derive resident demand from occupied housing. */
export const applySettlementState = (
  module: Module,
  state: SyncedSettlementState,
  entities: readonly SyncedProductionEntity[],
): Module => {
  const preset = module.presets.find(candidate => candidate.id === module.defaultPresetId)

  if (!preset || !module.liveArea) return module
  const zoneId = module.liveArea.zoneId
  // A planned Household Goods Module keeps its demand while the module is paused.
  const plannedHouseholdGoods = preset.dataSources?.[
    settlementRecipeIds.householdGoodsModule
  ] === 'planned'
  const ownedIds = new Set(entities.filter(entity => (
    entity.running && entity.zones.some(zone => zone.id === zoneId)
  )).map(entity => entity.entityId))
  const speedLevels = { ...preset.speedLevels }
  const replacements: Recipe[] = []
  let projectedPopulation = 0

  for (const { recipeId, prototypeId, housing } of housingTiers) {
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
    const hasPlan = hasHousingPlan(preset, recipeId)
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
          householdGoods: plannedHouseholdGoods
            || settlement.serviceIds.includes('HouseholdGoodsNeed'),
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
