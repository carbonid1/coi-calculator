import { describe, expect, it } from 'vitest'

import { getPresetResourceDemands } from './preset-resource-demands'

describe('preset resource demands', () => {
  it('combines fixed external loads and requested exports', () => {
    expect(getPresetResourceDemands({
      fixedDemands: { copper: 16, water: 24 },
      requestedExports: { copper: 384 },
    })).toEqual({
      copper: 400,
      water: 24,
    })
  })
})
