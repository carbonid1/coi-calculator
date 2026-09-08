import { type CalculatorModel } from '../calculator-model/derive-calculator-model'
import { calculateFactoryCalculation } from './factory-calculation'
import {
  readSavedFactoryCalculation,
  type SavedFactoryCalculation,
  writeSavedFactoryCalculation,
} from './factory-calculation-cache'

export interface FactoryCalculationRequest {
  model: CalculatorModel
  revision: string
  version: string
}

export type FactoryCalculationResponse =
  | { type: 'preview'; result: SavedFactoryCalculation; revision: string }
  | { type: 'settled'; result: SavedFactoryCalculation; revision: string }
  | { type: 'error'; error: string; revision: string }

const respond = (response: FactoryCalculationResponse) => self.postMessage(response)
let restored = false
let previous: SavedFactoryCalculation | null = null
let previousInput: string | undefined

self.addEventListener('message', async ({ data }: MessageEvent<FactoryCalculationRequest>) => {
  try {
    const input = JSON.stringify(data.model.factoryCalculationInput)

    if (!restored) {
      restored = true
      const saved = await readSavedFactoryCalculation(data.model.snapshot.saveId, data.version)

      if (saved) {
        previous = saved
        previousInput = JSON.stringify(saved.model.factoryCalculationInput)
        if (saved.revision === data.revision) {
          previous = { ...saved, model: data.model }
          previousInput = input
          respond({ type: 'settled', result: previous, revision: data.revision })
          return
        }
        if (previousInput !== input) respond({ type: 'preview', result: saved, revision: data.revision })
      }
    }

    // Stock levels and other snapshot-only changes need a fresh model, but do
    // not invalidate a solve of identical inputs. Keep only the latest result.
    const reusable = previous && previousInput === input
      && previous.version === data.version
      && previous.model.snapshot.saveId === data.model.snapshot.saveId
      ? previous : null
    const result: SavedFactoryCalculation = {
      calculation: reusable?.calculation ?? calculateFactoryCalculation(data.model.factoryCalculationInput),
      model: data.model,
      revision: data.revision,
      version: data.version,
    }

    previous = result
    previousInput = input
    respond({ type: 'settled', result, revision: data.revision })
    await writeSavedFactoryCalculation(result)
  } catch (error) {
    respond({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
      revision: data.revision,
    })
  }
})
