import { describe, expect, it } from 'vitest'

import { worldMines } from '../../db/world-mines'
import { calculateWorldMineProduction } from './calculate-world-mine-production'

describe('calculateWorldMineProduction', () => {
  it('normalizes the game-native sulfur rate to one production cycle', () => {
    expect(calculateWorldMineProduction(worldMines.sulfurMine, 1, 0)).toMatchObject({
      productionLevel: 1,
      researchLevel: 0,
      baseOutputPerCycle: 54,
      averageOutputPerCycle: 54,
      outputThisCycle: 54,
      bonusCarryHundredths: 0,
      finiteReserveConsumedPerCycle: null,
    })
  })

  it('carries fractional research output between production cycles', () => {
    let carry = 0
    const outputs: number[] = []

    for (let cycle = 0; cycle < 5; cycle += 1) {
      const result = calculateWorldMineProduction(worldMines.sulfurMine, 1, 5, carry)

      outputs.push(result.outputThisCycle)
      carry = result.bonusCarryHundredths
      expect(result.averageOutputPerCycle).toBeCloseTo(59.4)
    }

    expect(outputs).toEqual([59, 59, 60, 59, 60])
    expect(outputs.reduce((sum, output) => sum + output, 0)).toBe(297)
    expect(carry).toBe(0)
  })

  it('does not charge finite reserves for research bonus units', () => {
    expect(calculateWorldMineProduction(worldMines.coalMine, 2, 5)).toMatchObject({
      baseOutputPerCycle: 96,
      averageBonusOutputPerCycle: 9.6,
      averageOutputPerCycle: 105.6,
      bonusOutputThisCycle: 9,
      outputThisCycle: 105,
      bonusCarryHundredths: 60,
      finiteReserveConsumedPerCycle: 96,
    })
  })

  it('adds Focus output to the fractional bonus carry', () => {
    expect(calculateWorldMineProduction(
      worldMines.sulfurMine,
      1,
      0,
      0,
      10,
    )).toMatchObject({
      researchBonusPercent: 0,
      focusBonusPercent: 10,
      bonusPercent: 10,
      averageBonusOutputPerCycle: 5.4,
      bonusOutputThisCycle: 5,
      bonusCarryHundredths: 40,
    })
  })

  it('applies the research to groundwater wells through the shared mine runtime', () => {
    expect(calculateWorldMineProduction(worldMines.groundwaterWell, 1, 5)).toMatchObject({
      baseOutputPerCycle: 48,
      averageOutputPerCycle: 52.8,
      outputThisCycle: 52,
      bonusCarryHundredths: 80,
      finiteReserveConsumedPerCycle: null,
    })
  })
})
