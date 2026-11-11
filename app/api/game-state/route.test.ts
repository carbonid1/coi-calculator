import { beforeEach, expect, it, vi } from 'vitest'

const { read } = vi.hoisted(() => ({ read: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('../../server/read-game-state-snapshot', () => ({ readGameStateSnapshot: read }))

import { GET } from './route'

const available = (revision: string) => ({
  error: null, httpStatus: 200, isFresh: true, revision, status: 'available',
  snapshot: { exportedAtUtc: '2026-11-02T12:00:00.000Z', saveId: 'island' },
})
const get = (headers: Record<string, string> = {}) => GET(new Request('http://localhost:3000/api/game-state', { headers }))

beforeEach(() => { vi.resetAllMocks() })

it('returns the snapshot with its revision and answers a matching ETag with 304', async () => {
  read.mockResolvedValue(available('revision-a'))
  const response = await get()

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(available('revision-a').snapshot)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('x-coi-snapshot-revision')).toBe('revision-a')
  const etag = response.headers.get('etag') ?? ''

  expect(etag).not.toBe('')
  expect((await get({ 'If-None-Match': etag })).status).toBe(304)
  read.mockResolvedValue(available('revision-b'))
  expect((await get({ 'If-None-Match': etag })).status).toBe(200)
})

it.each([404, 422, 502, 503])('passes a %s failure through with its reason', async httpStatus => {
  read.mockResolvedValue({ error: 'Reason for the player.', httpStatus, isFresh: false, revision: null, snapshot: null, status: 'error' })
  const response = await get()

  expect(response.status).toBe(httpStatus)
  expect(await response.json()).toEqual({ error: 'Reason for the player.' })
})
