import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { createCacheTestModel } from '../../test-fixtures/factory-calculation-cache'
import { deriveCalculatorModel } from '../calculator-model/derive-calculator-model'
import { type FactoryCalculationRequest } from './factory-calculation.worker'

const { calculate, read, write } = vi.hoisted(() => ({
  calculate: vi.fn(), read: vi.fn(), write: vi.fn(),
}))

vi.mock('./factory-calculation', () => ({ calculateFactoryCalculation: calculate }))
vi.mock('./factory-calculation-cache', () => ({
  readSavedFactoryCalculation: read,
  writeSavedFactoryCalculation: write,
}))

let receive: (event: { data: FactoryCalculationRequest }) => Promise<void>
const postMessage = vi.fn()
const model = createCacheTestModel()
const request = { model, revision: 'new', version: 'code-a' }

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  calculate.mockReturnValue({ fresh: true })
  read.mockResolvedValue(null)
  write.mockResolvedValue(undefined)
  vi.stubGlobal('self', {
    postMessage,
    addEventListener: (_name: string, handler: typeof receive) => { receive = handler },
  })
  await import('./factory-calculation.worker')
})
afterEach(() => vi.unstubAllGlobals())

it('reuses an exact cached revision without running the expensive solver', async () => {
  const saved = { ...request, model: { oldTimestamp: true }, calculation: { cached: true } }

  read.mockResolvedValue(saved)
  await receive({ data: request })
  expect(calculate).not.toHaveBeenCalled()
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({
    type: 'settled', revision: 'new', result: { ...saved, model },
  })
})

it('shows the paired old model/result before solving and then saves the whole new pair', async () => {
  const saved = { ...request, revision: 'old', model: { old: true }, calculation: { cached: true } }

  read.mockResolvedValue(saved)
  calculate.mockImplementation(() => {
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'preview', revision: 'new', result: saved })
    return { fresh: true }
  })
  await receive({ data: request })
  const result = { ...request, calculation: { fresh: true } }

  expect(postMessage).toHaveBeenLastCalledWith({ type: 'settled', revision: 'new', result })
  expect(write).toHaveBeenCalledExactlyOnceWith(result)
})

it('calculates on a cache miss and reports solver failures without overwriting the cache', async () => {
  calculate.mockImplementation(() => { throw new Error('Solver failed') })
  await receive({ data: request })
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'error', revision: 'new', error: 'Solver failed' })
  expect(write).not.toHaveBeenCalled()
})

it('updates snapshot-only values without solving the same factory inputs again', async () => {
  await receive({ data: request })
  const next = structuredClone(request)

  next.revision = 'next'
  next.model.calculationRevision = next.revision
  next.model.snapshot.exportedAtUtc = '2026-09-04T00:00:05.000Z'
  next.model.snapshot.storages.push({
    entityId: 1, product: { productId: 'Wood', name: 'Wood' }, quantity: 100, capacity: 1000,
    trainLinked: false, hasAssignedInputs: false,
  })
  next.model = deriveCalculatorModel({ snapshot: next.model.snapshot, revision: next.revision, machineZoneAssignments: {} })
  next.revision = next.model.calculationRevision
  await receive({ data: next })

  expect(calculate).toHaveBeenCalledTimes(1)
  expect(postMessage).toHaveBeenLastCalledWith({
    type: 'settled', revision: next.revision, result: { ...next, calculation: { fresh: true } },
  })
  expect(write).toHaveBeenLastCalledWith({ ...next, calculation: { fresh: true } })
})

it('reuses saved calculation inputs when only the snapshot revision changed', async () => {
  const saved = { ...request, revision: 'old', calculation: { cached: true } }

  read.mockResolvedValue(saved)
  await receive({ data: request })

  expect(calculate).not.toHaveBeenCalled()
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({
    type: 'settled', revision: request.revision, result: { ...request, calculation: { cached: true } },
  })
})

it.each(['input', 'save', 'version', 'reserve availability'])('recalculates when the %s changes', async change => {
  await receive({ data: request })
  const next = structuredClone(request)

  next.revision = 'next'
  if (change === 'input') next.model.factoryCalculationInput.externalDemands = { water: 123 }
  if (change === 'save') next.model.snapshot.saveId = 'another-save'
  if (change === 'version') next.version = 'code-b'
  if (change === 'reserve availability') {
    next.model.snapshot.reserves.gold = 100
    next.model = deriveCalculatorModel({ snapshot: next.model.snapshot, revision: next.revision, machineZoneAssignments: {} })
    next.revision = next.model.calculationRevision
  }
  await receive({ data: next })

  expect(calculate).toHaveBeenCalledTimes(2)
})
