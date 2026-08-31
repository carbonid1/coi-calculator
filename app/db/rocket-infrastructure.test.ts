import { describe, expect, it } from 'vitest'

import {
  emptyRocketInfrastructureConfig,
  plannedRocketInfrastructureConfig,
  rocketInfrastructureItems,
} from './rocket-infrastructure'

describe('Space Station physical buildings', () => {
  it('plans one Rocket Assembly Depot and one Rocket Launch Pad over an empty baseline', () => {
    expect(emptyRocketInfrastructureConfig).toEqual({
      rocketAssemblyDepot: 0,
      rocketLaunchPad: 0,
    })
    expect(plannedRocketInfrastructureConfig).toEqual({
      rocketAssemblyDepot: 1,
      rocketLaunchPad: 1,
    })
    expect(rocketInfrastructureItems.reduce(
      (total, item) => total + plannedRocketInfrastructureConfig[item.id] * item.workers,
      0,
    )).toBe(190)
  })

})
