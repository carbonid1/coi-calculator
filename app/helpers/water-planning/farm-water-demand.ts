import { crops } from '../../db/crop-farming'
import { planningWeather } from '../../db/weather'
import { type RegularResult } from '../calculate/calculate'
import { getRecipeInputQuantity, type RecipeModifierMultipliers } from '../modifiers/recipe-output'
import { calculateFarmIrrigationForecast } from '../weather/calculate-farm-irrigation'

export interface FarmWaterDemand {
  steadyPerCycle: number
  dailyDifference: number[]
}

/** Keep planned steady rates; replace only known farms' first-year timing. */
export const calculateFarmWaterDemand = (results: readonly RegularResult[], modifiers: RecipeModifierMultipliers) => {
  const modules = new Map<string, FarmWaterDemand>()
  const weather = modifiers.weather

  if (!weather || weather.hasOverride) return modules
  for (const result of results) {
    const water = result.recipe.inputs.find(input => input.resourceId === 'water' && input.weatherAdjustedFarm)
    const farm = water?.weatherAdjustedFarm

    if (!water || !farm) continue
    const active = result.activeBuildings * result.speedLevel * result.supplyRatio

    if (active <= 0) continue
    const demand = modules.get(result.moduleId) ?? { steadyPerCycle: 0,
      dailyDifference: Array.from({ length: planningWeather.daysPerCycle * 12 + 1 }, () => 0) }
    const steady = getRecipeInputQuantity(water, modifiers)

    demand.steadyPerCycle += steady * active
    const current = farm.group.currentFarms ?? []
    const scale = Math.min(1, active / Math.max(1, current.length))

    for (const state of current) {
      if (state.runtime.cropId !== null && !(state.runtime.cropId in crops)) continue
      const forecast = calculateFarmIrrigationForecast(farm.group, farm.definitions, modifiers.cropWater ?? 1,
        modifiers.rainwaterYield ?? 1, weather, state)

      for (const [day, quantity] of forecast.entries()) {
        if (day > 0) demand.dailyDifference[day] = (demand.dailyDifference[day] ?? 0) + (quantity - steady / planningWeather.daysPerCycle) * scale
      }
    }
    modules.set(result.moduleId, demand)
  }
  return modules
}
