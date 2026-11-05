import { useEffect, useState } from 'react'

import {
  type ContractFullThrottlePreferences,
  parseContractPreferences,
} from '../helpers/contracts/contract-preferences'

const empty: ContractFullThrottlePreferences = {}
const read = (key: string) => {
  try {
    return parseContractPreferences(window.localStorage.getItem(key))
  } catch {
    return empty
  }
}

export const useOperatingPreferences = (key: string | null) => {
  const [saved, setSaved] = useState<Record<string, ContractFullThrottlePreferences>>({})

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

  const setFullThrottle = (sourceId: string, enabled: boolean) => {
    if (!key) return false
    // Keep choices while a setup is paused, absent, or reassigned.
    const next = { ...read(key), [sourceId]: enabled }

    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      return false
    }
    setSaved(current => ({ ...current, [key]: next }))
    return true
  }

  return {
    preferences: key ? saved[key] ?? empty : empty,
    ready: key == null || Object.hasOwn(saved, key),
    canSave: key != null && Object.hasOwn(saved, key),
    setFullThrottle,
  }
}
