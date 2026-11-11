import { expect, it, vi } from 'vitest'

import { createLatestWriter, shouldPersistInitialSnapshot, withCachedSnapshot } from './use-game-state'

const snapshot = (saveId: string | null, exportedAtUtc: string) => ({
  exportedAtUtc,
  saveId,
})

it('persists a server snapshot when no browser fallback exists', () => {
  expect(shouldPersistInitialSnapshot(snapshot('save-a', '2026-08-31T10:00:00Z'), null)).toBe(true)
})

it('replaces a stale fallback from the same or a different save', () => {
  const current = snapshot('save-a', '2026-08-31T10:00:05Z')

  expect(shouldPersistInitialSnapshot(
    current,
    snapshot('save-a', '2026-08-31T10:00:00Z'),
  )).toBe(true)
  expect(shouldPersistInitialSnapshot(
    current,
    snapshot('save-b', '2026-08-31T10:00:05Z'),
  )).toBe(true)
})

it('skips rewriting the current browser fallback', () => {
  const current = snapshot('save-a', '2026-08-31T10:00:05Z')

  expect(shouldPersistInitialSnapshot(current, current)).toBe(false)
})

const manualDefer = () => {
  const callbacks: Array<() => void> = []
  const cancel = vi.fn()
  const defer = vi.fn((run: () => void) => {
    callbacks.push(run)
    return cancel
  })

  return { callbacks, cancel, defer }
}

it('writes only the newest scheduled value once', () => {
  const write = vi.fn()
  const { callbacks, defer } = manualDefer()
  const writer = createLatestWriter(write, defer)

  writer.schedule('a')
  writer.schedule('b')
  expect(callbacks).toHaveLength(1)
  callbacks[0]()

  expect(write).toHaveBeenCalledTimes(1)
  expect(write).toHaveBeenCalledWith('b')
  expect(defer).toHaveBeenCalledTimes(1)
})

it('defers again after a scheduled write has run', () => {
  const write = vi.fn()
  const { callbacks, defer } = manualDefer()
  const writer = createLatestWriter(write, defer)

  writer.schedule('a')
  callbacks[0]()
  writer.schedule('c')

  expect(defer).toHaveBeenCalledTimes(2)
})

it('cancels a pending write on dispose', () => {
  const write = vi.fn()
  const { callbacks, cancel, defer } = manualDefer()
  const writer = createLatestWriter(write, defer)

  writer.schedule('a')
  writer.dispose()
  callbacks[0]()

  expect(cancel).toHaveBeenCalledTimes(1)
  expect(write).not.toHaveBeenCalled()
})

// Only identity fields matter to the swap; a full snapshot is megabytes.
const cachedFactory = (exportedAtUtc: string) => ({ exportedAtUtc, saveId: 'save-a' })
const serverResult = (status: 'loading' | 'available' | 'missing' | 'error', error: string | null) => ({
  error, exportedAtUtc: null, isFresh: false, revision: null, snapshot: null, source: 'none', status,
})

it.each(['missing', 'error'] as const)('keeps a %s status and its reason when the cached factory is shown', status => {
  const cached = cachedFactory('2026-08-31T10:00:00Z')

  expect(withCachedSnapshot(serverResult(status, 'Enable CoI Calculator Bridge in the loaded game.'), cached)).toEqual({
    error: 'Enable CoI Calculator Bridge in the loaded game.', exportedAtUtc: '2026-08-31T10:00:00Z',
    isFresh: false, revision: null, snapshot: cached, source: 'cached', status,
  })
})

it('shows the cached factory as loading when nothing has failed yet', () => {
  const cached = cachedFactory('2026-08-31T10:00:00Z')

  expect(withCachedSnapshot(serverResult('loading', null), cached)).toMatchObject({ error: null, source: 'cached', status: 'loading' })
})

it('never replaces live data with the cached factory', () => {
  const live = {
    ...serverResult('available', null), snapshot: cachedFactory('2026-08-31T10:00:05Z'), source: 'live', revision: 'r1',
  }

  expect(withCachedSnapshot(live, cachedFactory('2026-08-31T10:00:00Z'))).toBe(live)
})
