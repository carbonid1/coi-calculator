import { describe, expect, it } from 'vitest'

import { emptyStaticInfrastructureConfig } from './static-infrastructure'

describe('static infrastructure workforce', () => {
  it('uses zero for every sync-owned count before a snapshot is available', () => {
    expect(Object.values(emptyStaticInfrastructureConfig).every(count => count === 0)).toBe(true)
  })
})
