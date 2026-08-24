import { worldMineOutputResearch } from '../../db/research'

export interface WorldMineOutputResult {
  level: number
  researchBonusPercent: number
  focusBonusPercent: number
  bonusPercent: number
  multiplier: number
}

export const calculateWorldMineOutput = (
  level: number,
  focusBonusPercent = 0,
): WorldMineOutputResult => {
  const normalizedLevel = Math.min(worldMineOutputResearch.maxLevel, Math.max(0, Math.trunc(level)))
  const researchBonusPercent = normalizedLevel * worldMineOutputResearch.percentPerLevel
  const normalizedFocusBonusPercent = Math.max(0, focusBonusPercent)
  const bonusPercent = researchBonusPercent + normalizedFocusBonusPercent

  return {
    level: normalizedLevel,
    researchBonusPercent,
    focusBonusPercent: normalizedFocusBonusPercent,
    bonusPercent,
    multiplier: 1 + bonusPercent / 100,
  }
}
