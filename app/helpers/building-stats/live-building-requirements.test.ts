import { expect, it } from 'vitest'

import { type BuildingDefinition } from '../../building-state'
import { getBuildingData } from '../../db/buildings'
import { type Module } from '../../db/modules/modules'
import { type Recipe } from '../../db/recipes'
import { buildModuleLines } from '../../test-fixtures/build-module-lines'
import { calculateNet } from '../calculate/calculate'
import { calculateBuildingStats } from './building-stats'

const definition: BuildingDefinition = {
  id: 'Machine', name: 'Localized machine', workers: 12, electricityKw: 300, computingTflops: 24, unityPerCycle: 0,
}
const recipe: Recipe = {
  id: 'salt', gameBuildingId: 'Machine', building: 'Calculator label', name: 'Salt', group: 'production', balanceBy: 'output',
  inputs: [], outputs: [{ resourceId: 'salt', quantity: 1 }],
}
const moduleFor = (recipes: Recipe[]): Module => ({
  id: 'factory', name: 'Factory', description: '', recipes,
  builtBuildings: Object.fromEntries(recipes.map(recipe => [recipe.id, 1])),
  presets: [], defaultPresetId: null,
})

it('uses prototype identity and follows changed game requirements without leaking between snapshots', () => {
  expect(getBuildingData('Calculator label', [definition], 'Machine')).toMatchObject({ workers: 12, computingTflops: 24 })
  expect(getBuildingData('Calculator label', [{ ...definition, workers: 99 }], 'Machine')?.workers).toBe(99)
  expect(getBuildingData('Calculator label', [definition], 'Machine')?.workers).toBe(12)
  expect(getBuildingData('Localized machine', [definition], 'Unknown')).toBeUndefined()
})

it('distinguishes zero requirements from missing metadata and never substitutes an unknown prototype', () => {
  expect(getBuildingData('Calculator label', [{ ...definition, workers: 0, electricityKw: 0 }], 'Machine'))
    .toMatchObject({ workers: 0, electricityKw: 0 })
  expect(() => buildModuleLines(moduleFor([recipe]), null, { buildingDefinitions: [] }))
    .toThrow('Building requirements unavailable for Machine')
  expect(() => buildModuleLines(moduleFor([{ ...recipe, gameBuildingId: undefined }]), null, { buildingDefinitions: [] }))
    .toThrow('Building requirements unavailable for Calculator label')
})

it('counts physical workers once and applies live recipe power multipliers while preserving computing packing', () => {
  const recipes: Recipe[] = [
    { ...recipe, electricityMultiplier: 2, sharedCapacity: { id: 'pool', priority: 0 } },
    { ...recipe, id: 'water', outputs: [{ resourceId: 'water', quantity: 1 }], electricityMultiplier: 0.5,
      sharedCapacity: { id: 'pool', priority: 1 } },
  ]
  const { lines } = buildModuleLines(moduleFor(recipes), null, { buildingDefinitions: [definition] })
  const result = calculateNet(lines, {}, 90, {}, { salt: 0.25, water: 0.75 })

  expect(calculateBuildingStats(lines, result)).toEqual({ workers: 12, electricityKw: 262.5, computingTflops: 24 })
})

it('keeps computing reservations separate for different prototypes sharing a display name', () => {
  const second = { ...definition, id: 'OtherMachine', computingTflops: 8 }
  const recipes: Recipe[] = [
    recipe,
    { ...recipe, id: 'water', gameBuildingId: 'OtherMachine', outputs: [{ resourceId: 'water', quantity: 1 }] },
  ]
  const { lines } = buildModuleLines(moduleFor(recipes), null, { buildingDefinitions: [definition, second] })
  const result = calculateNet(lines, {}, 90, {}, { salt: 0.5, water: 0.5 })

  expect(calculateBuildingStats(lines, result).computingTflops).toBe(32)
})
