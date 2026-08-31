import { expect, it, vi } from 'vitest'

import { createLatestRevisionCache } from './latest-revision-cache'

it('reuses the calculated value while the revision is unchanged', () => {
  const getValue = createLatestRevisionCache<object>()
  const calculate = vi.fn(() => ({ result: 1 }))

  expect(getValue('revision-a', calculate)).toBe(getValue('revision-a', calculate))
  expect(calculate).toHaveBeenCalledTimes(1)
})

it('recalculates when the revision changes and retains only the latest value', () => {
  const getValue = createLatestRevisionCache<object>()
  const calculate = vi.fn(() => ({}))

  getValue('revision-a', calculate)
  getValue('revision-b', calculate)
  getValue('revision-a', calculate)

  expect(calculate).toHaveBeenCalledTimes(3)
})
