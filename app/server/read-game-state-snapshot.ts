import 'server-only'

import { normalizeGameStateSnapshot, type GameStateSnapshot } from '../game-state'
import { calculateGameStateSnapshotRevision } from './game-state-snapshot-revision'

interface AvailableResult {
  error: null
  httpStatus: 200
  isFresh: boolean
  revision: string
  snapshot: GameStateSnapshot
  status: 'available'
}

interface UnavailableResult {
  error: string
  httpStatus: 404 | 422 | 502 | 503
  isFresh: false
  revision: null
  snapshot: null
  status: 'error' | 'missing'
}

export type GameStateSnapshotReadResult = AvailableResult | UnavailableResult

const SNAPSHOT_ROUTE = '/api/mods/CoiCalculatorExporter/snapshot'
const REQUEST_TIMEOUT_MS = 8_000
const requests: { pending: Promise<GameStateSnapshotReadResult> | null } = { pending: null }

const unavailable = (
  httpStatus: UnavailableResult['httpStatus'],
  error: string,
): UnavailableResult => ({
  error, httpStatus, isFresh: false, revision: null, snapshot: null,
  status: httpStatus === 404 ? 'missing' : 'error',
})

const requestSnapshot = async (): Promise<GameStateSnapshotReadResult> => {
  const url = new URL(SNAPSHOT_ROUTE, process.env.COI_WEB_API_URL || 'http://127.0.0.1:3073')
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (response.status === 404) {
    return unavailable(404, 'Enable CoI Calculator Bridge in the loaded game.')
  }
  if (!response.ok) {
    return unavailable(502, 'The game could not provide calculator data. Check the game log.')
  }

  const snapshot = await response.json().then(normalizeGameStateSnapshot).catch(() => null)

  if (!snapshot) {
    return unavailable(422, 'Update CoI Calculator Bridge for this version of the calculator and game.')
  }

  return {
    error: null,
    httpStatus: 200,
    isFresh: Date.now() - Date.parse(snapshot.exportedAtUtc) < 20_000,
    revision: calculateGameStateSnapshotRevision(snapshot),
    snapshot,
    status: 'available',
  }
}

/** Coalesce concurrent callers; each later poll requests current game state. */
export const readGameStateSnapshot = (): Promise<GameStateSnapshotReadResult> => {
  if (!requests.pending) {
    requests.pending = requestSnapshot()
      .catch(() => unavailable(503, 'Cannot connect to the game. Load a game with CoI Calculator Bridge enabled.'))
      .finally(() => { requests.pending = null })
  }
  return requests.pending
}
