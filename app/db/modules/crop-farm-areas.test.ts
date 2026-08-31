import { describe, expect, it } from 'vitest'

import { type SyncedAreaEntity } from '../../game-state'
import { calculateBuildingStats } from '../../helpers/building-stats/building-stats'
import { calculateFactoryTotal } from '../../helpers/factory-total/factory-total'
import { createLiveAreaModules } from '../../helpers/live-area-modules/live-area-modules'
import {
  activeCropFarmGroups,
  type CurrentCropFarmEntity,
} from '../crop-farming'
import { recipes, type Recipe } from '../recipes'
import {
  createCropFarmAreaModule,
  createDefaultCropFarmModule,
  getCropFarmGroundwaterRecipeId,
  getCropFarmOwnerZone,
} from './crop-farm-areas'
import { defaultArea } from './default'
import { factoryModelModules, modules, type Module } from './modules'

const area = (
  zoneId: number,
  areaRecipes: readonly Recipe[] = [],
  recipeCount = 3,
): Module => ({
  id: `live-area-${zoneId}`,
  name: 'West agriculture',
  description: '',
  gameSynced: true,
  includedInFactoryTotals: false,
  builtBuildings: Object.fromEntries(areaRecipes.map(recipe => [recipe.id, recipeCount])),
  recipes: areaRecipes,
  presets: [{
    id: 'live',
    name: 'Live area',
    description: '',
    activeBuildings: Object.fromEntries(areaRecipes.map(recipe => [recipe.id, recipeCount])),
    currentActiveBuildings: Object.fromEntries(areaRecipes.map(recipe => [recipe.id, recipeCount])),
    dataSources: Object.fromEntries(areaRecipes.map(recipe => [recipe.id, 'synced' as const])),
    fixed: [],
  }],
  defaultPresetId: 'live',
  liveArea: {
    zoneId,
    trackedBuildings: 1,
    constructedBuildings: 1,
    activeBuildings: 1,
    pausedBuildings: 0,
    constructionGhosts: 0,
    issues: [{
      id: 'FarmT4:no-recipe',
      building: 'Greenhouse II',
      count: 1,
      message: 'This building does not expose a production recipe.',
    }],
  },
})

const farm = (
  entityId: number,
  overrides: Partial<CurrentCropFarmEntity> = {},
): CurrentCropFarmEntity => ({
  entityId,
  tierId: 'greenhouseII',
  schedule: ['corn', 'wheat', 'none', 'none'],
  fertilityTargetPercent: 100,
  fertilizerId: 'fertilizerII',
  running: true,
  zones: [{ id: 17, name: 'West agriculture' }],
  ...overrides,
})

describe('synced crop-farm areas', () => {
  it('does not register the fixed Greenhouses module in the application', () => {
    expect(modules.map(module => module.id)).not.toContain('greenhouses')
  })

  it('specializes the ordinary generated module without an area-name rule', () => {
    const areaEntity: SyncedAreaEntity = {
      entityId: 1,
      prototypeId: 'FarmT4',
      prototypeName: 'Greenhouse II',
      constructionState: 'Constructed',
      constructed: true,
      running: true,
      tile: { x: 10, y: 20 },
      zones: [{ id: 17, name: 'West agriculture' }],
      recipes: [],
    }
    const [generated] = createLiveAreaModules(
      [{ id: 17, name: 'West agriculture' }],
      [areaEntity],
      [],
    )

    if (!generated) throw new Error('Missing generated crop-farm area')

    const farmModule = createCropFarmAreaModule(generated, [farm(1)])

    expect(farmModule).toMatchObject({
      id: 'live-area-17',
      name: 'West agriculture',
      gameSynced: true,
      includedInFactoryTotals: true,
      liveArea: { issues: [] },
    })
    expect(farmModule.recipes?.some(recipe => recipe.id.includes(':crop-farm:'))).toBe(true)
  })

  it('attaches exact farm configuration to any generated area name', () => {
    const farmModule = createCropFarmAreaModule(area(17), [
      farm(1),
      farm(2, { running: false }),
    ])
    const recipe = farmModule.recipes?.find(candidate => candidate.id.includes(':crop-farm:'))
    const preset = farmModule.presets[0]

    expect(farmModule).toMatchObject({
      id: 'live-area-17',
      name: 'West agriculture',
      gameSynced: true,
      includedInFactoryTotals: true,
      liveArea: { issues: [] },
    })
    expect(recipe).toMatchObject({
      building: 'Greenhouse II',
      farmFertilizer: {
        targetFertilityPercent: 100,
        maximumFertilityPercent: 140,
      },
      inputs: expect.arrayContaining([
        expect.objectContaining({ resourceId: 'fertilizerII' }),
      ]),
    })
    expect(preset).toMatchObject({
      activeBuildings: { [recipe!.id]: 1 },
      currentActiveBuildings: { [recipe!.id]: 1 },
      builtBuildings: { [recipe!.id]: 2 },
      dataSources: { [recipe!.id]: 'synced' },
      fixed: [recipe!.id],
    })
  })

  it('uses one stable owner for overlapping areas and Default for unzoned farms', () => {
    const overlapping = farm(1, {
      zones: [
        { id: 17, name: 'West agriculture' },
        { id: 5, name: 'Food district' },
      ],
    })

    expect(getCropFarmOwnerZone(overlapping)?.id).toBe(5)
    expect(createCropFarmAreaModule(area(17), [overlapping]).recipes).toEqual([])
    expect(createCropFarmAreaModule(area(5), [overlapping]).recipes).toHaveLength(1)

    const withDefaultFarm = createDefaultCropFarmModule(defaultArea, [farm(2, { zones: [] })])

    expect(withDefaultFarm.recipes?.some(recipe => recipe.id.includes(':crop-farm:'))).toBe(true)
    expect(withDefaultFarm.includedInFactoryTotals).toBe(true)
  })

  it('ignores empty rotations and reports unsupported crops without inventing production', () => {
    const farmModule = createCropFarmAreaModule(area(17), [
      farm(1, {
        schedule: ['none', 'none', 'none', 'none'],
        fertilizerId: null,
        fertilityTargetPercent: 0,
        running: false,
      }),
      farm(2, { schedule: ['corn', 'Crop_Modded', 'none', 'none'] }),
    ])

    expect(farmModule.recipes).toEqual([])
    expect(farmModule.liveArea?.issues).toEqual([
      expect.objectContaining({ id: 'crop-farms:unsupported-crop', count: 1 }),
    ])
  })

  it('keeps unzoned farms without a supported rotation visible in Default', () => {
    const farmModule = createDefaultCropFarmModule(defaultArea, [
      farm(1, {
        schedule: ['none', 'none', 'none', 'none'],
        fertilizerId: null,
        fertilityTargetPercent: 0,
        running: false,
        zones: [],
      }),
      farm(2, {
        schedule: ['corn', 'Crop_Modded', 'none', 'none'],
        zones: [],
      }),
    ])
    const statusRecipes = farmModule.recipes?.filter(recipe => (
      recipe.id.includes(':crop-farm-status:')
    )) ?? []
    const preset = farmModule.presets[0]

    expect(statusRecipes).toEqual([
      expect.objectContaining({
        name: 'No crop rotation',
        building: 'Greenhouse II',
        inputs: [],
        outputs: [],
      }),
      expect.objectContaining({
        name: 'Unsupported crop rotation',
        building: 'Greenhouse II',
        inputs: [],
        outputs: [],
      }),
    ])
    expect(statusRecipes.map(recipe => preset.builtBuildings?.[recipe.id])).toEqual([1, 1])
    expect(statusRecipes.map(recipe => preset.activeBuildings[recipe.id])).toEqual([0, 1])
    expect(statusRecipes.map(recipe => preset.dataSources?.[recipe.id])).toEqual([
      'synced',
      'synced',
    ])
    expect(statusRecipes.every(recipe => preset.fixed.includes(recipe.id))).toBe(true)
  })

  it('caps output at the supplied fertilizer limit when the target is higher', () => {
    const limited = createCropFarmAreaModule(area(17), [farm(1, {
      fertilizerId: 'organic',
      fertilityTargetPercent: 140,
    })])
    const reachable = createCropFarmAreaModule(area(17), [farm(1, {
      fertilizerId: 'organic',
      fertilityTargetPercent: 100,
    })])
    const limitedRecipe = limited.recipes?.find(recipe => recipe.id.includes(':crop-farm:'))
    const reachableRecipe = reachable.recipes?.find(recipe => recipe.id.includes(':crop-farm:'))

    expect(limitedRecipe?.outputs).toEqual(reachableRecipe?.outputs)
    expect(limited.liveArea?.issues).toContainEqual(expect.objectContaining({
      id: 'crop-farms:fertilizer-limit',
      count: 1,
    }))
  })

  it('turns the live area pump into a sustainable module Water source', () => {
    const pumpId = getCropFarmGroundwaterRecipeId(17)
    const pump: Recipe = {
      id: pumpId,
      gameRecipeId: 'LandWaterPumping',
      name: 'Groundwater pumping',
      building: 'Groundwater Pump',
      group: 'production',
      cycleDurationSeconds: 10,
      inputs: [],
      outputs: [{ resourceId: 'water', quantity: 48 }],
      balanceBy: 'output',
      balanceOutputIds: ['water'],
    }
    const farmModule = createCropFarmAreaModule(area(17, [pump]), [farm(1)], {
      aquiferCount: 1,
      currentReserve: 10_000,
      reserveCapacity: 20_000,
      projectedPumpCount: 3,
      aquiferSustainableCeilingPerCycle: 90,
      installedCapacityPerCycle: 144,
      sustainableOutputPerCycle: 90,
      reserveCyclesAtProjectedUse: null,
    })

    expect(farmModule.recipes?.find(recipe => recipe.id === pumpId)).toMatchObject({
      group: 'source',
      sourceMode: 'module-demand-capped',
      sourceKind: 'groundwater',
      outputs: [{ resourceId: 'water', quantity: 30 }],
      groundwaterConstraint: { sustainableOutputPerCycle: 90 },
    })
  })

  it('preserves the current Factory Total before and after migration', () => {
    let entityId = 1
    const syncedFarms = [
      ...activeCropFarmGroups.flatMap(group => Array.from(
        { length: group.farmCount },
        (): CurrentCropFarmEntity => ({
          entityId: entityId++,
          tierId: group.tierId === 'greenhouse' ? 'greenhouse' : 'greenhouseII',
          schedule: group.schedule,
          fertilityTargetPercent: group.fertilizer?.targetFertilityPercent ?? 0,
          fertilizerId: group.fertilizer?.id ?? null,
          running: true,
          zones: [{ id: 17, name: 'West agriculture' }],
        }),
      )),
      ...Array.from({ length: 15 }, (): CurrentCropFarmEntity => ({
        entityId: entityId++,
        tierId: 'greenhouseII',
        schedule: ['none', 'none', 'none', 'none'],
        fertilityTargetPercent: 0,
        fertilizerId: null,
        running: false,
        zones: [{ id: 17, name: 'West agriculture' }],
      })),
    ]
    const legacyPump = recipes.find(recipe => recipe.id === 'groundwater-pump')

    if (!legacyPump) throw new Error('Missing legacy Groundwater Pump recipe')

    const runtimePump = {
      ...legacyPump,
      id: getCropFarmGroundwaterRecipeId(17),
      group: 'production' as const,
      sourceMode: undefined,
      sourceKind: undefined,
    }
    const syncedArea = createCropFarmAreaModule(area(17, [runtimePump], 5), syncedFarms)
    const baselineModules = factoryModelModules.filter(
      (module): module is Module => Boolean(module),
    )
    const afterModules = [
      ...baselineModules.filter(module => module.id !== 'greenhouses'),
      syncedArea,
    ]
    const before = calculateFactoryTotal(baselineModules, { recyclingEfficiencyPercent: 0 })
    const after = calculateFactoryTotal(afterModules, { recyclingEfficiencyPercent: 0 })
    const flowSnapshot = (result: ReturnType<typeof calculateFactoryTotal>) => Object.fromEntries(
      result.calculation.allResourceFlows.map(flow => [flow.resourceId, {
        consumed: flow.consumed,
        net: flow.net,
        produced: flow.produced,
      }]),
    )

    expect(flowSnapshot(after)).toEqual(flowSnapshot(before))
    expect(calculateBuildingStats(after.allLines, after.calculation)).toEqual(
      calculateBuildingStats(before.allLines, before.calculation),
    )
  })
})
