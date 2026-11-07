import { type BuildingDefinition, type MaintenancePlanningData } from '../../building-state'
import { getRecipeBuildingData } from '../../db/buildings'
import { type Module } from '../../db/modules/modules'
import { type GameStateSnapshot } from '../../game-state'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { type RecipeModifierMultipliers } from '../modifiers/recipe-output'

export type MaintenanceTier = 'maintenanceI' | 'maintenanceII' | 'maintenanceIII'
export type MaintenanceValues = Record<MaintenanceTier, number>
export interface MaintenanceProjection {
  synced: MaintenanceValues
  planned: MaintenanceValues | null
  projected: MaintenanceValues | null
}

const tiersByProductId: Record<string, MaintenanceTier> = {
  Product_Virtual_MaintenanceT1: 'maintenanceI',
  Product_Virtual_MaintenanceT2: 'maintenanceII',
  Product_Virtual_MaintenanceT3: 'maintenanceIII',
}

/** Historical consumption covers existing operation. Only extra active physical
 * inventory adds upkeep; speed, utilization and livestock population do not.
 * A shared recipe pool is one set of buildings, regardless of recipe count. */
export const projectMaintenance = (
  history: GameStateSnapshot['history']['maintenance'],
  modules: readonly Module[],
  modifiers: RecipeModifierMultipliers,
  configuration: MaintenancePlanningData | undefined,
): MaintenanceProjection => {
  const synced: MaintenanceValues = {
    maintenanceI: history.maintenanceI.averagePerCycle,
    maintenanceII: history.maintenanceII.averagePerCycle,
    maintenanceIII: history.maintenanceIII.averagePerCycle,
  }
  const planned: MaintenanceValues = { maintenanceI: 0, maintenanceII: 0, maintenanceIII: 0 }
  const additions = new Map<string, { count: number; unpaused: number; maintenance: BuildingDefinition['maintenance'] }>()

  for (const mod of modules) {
    const preset = mod.presets.find(preset => preset.id === mod.defaultPresetId) ?? null

    for (const line of buildModuleLines(mod, preset, modifiers).lines) {
      if (line.recipe.tracksPhysicalCapacity === false) continue
      const current = line.capacityPoolCurrentActiveBuildings ?? line.currentActiveBuildings ?? 0
      const active = line.capacityPoolActiveBuildings ?? line.activeBuildings
      const count = Math.max(0, Math.ceil(active) - Math.ceil(current))
      const built = line.capacityPoolBuiltBuildings ?? line.builtBuildings
      const unpaused = Math.min(count, Math.max(0, Math.ceil(built) - Math.ceil(current)))

      if (count === 0) continue
      const building = getRecipeBuildingData(line.recipe)

      // Synthetic operation ledgers (for example orbital upkeep) already carry
      // their own material costs and are not native physical buildings.
      if (!building?.prototypeId && !line.recipe.gameBuildingId) continue
      const changes = preset?.planMismatches?.filter(change => change.recipeId === line.recipe.id) ?? []

      if (changes.some(change => change.actions.some(action => action.type === 'upgrade'))
        && !changes.some(change => change.actions.some(action => action.type === 'build' || action.type === 'unpause'))) continue
      const key = line.capacityPoolId ?? `${mod.id}:${line.recipe.id}`
      const previous = additions.get(key)

      if (!previous || count > previous.count) additions.set(key, {
        count, unpaused, maintenance: building?.maintenance,
      })
    }
  }

  // Old compatible caches remain usable; absent rates are unknown, never zero.
  if (additions.size > 0 && (!configuration || [...additions.values()].some(entry => !entry.maintenance))) {
    return { synced, planned: null, projected: null }
  }
  for (const { count, unpaused, maintenance } of additions.values()) {
    if (!maintenance?.productId) continue
    const tier = tiersByProductId[maintenance.productId]

    // Existing paused machines already contribute idle maintenance to history.
    const increase = count - unpaused * (configuration?.idleMultiplier ?? 0)

    if (tier) planned[tier] += increase * maintenance.perMonth * (configuration?.consumptionMultiplier ?? 1)
  }
  return { synced, planned, projected: {
    maintenanceI: synced.maintenanceI + planned.maintenanceI,
    maintenanceII: synced.maintenanceII + planned.maintenanceII,
    maintenanceIII: synced.maintenanceIII + planned.maintenanceIII,
  } }
}
