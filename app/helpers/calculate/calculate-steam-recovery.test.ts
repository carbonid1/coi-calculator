import { expect, it } from 'vitest'

import { type Module } from '../../db/modules/modules'
import { applyWasteRecoveryPlan } from '../../db/modules/waste-recovery'
import { type Recipe } from '../../db/recipes'
import { testPlanningDefinitions } from '../../test-fixtures/recorded-game-data'
import { testRecipes as recipes } from '../../test-fixtures/solver-recipes'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
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
  ...[0, 144, 228, 400].flatMap(waste => [false, true].map(fallback => ({ waste, fallback, lateSourWater: false }))),
  { waste: 228, fallback: true, lateSourWater: true },
])(
  'burns only available Waste, serving production before desalination (%j)', ({ waste, fallback, lateSourWater }) => {
  const base: Module = {
    id: 'general', name: 'Default', description: '', defaultPresetId: 'current',
    builtBuildings: { supply: 1, paper: 1, demand: 1 },
    recipes: [
      { id: 'supply', name: 'Supply', building: 'Test', group: 'production', inputs: [],
        outputs: [{ resourceId: 'waste', quantity: waste }, { resourceId: 'water', quantity: 400 },
          { resourceId: 'limestone', quantity: 20 },
          { resourceId: 'fuelGas', quantity: 100 }] },
      { id: 'paper', name: 'Paper', building: 'Test', group: 'production', balanceBy: 'output',
        allocation: fallback ? 'fallback' : undefined, allocationPriority: 40,
        inputs: [{ resourceId: 'steamHigh', quantity: 12 }], outputs: [{ resourceId: 'paper', quantity: 12 }] },
      { id: 'demand', name: 'Demand', building: 'Test', group: 'production',
        inputs: [{ resourceId: 'paper', quantity: 12 }], outputs: [] },
    ],
    presets: [{ id: 'current', name: '', description: '',
      activeBuildings: { supply: 1, paper: 1, demand: 1 }, fixed: ['supply', 'demand'] }],
  }
  const planned = applyWasteRecoveryPlan(testPlanningDefinitions, base)
  const { lines } = buildModuleLines(planned, planned.presets[0], { planningDefinitions: testPlanningDefinitions })
  const lateRecovery = lateSourWater ? [
    line({
      id: 'late-sour-water', name: 'Late byproduct', building: 'Test', group: 'production',
      allocation: 'surplus', balanceBy: 'input',
      inputs: [], outputs: [{ resourceId: 'sourWater', quantity: 36 }],
    }, 'general'),
    line({
      id: 'stripper', name: 'Stripper', building: 'Test', group: 'waste',
      allocation: 'fallback', allocationPriority: 40, balanceBy: 'input',
      balanceInputIds: ['sourWater', 'steamHigh'], moduleInputIds: ['steamHigh'],
      inputs: [{ resourceId: 'sourWater', quantity: 36 }, { resourceId: 'steamHigh', quantity: 3 }],
      outputs: [],
    }, 'general'),
  ] : []
  const result = calculateNet([
    line({ ...steamProducer('remote-steam', 200), outputs: [
      { resourceId: 'steamHigh', quantity: 200 }, { resourceId: 'exhaust', quantity: 200 },
      { resourceId: 'carbonDioxide', quantity: 150 },
    ] }, 'nuclear', 'fixed'),
    ...lines.toReversed(),
    ...lateRecovery,
  ])
  const burner = result.regularResults.find(row => row.recipe.gameBuildingId === 'IncinerationPlant')!
  const desalination = result.regularResults.find(row => row.recipe.gameRecipeId === 'DesalinationFromHP')!
  const production = result.regularResults.find(row => row.recipe.id === 'paper')!
  const scrubber = result.regularResults.find(row => row.recipe.gameRecipeId === 'ExhaustFilteringLime')!
  const graphite = result.regularResults.find(row => row.recipe.gameRecipeId === 'GraphiteProductionCo2')!
  const consumed = (row: typeof burner, id: string) => row.actualInputs.find(input => input.resourceId === id)?.quantity ?? 0
  const burned = Math.min(waste, 288)
  const localSteam = burned / 8
  const steamForStripping = lateSourWater ? 3 : 0

  expect(consumed(burner, 'waste')).toBeCloseTo(burned)
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'waste')?.net).toBeCloseTo(waste - burned)
  expect(consumed(production, 'steamHigh')).toBeCloseTo(Math.min(12, localSteam))
  if (lateSourWater) expect(result.allResourceFlows.find(flow => flow.resourceId === 'sourWater')?.net).toBeCloseTo(0, 6)
  expect(consumed(desalination, 'steamHigh')).toBeCloseTo(Math.min(24, Math.max(0, localSteam - 12 - steamForStripping)))
  expect(consumed(desalination, 'seaWater')).toBeCloseTo(consumed(desalination, 'steamHigh') * 9)
  expect(consumed(scrubber, 'exhaust')).toBeCloseTo(burned / 2)
  expect(consumed(graphite, 'carbonDioxide')).toBeCloseTo(burned / 5)
})

it('leaves unburned Waste when local steam recovery cannot keep up', () => {
  const base: Module = {
    id: 'general', name: 'Default', description: '', defaultPresetId: 'current', builtBuildings: { supply: 1 },
    recipes: [{
      id: 'supply', name: 'Supply', building: 'Test', group: 'production', inputs: [],
      outputs: [
        { resourceId: 'waste', quantity: 228 }, { resourceId: 'water', quantity: 400 },
        { resourceId: 'limestone', quantity: 20 }, { resourceId: 'fuelGas', quantity: 100 },
      ],
    }],
    presets: [{ id: 'current', name: '', description: '', activeBuildings: { supply: 1 }, fixed: ['supply'] }],
  }
  const planned = applyWasteRecoveryPlan(testPlanningDefinitions, base)
  const { lines } = buildModuleLines(planned, planned.presets[0], { planningDefinitions: testPlanningDefinitions })
  const result = calculateNet(lines)

  expect(result.allResourceFlows.find(flow => flow.resourceId === 'waste')?.net).toBeCloseTo(36, 4)
  expect(result.allResourceFlows.find(flow => flow.resourceId === 'steamHigh')?.net).toBeCloseTo(0, 4)
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
