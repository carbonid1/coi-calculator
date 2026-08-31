import { describe, expect, it } from 'vitest'

import { defaultArea } from '../../db/modules/default'
import { type Module } from '../../db/modules/modules'
import { recipes, type Recipe } from '../../db/recipes'
import {
  getClaimedTerrainResourceIds,
  transferTerrainMineOwnership,
} from './terrain-mine-ownership'

const createLiveIronMine = (): Module => {
  const crusher = recipes.find(recipe => recipe.id === 'crusher-large-iron')
  const source: Recipe = {
    id: 'live-area-99:terrain-source:ironOre',
    name: 'Iron Ore terrain extraction',
    building: 'Terrain extraction',
    group: 'source',
    inputs: [],
    outputs: [{ resourceId: 'ironOre', quantity: 0 }],
    sourceMode: 'module-demand',
    sourceKind: 'terrain-mine',
  }

  if (!crusher) throw new Error('Missing Iron crusher fixture')

  return {
    id: 'live-area-99',
    name: 'New iron mine',
    description: '',
    includedInFactoryTotals: true,
    builtBuildings: { 'live-area-99:terrain-source:ironOre': 1 },
    recipes: [
      source,
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

  it('retires only the matching Default first-stage crusher', () => {
    const [updatedDefault] = transferTerrainMineOwnership(
      [defaultArea],
      [createLiveIronMine()],
    )

    expect(updatedDefault?.builtBuildings).not.toHaveProperty('crusher-large-iron')
    expect(updatedDefault?.builtBuildings).toHaveProperty('crusher-large-copper', 1)
    expect(updatedDefault?.presets[0]?.builtBuildings)
      .not.toHaveProperty('crusher-large-iron')
  })

  it('keeps the Default crusher when a live sorter exports raw material', () => {
    const rawIronMine = createLiveIronMine()
    const source = rawIronMine.recipes?.find(recipe => recipe.sourceKind === 'terrain-mine')

    if (!source) throw new Error('Missing live Iron source')

    const [updatedDefault] = transferTerrainMineOwnership(
      [defaultArea],
      [{ ...rawIronMine, recipes: [source] }],
    )

    expect(updatedDefault?.builtBuildings).toHaveProperty('crusher-large-iron', 1)
  })

  it('keeps the Default crusher when its live replacement is outside Factory Total', () => {
    const liveIronMine = createLiveIronMine()
    const source = liveIronMine.recipes?.find(recipe => recipe.sourceKind === 'terrain-mine')
    const crusher = liveIronMine.recipes?.find(recipe => recipe.id.includes('CrusherLarge'))

    if (!source || !crusher) throw new Error('Missing live Iron fixtures')

    const [updatedDefault] = transferTerrainMineOwnership(
      [defaultArea],
      [
        { ...liveIronMine, recipes: [source] },
        {
          ...liveIronMine,
          id: 'live-area-100',
          name: 'Detached crushers',
          includedInFactoryTotals: false,
          recipes: [crusher],
        },
      ],
    )

    expect(updatedDefault?.builtBuildings).toHaveProperty('crusher-large-iron', 1)
  })
})
