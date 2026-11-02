import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { testProducts } from '../test-fixtures/products'

const { normalize, revision } = vi.hoisted(() => ({ normalize: vi.fn(), revision: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('../game-state', () => ({ normalizeGameStateSnapshot: normalize }))
vi.mock('./game-state-snapshot-revision', () => ({ calculateGameStateSnapshotRevision: revision }))

const snapshot = { exportedAtUtc: '2026-11-02T12:00:00.000Z', saveId: 'island', gameId: '123', sessionId: '456' }
const fetchMock = vi.fn<typeof fetch>()
const bridgeReply = vi.fn<() => Response>()
const infoReply = vi.fn<() => Response>()
const inventoryReply = vi.fn<() => Response>()
const read = async () => (await import('./read-game-state-snapshot')).readGameStateSnapshot()

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('COI_WEB_API_URL', '')
  bridgeReply.mockImplementation(() => Response.json({ raw: 'game' }))
  infoReply.mockImplementation(() => Response.json({ gameId: '123', sessionId: '456' }))
  inventoryReply.mockImplementation(() => Response.json({ products: testProducts.inventory, unknownIds: [] }))
  fetchMock.mockImplementation(input => {
    const path = new URL(String(input)).pathname

    if (path === '/api/v1/game-info') return Promise.resolve(infoReply())
    if (path === '/api/v1/products') return Promise.resolve(Response.json({ products: testProducts.catalog, unknownIds: [] }))
    if (path === '/api/v1/products/stats') return Promise.resolve(inventoryReply())
    if (path === '/api/mods/CoiCalculatorExporter/snapshot') return Promise.resolve(bridgeReply())
    return Promise.resolve(new Response(null, { status: 404 }))
  })
  normalize.mockReturnValue(snapshot)
  revision.mockReturnValue('revision-a')
})

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })

it('combines the bridge with native metadata and inventory using one request deadline', async () => {
  expect(await read()).toMatchObject({ status: 'available', snapshot: { ...snapshot, products: testProducts }, revision: 'revision-a' })
  expect(fetchMock).toHaveBeenCalledWith(
    new URL('http://127.0.0.1:3073/api/mods/CoiCalculatorExporter/snapshot'),
    expect.objectContaining({ cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal) }),
  )
  expect(normalize).toHaveBeenCalledWith({ raw: 'game' })
  expect(fetchMock.mock.calls.every(([, options]) => options?.signal === fetchMock.mock.calls[0]?.[1]?.signal)).toBe(true)
  expect(revision).toHaveBeenCalledWith({ ...snapshot, products: testProducts })
})

it('shares concurrent requests and fetches current state on the next poll', async () => {
  const results = await Promise.all([read(), read(), read()])

  expect(results.every(result => result.snapshot === results[0].snapshot)).toBe(true)
  expect(fetchMock).toHaveBeenCalledTimes(5)
  await read()
  expect(fetchMock).toHaveBeenCalledTimes(10)
})

it('uses a configured server port', async () => {
  vi.stubEnv('COI_WEB_API_URL', 'http://localhost:3099')
  await read()
  expect(fetchMock.mock.calls.every(([url]) => new URL(String(url)).port === '3099')).toBe(true)
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
  bridgeReply.mockReturnValueOnce(new Response(null, { status: 404 }))
  expect(await read()).toMatchObject({ httpStatus: 404, snapshot: null, status: 'missing' })
})

it('reports an upstream collection failure without returning older data', async () => {
  await read()
  bridgeReply.mockReturnValueOnce(new Response(null, { status: 500 }))
  expect(await read()).toMatchObject({ httpStatus: 502, snapshot: null, status: 'error' })
})

it('rejects malformed JSON and incompatible game data', async () => {
  bridgeReply.mockReturnValueOnce(new Response('<html>wrong endpoint</html>'))
  expect(await read()).toMatchObject({ httpStatus: 422, snapshot: null })
  normalize.mockReturnValueOnce(null)
  expect(await read()).toMatchObject({ httpStatus: 422, snapshot: null })
})

it('rejects a game load between native inventory and bridge collection', async () => {
  infoReply.mockReturnValueOnce(Response.json({ gameId: '123', sessionId: '456' }))
    .mockReturnValueOnce(Response.json({ gameId: '123', sessionId: '999' }))
  expect(await read()).toMatchObject({ httpStatus: 503, snapshot: null })
  expect((await read()).status).toBe('available')
})

it('rejects bridge data from a different loaded game', async () => {
  normalize.mockReturnValueOnce({ ...snapshot, gameId: '789' })
  expect(await read()).toMatchObject({ httpStatus: 503, snapshot: null })
})

it('does not substitute old stock when native inventory fails or is malformed', async () => {
  await read()
  inventoryReply.mockReturnValueOnce(new Response(null, { status: 500 }))
  expect(await read()).toMatchObject({ httpStatus: 502, snapshot: null })
  inventoryReply.mockReturnValueOnce(Response.json({ products: { Product_Salt: { quantity: -1 } }, unknownIds: [] }))
  expect(await read()).toMatchObject({ httpStatus: 502, snapshot: null })
})
