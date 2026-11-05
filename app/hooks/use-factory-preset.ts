import { useEffect, useState } from 'react'

import { getFactoryPreset, getFactoryPresetStorageKey, type FactoryPresetId } from '../db/factory-presets'
import { type ResourceProcessingPriority } from '../db/resource-supply'
import { type ResourceId } from '../db/resources'
import { parseContractPreferences, type ContractFullThrottlePreferences } from '../helpers/contracts/contract-preferences'
import { parseResourcePriorityOverrides, type ResourcePriorityOverrides } from '../helpers/resource-priorities/resource-priorities'

interface ForecastChanges {
  contracts: ContractFullThrottlePreferences
  worldMines: ContractFullThrottlePreferences
  priorities: ResourcePriorityOverrides
}

interface PresetState {
  presetId: FactoryPresetId
  changes: ForecastChanges | null
}

const emptyChanges: ForecastChanges = { contracts: {}, worldMines: {}, priorities: {} }
const initial: PresetState = { presetId: 'current', changes: null }
const read = (key: string): PresetState => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null')

    if (!value || typeof value !== 'object' || !('presetId' in value)) return initial
    const presetId = getFactoryPreset(typeof value.presetId === 'string' ? value.presetId : null).id
    const changes = 'changes' in value ? value.changes : null

    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return { presetId, changes: null }
    return { presetId, changes: {
      contracts: parseContractPreferences(JSON.stringify('contracts' in changes ? changes.contracts : {})),
      worldMines: parseContractPreferences(JSON.stringify('worldMines' in changes ? changes.worldMines : {})),
      priorities: parseResourcePriorityOverrides(JSON.stringify('priorities' in changes ? changes.priorities : {})),
    } }
  } catch {
    return initial
  }
}

export const useFactoryPreset = (saveId: string | null | undefined) => {
  const key = getFactoryPresetStorageKey(saveId)
  const [saved, setSaved] = useState<Record<string, PresetState>>({})

  useEffect(() => {
    if (!key) return
    const refresh = () => setSaved(current => ({ ...current, [key]: read(key) }))
    const frame = window.requestAnimationFrame(refresh)
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) refresh()
    }

    window.addEventListener('storage', onStorage)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('storage', onStorage)
    }
  }, [key])

  const current = key ? saved[key] ?? initial : initial
  const changes = current.changes ?? emptyChanges
  const write = (next: PresetState) => {
    if (!key) return false
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      return false
    }
    setSaved(values => ({ ...values, [key]: next }))
    return true
  }

  return {
    presetId: current.presetId,
    isModified: current.changes !== null,
    changes,
    ready: key == null || Object.hasOwn(saved, key),
    canSave: key != null && Object.hasOwn(saved, key),
    // Selecting a preset discards the entire draft, including hidden settings.
    selectPreset: (presetId: FactoryPresetId) => write({ presetId, changes: null }),
    setContractMode: (id: string, enabled: boolean) => write({ ...current,
      changes: { ...changes, contracts: { ...changes.contracts, [id]: enabled } } }),
    setWorldMineMode: (id: string, enabled: boolean) => write({ ...current,
      changes: { ...changes, worldMines: { ...changes.worldMines, [id]: enabled } } }),
    setPriority: (zoneId: number, resourceId: ResourceId, priority: ResourceProcessingPriority) => write({ ...current,
      changes: { ...changes, priorities: { ...changes.priorities,
        [zoneId]: { ...changes.priorities[zoneId], [resourceId]: priority } } } }),
  }
}
