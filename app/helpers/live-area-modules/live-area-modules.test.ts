import { describe, expect, it } from 'vitest'

import { type SyncedAreaEntity } from '../../game-state'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { calculateNet } from '../calculate/calculate'
import { createLiveAreaModules } from './live-area-modules'

const recipe = {
  id: 'AirSeparation',
  name: 'Air Separation',
  durationSeconds: 20,
  assigned: true,
  inputs: [],
  outputs: [
    { productId: 'Product_Oxygen', name: 'Oxygen', quantity: 2 },
    { productId: 'Product_Nitrogen', name: 'Nitrogen', quantity: 4 },
  ],
}

const entity = (
  entityId: number,
  constructed: boolean,
  running: boolean,
  recipes = [recipe],
): SyncedAreaEntity => ({
  entityId,
  prototypeId: 'AirSeparator',
  prototypeName: 'Air Separator',
  constructionState: constructed ? 'Constructed' : 'NotStarted',
  constructed,
  running,
  tile: { x: entityId, y: 10 },
  zones: [{ id: 16, name: 'Test' }],
  recipes,
})

describe('createLiveAreaModules', () => {
  it('creates a planning-only tab and includes ghosts in projected capacity', () => {
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [entity(1, true, true), entity(2, false, false)],
      [],
    )
    const liveRecipe = module?.recipes?.[0]

    expect(module).toMatchObject({
      id: 'live-area-16',
      name: 'Test',
      includedInFactoryTotals: false,
      liveArea: {
        trackedBuildings: 2,
        constructedBuildings: 1,
        plannedBuildings: 1,
      },
    })
    expect(liveRecipe).toMatchObject({
      building: 'Air Separator',
      outputs: [
        { resourceId: 'oxygen', quantity: 6 },
        { resourceId: 'nitrogen', quantity: 12 },
      ],
    })
    expect(module?.presets[0]).toMatchObject({
      activeBuildings: { [liveRecipe?.id ?? 'missing']: 2 },
      builtBuildings: { [liveRecipe?.id ?? 'missing']: 1 },
      plannedBuildings: { [liveRecipe?.id ?? 'missing']: 1 },
      dataSources: { [liveRecipe?.id ?? 'missing']: 'planned' },
    })
  })

  it('creates an empty tab as soon as a new named area exists', () => {
    const [module] = createLiveAreaModules([{ id: 16, name: 'Test' }], [], [])

    expect(module).toMatchObject({
      name: 'Test',
      recipes: [],
      liveArea: { trackedBuildings: 0, plannedBuildings: 0 },
    })
  })

  it('normalizes fractional game recipe durations without truncating them', () => {
    const fractionalRecipe = {
      ...recipe,
      durationSeconds: 7.5,
      outputs: [{ productId: 'Product_Oxygen', name: 'Oxygen', quantity: 6 }],
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [entity(1, false, false, [fractionalRecipe])],
      [],
    )

    expect(module?.recipes?.[0]?.outputs).toEqual([
      { resourceId: 'oxygen', quantity: 48 },
    ])
  })

  it('does not duplicate a named area already represented by a configured module', () => {
    const modules = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [],
      [{
        id: 'test',
        name: 'Test',
        description: '',
        builtBuildings: {},
        presets: [],
        defaultPresetId: null,
      }],
    )

    expect(modules).toEqual([])
  })

  it('keeps multi-recipe ghosts visible as a configuration issue', () => {
    const alternative = { ...recipe, id: 'AirSeparationAlternative', assigned: false }
    const ambiguous = entity(2, false, false, [
      { ...recipe, assigned: false },
      alternative,
    ])
    const [module] = createLiveAreaModules([{ id: 16, name: 'Test' }], [ambiguous], [])

    expect(module?.recipes).toEqual([])
    expect(module?.liveArea?.issues).toEqual([
      expect.objectContaining({ building: 'Air Separator', count: 1 }),
    ])
  })

  it('retains the capacity of separate machines assigned to different recipes', () => {
    const oxygenRecipe = { ...recipe, assigned: true }
    const nitrogenRecipe = {
      ...recipe,
      id: 'NitrogenSeparation',
      name: 'Nitrogen Separation',
      assigned: true,
      outputs: [{ productId: 'Product_Nitrogen', name: 'Nitrogen', quantity: 4 }],
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [
        entity(1, true, true, [oxygenRecipe]),
        entity(2, true, true, [nitrogenRecipe]),
      ],
      [],
    )

    expect(module?.presets[0]?.capacityPools).toEqual({
      AirSeparator: { active: 2, built: 2, planned: 0 },
    })

    if (!module) throw new Error('Live area module was not created')

    const { lines } = buildModuleLines(module, module.presets[0] ?? null)
    const result = calculateNet(lines)

    expect(result.regularResults).toHaveLength(2)
    expect(result.regularResults.map(item => item.supplyRatio)).toEqual([1, 1])
  })

  it('preserves the Shredder recycling exception', () => {
    const shredding = {
      id: 'ShreddingRetiredWaste',
      name: 'Shredding Retired Waste',
      durationSeconds: 60,
      assigned: true,
      inputs: [{ productId: 'Product_RetiredWaste', name: 'Retired Waste', quantity: 6 }],
      outputs: [{ productId: 'Product_Recyclables', name: 'Recyclables', quantity: 6 }],
    }
    const shredder = {
      ...entity(3, true, true, [shredding]),
      prototypeId: 'Shredder',
      prototypeName: 'Shredder',
    }
    const [module] = createLiveAreaModules([{ id: 16, name: 'Test' }], [shredder], [])

    expect(module?.recipes?.[0]?.appliesRecyclingEfficiency).toBe(false)
  })

  it('counts every building affected by an unsupported product', () => {
    const unsupported = {
      ...recipe,
      inputs: [{ productId: 'Product_Unobtainium', name: 'Unobtainium', quantity: 1 }],
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [entity(4, true, true, [unsupported]), entity(5, false, false, [unsupported])],
      [],
    )

    expect(module?.liveArea?.issues).toEqual([
      expect.objectContaining({ building: 'Air Separator', count: 2 }),
    ])
  })
})
