import { getWorldMineBaseOutputPerCycle, type WorldMineDefinition } from '../../db/world-mines'
import { calculateWorldMineOutput } from '../modifiers/calculate-world-mine-output'

const BONUS_CARRY_SCALE = 100

export interface WorldMineProductionResult {
  productionLevel: number
  researchLevel: number
  researchBonusPercent: number
  focusBonusPercent: number
  bonusPercent: number
  baseOutputPerCycle: number
  averageBonusOutputPerCycle: number
  averageOutputPerCycle: number
  bonusOutputThisCycle: number
  outputThisCycle: number
  bonusCarryHundredths: number
  finiteReserveConsumedPerCycle: number | null
}

/**
 * Calculates one 60-second production cycle. The game accumulates fractional
 * research output and releases only whole bonus units, carrying the remainder
 * into later cycles. Finite deposits are charged only for the base output.
 */
export const calculateWorldMineProduction = (
  mine: WorldMineDefinition,
  productionLevel: number,
  researchLevel: number,
  bonusCarryHundredths = 0,
  focusBonusPercent = 0,
): WorldMineProductionResult => {
  const normalizedProductionLevel = Math.min(
    mine.maxProductionLevel,
    Math.max(0, Math.trunc(productionLevel)),
  )
  const normalizedCarry = Math.min(
    BONUS_CARRY_SCALE - 1,
    Math.max(0, Math.trunc(bonusCarryHundredths)),
  )
  const research = calculateWorldMineOutput(researchLevel, focusBonusPercent)
  const baseOutputPerCycle = getWorldMineBaseOutputPerCycle(mine, normalizedProductionLevel)
  const availableBonusHundredths = normalizedCarry + baseOutputPerCycle * research.bonusPercent
  const bonusOutputThisCycle = Math.floor(availableBonusHundredths / BONUS_CARRY_SCALE)
  const nextBonusCarryHundredths = availableBonusHundredths % BONUS_CARRY_SCALE
  const averageBonusOutputPerCycle =
    (baseOutputPerCycle * research.bonusPercent) / BONUS_CARRY_SCALE

  return {
    productionLevel: normalizedProductionLevel,
    researchLevel: research.level,
    researchBonusPercent: research.researchBonusPercent,
    focusBonusPercent: research.focusBonusPercent,
    bonusPercent: research.bonusPercent,
    baseOutputPerCycle,
    averageBonusOutputPerCycle,
    averageOutputPerCycle: baseOutputPerCycle + averageBonusOutputPerCycle,
    bonusOutputThisCycle,
    outputThisCycle: baseOutputPerCycle + bonusOutputThisCycle,
    bonusCarryHundredths: nextBonusCarryHundredths,
    finiteReserveConsumedPerCycle: mine.baseReserve === null ? null : baseOutputPerCycle,
  }
}
