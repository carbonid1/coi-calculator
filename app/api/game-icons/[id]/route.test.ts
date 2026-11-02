import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { GET } from './route'

const fetchMock = vi.fn<typeof fetch>()
const get = (id = 'Product_Salt', query = '?v=456') => GET(new Request(`http://localhost:3000/api/game-icons/${id}${query}`), {
  params: Promise.resolve({ id }),
})

beforeEach(() => { vi.stubGlobal('fetch', fetchMock); vi.stubEnv('COI_WEB_API_URL', 'http://127.0.0.1:3073') })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks() })

it('proxies native PNGs and caches them by session', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71])

  fetchMock.mockResolvedValueOnce(new Response(bytes, { headers: { 'Content-Type': 'image/png' } }))
  const response = await get()

  expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://127.0.0.1:3073/api/v1/icons/Product_Salt?v=456')
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  expect(response.headers.get('cache-control')).toContain('immutable')
})

it('keeps missing icons and unavailable games as errors, without caching a fallback', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
  const missing = await get()

  expect(missing.status).toBe(404)
  expect(missing.headers.get('cache-control')).toBe('no-store')
  fetchMock.mockRejectedValueOnce(new TypeError('Connection refused'))
  expect((await get()).status).toBe(503)
  fetchMock.mockResolvedValueOnce(new Response('<html>', { headers: { 'Content-Type': 'text/html' } }))
  expect((await get()).status).toBe(502)
})

it('rejects path traversal without requesting the game', async () => {
  expect((await get('../game-info')).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})
