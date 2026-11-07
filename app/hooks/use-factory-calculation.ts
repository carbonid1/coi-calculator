import { useEffect, useRef, useState } from 'react'

import { type CalculatorModel } from '../helpers/calculator-model/derive-calculator-model'
import { type SavedFactoryCalculation } from '../helpers/factory-calculation/factory-calculation-cache'
import {
  createCalculationScheduler,
  type CalculationScheduler,
} from '../helpers/factory-calculation/factory-calculation-scheduler'
import {
  type FactoryCalculationRequest,
  type FactoryCalculationResponse,
} from '../helpers/factory-calculation/factory-calculation.worker'

const calculateInWorker = (
  worker: Worker,
  request: FactoryCalculationRequest,
  onPreview: (result: SavedFactoryCalculation) => void,
  signal: AbortSignal,
) => new Promise<SavedFactoryCalculation>((resolve, reject) => {
  const cleanup = () => {
    clearTimeout(timeout)
    worker.removeEventListener('message', onMessage)
    worker.removeEventListener('error', onError)
    worker.removeEventListener('messageerror', onMessageError)
    signal.removeEventListener('abort', onAbort)
  }
  const fail = (error: Error) => {
    cleanup()
    reject(error)
  }
  const onMessage = ({ data }: MessageEvent<FactoryCalculationResponse>) => {
    if (data.revision !== request.revision) return
    if (data.type === 'preview') {
      onPreview(data.result)
      return
    }
    cleanup()
    if (data.type === 'settled') resolve(data.result)
    else reject(new Error(data.error))
  }
  const onError = (event: ErrorEvent) => fail(new Error(event.message))
  const onMessageError = () => fail(new Error('Could not read the worker result.'))
  const onAbort = () => fail(new Error('Factory calculation cancelled.'))
  const timeout = setTimeout(() => {
    worker.terminate()
    fail(new Error('Factory calculation timed out.'))
  }, 120_000)

  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', onError)
  worker.addEventListener('messageerror', onMessageError)
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    worker.postMessage(request)
  } catch (error) {
    fail(error instanceof Error ? error : new Error(String(error)))
  }
})

/** Restore/solve only in the worker; never run the solver during SSR or hydration. */
export const useFactoryCalculation = (model: CalculatorModel | null, version: string) => {
  const [settled, setSettled] = useState<SavedFactoryCalculation | null>(null)
  const [failureKey, setFailureKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const schedulerRef = useRef<CalculationScheduler<CalculatorModel> | null>(null)
  const saveId = model?.snapshot.saveId ?? null
  const revision = model?.calculationRevision ?? null
  const requestKey = `${saveId}:${version}:${attempt}`
  const failed = failureKey === requestKey

  useEffect(() => {
    if (!saveId) return
    const lifecycle: { worker: Worker | undefined; disposed: boolean } = {
      worker: undefined,
      disposed: false,
    }
    const controller = new AbortController()
    const reportError = (error: unknown) => {
      if (lifecycle.disposed) return
      console.error('Factory calculation failed.', error)
      schedulerRef.current?.dispose()
      setFailureKey(requestKey)
    }

    try {
      lifecycle.worker = new Worker(
        new URL('../helpers/factory-calculation/factory-calculation.worker.ts', import.meta.url),
      )
    } catch (error) {
      // Do not fall back to freezing the main thread if workers are unavailable.
      const timer = setTimeout(() => reportError(error), 0)

      return () => { lifecycle.disposed = true; clearTimeout(timer) }
    }

    const activeWorker = lifecycle.worker
    const scheduler = createCalculationScheduler<CalculatorModel, SavedFactoryCalculation>({
      calculate: (jobRevision, jobModel) => calculateInWorker(
        activeWorker,
        { model: jobModel, revision: jobRevision, version },
        preview => {
          if (!lifecycle.disposed) setSettled(current => current?.model.snapshot.saveId === saveId && current.version === version ? current : preview)
        },
        controller.signal,
      ),
      onError: (_revision, error) => reportError(error),
      onSettled: (_revision, _model, result) => {
        setFailureKey(null)
        setSettled(result)
      },
    })

    schedulerRef.current = scheduler
    return () => {
      lifecycle.disposed = true
      scheduler.dispose()
      schedulerRef.current = null
      controller.abort()
      activeWorker.terminate()
    }
  }, [attempt, requestKey, saveId, version])

  useEffect(() => {
    if (!model || !revision || failed) return
    if (settled?.revision === revision && settled.version === version && settled.model.snapshot.saveId === saveId) return
    schedulerRef.current?.request(revision, model)
  }, [attempt, failed, model, revision, saveId, settled, version])

  // A save switch or code update must never show another factory's old results.
  const visible = settled?.model.snapshot.saveId === saveId && settled.version === version ? settled : null

  return {
    failed,
    retry: () => setAttempt(current => current + 1),
    settled: visible ? { ...visible, isStale: visible.revision !== revision } : null,
  }
}
