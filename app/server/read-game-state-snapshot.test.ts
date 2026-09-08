import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { type readGameStateSnapshot } from './read-game-state-snapshot'

const { readFile, stat, normalize, revision } = vi.hoisted(() => ({
  readFile: vi.fn(), stat: vi.fn(), normalize: vi.fn(), revision: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('node:fs/promises', () => ({ readFile, stat }))
vi.mock('../game-state', () => ({ normalizeGameStateSnapshot: normalize }))
vi.mock('./game-state-snapshot-revision', () => ({ calculateGameStateSnapshotRevision: revision }))

const snapshot = { exportedAtUtc: '2026-09-08T00:00:00.000Z', saveId: 'island' }
const metadata = { dev: 1, ino: 2, size: 100, mtimeMs: 10, ctimeMs: 10 }
let read: typeof readGameStateSnapshot

beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.stubEnv('COI_CALCULATOR_STATE_PATH', 'snapshot.json')
  readFile.mockResolvedValue('{}')
  stat.mockResolvedValue(metadata)
  normalize.mockReturnValue(snapshot)
  revision.mockReturnValue('revision-a')
  read = (await import('./read-game-state-snapshot')).readGameStateSnapshot
})

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

it('shares one read and normalization across concurrent and repeated polls of an unchanged file', async () => {
  const results = await Promise.all([read(), read(), read()])

  expect(results.every(result => result.snapshot === snapshot)).toBe(true)
  await read()
  expect(readFile).toHaveBeenCalledTimes(1)
  expect(normalize).toHaveBeenCalledTimes(1)
  expect(revision).toHaveBeenCalledTimes(1)
})

it('rechecks freshness even while the file is unchanged', async () => {
  vi.useFakeTimers()
  vi.setSystemTime('2026-09-08T00:00:05.000Z')
  expect((await read()).isFresh).toBe(true)
  vi.setSystemTime('2026-09-08T00:00:25.000Z')
  expect((await read()).isFresh).toBe(false)
  expect(readFile).toHaveBeenCalledTimes(1)
})

it.each(['mtimeMs', 'ctimeMs', 'size', 'ino'])('invalidates a changed or replaced file (%s)', async field => {
  await read()
  stat.mockResolvedValue({ ...metadata, [field]: 123 })
  await read()
  expect(readFile).toHaveBeenCalledTimes(2)
})

it('does not reuse a different snapshot path with matching metadata', async () => {
  await read()
  vi.stubEnv('COI_CALCULATOR_STATE_PATH', 'another.json')
  await read()
  expect(readFile).toHaveBeenCalledTimes(2)
})

it('does not mask a deleted snapshot with the cached value', async () => {
  await read()
  stat.mockRejectedValueOnce(Object.assign(new Error('Missing'), { code: 'ENOENT' }))
  expect(await read()).toMatchObject({ status: 'missing', snapshot: null })
  await read()
  expect(readFile).toHaveBeenCalledTimes(2)
})

it('retries a failed read even if file metadata is unchanged', async () => {
  readFile.mockRejectedValueOnce(new Error('Temporary read failure'))
  expect(await read()).toMatchObject({ status: 'error', snapshot: null })
  expect((await read()).snapshot).toBe(snapshot)
  expect(readFile).toHaveBeenCalledTimes(2)
})
