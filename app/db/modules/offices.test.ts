import { describe, expect, it } from 'vitest'

import {
  type SyncedAreaEntity,
  type SyncedProductionEntity,
} from '../../game-state'
import { calculateFactoryTotal } from '../../helpers/factory-total/factory-total'
import { createLiveAreaModules } from '../../helpers/live-area-modules/live-area-modules'
import { baseConfig } from '../config'
import { defaultOfficePlan } from '../offices'
import { modules } from './modules'
import {
  applySyncedOfficeInventory,
  createOfficeAreaModule,
  createPlannedOfficeModule,
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
  it('adapts Office buildings in any generated area without changing their balance', () => {
    const entities = [
      areaEntity(1, 'OfficeBuildingT3', 'Office III'),
      areaEntity(2, 'AssemblyRoboticT2', 'Assembly V', [officeSuppliesRecipe]),
    ]
    const [generatedArea] = createLiveAreaModules([zone], entities, modules)

    if (!generatedArea) throw new Error('Missing generated Office area')

    const officeAreaModule = createOfficeAreaModule(generatedArea, entities, plan, 'planned')
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
    expect(modules.some(candidate => candidate.name === 'Offices')).toBe(false)
    expect(office).toMatchObject({
      activeBuildings: 1,
      builtBuildings: 1,
      dataSource: 'planned',
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
      modules,
    )
    const configuredAreas = generatedAreas.map(generatedArea => (
      createOfficeAreaModule(generatedArea, [overlappingOffice], plan, 'planned')
    ))

    expect(configuredAreas.filter(hasAttachedOfficeRecipes).map(area => area.id)).toEqual([
      'live-area-23',
    ])
    expect(configuredAreas.find(area => area.id === 'live-area-24')).toMatchObject({
      includedInFactoryTotals: false,
      liveArea: { issues: [] },
    })
  })
})
