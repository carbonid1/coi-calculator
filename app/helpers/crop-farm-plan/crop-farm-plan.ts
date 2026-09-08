import { type ValueSource } from '../../data-source'
import { crops, cropFarmTiers, type CropFarmGroup, type CropFarmTierId, type CurrentCropFarmEntity } from '../../db/crop-farming'
import { type PlanMismatch } from '../../db/modules/modules'

const rotationKey = (schedule: readonly string[]) => {
  // Starting slots and repetitions of the same complete rotation are equivalent.
  const length = Array.from({ length: schedule.length }, (_, offset) => offset + 1)
    .find(length => (
      schedule.length % length === 0
      && schedule.every((crop, i) => crop === schedule[i % length])
    )) ?? schedule.length
  const cycle = schedule.slice(0, length)

  return cycle.map((_, index) => [...cycle.slice(index), ...cycle.slice(0, index)].join('/'))
    .toSorted()[0] ?? ''
}

const matches = (farm: CurrentCropFarmEntity, group: CropFarmGroup) => (
  farm.tierId === group.tierId
  && rotationKey(farm.schedule) === rotationKey(group.schedule)
  && farm.fertilityTargetPercent === (group.fertilizer?.targetFertilityPercent ?? 0)
  && (farm.fertilizerId ?? null) === (group.fertilizer?.id ?? null)
)

export interface PlannedCropFarmInventory {
  group: CropFarmGroup
  built: number
  running: number
  currentActive: number
  constructionGhosts: number
  source: ValueSource
  mismatch?: PlanMismatch
}

/** Assign each physical farm once, retaining matching rotations before reconfiguring spares. */
export const allocateCropFarmPlan = (
  moduleId: string,
  entities: readonly CurrentCropFarmEntity[],
  groups: readonly CropFarmGroup[],
  constructionGhosts: Partial<Record<CropFarmTierId, number>> = {},
) => {
  const availableGhosts = { ...constructionGhosts }
  const available = new Map(entities.toSorted((a, b) => (
    Number(b.running) - Number(a.running) || a.entityId - b.entityId
  )).map(entity => [entity.entityId, entity]))
  const assignments = groups.map(group => {
    const assigned = [...available.values()].filter(farm => matches(farm, group))
      .slice(0, group.farmCount)

    for (const farm of assigned) available.delete(farm.entityId)

    return { group, assigned }
  })

  for (const { group, assigned } of assignments) {
    for (const farm of available.values()) {
      if (assigned.length >= group.farmCount) break
      if (farm.tierId !== group.tierId) continue
      assigned.push(farm)
      available.delete(farm.entityId)
    }
  }

  const inventories: PlannedCropFarmInventory[] = assignments.map(({ group, assigned }) => {
    const recipeId = `${moduleId}:crop-farm-plan:${group.id}`
    const matching = assigned.filter(farm => matches(farm, group) && farm.running).length
    const configure = assigned.filter(farm => !matches(farm, group)).length
    const unpause = assigned.filter(farm => !farm.running).length
    const ghosts = Math.min(group.farmCount - assigned.length, availableGhosts[group.tierId] ?? 0)

    availableGhosts[group.tierId] = (availableGhosts[group.tierId] ?? 0) - ghosts
    const build = group.farmCount - assigned.length - ghosts
    const building = cropFarmTiers[group.tierId].name
    const rotation = group.schedule.map(id => crops[id].name).join(' / ')
    const settings = group.fertilizer
      ? `${group.fertilizer.targetFertilityPercent}% fertility`
      : 'no fertilizer'
    const actions: PlanMismatch['actions'] = [
      ...(unpause ? [{ type: 'unpause' as const, label: `Unpause ${unpause} ${building}` }] : []),
      ...(build ? [{ type: 'build' as const, label: `Build ${build} ${building}` }] : []),
      ...(configure || ghosts || build ? [{
        type: 'configure' as const,
        label: `Set ${configure + ghosts + build} to ${rotation} · ${settings}`,
      }] : []),
    ]

    return {
      group: { ...group, id: recipeId },
      built: assigned.length,
      running: group.farmCount,
      currentActive: assigned.filter(farm => farm.running).length,
      constructionGhosts: ghosts,
      source: matching === group.farmCount ? 'synced' : 'planned',
      mismatch: actions.length ? {
        recipeId, current: matching, target: group.farmCount,
        direction: 'at-least', format: 'configuration', actions,
      } : undefined,
    }
  })

  return { inventories, remaining: [...available.values()] }
}
