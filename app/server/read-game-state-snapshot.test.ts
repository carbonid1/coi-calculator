import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { normalize, revision } = vi.hoisted(() => ({ normalize: vi.fn(), revision: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('../game-state', () => ({ normalizeGameStateSnapshot: normalize }))
vi.mock('./game-state-snapshot-revision', () => ({ calculateGameStateSnapshotRevision: revision }))

const snapshot = { exportedAtUtc: '2026-11-02T12:00:00.000Z', saveId: 'island' }
const fetchMock = vi.fn<typeof fetch>()
const read = async () => (await import('./read-game-state-snapshot')).readGameStateSnapshot()

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('COI_WEB_API_URL', '')
  fetchMock.mockImplementation(() => Promise.resolve(Response.json({ raw: 'game' })))
  normalize.mockReturnValue(snapshot)
  revision.mockReturnValue('revision-a')
})

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('requests the bridge through the game server with a deadline and no caching', async () => {
  expect(await read()).toMatchObject({ status: 'available', snapshot, revision: 'revision-a' })
  expect(fetchMock).toHaveBeenCalledWith(
    new URL('http://127.0.0.1:3073/api/mods/CoiCalculatorExporter/snapshot'),
    expect.objectContaining({ cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal) }),
  )
  expect(normalize).toHaveBeenCalledWith({ raw: 'game' })
})

it('shares concurrent requests and fetches current state on the next poll', async () => {
  const results = await Promise.all([read(), read(), read()])

  expect(results.every(result => result.snapshot === snapshot)).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await read()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('uses a configured server port', async () => {
  vi.stubEnv('COI_WEB_API_URL', 'http://localhost:3099')
  await read()
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://localhost:3099/api/mods/CoiCalculatorExporter/snapshot')
})

it('checks capture freshness while the game is paused', async () => {
  vi.useFakeTimers()
  vi.setSystemTime('2026-11-02T12:00:05.000Z')
  expect((await read()).isFresh).toBe(true)
  vi.setSystemTime('2026-11-02T12:00:25.000Z')
  expect((await read()).isFresh).toBe(false)
})

it.each([new TypeError('Connection refused'), new DOMException('Timed out', 'TimeoutError')])(
  'reports an unavailable server and retries on the next request: %s', async error => {
    fetchMock.mockRejectedValueOnce(error)
    expect(await read()).toMatchObject({ httpStatus: 503, snapshot: null, status: 'error' })
    expect((await read()).status).toBe('available')
  },
)

it('reports the missing bridge separately from a stopped server', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
  expect(await read()).toMatchObject({ httpStatus: 404, snapshot: null, status: 'missing' })
})

it('reports an upstream collection failure without returning older data', async () => {
  await read()
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
  expect(await read()).toMatchObject({ httpStatus: 502, snapshot: null, status: 'error' })
})

it('rejects malformed JSON and incompatible game data', async () => {
  fetchMock.mockResolvedValueOnce(new Response('<html>wrong endpoint</html>'))
  expect(await read()).toMatchObject({ httpStatus: 422, snapshot: null })
  normalize.mockReturnValueOnce(null)
  expect(await read()).toMatchObject({ httpStatus: 422, snapshot: null })
})
