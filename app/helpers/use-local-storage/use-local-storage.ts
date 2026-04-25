'use client'

import { useCallback, useState } from 'react'
import type { z } from 'zod'

export const useLocalStorage = <S extends z.ZodType>(
  key: string,
  schema: S,
  initial: z.infer<S>,
): [z.infer<S>, (value: z.infer<S> | ((prev: z.infer<S>) => z.infer<S>)) => void] => {
  const [stored, setStored] = useState<z.infer<S>>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const item = window.localStorage.getItem(key)

      if (!item) return initial
      const parsed = schema.safeParse(JSON.parse(item))

      return parsed.success ? parsed.data : initial
    } catch {
      return initial
    }
  })

  const setValue = useCallback(
    (value: z.infer<S> | ((prev: z.infer<S>) => z.infer<S>)) => {
      setStored(prev => {
        const next = value instanceof Function ? value(prev) : value

        try {
          window.localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* quota exceeded — ignore */
        }
        return next
      })
    },
    [key],
  )

  return [stored, setValue]
}
