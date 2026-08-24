import { describe, expect, it } from 'vitest'

import { defaultInfiniteResearchLevels, worldMineOutputResearch } from '../../db/research'
import { calculateWorldMineOutput } from './calculate-world-mine-output'

describe('calculateWorldMineOutput', () => {
  it('applies the configured level-five default', () => {
    expect(defaultInfiniteResearchLevels.worldMineOutput).toBe(5)
    expect(calculateWorldMineOutput(defaultInfiniteResearchLevels.worldMineOutput)).toEqual({
      level: 5,
      bonusPercent: 10,
      focusBonusPercent: 0,
      multiplier: 1.1,
      researchBonusPercent: 10,
    })
  })

  it('adds two percent of bonus output per whole research level', () => {
    expect(worldMineOutputResearch.percentPerLevel).toBe(2)
    expect(calculateWorldMineOutput(3.9)).toEqual({
      level: 3,
      bonusPercent: 6,
      focusBonusPercent: 0,
      multiplier: 1.06,
      researchBonusPercent: 6,
    })
  })

  it('clamps the research to the in-game level range', () => {
    expect(worldMineOutputResearch.maxLevel).toBe(50)
    expect(calculateWorldMineOutput(-1).level).toBe(0)
    expect(calculateWorldMineOutput(51)).toEqual({
      level: 50,
      bonusPercent: 100,
      focusBonusPercent: 0,
      multiplier: 2,
      researchBonusPercent: 100,
    })
  })

  it('adds the world mines Focus bonus', () => {
    expect(calculateWorldMineOutput(5, 10)).toMatchObject({
      bonusPercent: 20,
      focusBonusPercent: 10,
      researchBonusPercent: 10,
    })
  })
})
