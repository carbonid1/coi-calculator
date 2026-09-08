import { describe, expect, it } from 'vitest'

import {
  type SyncedAreaEntity,
  type SyncedProductionEntity,
} from '../../game-state'
import { calculateFactoryTotal } from '../../helpers/factory-total/factory-total'
import { createLiveAreaModules } from '../../helpers/live-area-modules/live-area-modules'
import { baseConfig } from '../config'
import { getLiveAreaPlans } from '../live-area-plans'
import { calculateOfficePlan, defaultOfficePlan, plannedOfficePlan } from '../offices'
import {
  applySyncedOfficeInventory,
  createOfficeAreaModule,
  createPlannedOfficeModule,
  getOfficeAreaZoneIds,
  getModuleOfficeConfigurations,
  getSyncedOfficeConfigurations,
  hasAttachedOfficeRecipes,
} from './offices'

const zone = { id: 23, name: 'Admin West' }
const areaEntity = (
  entityId: number,
  prototypeId: string,
  prototypeName: string,
  recipes: SyncedAreaEntity['recipes'] = [],
): SyncedAreaEntity => ({
  entityId,
  prototypeId,
  prototypeName,
  constructionState: 'Constructed',
  constructed: true,
  running: true,
  tile: { x: entityId, y: 10 },
  zones: [zone],
  recipes,
})

const officeSuppliesRecipe = {
  id: 'OfficeSuppliesAssembly',
  name: 'Office Supplies',
  durationSeconds: 7.5,
  assigned: true,
  inputs: [
    { productId: 'Product_Paper', name: 'Paper', quantity: 3 },
    { productId: 'Product_HouseholdGoods', name: 'Household Goods', quantity: 2 },
    { productId: 'Product_Electronics2', name: 'Electronics II', quantity: 1 },
  ],
  outputs: [
    { productId: 'Product_OfficeSupplies', name: 'Office Supplies', quantity: 6 },
  ],
}

const plan = {
  ...defaultOfficePlan,
  offices: {
    ...defaultOfficePlan.offices,
    officeIII: { count: 1, computingBoostStep: 2 as const },
  },
}

describe('synced Office areas', () => {
  it('reconfigures existing offices at another boost instead of planning extra buildings', () => {
    const entities = ([2, 0, 0] as const).map((computingBoostStep, index) => ({
      ...areaEntity(index + 1, 'OfficeBuildingT3', 'Office III'),
      office: { computingBoostStep },
    }))
    const [generatedArea] = createLiveAreaModules([zone], entities)
    const officeModule = createOfficeAreaModule(generatedArea!, entities, plannedOfficePlan,
      getLiveAreaPlans('Last-Stop Waters')[zone.id]?.offices)
    const preset = officeModule.presets[0]

    expect(getModuleOfficeConfigurations([officeModule])).toEqual([
      { tierId: 'officeIII', computingBoostStep: 2, count: 3 },
    ])
    expect(Object.values(preset.builtBuildings ?? {}).reduce((sum, count) => sum + count, 0)).toBe(3)
    expect(preset.unplacedPlannedBuildings?.['officeIII-boost-2']).toBe(0)
    expect(preset.planMismatches).toEqual([expect.objectContaining({
      recipeId: 'officeIII-boost-2', current: 1, target: 3,
      actions: [{ type: 'configure', label: 'Set 2 Office III to computing boost 2' }],
    })])
    expect(calculateOfficePlan(plannedOfficePlan, 8, getModuleOfficeConfigurations([officeModule])))
      .toMatchObject({ focusPointsCapacity: 5460, computingTflops: 576, workers: 3000 })
  })

  it.each(['paused', 'ghost'] as const)('uses %s offices at another boost to satisfy the target', state => {
    const entities = [0, 1, 2].map(index => ({
      ...areaEntity(index + 1, 'OfficeBuildingT3', 'Office III'),
      constructed: state !== 'ghost' || index === 0,
      running: index === 0,
      office: { computingBoostStep: index === 0 ? 2 as const : 0 as const },
    }))
    const [generatedArea] = createLiveAreaModules([zone], entities)
    const officeModule = createOfficeAreaModule(generatedArea!, entities, plannedOfficePlan,
      getLiveAreaPlans('Last-Stop Waters')[zone.id]?.offices)
    const preset = officeModule.presets[0]

    expect(getModuleOfficeConfigurations([officeModule])).toEqual([
      { tierId: 'officeIII', computingBoostStep: 2, count: 3 },
    ])
    expect(preset.unplacedPlannedBuildings?.['officeIII-boost-2']).toBe(0)
    expect(preset.builtBuildings?.['officeIII-boost-2']).toBe(state === 'ghost' ? 1 : 3)
    expect(preset.constructionGhosts?.['officeIII-boost-2']).toBe(state === 'ghost' ? 2 : 0)
    expect(preset.planMismatches?.[0]?.actions).toEqual([
      ...(state === 'paused' ? [{ type: 'unpause', label: 'Unpause 2 Office III' }] : []),
      { type: 'configure', label: 'Set 2 Office III to computing boost 2' },
    ])
  })

  it('adds planned full-load offices to the owning area and the Focus budget', () => {
    const entities = [
      { ...areaEntity(1, 'OfficeBuildingT3', 'Office III'), office: { computingBoostStep: 2 as const } },
      areaEntity(2, 'AssemblyRoboticT2', 'Assembly V', [officeSuppliesRecipe]),
    ]
    const [generatedArea] = createLiveAreaModules([zone], entities)
    const targets = getLiveAreaPlans('Last-Stop Waters')[zone.id]?.offices
    const officeModule = createOfficeAreaModule(generatedArea!, entities, plannedOfficePlan, targets)
    const result = calculateFactoryTotal([officeModule], {
      recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent,
    })
    const office = result.calculation.regularResults.find(row => row.recipe.id === 'officeIII-boost-2')
    const configurations = getModuleOfficeConfigurations([officeModule])

    expect(officeModule.presets[0]).toMatchObject({
      activeBuildings: { 'officeIII-boost-2': 3 },
      currentActiveBuildings: { 'officeIII-boost-2': 1 },
      builtBuildings: { 'officeIII-boost-2': 1 },
      unplacedPlannedBuildings: { 'officeIII-boost-2': 2 },
      dataSources: { 'officeIII-boost-2': 'planned' },
    })
    expect(office).toMatchObject({ activeBuildings: 3, builtBuildings: 1, supplyRatio: 1, dataSource: 'planned' })
    expect(result.flows.find(flow => flow.resourceId === 'officeSupplies')).toMatchObject({ consumed: 24, produced: 24, net: 0 })
    expect(result.flows.find(flow => flow.resourceId === 'paper')?.net).toBeCloseTo(-12)
    expect(result.flows.find(flow => flow.resourceId === 'householdGoods')?.net).toBeCloseTo(-8)
    expect(result.flows.find(flow => flow.resourceId === 'electronicsII')?.net).toBeCloseTo(-4)
    expect(result.computingDemandTflops).toBe(582)
    expect(calculateOfficePlan(plannedOfficePlan, 8, configurations)).toMatchObject({
      focusPointsCapacity: 5460, focusPointsRequired: 5375, focusPointsAvailable: 85,
      computingTflops: 576, workers: 3000,
    })
    expect(getLiveAreaPlans('another save')[zone.id]?.offices).toBeUndefined()
  })

  it.each([
    { built: 1, ghosts: 1, running: 1, active: 3, unplaced: 1, source: 'planned' },
    { built: 3, ghosts: 0, running: 2, active: 3, unplaced: 0, source: 'planned' },
    { built: 3, ghosts: 0, running: 3, active: 3, unplaced: 0, source: 'synced' },
    { built: 4, ghosts: 0, running: 4, active: 4, unplaced: 0, source: 'synced' },
  ])('keeps a fixed target as synced offices change: %o', ({ built, ghosts, running, active, unplaced, source }) => {
    const entities = Array.from({ length: built + ghosts }, (_, index) => ({
      ...areaEntity(index + 1, 'OfficeBuildingT3', 'Office III'),
      constructed: index < built,
      running: index < running,
      office: { computingBoostStep: 2 as const },
    }))
    const [generatedArea] = createLiveAreaModules([zone], entities)
    const officeModule = createOfficeAreaModule(generatedArea!, entities, plannedOfficePlan,
      getLiveAreaPlans('Last-Stop Waters')[zone.id]?.offices)

    expect(officeModule.presets[0]).toMatchObject({
      activeBuildings: { 'officeIII-boost-2': active },
      currentActiveBuildings: { 'officeIII-boost-2': running },
      builtBuildings: { 'officeIII-boost-2': built },
      constructionGhosts: { 'officeIII-boost-2': ghosts },
      unplacedPlannedBuildings: { 'officeIII-boost-2': unplaced },
      dataSources: { 'officeIII-boost-2': source },
    })
    expect(getModuleOfficeConfigurations([officeModule])).toEqual([
      { tierId: 'officeIII', computingBoostStep: 2, count: active },
    ])
  })

  it('adapts Office buildings in any generated area without changing their balance', () => {
    const entities = [
      {
        ...areaEntity(1, 'OfficeBuildingT3', 'Office III'),
        office: { computingBoostStep: 2 as const },
      },
      areaEntity(2, 'AssemblyRoboticT2', 'Assembly V', [officeSuppliesRecipe]),
    ]
    const [generatedArea] = createLiveAreaModules([zone], entities)

    if (!generatedArea) throw new Error('Missing generated Office area')

    const officeAreaModule = createOfficeAreaModule(generatedArea, entities, plan)
    const result = calculateFactoryTotal(
      [officeAreaModule],
      { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
    )
    const office = result.calculation.regularResults.find(
      candidate => candidate.recipe.id === 'officeIII-boost-2',
    )
    const supplies = result.calculation.regularResults.find(
      candidate => candidate.recipe.gameRecipeId === 'OfficeSuppliesAssembly',
    )
    const flow = (
      resourceId: 'officeSupplies' | 'paper' | 'householdGoods' | 'electronicsII',
    ) => result.flows.find(candidate => candidate.resourceId === resourceId)

    expect(officeAreaModule).toMatchObject({
      id: 'live-area-23',
      name: 'Admin West',
      gameSynced: true,
      includedInFactoryTotals: true,
      builtBuildings: { 'officeIII-boost-2': 1 },
      liveArea: { issues: [] },
    })
    expect(office).toMatchObject({
      activeBuildings: 1,
      builtBuildings: 1,
      dataSource: 'synced',
      supplyRatio: 1,
    })
    expect(supplies?.supplyRatio).toBeCloseTo(1 / 6)
    expect(supplies?.recipe.displayName).toBe('Office Supplies')
    expect(flow('officeSupplies')).toMatchObject({ consumed: 8, net: 0, produced: 8 })
    expect(flow('paper')?.net).toBeCloseTo(-4)
    expect(flow('householdGoods')?.net).toBeCloseTo(-8 / 3)
    expect(flow('electronicsII')?.net).toBeCloseTo(-4 / 3)
    expect(result.computingDemandTflops).toBe(198)
  })

  it('keeps mixed synced computing boosts as separate Office configurations', () => {
    const entities: SyncedAreaEntity[] = [
      {
        ...areaEntity(1, 'OfficeBuildingT3', 'Office III'),
        office: { computingBoostStep: 0 },
      },
      {
        ...areaEntity(2, 'OfficeBuildingT3', 'Office III'),
        office: { computingBoostStep: 2 },
      },
      {
        ...areaEntity(3, 'OfficeBuildingT3', 'Office III'),
        running: false,
        office: { computingBoostStep: 2 },
      },
    ]
    const [generatedArea] = createLiveAreaModules([zone], entities)

    if (!generatedArea) throw new Error('Missing generated Office area')

    const officeAreaModule = createOfficeAreaModule(generatedArea, entities, plan)
    const preset = officeAreaModule.presets.find(({ id }) => (
      id === officeAreaModule.defaultPresetId
    ))

    expect(officeAreaModule.builtBuildings).toMatchObject({
      'officeIII-boost-0': 1,
      'officeIII-boost-2': 2,
    })
    expect(preset).toMatchObject({
      activeBuildings: {
        'officeIII-boost-0': 1,
        'officeIII-boost-2': 1,
      },
      dataSources: {
        'officeIII-boost-0': 'synced',
        'officeIII-boost-2': 'synced',
      },
    })
    expect(getSyncedOfficeConfigurations(entities)).toEqual([
      { tierId: 'officeIII', computingBoostStep: 0, count: 1 },
      { tierId: 'officeIII', computingBoostStep: 2, count: 1 },
    ])
    expect(getSyncedOfficeConfigurations(entities, 'built')).toEqual([
      { tierId: 'officeIII', computingBoostStep: 0, count: 1 },
      { tierId: 'officeIII', computingBoostStep: 2, count: 2 },
    ])
  })

  it('uses running synced Offices for the Focus budget', () => {
    const productionEntity = (
      entityId: number,
      prototypeId: string,
      running: boolean,
    ): SyncedProductionEntity => ({
      entityId,
      prototypeId,
      running,
      recipeIds: [],
      zones: [zone],
      nuclearReactor: null,
      dataCenterRacks: null,
      trainStation: null,
    })
    const syncedPlan = applySyncedOfficeInventory(plan, [
      productionEntity(1, 'OfficeBuildingT3', true),
      productionEntity(2, 'OfficeBuildingT3', false),
      productionEntity(3, 'OfficeBuildingT2', true),
    ])

    expect(syncedPlan.offices).toMatchObject({
      officeI: { count: 0 },
      officeII: { count: 1 },
      officeIII: { count: 1 },
    })
    expect(applySyncedOfficeInventory(plan, [
      productionEntity(1, 'OfficeBuildingT3', true),
      productionEntity(2, 'OfficeBuildingT3', false),
    ], 'built').offices.officeIII.count).toBe(2)
  })

  it('keeps planned Office costs when no generated area can own them', () => {
    const fallbackPlan = { ...plan, officeSuppliesAssemblyVCount: 1 }
    const fallback = createPlannedOfficeModule(fallbackPlan)
    const result = calculateFactoryTotal(
      [fallback],
      { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
    )

    expect(fallback).toMatchObject({
      id: 'office-plan',
      name: 'Office plan',
      builtBuildings: {
        'assembly-v-office-supplies': 0,
        'officeIII-boost-2': 0,
      },
      presets: [{
        activeBuildings: {
          'assembly-v-office-supplies': 1,
          'officeIII-boost-2': 1,
        },
        currentActiveBuildings: {
          'assembly-v-office-supplies': 0,
          'officeIII-boost-2': 0,
        },
      }],
    })
    expect(result.computingDemandTflops).toBe(198)
    expect(result.flows.find(flow => flow.resourceId === 'officeSupplies')).toMatchObject({
      consumed: 8,
      net: 0,
      produced: 8,
    })
  })

  it('assigns an Office in overlapping areas to one stable owner', () => {
    const secondZone = { id: 24, name: 'Shared East' }
    const overlappingOffice = {
      ...areaEntity(1, 'OfficeBuildingT3', 'Office III'),
      zones: [secondZone, zone],
    }
    const generatedAreas = createLiveAreaModules(
      [zone, secondZone],
      [overlappingOffice],
    )
    const configuredAreas = generatedAreas.map(generatedArea => (
      createOfficeAreaModule(generatedArea, [overlappingOffice], plan)
    ))

    expect(configuredAreas.filter(hasAttachedOfficeRecipes).map(area => area.id)).toEqual([
      'live-area-23',
    ])
    expect(configuredAreas.find(area => area.id === 'live-area-24')).toMatchObject({
      includedInFactoryTotals: false,
      liveArea: { issues: [] },
    })
  })

  it('assigns an Office outside named areas to Default', () => {
    const unzonedOffice = {
      ...areaEntity(1, 'OfficeBuildingT3', 'Office III'),
      zones: [],
    }
    const [generatedDefault] = createLiveAreaModules(
      [{ id: -1, name: 'Default' }],
      [unzonedOffice],
    )

    if (!generatedDefault) throw new Error('Missing generated Default area')

    const configuredDefault = createOfficeAreaModule(
      generatedDefault,
      [unzonedOffice],
      plan,
    )

    expect(getOfficeAreaZoneIds([unzonedOffice])).toEqual(new Set([-1]))
    expect(configuredDefault).toMatchObject({
      id: 'general',
      includedInFactoryTotals: true,
      builtBuildings: { 'officeIII-boost-2': 1 },
    })
  })
})
