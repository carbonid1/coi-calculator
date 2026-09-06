import {
  calculateFactoryCalculation,
  type FactoryCalculation,
  type FactoryCalculationInput,
} from './factory-calculation'

export interface FactoryCalculationRequest {
  input: FactoryCalculationInput
  revision: string
}

export type FactoryCalculationResponse =
  | { calculation: FactoryCalculation; error?: undefined; revision: string }
  | { calculation?: undefined; error: string; revision: string }

const respond = (response: FactoryCalculationResponse) => self.postMessage(response)

self.addEventListener('message', ({ data }: MessageEvent<FactoryCalculationRequest>) => {
  try {
    respond({
      calculation: calculateFactoryCalculation(data.input),
      revision: data.revision,
    })
  } catch (error) {
    respond({
      error: error instanceof Error ? error.message : String(error),
      revision: data.revision,
    })
  }
})
