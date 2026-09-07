import { type CalculatorModel } from '../calculator-model/derive-calculator-model'
import { type FactoryCalculation } from './factory-calculation'

export interface SavedFactoryCalculation {
  calculation: FactoryCalculation
  model: CalculatorModel
  revision: string
  version: string
}

const DATABASE_NAME = 'coi-factory-calculation'
const STORE_NAME = 'results'
const CACHE_KEY = 'latest'
const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

export const isCompatibleFactoryCalculation = (
  value: unknown,
  saveId: string,
  version: string,
): value is SavedFactoryCalculation => {
  if (!isRecord(value) || !isRecord(value.model) || !isRecord(value.calculation)) return false
  const { model, calculation } = value

  return value.version === version
    && typeof value.revision === 'string'
    && isRecord(model.snapshot) && model.snapshot.saveId === saveId
    && model.calculationRevision === value.revision
    && Array.isArray(model.configuredModules)
    && isRecord(calculation.factoryResult)
    && Array.isArray(calculation.factoryResult.allLines)
    && Array.isArray(calculation.factoryResult.contractFlows)
    && isRecord(calculation.factoryResult.calculation)
    && Array.isArray(calculation.factoryResult.calculation.resourceFlows)
    && isRecord(calculation.linkedModulesResult)
    && Array.isArray(calculation.linkedModulesResult.boundaries)
    && calculation.linkedModulesResult.moduleResults instanceof Map
}

/** Worker-only storage. One atomic record keeps the model and its result paired. */
const withStore = <Value>(
  mode: IDBTransactionMode,
  fallback: Value,
  run: (store: IDBObjectStore) => IDBRequest<Value>,
): Promise<Value> => new Promise(resolve => {
  let database: IDBDatabase | undefined
  let finished = false
  const finish = (value: Value) => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    database?.close()
    resolve(value)
  }
  // A blocked/disabled browser database must never hold up the calculation.
  const timer = setTimeout(() => finish(fallback), 500)

  try {
    const open = indexedDB.open(DATABASE_NAME, 1)

    open.onupgradeneeded = () => open.result.createObjectStore(STORE_NAME)
    open.onerror = () => finish(fallback)
    open.onblocked = () => finish(fallback)
    open.onsuccess = () => {
      database = open.result
      if (finished) {
        database.close()
        return
      }
      database.onversionchange = () => database?.close()
      try {
        const transaction = database.transaction(STORE_NAME, mode)
        const request = run(transaction.objectStore(STORE_NAME))

        transaction.oncomplete = () => finish(request.result)
        transaction.onabort = () => finish(fallback)
        transaction.onerror = () => finish(fallback)
      } catch {
        finish(fallback)
      }
    }
  } catch {
    finish(fallback)
  }
})

export const readSavedFactoryCalculation = async (saveId: string, version: string) => {
  const entry: unknown = await withStore('readonly', undefined, store => store.get(CACHE_KEY))

  return isCompatibleFactoryCalculation(entry, saveId, version) ? entry : null
}

export const writeSavedFactoryCalculation = async (entry: SavedFactoryCalculation) => {
  await withStore<IDBValidKey>('readwrite', '', store => store.put(entry, CACHE_KEY))
}
