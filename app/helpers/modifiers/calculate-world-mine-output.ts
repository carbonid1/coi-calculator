import { worldMineOutputResearch } from '../../db/research'

export interface WorldMineOutputResult {
  level: number
  bonusPercent: number
  multiplier: number
}

export const calculateWorldMineOutput = (level: number): WorldMineOutputResult => {
  const normalizedLevel = Math.min(worldMineOutputResearch.maxLevel, Math.max(0, Math.trunc(level)))
  const bonusPercent = normalizedLevel * worldMineOutputResearch.percentPerLevel

  return {
    level: normalizedLevel,
    bonusPercent,
    multiplier: 1 + bonusPercent / 100,
  }
}
