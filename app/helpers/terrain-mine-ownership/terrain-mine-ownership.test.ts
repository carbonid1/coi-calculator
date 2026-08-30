import { describe, expect, it } from 'vitest'

import { defaultArea } from '../../db/modules/default'
import { mines } from '../../db/modules/mines'
import { type Module } from '../../db/modules/modules'
import { recipes } from '../../db/recipes'
import {
  getClaimedTerrainResourceIds,
  transferTerrainMineOwnership,
} from './terrain-mine-ownership'

const createLiveIronMine = (): Module => {
  const source = recipes.find(recipe => recipe.id === 'iron-map-mine')
  const crusher = recipes.find(recipe => recipe.id === 'crusher-large-iron')

  if (!source || !crusher) throw new Error('Missing Iron mine fixtures')

  return {
    id: 'live-area-99',
    name: 'New iron mine',
    description: '',
    includedInFactoryTotals: true,
    builtBuildings: { 'live-area-99:terrain-source:ironOre': 1 },
    recipes: [
      {
        ...source,
        id: 'live-area-99:terrain-source:ironOre',
        sourceMode: 'module-demand',
      },
      {
        ...crusher,
        id: 'live-area-99:CrusherLarge:IronOreCrushing',
        building: 'Crusher (large)',
      },
    ],
    presets: [{
      id: 'live',
      name: 'Live area',
      description: '',
      activeBuildings: { 'live-area-99:terrain-source:ironOre': 1 },
      fixed: [],
    }],
    defaultPresetId: 'live',
  }
}

describe('terrain mine ownership', () => {
  it('derives the claimed resource from the inferred live source', () => {
    expect([...getClaimedTerrainResourceIds([createLiveIronMine()])])
      .toEqual(['ironOre'])
  })

  it('retires only the matching legacy source and first-stage crusher', () => {
    const [updatedDefault, updatedMines] = transferTerrainMineOwnership(
      [defaultArea, mines],
      [createLiveIronMine()],
    )

    expect(updatedMines?.builtBuildings).not.toHaveProperty('iron-map-mine')
    expect(updatedMines?.builtBuildings).toHaveProperty('copper-map-mine', 1)
    expect(updatedDefault?.builtBuildings).not.toHaveProperty('crusher-large-iron')
    expect(updatedDefault?.builtBuildings).toHaveProperty('crusher-large-copper', 1)
    expect(updatedDefault?.presets[0]?.builtBuildings)
      .not.toHaveProperty('crusher-large-iron')
  })

  it('keeps the Default crusher when a live sorter exports raw material', () => {
    const rawIronMine = createLiveIronMine()
    const source = rawIronMine.recipes?.find(recipe => recipe.sourceKind === 'map-mine')

    if (!source) throw new Error('Missing live Iron source')

    const [updatedDefault, updatedMines] = transferTerrainMineOwnership(
      [defaultArea, mines],
      [{ ...rawIronMine, recipes: [source] }],
    )

    expect(updatedMines?.builtBuildings).not.toHaveProperty('iron-map-mine')
    expect(updatedDefault?.builtBuildings).toHaveProperty('crusher-large-iron', 1)
  })
})
