import { describe, expect, it } from 'vitest'

import { type CropFarmGroup, type CurrentCropFarmEntity } from '../../db/crop-farming'
import { allocateCropFarmPlan } from './crop-farm-plan'

const group: CropFarmGroup = {
  id: 'corn-wheat', name: 'Corn / Wheat', tierId: 'greenhouseII', farmCount: 2,
  schedule: ['corn', 'wheat'],
  fertilizer: { id: 'fertilizerII', targetFertilityPercent: 140 },
}
const farm = (entityId: number, overrides: Partial<CurrentCropFarmEntity> = {}): CurrentCropFarmEntity => ({
  entityId, tierId: 'greenhouseII', running: true, schedule: ['corn', 'wheat'],
  fertilizerId: 'fertilizerII', fertilityTargetPercent: 140, ...overrides,
})

describe('crop rotation plans', () => {
  it('unpauses matching inventory and reuses existing farms without inventing construction', () => {
    const entities = [farm(1), farm(2, { running: false, schedule: [] }), farm(3, { running: false })]
    const { inventories, remaining } = allocateCropFarmPlan('farms', entities, [group])

    expect(inventories[0]).toMatchObject({
      built: 2, running: 2, currentActive: 1, source: 'planned',
      mismatch: { current: 1, target: 2, actions: [{ type: 'unpause', label: 'Unpause 1 Greenhouse II' }] },
    })
    expect(remaining.map(entity => entity.entityId)).toEqual([2])
    expect(entities[2].running).toBe(false)
  })

  it('reserves all matching groups before assigning farms to other rotations', () => {
    const vegetableGroup: CropFarmGroup = { ...group, id: 'corn-vegetables', schedule: ['corn', 'vegetables'], farmCount: 1 }
    const plan = allocateCropFarmPlan('farms', [
      farm(1, { schedule: vegetableGroup.schedule }),
      farm(2, { running: false, schedule: [] }),
    ], [{ ...group, farmCount: 1 }, vegetableGroup])

    expect(plan.inventories[0]).toMatchObject({ built: 1, currentActive: 0, source: 'planned' })
    expect(plan.inventories[1]).toMatchObject({ built: 1, currentActive: 1, source: 'synced', mismatch: undefined })
    expect(plan.remaining).toEqual([])
  })

  it('recognizes completed rotations regardless of starting slot or repeated complete cycles', () => {
    const plan = allocateCropFarmPlan('farms', [
      farm(1, { schedule: ['wheat', 'corn', 'wheat', 'corn'] }), farm(2),
    ], [group])

    expect(plan.inventories[0]).toMatchObject({ source: 'synced', mismatch: undefined })
  })

  it('counts construction only after using compatible built inventory', () => {
    const plan = allocateCropFarmPlan('farms', [farm(1, { schedule: ['potato', 'corn'] })], [group])

    expect(plan.inventories[0]).toMatchObject({ built: 1, running: 2 })
    expect(plan.inventories[0].mismatch?.actions).toEqual([
      { type: 'build', label: 'Build 1 Greenhouse II' },
      { type: 'configure', label: 'Set 2 to Corn / Wheat · 140% fertility' },
    ])
  })

  it('uses paused farms before sharing each same-tier construction ghost once', () => {
    const plan = allocateCropFarmPlan('farms', [farm(1, { running: false })], [
      { ...group, farmCount: 1 },
      { ...group, id: 'vegetables', schedule: ['corn', 'vegetables'], farmCount: 1 },
      { ...group, id: 'potato', schedule: ['corn', 'potato'], farmCount: 1 },
    ], { greenhouseII: 1, greenhouse: 2 })

    expect(plan.inventories.map(({ built, constructionGhosts }) => ({ built, constructionGhosts })))
      .toEqual([{ built: 1, constructionGhosts: 0 }, { built: 0, constructionGhosts: 1 },
        { built: 0, constructionGhosts: 0 }])
    expect(plan.inventories[0].mismatch?.actions).toEqual([
      { type: 'unpause', label: 'Unpause 1 Greenhouse II' },
    ])
    expect(plan.inventories[1].mismatch?.actions).toEqual([
      { type: 'configure', label: 'Set 1 to Corn / Vegetables · 140% fertility' },
    ])
    expect(plan.inventories[2].mismatch?.actions).toEqual([
      { type: 'build', label: 'Build 1 Greenhouse II' },
      { type: 'configure', label: 'Set 1 to Corn / Potato · 140% fertility' },
    ])
  })

})
