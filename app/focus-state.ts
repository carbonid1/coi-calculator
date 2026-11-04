import { type ValueSource } from './data-source'
import { mapFocusValues, type FocusEffectId } from './db/offices'
import { getFocusDefinitions, type OfficeFocusDefinitions } from './office-focus-state'

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

export const normalizeFocusStates = (value: unknown, definitions: OfficeFocusDefinitions): SyncedFocusStates | null => {
  if (!isRecord(value)) return null
  const focuses = getFocusDefinitions(definitions)
  const states = mapFocusValues(id => {
    const entry = value[id]
    const focus = focuses.find(candidate => candidate.id === id)

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
  const syncedSource: ValueSource | null = current ? 'synced' : null
  const source: ValueSource | null = target !== undefined && target !== current?.targetStep ? 'planned' : syncedSource

  return { step, source, synced: current }
})
