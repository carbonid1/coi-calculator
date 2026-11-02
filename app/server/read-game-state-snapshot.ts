import 'server-only'

import { normalizeGameStateSnapshot, type GameStateSnapshot } from '../game-state'
import { isGameIdentity, normalizeNativeProducts } from '../product-state'
import { calculateGameStateSnapshotRevision } from './game-state-snapshot-revision'
import { fetchGameWebApi } from './game-web-api'

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
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const beforeResponse = await fetchGameWebApi('/api/v1/game-info', signal)
  const before: unknown = beforeResponse.ok ? await beforeResponse.json() : null

  if (!isGameIdentity(before)) return unavailable(502, 'The game could not provide calculator data. Check the game log.')
  const [response, catalogResponse, inventoryResponse] = await Promise.all([
    fetchGameWebApi(SNAPSHOT_ROUTE, signal),
    fetchGameWebApi('/api/v1/products?includeLocked=true', signal),
    fetchGameWebApi('/api/v1/products/stats?series=quantity,stored,storageCapacity', signal),
  ])

  if (response.status === 404) {
    return unavailable(404, 'Enable CoI Calculator Bridge in the loaded game.')
  }
  if (!response.ok || !catalogResponse.ok || !inventoryResponse.ok) {
    return unavailable(502, 'The game could not provide calculator data. Check the game log.')
  }

  const [bridge, catalog, inventory, afterResponse] = await Promise.all([
    response.json().then(normalizeGameStateSnapshot).catch(() => null),
    catalogResponse.json().catch(() => null),
    inventoryResponse.json().catch(() => null),
    fetchGameWebApi('/api/v1/game-info', signal),
  ])
  const after: unknown = afterResponse.ok ? await afterResponse.json() : null
  const products = normalizeNativeProducts(catalog, inventory, before)

  if (!bridge) {
    return unavailable(422, 'Update CoI Calculator Bridge for this version of the calculator and game.')
  }
  if (!products) {
    return unavailable(502, 'The game could not provide product and inventory data. Check the game log.')
  }
  if (!isGameIdentity(after) || before.gameId !== after.gameId || before.sessionId !== after.sessionId
    || bridge.gameId !== before.gameId || bridge.sessionId !== before.sessionId) {
    return unavailable(503, 'The loaded game changed. Waiting for current factory data.')
  }
  const snapshot: GameStateSnapshot = { ...bridge, products }

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
