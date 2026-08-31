import { expect, it } from 'vitest'

import { shouldPersistInitialSnapshot } from './use-game-state'

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
