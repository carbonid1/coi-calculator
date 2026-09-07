import { expect, it } from 'vitest'

import { recipes, type Recipe } from '../../db/recipes'
import { calculateNet, type ProductionLine } from './calculate'

const coolingTower = recipes.find(recipe => recipe.id === 'cooling-tower-large-depleted')!
const liquidDump = recipes.find(recipe => recipe.id === 'nuclear-liquid-dump-water')!
const line = (
  recipe: Recipe,
  moduleId: string,
  operatingMode: ProductionLine['operatingMode'] = 'balanced',
  activeBuildings = 1,
): ProductionLine => ({ recipe, moduleId, operatingMode, activeBuildings, builtBuildings: activeBuildings, speedLevel: 1 })
const steamProducer = (id: string, quantity: number): Recipe => ({
  id, name: id, building: 'Test producer', group: 'production', inputs: [],
  outputs: [{ resourceId: 'steamDepleted', quantity }],
})

it.each([
  { towers: 2, remoteFirst: true },
  { towers: 2, remoteFirst: false },
  { towers: 1, remoteFirst: true },
])('recovers steam locally before sharing Water and dumping excess: %j', ({ towers, remoteFirst }) => {
  // Live recipes get their input scope from the resource supply policy.
  const defaultTower = line({
    ...coolingTower,
    id: 'default-cooling',
    sinkScope: undefined,
    balanceInputScope: 'module',
    balanceInputIds: ['steamDepleted'],
  }, 'default')
  const nuclearTower = line(coolingTower, 'nuclear', 'balanced', towers)
  const waterDemand: Recipe = {
    id: 'water-demand', name: 'Water demand', building: 'Test consumer', group: 'production',
    inputs: [{ resourceId: 'water', quantity: 20 }], outputs: [],
  }
  const result = calculateNet([
    line(steamProducer('nuclear-steam', 120), 'nuclear', 'fixed'),
    line(steamProducer('default-steam', 4), 'default', 'fixed'),
    line(waterDemand, 'default', 'fixed'),
    ...(remoteFirst ? [defaultTower, nuclearTower] : [nuclearTower, defaultTower]),
    line(liquidDump, 'nuclear'),
  ])
  const localSteamRecovered = Math.min(120, 96 * towers)

  expect(result.sinkResults.find(row => row.recipe.id === defaultTower.recipe.id)?.actualInputs)
    .toEqual([{ resourceId: 'steamDepleted', quantity: 4 }])
  expect(result.sinkResults.find(row => row.recipe.id === coolingTower.id)?.actualInputs)
    .toEqual([{ resourceId: 'steamDepleted', quantity: localSteamRecovered }])
  expect(result.sinkResults.find(row => row.recipe.id === liquidDump.id)?.actualInputs[0]?.quantity)
    .toBeCloseTo((localSteamRecovered + 4) * 0.75 - 20)
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'water')?.net).toBeCloseTo(0)
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'steamDepleted')?.net)
    .toBeCloseTo(120 - localSteamRecovered)
})
