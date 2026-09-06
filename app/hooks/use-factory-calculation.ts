import { useEffect, useRef, useState } from 'react'

import {
  calculateFactoryCalculation,
  type FactoryCalculation,
  type FactoryCalculationInput,
} from '../helpers/factory-calculation/factory-calculation'
import {
  createCalculationScheduler,
  type CalculationScheduler,
} from '../helpers/factory-calculation/factory-calculation-scheduler'
import {
  type FactoryCalculationRequest,
  type FactoryCalculationResponse,
} from '../helpers/factory-calculation/factory-calculation.worker'
import { createLatestRevisionCache } from '../helpers/latest-revision-cache/latest-revision-cache'

export interface SettledFactoryCalculation<Model> {
  calculation: FactoryCalculation
  /** True while a newer revision is still being solved off the main thread. */
  isStale: boolean
  model: Model
  revision: string
}

interface SettledState<Model> {
  calculation: FactoryCalculation
  model: Model
  revision: string
}

interface CalculationJob<Model> {
  input: FactoryCalculationInput
  model: Model
}

const getInitialCalculation = createLatestRevisionCache<FactoryCalculation>()

const createWorker = () => {
  if (typeof Worker === 'undefined') return null

  try {
    return new Worker(
      new URL('../helpers/factory-calculation/factory-calculation.worker.ts', import.meta.url),
    )
  } catch {
    return null
  }
}

const calculateInWorker = (
  worker: Worker,
  revision: string,
  input: FactoryCalculationInput,
) => new Promise<FactoryCalculation>((resolve, reject) => {
  const cleanup = () => {
    worker.removeEventListener('message', onMessage)
    worker.removeEventListener('error', onError)
  }
  const onMessage = ({ data }: MessageEvent<FactoryCalculationResponse>) => {
    if (data.revision !== revision) return
    cleanup()
    if (data.calculation) {
      resolve(data.calculation)
    } else {
      reject(new Error(data.error))
    }
  }
  const onError = (event: ErrorEvent) => {
    cleanup()
    reject(event.error instanceof Error ? event.error : new Error(event.message))
  }
  const request: FactoryCalculationRequest = { input, revision }

  worker.addEventListener('message', onMessage)
  worker.addEventListener('error', onError)
  worker.postMessage(request)
})

/**
 * Keeps the factory solved for the latest `revision` without blocking the UI.
 * The first revision is solved synchronously so server and client render the
 * same markup. Later revisions are solved in a Web Worker while the previous
 * model and calculation stay on screen, then both swap together.
 */
export const useFactoryCalculation = <Model>(
  revision: string | null,
  model: Model | null,
  getInput: (model: Model) => FactoryCalculationInput,
): SettledFactoryCalculation<Model> | null => {
  const [settled, setSettled] = useState<SettledState<Model> | null>(() => (
    revision !== null && model !== null
      ? {
          calculation: getInitialCalculation(
            revision,
            () => calculateFactoryCalculation(getInput(model)),
          ),
          model,
          revision,
        }
      : null
  ))
  const schedulerRef = useRef<CalculationScheduler<CalculationJob<Model>> | null>(null)

  useEffect(() => {
    const worker = createWorker()
    const scheduler = createCalculationScheduler<CalculationJob<Model>, FactoryCalculation>({
      calculate: (jobRevision, job) => (
        worker
          ? calculateInWorker(worker, jobRevision, job.input)
          : Promise.resolve(calculateFactoryCalculation(job.input))
      ),
      onError: (_jobRevision, error) => {
        console.error('Factory calculation failed off the main thread.', error)
      },
      onSettled: (jobRevision, job, calculation) => {
        setSettled({ calculation, model: job.model, revision: jobRevision })
      },
    })

    schedulerRef.current = scheduler

    return () => {
      scheduler.dispose()
      schedulerRef.current = null
      worker?.terminate()
    }
  }, [])

  useEffect(() => {
    if (revision === null || model === null) return
    if (settled?.revision === revision) return

    // Re-requesting the revision already in flight is a no-op in the scheduler.
    schedulerRef.current?.request(revision, { input: getInput(model), model })
  }, [getInput, model, revision, settled?.revision])

  if (!settled) return null

  return { ...settled, isStale: settled.revision !== revision }
}
