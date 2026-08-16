import { describe, expect, it } from 'vitest'

import { defaultInfiniteResearchLevels, worldMineOutputResearch } from '../../db/research'
import { calculateWorldMineOutput } from './calculate-world-mine-output'

describe('calculateWorldMineOutput', () => {
  it('applies the configured level-one default', () => {
    expect(defaultInfiniteResearchLevels.worldMineOutput).toBe(1)
    expect(calculateWorldMineOutput(defaultInfiniteResearchLevels.worldMineOutput)).toEqual({
      level: 1,
      bonusPercent: 2,
      multiplier: 1.02,
    })
  })

  it('adds two percent of bonus output per whole research level', () => {
    expect(worldMineOutputResearch.percentPerLevel).toBe(2)
    expect(calculateWorldMineOutput(3.9)).toEqual({
      level: 3,
      bonusPercent: 6,
      multiplier: 1.06,
    })
  })

  it('clamps the research to the in-game level range', () => {
    expect(worldMineOutputResearch.maxLevel).toBe(50)
    expect(calculateWorldMineOutput(-1).level).toBe(0)
    expect(calculateWorldMineOutput(51)).toEqual({
      level: 50,
      bonusPercent: 100,
      multiplier: 2,
    })
  })
})
