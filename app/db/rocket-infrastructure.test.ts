import { describe, expect, it } from 'vitest'

import {
  emptyRocketInfrastructureConfig,
  normalizeRocketInfrastructureConfig,
} from './rocket-infrastructure'

describe('Space Station physical buildings', () => {
  it('normalizes the synced rocket inventory', () => {
    expect(emptyRocketInfrastructureConfig).toEqual({
      rocketAssemblyDepot: 0,
      rocketLaunchPad: 0,
    })
    expect(normalizeRocketInfrastructureConfig({
      rocketAssemblyDepot: 1.8,
      rocketLaunchPad: -1,
    })).toEqual({
      rocketAssemblyDepot: 1,
      rocketLaunchPad: 0,
    })
  })

})
