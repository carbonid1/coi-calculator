import { type Preset } from '../../db/modules/modules'
import { createAtLeastBuildingActions, createAtMostBuildingActions } from '../../db/modules/plan-mismatch'
import { type Recipe } from '../../db/recipes'

export interface NuclearOperationTarget {
  name: string
  pluralName?: string
  recipeId: string
  target: number
}

export interface NuclearTurbinePlan {
  working: number
  standby: number
}

export const applyTurbineAutoBalance = (preset: Preset, targets: Readonly<Record<string, number>> = {}): Preset => {
  const autoBalanceOffBuildings = { ...preset.autoBalanceOffBuildings }
  const dataSources = { ...preset.dataSources }
  const planMismatches = [...(preset.planMismatches ?? [])]

  for (const member of turbineRowMembers.filter(member => member.recipeId.startsWith('turbine-'))) {
    const id = member.recipeId
    const requested = targets[id]

    if (requested != null && (!Number.isSafeInteger(requested) || requested < 0)) continue
    if (requested == null && !(id in preset.activeBuildings)) continue
    const active = preset.activeBuildings[id] ?? 0
    const current = preset.autoBalanceOffBuildings?.[id] ?? 0
    const running = preset.currentActiveBuildings?.[id] ?? active
    const ghostCapacity = Math.min(preset.constructionGhosts?.[id] ?? 0,
      Math.max(0, active - running))
    const paused = Math.max(0, (preset.builtBuildings?.[id] ?? running) - running)
    const unpaused = Math.min(paused, Math.max(0, active - running - ghostCapacity))
    const pausedOff = Math.min(paused, preset.pausedAutoBalanceOffBuildings?.[id] ?? 0)
    const minimumUnpausedOff = Math.max(0, unpaused - (paused - pausedOff))
    const maximumUnpausedOff = Math.min(unpaused, pausedOff)
    const retainedOff = Math.min(current, active)
    const unpausedOff = requested == null ? maximumUnpausedOff
      : Math.max(minimumUnpausedOff, Math.min(maximumUnpausedOff, requested - retainedOff))
    const currentInPlan = retainedOff + unpausedOff
    const target = requested == null ? currentInPlan : Math.min(active, requested)
    // Placed ghosts cover future configuration; compare their built settings
    // again after construction instead of treating the ghost as unplaced work.
    const changed = Math.max(0, currentInPlan - target, target - currentInPlan - ghostCapacity)

    autoBalanceOffBuildings[id] = target
    if (requested == null || changed === 0) continue
    const enabled = target < currentInPlan

    dataSources[id] = 'planned'
    const action = { type: 'configure' as const,
      label: `Set auto-balance ${enabled ? 'on' : 'off'} for ${changed} ${changed === 1 ? member.name : member.pluralName}` }
    const existingIndex = planMismatches.findIndex(mismatch => mismatch.recipeId === id)
    const existing = planMismatches[existingIndex]

    if (existing) {
      planMismatches[existingIndex] = {
        ...existing,
        currentLabel: `${existing.currentLabel ?? `${existing.current} running`} · ${current} auto-balance off`,
        targetLabel: `${existing.targetLabel ?? `${existing.target} running`} · ${target} auto-balance off`,
        actions: [...existing.actions, action],
      }
      continue
    }
    planMismatches.push({ recipeId: id, current, target, direction: enabled ? 'at-most' : 'at-least', format: 'configuration',
      currentLabel: `${current} auto-balance off`, targetLabel: `${target} auto-balance off`,
      actions: [action] })
  }
  return { ...preset, autoBalanceOffBuildings, dataSources,
    planMismatches: planMismatches.length > 0 ? planMismatches : undefined }
}

// The installed turbine/generator recipes form a 60 MW row: two complete
// SP/HP/LP trains with four Generator IIs. Standby rows stay outside dispatch.
const turbineRowMembers = [
  { recipeId: 'turbine-super', count: 2, name: 'Super-pressure turbine', pluralName: 'Super-pressure turbines' },
  { recipeId: 'turbine-high', count: 2, name: 'High-pressure turbine II', pluralName: 'High-pressure turbines II' },
  { recipeId: 'turbine-low', count: 2, name: 'Low-pressure turbine II', pluralName: 'Low-pressure turbines II' },
  { recipeId: 'power-generator-ii-nuclear', count: 4, name: 'Power generator II', pluralName: 'Power generators II' },
]

export const applyNuclearTurbinePlan = (preset: Preset, plan?: NuclearTurbinePlan): Preset => {
  if (!plan) return preset
  const activeBuildings = { ...preset.activeBuildings }
  const unplacedPlannedBuildings = { ...preset.unplacedPlannedBuildings }
  const dataSources = { ...preset.dataSources }
  const planMismatches = [...(preset.planMismatches ?? [])]

  for (const member of turbineRowMembers) {
    const id = member.recipeId
    const built = preset.builtBuildings?.[id] ?? 0
    const current = preset.currentActiveBuildings?.[id] ?? 0
    const ghosts = preset.constructionGhosts?.[id] ?? 0
    const working = plan.working * member.count
    const standby = plan.standby * member.count
    const total = working + standby
    const unplaced = Math.max(0, total - built - ghosts)
    const standbyToBuild = Math.min(standby, unplaced)
    const actions = [
      ...createAtLeastBuildingActions({ ...member, built, running: current, target: working - ghosts }),
      ...createAtMostBuildingActions({ ...member, running: current, target: working }),
      ...(standbyToBuild > 0 ? [{ type: 'build' as const,
        label: `Build ${standbyToBuild} ${standbyToBuild === 1 ? member.name : member.pluralName} for standby (leave paused)` }] : []),
    ]

    activeBuildings[id] = working
    // Physical construction includes the paused spare, while dispatch uses
    // only working inventory. Keep the synced built count unchanged.
    unplacedPlannedBuildings[id] = unplaced
    if (actions.length > 0 || unplaced > 0) dataSources[id] = 'planned'
    if (actions.length === 0) continue
    planMismatches.push({ recipeId: id, current, target: working,
      direction: current > working ? 'at-most' : 'at-least', format: 'count',
      currentLabel: `${built} built · ${current} running`,
      targetLabel: `≥${total} built · ${working} running · ≥${standby} paused`,
      actions })
  }

  return { ...preset, activeBuildings, unplacedPlannedBuildings, dataSources,
    planMismatches: planMismatches.length > 0 ? planMismatches : undefined }
}

/** Raise physical inventory across configured recipe groups without replacing synced counts. */
export const applyNuclearOperationTargets = (
  preset: Preset,
  recipes: readonly Recipe[],
  targets: readonly NuclearOperationTarget[],
  recipeIdsByPolicyId = new Map<string, string[]>(),
  unavailableRecipeIds = new Set<string>(),
): Preset => {
  const activeBuildings = { ...preset.activeBuildings }
  const capacityPools = { ...preset.capacityPools }
  const unplacedPlannedBuildings = { ...preset.unplacedPlannedBuildings }
  const dataSources = { ...preset.dataSources }
  const planMismatches = [...(preset.planMismatches ?? [])]
  const built = (id: string) => preset.builtBuildings?.[id] ?? 0
  const current = (id: string) => preset.currentActiveBuildings?.[id] ?? 0
  const ghosts = (id: string) => preset.constructionGhosts?.[id] ?? 0
  const active = (id: string) => activeBuildings[id] ?? 0
  const activate = (id: string, quantity: number) => {
    if (quantity <= 0) return
    const poolId = recipes.find(recipe => recipe.id === id)?.sharedCapacity?.id
    const pool = poolId ? capacityPools[poolId] : undefined
    const members = pool && poolId
      ? recipes.filter(recipe => recipe.sharedCapacity?.id === poolId).map(recipe => recipe.id)
      : [id]
    const projected = active(id) + quantity

    for (const memberId of members) {
      activeBuildings[memberId] = projected
      unplacedPlannedBuildings[memberId] = Math.max(0, projected - built(memberId) - ghosts(memberId))
      dataSources[memberId] = 'planned'
    }
    if (pool && poolId) {
      capacityPools[poolId] = { ...pool, active: projected,
        unplacedPlanned: Math.max(0, projected - pool.built - pool.constructionGhosts) }
    }
  }

  for (const target of targets) {
    if (unavailableRecipeIds.has(target.recipeId)) continue
    const ids = recipeIdsByPolicyId.get(target.recipeId) ?? [target.recipeId]
    const remaining = {
      needed: Math.max(0, target.target - ids.reduce((sum, id) => sum + active(id), 0)),
    }

    // Reuse paused buildings in any matching configuration before adding new ones.
    for (const id of ids) {
      const reused = Math.min(remaining.needed, Math.max(0, built(id) + ghosts(id) - active(id)))

      activate(id, reused)
      remaining.needed -= reused
    }
    const leadId = ids[0]

    if (leadId) activate(leadId, remaining.needed)
    for (const id of ids) {
      const actions = createAtLeastBuildingActions({
        built: built(id), running: current(id), target: active(id) - ghosts(id),
        name: target.name, pluralName: target.pluralName,
      })

      if (actions.length === 0) continue
      planMismatches.push({ recipeId: id, current: current(id), target: active(id),
        direction: 'at-least', format: 'count', actions })
    }
  }

  return { ...preset, activeBuildings, capacityPools, unplacedPlannedBuildings, dataSources,
    planMismatches: planMismatches.length > 0 ? planMismatches : undefined }
}
