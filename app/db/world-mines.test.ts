import { describe, expect, it } from 'vitest'

import { getWorldMineProductionLevels, worldMineCatalog } from './world-mines'

describe('world mine database', () => {
  it('contains every installed v0.8.7 production configuration', () => {
    expect(
      worldMineCatalog.map(mine => ({
        id: mine.id,
        gamePrototypeIds: mine.gamePrototypeIds,
        resourceId: mine.resourceId,
        baseOutputPerCompletion: mine.baseOutputPerCompletion,
        completionDurationSeconds: mine.completionDurationSeconds,
        maxProductionLevel: mine.maxProductionLevel,
        unityPerProductionLevelPerCycle: mine.unityPerProductionLevelPerCycle,
        workersPerProductionLevel: mine.workersPerProductionLevel,
        baseReserve: mine.baseReserve,
      })),
    ).toEqual([
      {
        id: 'oilRig',
        gamePrototypeIds: ['OilRigCost1', 'OilRigCost2', 'OilRigCost3'],
        resourceId: 'crudeOil',
        baseOutputPerCompletion: 10,
        completionDurationSeconds: 20,
        maxProductionLevel: 16,
        unityPerProductionLevelPerCycle: 0.4,
        workersPerProductionLevel: 18,
        baseReserve: 1_000_000,
      },
      {
        id: 'groundwaterWell',
        gamePrototypeIds: ['WaterWell'],
        resourceId: 'water',
        baseOutputPerCompletion: 8,
        completionDurationSeconds: 10,
        maxProductionLevel: 8,
        unityPerProductionLevelPerCycle: 0.2,
        workersPerProductionLevel: 16,
        baseReserve: null,
      },
      {
        id: 'sulfurMine',
        gamePrototypeIds: ['SulfurMine'],
        resourceId: 'sulfur',
        baseOutputPerCompletion: 18,
        completionDurationSeconds: 20,
        maxProductionLevel: 8,
        unityPerProductionLevelPerCycle: 0.2,
        workersPerProductionLevel: 12,
        baseReserve: null,
      },
      {
        id: 'coalMine',
        gamePrototypeIds: ['CoalMine'],
        resourceId: 'coal',
        baseOutputPerCompletion: 16,
        completionDurationSeconds: 20,
        maxProductionLevel: 24,
        unityPerProductionLevelPerCycle: 0.4,
        workersPerProductionLevel: 25,
        baseReserve: 1_500_000,
      },
      {
        id: 'quartzMine',
        gamePrototypeIds: ['QuartzMine'],
        resourceId: 'quartz',
        baseOutputPerCompletion: 12,
        completionDurationSeconds: 20,
        maxProductionLevel: 20,
        unityPerProductionLevelPerCycle: 0.3,
        workersPerProductionLevel: 25,
        baseReserve: 1_000_000,
      },
      {
        id: 'uraniumMine',
        gamePrototypeIds: ['UraniumMine'],
        resourceId: 'uraniumOre',
        baseOutputPerCompletion: 12,
        completionDurationSeconds: 20,
        maxProductionLevel: 20,
        unityPerProductionLevelPerCycle: 0.4,
        workersPerProductionLevel: 25,
        baseReserve: 800_000,
      },
      {
        id: 'rockMine',
        gamePrototypeIds: ['RockMine'],
        resourceId: 'rock',
        baseOutputPerCompletion: 12,
        completionDurationSeconds: 20,
        maxProductionLevel: 32,
        unityPerProductionLevelPerCycle: 0.2,
        workersPerProductionLevel: 25,
        baseReserve: null,
      },
      {
        id: 'limestoneQuarry',
        gamePrototypeIds: ['LimestoneMine'],
        resourceId: 'limestone',
        baseOutputPerCompletion: 8,
        completionDurationSeconds: 20,
        maxProductionLevel: 16,
        unityPerProductionLevelPerCycle: 0.4,
        workersPerProductionLevel: 25,
        baseReserve: 500_000,
      },
      {
        id: 'bauxiteQuarry',
        gamePrototypeIds: ['BauxiteMine'],
        resourceId: 'bauxite',
        baseOutputPerCompletion: 12,
        completionDurationSeconds: 20,
        maxProductionLevel: 24,
        unityPerProductionLevelPerCycle: 0.3,
        workersPerProductionLevel: 25,
        baseReserve: 750_000,
      },
    ])
  })

  it('retains all eleven installed prototype IDs', () => {
    expect(worldMineCatalog.flatMap(mine => mine.gamePrototypeIds)).toEqual([
      'OilRigCost1',
      'OilRigCost2',
      'OilRigCost3',
      'WaterWell',
      'SulfurMine',
      'CoalMine',
      'QuartzMine',
      'UraniumMine',
      'RockMine',
      'LimestoneMine',
      'BauxiteMine',
    ])
  })

  it('derives every selectable production level from the base rate', () => {
    for (const mine of worldMineCatalog) {
      const levels = getWorldMineProductionLevels(mine)
      const outputPerLevelPerCycle =
        (mine.baseOutputPerCompletion * 60) / mine.completionDurationSeconds

      expect(mine.startingMineLevel).toBe(2)
      expect(mine.levelsPerUpgrade).toBe(2)
      expect(levels).toHaveLength(mine.maxProductionLevel + 1)
      expect(levels[0]).toEqual({
        productionLevel: 0,
        baseOutputPerCycle: 0,
        unityPerCycle: 0,
        workers: 0,
      })
      expect(levels.at(-1)).toEqual({
        productionLevel: mine.maxProductionLevel,
        baseOutputPerCycle: outputPerLevelPerCycle * mine.maxProductionLevel,
        unityPerCycle: mine.unityPerProductionLevelPerCycle * mine.maxProductionLevel,
        workers: mine.workersPerProductionLevel * mine.maxProductionLevel,
      })
    }
  })
})
