import { afterEach, expect, it, vi } from 'vitest'

import { createCacheTestModel } from '../../test-fixtures/factory-calculation-cache'
import { calculateFactoryCalculation } from './factory-calculation'
import {
  isCompatibleFactoryCalculation,
  readSavedFactoryCalculation,
  type SavedFactoryCalculation,
  writeSavedFactoryCalculation,
} from './factory-calculation-cache'

const entry = {
  version: 'code-a',
  revision: 'new:{}',
  model: createCacheTestModel(),
  calculation: calculateFactoryCalculation({
    contracts: [], contractsProfitMultiplier: 1, links: [], modules: [],
    outputModifiers: {}, recyclingEfficiencyPercent: 0, shipsFuelUseMultiplier: 1,
  }),
} satisfies SavedFactoryCalculation

afterEach(() => vi.unstubAllGlobals())

it('restores structured-cloned maps only for the same save and calculation code', () => {
  const restored: unknown = structuredClone(entry)

  expect(isCompatibleFactoryCalculation(restored, 'island-a', 'code-a')).toBe(true)
  expect(isCompatibleFactoryCalculation(restored, 'island-b', 'code-a')).toBe(false)
  expect(isCompatibleFactoryCalculation(restored, 'island-a', 'code-b')).toBe(false)
})

it('rejects missing, corrupt, JSON-flattened, or mismatched model/result records', () => {
  for (const value of [
    null, undefined, {}, 'broken',
    JSON.parse(JSON.stringify(entry)),
    { ...entry, revision: 'revision-b' },
    { ...entry, calculation: {} },
    { ...entry, calculation: {
      ...entry.calculation,
      factoryResult: { ...entry.calculation.factoryResult, contractFlows: undefined },
    } },
    { ...entry, calculation: {
      ...entry.calculation,
      linkedModulesResult: { ...entry.calculation.linkedModulesResult, boundaries: undefined },
    } },
  ]) {
    expect(isCompatibleFactoryCalculation(value, 'island-a', 'code-a')).toBe(false)
  }
})

it('treats unavailable or denied storage as a cache miss and skips persistence', async () => {
  for (const database of [undefined, { open: () => { throw new Error('Storage denied') } }]) {
    vi.stubGlobal('indexedDB', database)
    expect(await readSavedFactoryCalculation('island-a', 'code-a')).toBeNull()
    await expect(writeSavedFactoryCalculation(entry)).resolves.toBeUndefined()
  }
})

it('does not wait indefinitely on a blocked database', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('indexedDB', { open: () => ({}) })
  try {
    const read = readSavedFactoryCalculation('island-a', 'code-a')

    await vi.advanceTimersByTimeAsync(500)
    expect(await read).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})
