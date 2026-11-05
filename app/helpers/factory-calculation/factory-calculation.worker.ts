import { type CalculatorModel } from '../calculator-model/derive-calculator-model'
import { calculateFactoryCalculation, type FactoryCalculation } from './factory-calculation'
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
// Keep a few recently visited operating configurations, without retaining old
// snapshots. Returning to one still pairs its solve with the newest live model.
const recent = { restored: false, identity: '', calculations: new Map<string, FactoryCalculation>() }
const MAX_RECENT_CALCULATIONS = 3

self.addEventListener('message', async ({ data }: MessageEvent<FactoryCalculationRequest>) => {
  try {
    const input = JSON.stringify(data.model.factoryCalculationInput)
    const identity = JSON.stringify([data.model.snapshot.saveId, data.version])

    if (recent.identity !== identity) {
      recent.identity = identity
      recent.calculations.clear()
    }

    if (!recent.restored) {
      recent.restored = true
      const saved = await readSavedFactoryCalculation(data.model.snapshot.saveId, data.version)

      if (saved) {
        const savedInput = JSON.stringify(saved.model.factoryCalculationInput)

        if (savedInput) recent.calculations.set(savedInput, saved.calculation)
        if (saved.revision === data.revision) {
          recent.calculations.set(input, saved.calculation)
          respond({ type: 'settled', result: { ...saved, model: data.model }, revision: data.revision })
          return
        }
        if (savedInput !== input) respond({ type: 'preview', result: saved, revision: data.revision })
      }
    }

    const result: SavedFactoryCalculation = {
      calculation: recent.calculations.get(input) ?? calculateFactoryCalculation(data.model.factoryCalculationInput),
      model: data.model,
      revision: data.revision,
      version: data.version,
    }

    recent.calculations.delete(input)
    recent.calculations.set(input, result.calculation)
    if (recent.calculations.size > MAX_RECENT_CALCULATIONS) {
      const oldest = recent.calculations.keys().next().value

      if (oldest !== undefined) recent.calculations.delete(oldest)
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
