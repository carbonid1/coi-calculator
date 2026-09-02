import { describe, expect, it } from 'vitest'

import { DEFAULT_MODULE_ID } from '../db/modules/default'
import { type Module } from '../db/modules/modules'
import { getModuleTabGroups } from './module-tab-order'

const createModule = ({
  gameSynced,
  id,
  name = id,
}: {
  gameSynced: boolean
  id: string
  name?: string
}): Module => ({
  id,
  name,
  description: '',
  gameSynced,
  builtBuildings: {},
  presets: [],
})

describe('module tab order', () => {
  it('pins Default first in the synced group by stable ID, not display name', () => {
    const chickenFarms = createModule({ id: 'chicken-farms', gameSynced: true })
    const defaultArea = createModule({
      id: DEFAULT_MODULE_ID,
      name: 'Localized default area',
      gameSynced: true,
    })
    const forestry = createModule({ id: 'live-area-22', gameSynced: true })
    const preset = createModule({ id: 'preset', gameSynced: false })

    const groups = getModuleTabGroups([
      chickenFarms,
      preset,
      forestry,
      defaultArea,
    ])

    expect(groups.syncedModules.map(candidate => candidate.id)).toEqual([
      DEFAULT_MODULE_ID,
      'chicken-farms',
      'live-area-22',
    ])
    expect(groups.presetModules.map(candidate => candidate.id)).toEqual(['preset'])
  })

  it('keeps a view module out of the synced group even when it is Default', () => {
    const defaultArea = createModule({ id: DEFAULT_MODULE_ID, gameSynced: true })
    const groups = getModuleTabGroups(
      [defaultArea],
      new Set([DEFAULT_MODULE_ID]),
    )

    expect(groups.viewModules).toEqual([defaultArea])
    expect(groups.syncedModules).toEqual([])
  })
})
