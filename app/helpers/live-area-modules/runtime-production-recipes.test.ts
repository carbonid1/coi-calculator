import { expect, it, vi } from 'vitest'

import type * as RecipeDefinitions from '../../db/recipes'
import { type SyncedAreaEntity, type SyncedAreaRecipe } from '../../game-state'
import { buildModuleLines } from '../../test-fixtures/build-module-lines'
import { createLiveAreaModules } from './live-area-modules'

vi.mock('../../db/recipes', async importOriginal => ({
  ...await importOriginal<typeof RecipeDefinitions>(), recipes: [],
}))

const zone = { id: 17, name: 'Current factory' }
const recipe: SyncedAreaRecipe = {
  id: 'BauxiteDigestion', name: 'Current game recipe', assigned: true, durationSeconds: 30,
  electricityMultiplier: 1.25,
  inputs: [{ productId: 'Product_BauxitePowder', name: 'Bauxite powder', quantity: 7 }],
  outputs: [{ productId: 'Product_HydratedAlumina', name: 'Hydrated alumina', quantity: 3 }],
}
const entity = (id: number, running = true): SyncedAreaEntity => ({
  entityId: id, prototypeId: 'ChemicalPlant2', prototypeName: 'Chemical plant II',
  constructed: true, constructionState: 'Constructed', running, tile: { x: id, y: 0 },
  zones: [zone], recipes: [recipe], availableRecipeCount: 2,
})

it('uses live quantities and duration with an empty static catalog, retaining allocation policy', () => {
  const [module] = createLiveAreaModules([zone], [entity(1)])

  if (!module) throw new Error('Missing live module')
  const [line] = buildModuleLines(module, module.presets[0]).lines

  expect(line?.recipe).toMatchObject({
    name: 'Current game recipe', building: 'Chemical plant II', cycleDurationSeconds: 30,
    electricityMultiplier: 1.25,
    inputs: [{ resourceId: 'bauxitePowder', quantity: 14 }],
    outputs: [{ resourceId: 'hydratedAlumina', quantity: 6 }],
    balanceBy: 'output', balanceOutputIds: ['hydratedAlumina'],
  })
  expect(module.liveArea?.issues).toEqual([])
})

it('retains paused inventory, construction and shared capacity without static recipe definitions', () => {
  const configured = (source: SyncedAreaEntity) => ({
    ...source, recipes: [recipe, { ...recipe, id: 'AlternativeDigestion', name: 'Alternative' }],
  })
  const ghost: SyncedAreaEntity = {
    ...entity(3, false), constructed: false, constructionState: 'NotStarted',
  }
  const [module] = createLiveAreaModules([zone], [
    configured(entity(1)), configured(entity(2, false)), configured(ghost),
  ])

  if (!module) throw new Error('Missing live module')
  const lines = buildModuleLines(module, module.presets[0]).lines

  expect(lines).toHaveLength(2)
  expect(new Set(lines.map(line => line.capacityPoolId)).size).toBe(1)
  for (const line of lines) {
    expect(line).toMatchObject({
      builtBuildings: 2, currentActiveBuildings: 1, activeBuildings: 2,
      constructionGhosts: 1, capacityPoolBuiltBuildings: 2, capacityPoolActiveBuildings: 2,
    })
  }
})
