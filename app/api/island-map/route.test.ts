import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { GET } from './route'

const fetchMock = vi.fn<typeof fetch>()
const map = {
  schemaVersion: 1, gameId: 'game', sessionId: 'session', revision: 3,
  width: 4, height: 2, cellSize: 1, landRows: [[0, 2], [1, 3]],
}
const get = (query = '?gameId=game&sessionId=session', headers: Record<string, string> = {}) => (
  GET(new Request(`http://localhost:3000/api/island-map${query}`, { headers }))
)

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); vi.stubEnv('COI_WEB_API_URL', 'http://127.0.0.1:3073') })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks() })

it('returns the validated map and answers a matching ETag with 304', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(Response.json(map)))
  const response = await get()

  expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://127.0.0.1:3073/api/mods/CoiCalculatorExporter/island-map')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(map)
  const etag = response.headers.get('etag')

  expect(etag).toBeTruthy()
  expect((await get(undefined, { 'If-None-Match': etag ?? '' })).status).toBe(304)
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
  fetchMock.mockResolvedValueOnce(Response.json({ ...map, landRows: [[0, 2]] }))
  expect((await get()).status).toBe(502)
  fetchMock.mockResolvedValueOnce(Response.json({ ...map, sessionId: 'other' }))
  expect((await get()).status).toBe(409)
  fetchMock.mockRejectedValueOnce(new TypeError('Connection refused'))
  expect((await get()).status).toBe(503)
})
