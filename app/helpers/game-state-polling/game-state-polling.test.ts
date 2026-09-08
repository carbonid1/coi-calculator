import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { startGameStatePolling } from './game-state-polling'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('waits a full minute after the active request before polling again', async () => {
  let finish!: () => void
  const refresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  const poller = startGameStatePolling({ refresh, isVisible: () => true, onError: vi.fn() })

  await vi.advanceTimersByTimeAsync(5_000)
  poller.visibilityChanged()
  expect(refresh).toHaveBeenCalledTimes(1)
  finish()
  await vi.advanceTimersByTimeAsync(59_999)
  expect(refresh).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(refresh).toHaveBeenCalledTimes(2)
  poller.dispose()
})

it('times out a hung request and continues polling, even if the request ignores cancellation', async () => {
  const refresh = vi.fn<(signal: AbortSignal) => Promise<void>>()
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValue(undefined)
  const onError = vi.fn()
  const poller = startGameStatePolling({ refresh, isVisible: () => true, onError })

  await vi.advanceTimersByTimeAsync(10_000)
  expect(refresh.mock.calls[0][0].aborted).toBe(true)
  expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'Game sync request timed out.' }))
  await vi.advanceTimersByTimeAsync(60_000)
  expect(refresh).toHaveBeenCalledTimes(2)
  poller.dispose()
})

it('does no polling while hidden and refreshes on return when the next poll is due', async () => {
  let visible = false
  const refresh = vi.fn().mockResolvedValue(undefined)
  const poller = startGameStatePolling({ refresh, isVisible: () => visible, onError: vi.fn() })

  await vi.advanceTimersByTimeAsync(60_000)
  expect(refresh).not.toHaveBeenCalled()
  visible = true
  poller.visibilityChanged()
  await vi.advanceTimersByTimeAsync(0)
  expect(refresh).toHaveBeenCalledTimes(1)
  visible = false
  poller.visibilityChanged()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(refresh).toHaveBeenCalledTimes(1)
  visible = true
  poller.visibilityChanged()
  expect(refresh).toHaveBeenCalledTimes(2)
  poller.dispose()
})

it('does not bypass the one-minute interval when switching tabs', async () => {
  let visible = true
  const refresh = vi.fn().mockResolvedValue(undefined)
  const poller = startGameStatePolling({ refresh, isVisible: () => visible, onError: vi.fn() })

  await vi.advanceTimersByTimeAsync(5_000)
  visible = false
  poller.visibilityChanged()
  await vi.advanceTimersByTimeAsync(5_000)
  visible = true
  poller.visibilityChanged()
  expect(refresh).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(49_999)
  expect(refresh).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(refresh).toHaveBeenCalledTimes(2)
  poller.dispose()
})

it('cancels work on disposal and reports no errors or further polls', async () => {
  const refresh = vi.fn(() => new Promise<void>(() => {}))
  const onError = vi.fn()
  const poller = startGameStatePolling({ refresh, isVisible: () => true, onError })

  poller.dispose()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(onError).not.toHaveBeenCalled()
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

it('retries failed requests', async () => {
  const refresh = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined)
  const onError = vi.fn()
  const poller = startGameStatePolling({ refresh, isVisible: () => true, onError })

  await vi.advanceTimersByTimeAsync(60_000)
  expect(onError).toHaveBeenCalledTimes(1)
  expect(refresh).toHaveBeenCalledTimes(2)
  poller.dispose()
})
