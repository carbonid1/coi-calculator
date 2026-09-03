import { expect, it } from 'vitest'

import {
  calculateGameStateSnapshotRevision,
  formatGameStateSnapshotEtag,
  matchesGameStateSnapshotEtag,
} from './game-state-snapshot-revision'

const snapshot = (exportedAtUtc: string, saveId = 'test-save') =>
  ({
    exportedAtUtc,
    saveId,
    schemaVersion: 38,
  })

it('keeps the snapshot revision stable when only the export time changes', () => {
  expect(calculateGameStateSnapshotRevision(snapshot('2026-08-30T10:00:00Z'))).toBe(
    calculateGameStateSnapshotRevision(snapshot('2026-08-30T10:00:05Z')),
  )
})

it('changes the snapshot revision when calculator state changes', () => {
  expect(calculateGameStateSnapshotRevision(snapshot('2026-08-30T10:00:00Z'))).not.toBe(
    calculateGameStateSnapshotRevision(snapshot('2026-08-30T10:00:00Z', 'another-save')),
  )
})

it('matches strong and weak conditional request tags', () => {
  const revision = calculateGameStateSnapshotRevision(snapshot('2026-08-30T10:00:00Z'))
  const etag = formatGameStateSnapshotEtag(revision)

  expect(matchesGameStateSnapshotEtag(etag, revision)).toBe(true)
  expect(matchesGameStateSnapshotEtag(`W/${etag}`, revision)).toBe(true)
  expect(matchesGameStateSnapshotEtag(`"other", ${etag}`, revision)).toBe(true)
  expect(matchesGameStateSnapshotEtag('"other"', revision)).toBe(false)
})
