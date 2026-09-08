import { type ValueSource } from './data-source'
import { focusCatalog, mapFocusValues, type FocusEffectId } from './db/offices'

export interface SyncedFocusState {
  targetStep: number
  activeStep: number
}

export type SyncedFocusStates = Record<FocusEffectId, SyncedFocusState>

interface FocusAllocation {
  step: number | null
  source: ValueSource | null
  synced: SyncedFocusState | null
}

export type FocusAllocations = Record<FocusEffectId, FocusAllocation>

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)
const isComplete = (states: Record<FocusEffectId, SyncedFocusState | null>): states is SyncedFocusStates => (
  Object.values(states).every(state => state !== null)
)

export const normalizeFocusStates = (value: unknown): SyncedFocusStates | null => {
  if (!isRecord(value)) return null
  const states = mapFocusValues(id => {
    const entry = value[id]
    const focus = focusCatalog.find(candidate => candidate.id === id)

    if (!focus || !isRecord(entry)) return null
    const { targetStep, activeStep } = entry

    if (
      typeof targetStep !== 'number' || !Number.isInteger(targetStep)
      || targetStep < 0 || targetStep > focus.maxStep
      || typeof activeStep !== 'number' || !Number.isInteger(activeStep)
      || activeStep < 0 || activeStep > targetStep
    ) return null
    return { targetStep, activeStep }
  })

  return isComplete(states) ? states : null
}

export const resolveFocusAllocations = (
  synced: SyncedFocusStates | undefined,
  overrides: Partial<Record<FocusEffectId, number>>,
): FocusAllocations => mapFocusValues(id => {
  const current = synced?.[id] ?? null
  const target = overrides[id]
  // Selected game steps describe steady operation; active steps can dip each tick.
  const step = target ?? current?.targetStep ?? null
  let source: ValueSource | null = current ? 'synced' : null

  if (target !== undefined && target !== current?.targetStep) source = 'planned'

  return { step, source, synced: current }
})
