import { isModuleScopedSourceMode } from '../../db/recipes'
import { type FactoryCalculation } from '../factory-calculation/factory-calculation'
import { getRecipeGrossInputQuantity, getRecipeInputQuantity, type RecipeModifierMultipliers } from '../modifiers/recipe-output'
import { type WorldMineResult } from '../world-mines/calculate-world-mines'

export interface FreshwaterUse {
  groundwater: number
  farmRain: number
  worldMines: number
  unused: number
  total: number
}

/** Freshwater consumed per in-game month; supply surplus and farm rain are reported separately. */
export const calculateFreshwaterUse = (
  calculation: FactoryCalculation,
  modifiers: RecipeModifierMultipliers,
  worldMines: WorldMineResult | undefined = calculation.worldMines,
): FreshwaterUse => {
  const results = [
    { result: calculation.factoryResult.calculation, flows: calculation.factoryResult.flows, worldWater: worldMines?.supplies.water ?? 0 },
    ...[...calculation.linkedModulesResult.moduleResults.values()].map(result => ({ result, flows: result.resourceFlows, worldWater: 0 })),
  ]
  const use: FreshwaterUse = { groundwater: 0, farmRain: 0, worldMines: worldMines?.supplies.water ?? 0, unused: 0, total: 0 }

  for (const { result, flows, worldWater } of results) {
    const supply = { pooledFreshwater: worldWater }

    for (const source of result.sourceResults) {
      const water = source.actualOutputs.find(output => output.resourceId === 'water')?.quantity ?? 0

      if (source.recipe.sourceKind !== 'groundwater') continue
      use.groundwater += water
      if (!isModuleScopedSourceMode(source.recipe.sourceMode)) supply.pooledFreshwater += water
    }

    // Module pumps are demand-capped to their private consumers. Surplus in
    // another network cannot cancel that draw; only credit the pooled supply.
    use.unused += Math.min(supply.pooledFreshwater, Math.max(0, flows.find(flow => flow.resourceId === 'water')?.net ?? 0))

    for (const farm of result.regularResults) {
      const water = farm.recipe.inputs.find(input => input.resourceId === 'water' && input.weatherAdjustedFarm)

      if (!water) continue
      // Irrigation demand already credits useful rain. Keep that benefit out
      // of the draw total, without counting soil overflow or rain on idle land.
      use.farmRain += Math.max(0, getRecipeGrossInputQuantity(water, modifiers) - getRecipeInputQuantity(water, modifiers))
        * farm.activeBuildings * farm.speedLevel * farm.supplyRatio
    }
  }

  use.total = use.groundwater + use.worldMines - use.unused
  return use
}
