import { useEffect, useState } from 'react'

import { type ResourceProcessingPriority } from '../db/resource-supply'
import { type ResourceId } from '../db/resources'
import {
  getResourcePriorityStorageKey,
  parseResourcePriorityOverrides,
  type ResourcePriorityOverrides,
} from '../helpers/resource-priorities/resource-priorities'

const empty: ResourcePriorityOverrides = {}
const read = (key: string) => {
  try {
    return parseResourcePriorityOverrides(window.localStorage.getItem(key))
  } catch {
    return empty
  }
}

export const useResourcePriorities = (saveId: string | null | undefined) => {
  const key = getResourcePriorityStorageKey(saveId)
  const [saved, setSaved] = useState<Record<string, ResourcePriorityOverrides>>({})

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

  const setPriority = (zoneId: number, resourceId: ResourceId, priority: ResourceProcessingPriority) => {
    if (!key) return false
    const current = read(key)
    const next = { ...current, [zoneId]: { ...current[zoneId], [resourceId]: priority } }

    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      return false
    }
    setSaved(values => ({ ...values, [key]: next }))
    return true
  }

  return {
    overrides: key ? saved[key] ?? empty : empty,
    ready: key == null || Object.hasOwn(saved, key),
    setPriority,
  }
}
