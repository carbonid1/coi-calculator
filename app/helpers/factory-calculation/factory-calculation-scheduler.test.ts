import { expect, it, vi } from 'vitest'

import { createCalculationScheduler } from './factory-calculation-scheduler'

const createDeferred = <Value>() => {
  let resolve!: (value: Value) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Value>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, reject, resolve }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

it('runs one calculation at a time and keeps only the newest queued revision', async () => {
  const deferred = new Map<string, ReturnType<typeof createDeferred<number>>>()
  const calculate = vi.fn((revision: string) => {
    const job = createDeferred<number>()

    deferred.set(revision, job)
    return job.promise
  })
  const onSettled = vi.fn()
  const scheduler = createCalculationScheduler<number, number>({
    calculate,
    onError: vi.fn(),
    onSettled,
  })

  scheduler.request('a', 1)
  scheduler.request('b', 2)
  scheduler.request('c', 3)

  expect(calculate).toHaveBeenCalledTimes(1)

  deferred.get('a')!.resolve(10)
  await flush()

  expect(onSettled).toHaveBeenCalledWith('a', 1, 10)
  expect(calculate).toHaveBeenCalledTimes(2)
  expect(calculate).toHaveBeenLastCalledWith('c', 3)

  deferred.get('c')!.resolve(30)
  await flush()

  expect(onSettled).toHaveBeenLastCalledWith('c', 3, 30)
  expect(calculate).toHaveBeenCalledTimes(2)
})

it('does not re-run or queue the revision already in flight', async () => {
  const job = createDeferred<number>()
  const calculate = vi.fn(() => job.promise)
  const onSettled = vi.fn()
  const scheduler = createCalculationScheduler<number, number>({
    calculate,
    onError: vi.fn(),
    onSettled,
  })

  scheduler.request('a', 1)
  scheduler.request('b', 2)
  scheduler.request('a', 1)
  job.resolve(10)
  await flush()

  expect(calculate).toHaveBeenCalledTimes(1)
  expect(onSettled).toHaveBeenCalledTimes(1)
})

it('reports failures and continues with the queued revision', async () => {
  const first = createDeferred<number>()
  const calculate = vi
    .fn<(revision: string, input: number) => Promise<number>>()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(20)
  const onError = vi.fn()
  const onSettled = vi.fn()
  const scheduler = createCalculationScheduler<number, number>({
    calculate,
    onError,
    onSettled,
  })

  scheduler.request('a', 1)
  scheduler.request('b', 2)
  first.reject(new Error('boom'))
  await flush()

  expect(onError).toHaveBeenCalledWith('a', expect.any(Error))
  expect(onSettled).toHaveBeenCalledWith('b', 2, 20)
})

it('ignores results after dispose', async () => {
  const job = createDeferred<number>()
  const onSettled = vi.fn()
  const scheduler = createCalculationScheduler<number, number>({
    calculate: () => job.promise,
    onError: vi.fn(),
    onSettled,
  })

  scheduler.request('a', 1)
  scheduler.dispose()
  job.resolve(10)
  await flush()

  expect(onSettled).not.toHaveBeenCalled()
})
