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

self.addEventListener('message', async ({ data }: MessageEvent<FactoryCalculationRequest>) => {
  try {
    if (!restored) {
      restored = true
      const saved = await readSavedFactoryCalculation(data.model.snapshot.saveId, data.version)

      if (saved) {
        if (saved.revision === data.revision) {
          respond({ type: 'settled', result: { ...saved, model: data.model }, revision: data.revision })
          return
        }
        respond({ type: 'preview', result: saved, revision: data.revision })
      }
    }

    const result: SavedFactoryCalculation = {
      calculation: calculateFactoryCalculation(data.model.factoryCalculationInput),
      model: data.model,
      revision: data.revision,
      version: data.version,
    }

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
