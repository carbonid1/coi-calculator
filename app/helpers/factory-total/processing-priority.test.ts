import { expect, it } from 'vitest'

import { type Module } from '../../db/modules/modules'
import { type Recipe } from '../../db/recipes'
import { calculateFactoryTotal } from './factory-total'

const recipe = (id: string, properties: Partial<Recipe>): Recipe => ({
  id, name: id, building: 'Test', group: 'production', inputs: [], outputs: [], ...properties,
})
const moduleWith = (id: string, recipes: Recipe[]): Module => ({
  id, name: id, description: '', recipes,
  builtBuildings: Object.fromEntries(recipes.map(recipe => [recipe.id, 1])),
  defaultPresetId: 'test', presets: [{ id: 'test', name: 'Test', description: '',
    activeBuildings: {}, fixed: recipes.filter(recipe => recipe.inputs.length === 0).map(recipe => recipe.id) }],
})

it.each([false, true])('processes local Brine for factory Salt and Chlorine before export (reverse: %s)', reverse => {
  const nuclear = moduleWith('nuclear', [
    recipe('brine-source', { outputs: [{ resourceId: 'brine', quantity: 100 }] }),
    recipe('chlorine', { balanceBy: 'output', inputPriorities: { brine: 2 },
      inputs: [{ resourceId: 'brine', quantity: 60 }], outputs: [{ resourceId: 'chlorine', quantity: 40 }] }),
    recipe('salt', { balanceBy: 'output', inputPriorities: { brine: 3 },
      inputs: [{ resourceId: 'brine', quantity: 40 }], outputs: [{ resourceId: 'salt', quantity: 5 }] }),
  ])
  const other = moduleWith('other', [
    recipe('other-use', { balanceBy: 'output', inputs: [{ resourceId: 'brine', quantity: 60 }],
      outputs: [{ resourceId: 'hydratedAlumina', quantity: 60 }] }),
  ])

  other.presets[0].fixedDemands = { chlorine: 40, salt: 5, hydratedAlumina: 60 }
  const modules = reverse ? [other, nuclear] : [nuclear, other]
  const shared = calculateFactoryTotal(modules, { recyclingEfficiencyPercent: 100 })
  const use = (result: typeof shared, id: string) => result.calculation.regularResults.find(r => r.recipe.id === id)
    ?.actualInputs.find(input => input.resourceId === 'brine')?.quantity ?? 0

  expect(use(shared, 'salt')).toBeLessThan(40)
  nuclear.presets[0].resourceProcessingPriorities = { brine: 'local-first' }
  const preferred = calculateFactoryTotal(modules, { recyclingEfficiencyPercent: 100 })

  expect(use(preferred, 'chlorine')).toBeCloseTo(60, 3)
  expect(use(preferred, 'salt')).toBeCloseTo(40, 3)
  expect(use(preferred, 'other-use')).toBeCloseTo(0, 3)
  expect(preferred.flows.find(flow => flow.resourceId === 'brine')?.net).toBeCloseTo(0, 3)
});

const consumed = (result: ReturnType<typeof calculateFactoryTotal>, id: string) => result.calculation.regularResults
  .find(line => line.recipe.id === id)?.actualInputs.find(input => input.resourceId === 'brine')?.quantity ?? 0

const priorityScenario = (localDemand: number, source = 100) => {
  const local = moduleWith('local', [
    recipe('source', { outputs: [{ resourceId: 'brine', quantity: source }] }),
    recipe('local-salt', { balanceBy: 'output', allocation: 'primary', inputs: [{ resourceId: 'brine', quantity: 100 }],
      outputs: [{ resourceId: 'salt', quantity: 100 }] }),
  ])
  const other = moduleWith('other', [
    recipe('other-chlorine', { balanceBy: 'output', inputs: [{ resourceId: 'brine', quantity: 100 }],
      outputs: [{ resourceId: 'chlorine', quantity: 100 }] }),
  ])

  local.presets[0].resourceProcessingPriorities = { brine: 'local-first' }
  other.presets[0].fixedDemands = { salt: localDemand, chlorine: 100 }
  return { local, other }
}

it.each([0, 25, 100])('exports only the remainder after useful local processing (demand: %s)', demand => {
  const { local, other } = priorityScenario(demand)
  const result = calculateFactoryTotal([other, local], { recyclingEfficiencyPercent: 100 })

  expect(consumed(result, 'local-salt')).toBeCloseTo(demand, 3)
  expect(consumed(result, 'other-chlorine')).toBeCloseTo(100 - demand, 3)
  expect(result.flows.find(flow => flow.resourceId === 'brine')?.net).toBeCloseTo(0, 3)
})

it('releases local supply when its processing capacity is paused', () => {
  const { local, other } = priorityScenario(100)

  local.presets[0].activeBuildings['local-salt'] = 0
  const result = calculateFactoryTotal([local, other], { recyclingEfficiencyPercent: 100 })

  expect(consumed(result, 'local-salt')).toBe(0)
  expect(consumed(result, 'other-chlorine')).toBeCloseTo(100, 3)
})

it('keeps fixed direct consumption ahead of processing reservations', () => {
  const { local, other } = priorityScenario(100)

  other.presets[0].fixedDemands = { ...other.presets[0].fixedDemands, brine: 20 }
  const result = calculateFactoryTotal([other, local], { recyclingEfficiencyPercent: 100 })

  expect(consumed(result, 'local-salt')).toBeCloseTo(80, 3)
  expect(consumed(result, 'other-chlorine')).toBeCloseTo(0, 3)
  expect(result.flows.find(flow => flow.resourceId === 'brine')?.net).toBeCloseTo(0, 3)
})

it('can request more input from a demand-balanced upstream producer', () => {
  const { local, other } = priorityScenario(25)

  local.recipes![0].balanceBy = 'output'
  local.presets[0].fixed = []
  const result = calculateFactoryTotal([other, local], { recyclingEfficiencyPercent: 100 })

  expect(consumed(result, 'local-salt')).toBeCloseTo(25, 3)
  expect(consumed(result, 'other-chlorine')).toBeCloseTo(75, 3)
})

it('does not consume Brine reserved by a direct module link', () => {
  const { local, other } = priorityScenario(100)
  const result = calculateFactoryTotal([other, local], {
    recyclingEfficiencyPercent: 100,
    moduleFixedDemands: new Map([['local', { brine: 20 }]]),
  })

  expect(consumed(result, 'local-salt')).toBeCloseTo(80, 3)
  expect(consumed(result, 'other-chlorine')).toBeCloseTo(0, 3)
  expect(result.flows.find(flow => flow.resourceId === 'brine')?.net).toBeCloseTo(0, 3)
})

it('respects explicit output targets before ordinary processing priorities', () => {
  const { local, other } = priorityScenario(100)

  other.presets[0].outputTargets = { chlorine: 20 }
  const result = calculateFactoryTotal([other, local], { recyclingEfficiencyPercent: 100 })

  expect(consumed(result, 'local-salt')).toBeCloseTo(80, 3)
  expect(consumed(result, 'other-chlorine')).toBeCloseTo(20, 3)
  expect(result.flows.find(flow => flow.resourceId === 'brine')?.net).toBeCloseTo(0, 3)
})

it('keeps a preferred processor’s explicit output target', () => {
  const { local, other } = priorityScenario(100)

  local.presets[0].outputTargets = { salt: 20 }
  const result = calculateFactoryTotal([other, local], { recyclingEfficiencyPercent: 100 })

  expect(consumed(result, 'local-salt')).toBeCloseTo(20, 3)
  expect(consumed(result, 'other-chlorine')).toBeCloseTo(80, 3)
})
