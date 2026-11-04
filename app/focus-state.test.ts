import { expect, it } from 'vitest'

import { focusCatalog } from './db/offices'
import { normalizeFocusStates, resolveFocusAllocations } from './focus-state'
import { normalizeGameStateSnapshot } from './game-state'
import { calculateGameStateSnapshotRevision } from './server/game-state-snapshot-revision'
import { createCacheTestModel } from './test-fixtures/factory-calculation-cache'
import { testOfficeFocusDefinitions } from './test-fixtures/recorded-game-data'

const focusState = () => Object.fromEntries(focusCatalog.map(focus => [focus.id, {
  targetStep: 0, activeStep: 0,
}]))

it('retains target versus active steps through snapshot parsing and invalidates the revision', () => {
  const snapshot = createCacheTestModel().snapshot
  const focus = { ...focusState(), contractsProfitability: { targetStep: 7, activeStep: 3 } }
  const parsed = normalizeGameStateSnapshot({ ...snapshot, focus })

  expect(parsed?.focus).toEqual(focus)
  expect(normalizeGameStateSnapshot(snapshot)?.focus).toEqual(focusState())
  expect(calculateGameStateSnapshotRevision(parsed!)).not.toBe(calculateGameStateSnapshotRevision(snapshot))
})
it('rejects older snapshots with missing Focus data before they can produce factory totals', () => {
  const snapshot = createCacheTestModel().snapshot
  const { focus: _focus, ...olderSnapshot } = snapshot

  expect(normalizeGameStateSnapshot(olderSnapshot)).toBeNull()
})

it.each([
  null, [], {},
  { ...focusState(), cropYield: { targetStep: 151, activeStep: 0 } },
  { ...focusState(), cropYield: { targetStep: 2.5, activeStep: 0 } },
  { ...focusState(), cropYield: { targetStep: -1, activeStep: 0 } },
  { ...focusState(), cropYield: { targetStep: 2, activeStep: 3 } },
  { ...focusState(), cropYield: { targetStep: 2, activeStep: -1 } },
  { ...focusState(), cropYield: { targetStep: 2, activeStep: 0.5 } },
  { ...focusState(), cropYield: { targetStep: '2', activeStep: 0 } },
])('rejects malformed Focus data instead of treating it as synced zero (%j)', focus => {
  expect(normalizeFocusStates(focus, testOfficeFocusDefinitions)).toBeNull()
  expect(normalizeGameStateSnapshot({ ...createCacheTestModel().snapshot, focus })).toBeNull()
})

it('preserves explicit zero plans and distinguishes unsynced allocations from confirmed Off', () => {
  const states = normalizeFocusStates(focusState(), testOfficeFocusDefinitions)!

  states.cropYield = { targetStep: 2, activeStep: 2 }
  const resolved = resolveFocusAllocations(states, { cropYield: 0 })

  expect(resolved.cropYield).toMatchObject({ step: 0, source: 'planned' })
  expect(resolved.trucksCapacity).toMatchObject({ step: 0, source: 'synced' })
  expect(resolveFocusAllocations(undefined, {}).trucksCapacity)
    .toEqual({ step: null, source: null, synced: null })
})
