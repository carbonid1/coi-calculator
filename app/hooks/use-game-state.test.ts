import { expect, it, vi } from 'vitest'

import { createLatestWriter, shouldPersistInitialSnapshot } from './use-game-state'

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
