import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { GET } from './route'

const fetchMock = vi.fn<typeof fetch>()
const layout = {
  schemaVersion: 1, gameId: 'game', sessionId: 'session',
  areas: [{ id: 1, outline: [[0, 0], [10, 0], [10, 10]] }],
  shapes: [[[-1, -1, 1, 1]]],
  buildings: [{ id: 7, prototypeId: 'Smelter', x: 5, y: 5, shape: 0, constructed: true, areas: [1] }],
}
const get = (query = '?gameId=game&sessionId=session', headers: Record<string, string> = {}) => (
  GET(new Request(`http://localhost:3000/api/factory-layout${query}`, { headers }))
)

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); vi.stubEnv('COI_WEB_API_URL', 'http://127.0.0.1:3073') })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks() })

it('returns the validated layout and answers a matching ETag with 304 until the layout changes', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(Response.json(layout)))
  const response = await get()

  expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://127.0.0.1:3073/api/mods/CoiCalculatorExporter/factory-layout')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(layout)
  const etag = response.headers.get('etag')

  expect(etag).toBeTruthy()
  expect((await get(undefined, { 'If-None-Match': etag ?? '' })).status).toBe(304)

  const changed = {
    ...layout,
    buildings: [...layout.buildings, { id: 8, prototypeId: 'Depot', x: 1, y: 1, shape: 0, constructed: false, areas: [1] }],
  }

  fetchMock.mockImplementation(() => Promise.resolve(Response.json(changed)))
  expect((await get(undefined, { 'If-None-Match': etag ?? '' })).status).toBe(200)
})

it('requires both identifiers without asking the game', async () => {
  expect((await get('')).status).toBe(400)
  expect((await get('?gameId=game')).status).toBe(400)
  expect((await get(`?gameId=${'g'.repeat(101)}&sessionId=session`)).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('maps game-side failures to distinct statuses', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
  expect((await get()).status).toBe(404)
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
  expect((await get()).status).toBe(502)
  fetchMock.mockResolvedValueOnce(Response.json({ ...layout, shapes: [[[1, 1, 0, 0]]] }))
  expect((await get()).status).toBe(502)
  fetchMock.mockResolvedValueOnce(Response.json({ ...layout, sessionId: 'other' }))
  expect((await get()).status).toBe(409)
  fetchMock.mockRejectedValueOnce(new TypeError('Connection refused'))
  expect((await get()).status).toBe(503)
})
