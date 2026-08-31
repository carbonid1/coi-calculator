import { createHash } from 'node:crypto'

export const calculateGameStateSnapshotRevision = <
  Snapshot extends { exportedAtUtc: string },
>(
  snapshot: Snapshot,
): string => {
  const { exportedAtUtc: _exportedAtUtc, ...calculationState } = snapshot

  return createHash('sha256').update(JSON.stringify(calculationState)).digest('base64url')
}

export const formatGameStateSnapshotEtag = (revision: string): string => `"${revision}"`

export const matchesGameStateSnapshotEtag = (
  ifNoneMatch: string | null,
  revision: string,
): boolean => {
  if (!ifNoneMatch) return false

  const expected = formatGameStateSnapshotEtag(revision)

  return ifNoneMatch.split(',').some(candidate => candidate.trim().replace(/^W\//, '') === expected)
}
