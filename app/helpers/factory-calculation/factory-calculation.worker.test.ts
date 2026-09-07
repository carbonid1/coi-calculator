import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { createCacheTestModel } from '../../test-fixtures/factory-calculation-cache'
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
