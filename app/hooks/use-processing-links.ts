import { useEffect, useState } from 'react'

import { getProcessingLinksStorageKey, parseProcessingLinks, type ProcessingLink } from '../helpers/processing-links/processing-links'

const empty: ProcessingLink[] = []
const read = (key: string) => {
  try { return parseProcessingLinks(window.localStorage.getItem(key)) }
  catch { return empty }
}

export const useProcessingLinks = (saveId: string | null | undefined) => {
  const storageKey = getProcessingLinksStorageKey(saveId)
  const [saved, setSaved] = useState<Record<string, ProcessingLink[]>>({})

  useEffect(() => {
    if (!storageKey) return
    const refresh = () => setSaved(current => ({ ...current, [storageKey]: read(storageKey) }))
    const frame = requestAnimationFrame(refresh)
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) refresh()
    }

    window.addEventListener('storage', onStorage)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('storage', onStorage) }
  }, [storageKey])

  return {
    links: storageKey ? saved[storageKey] ?? empty : empty,
    ready: storageKey === null || storageKey in saved,
    canSave: storageKey !== null && storageKey in saved,
    update: (change: (links: ProcessingLink[]) => ProcessingLink[]) => {
      if (!storageKey) return false
      const next = change(read(storageKey))

      try { window.localStorage.setItem(storageKey, JSON.stringify(next)) }
      catch { return false }
      setSaved(current => ({ ...current, [storageKey]: next }))
      return true
    },
  }
}
