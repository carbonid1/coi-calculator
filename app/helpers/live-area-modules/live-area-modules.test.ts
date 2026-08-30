import { describe, expect, it } from 'vitest'

import { type SyncedAreaEntity } from '../../game-state'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { calculateBuildingStats } from '../building-stats/building-stats'
import { calculateNet } from '../calculate/calculate'
import { getPresetResourceDemands } from '../preset-resource-demands/preset-resource-demands'
import {
  createLiveAreaModules,
  getModeledTerrainSorterEntityIds,
} from './live-area-modules'

const recipe = {
  id: 'AirSeparation',
  name: 'Air Separation',
  durationSeconds: 20,
  assigned: true,
  inputs: [],
  outputs: [
    { productId: 'Product_Oxygen', name: 'Oxygen', quantity: 2 },
    { productId: 'Product_Nitrogen', name: 'Nitrogen', quantity: 4 },
  ],
}

const entity = (
  entityId: number,
  constructed: boolean,
  running: boolean,
  recipes = [recipe],
): SyncedAreaEntity => ({
  entityId,
  prototypeId: 'AirSeparator',
  prototypeName: 'Air Separator',
  constructionState: constructed ? 'Constructed' : 'NotStarted',
  constructed,
  running,
  tile: { x: entityId, y: 10 },
  zones: [{ id: 16, name: 'Test' }],
  recipes,
})

describe('createLiveAreaModules', () => {
  it('creates a planning-only tab and includes ghosts in projected capacity', () => {
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [entity(1, true, true), entity(2, false, false)],
      [],
    )
    const liveRecipe = module?.recipes?.[0]

    expect(module).toMatchObject({
      id: 'live-area-16',
      name: 'Test',
      description: '',
      includedInFactoryTotals: false,
      liveArea: {
        trackedBuildings: 2,
        constructedBuildings: 1,
        activeBuildings: 1,
        pausedBuildings: 0,
        constructionGhosts: 1,
      },
    })
    expect(liveRecipe).toMatchObject({
      building: 'Air Separator',
      gameRecipeId: 'AirSeparation',
      outputs: [
        { resourceId: 'oxygen', quantity: 6 },
        { resourceId: 'nitrogen', quantity: 12 },
      ],
    })
    expect(module?.presets[0]).toMatchObject({
      activeBuildings: { [liveRecipe?.id ?? 'missing']: 2 },
      currentActiveBuildings: { [liveRecipe?.id ?? 'missing']: 1 },
      builtBuildings: { [liveRecipe?.id ?? 'missing']: 1 },
      constructionGhosts: { [liveRecipe?.id ?? 'missing']: 1 },
      dataSources: { [liveRecipe?.id ?? 'missing']: 'synced' },
    })
  })

  it('creates an empty tab as soon as a new named area exists', () => {
    const [module] = createLiveAreaModules([{ id: 16, name: 'Test' }], [], [])

    expect(module).toMatchObject({
      name: 'Test',
      recipes: [],
      liveArea: {
        trackedBuildings: 0,
        activeBuildings: 0,
        pausedBuildings: 0,
        constructionGhosts: 0,
      },
    })
  })

  it('leaves station infrastructure to the dedicated station groups', () => {
    const station = {
      ...entity(3, true, true, []),
      prototypeId: 'TrainStationLoose_ELEC',
      prototypeName: 'Loose station module (electrified)',
      trainStation: {
        isForLoading: false,
        selectedProduct: {
          productId: 'Product_CopperOreCrushed',
          name: 'Copper Ore Crushed',
        },
      },
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [station],
      [],
    )

    expect(module?.recipes).toEqual([])
    expect(module?.liveArea).toMatchObject({
      trackedBuildings: 1,
      activeBuildings: 1,
      issues: [],
    })
  })

  it('leaves recipe-less stationary infrastructure for area ownership without reporting an issue', () => {
    const station = {
      ...entity(3, false, false, []),
      prototypeId: 'TrainStationLoose_ELEC',
      prototypeName: 'Loose station module (electrified)',
    }
    const [module] = createLiveAreaModules([{ id: 16, name: 'Test' }], [station], [])

    expect(module?.recipes).toEqual([])
    expect(module?.liveArea).toMatchObject({
      trackedBuildings: 1,
      constructionGhosts: 1,
      issues: [],
    })
  })

  it('leaves maintenance depots and solar panels to their dedicated area ownership', () => {
    const maintenanceDepot = {
      ...entity(3, true, true),
      prototypeId: 'MaintenanceDepotT1',
      prototypeName: 'Maintenance Depot',
    }
    const solarPanel = {
      ...entity(4, true, true),
      prototypeId: 'SolarPanelMono',
      prototypeName: 'Solar Panel (Mono)',
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [maintenanceDepot, solarPanel],
      [],
    )

    expect(module?.recipes).toEqual([])
    expect(module?.presets[0]?.capacityPools).toEqual({})
    expect(module?.liveArea).toMatchObject({
      trackedBuildings: 2,
      activeBuildings: 2,
      issues: [],
    })
  })

  it('retains construction capacity for recipe-less Computing ghosts', () => {
    const dataCenterGhost = {
      ...entity(3, false, false, []),
      prototypeId: 'DataCenter',
      prototypeName: 'Data Center',
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [dataCenterGhost],
      [],
    )

    expect(module?.presets[0]?.capacityPools).toEqual({
      DataCenter: {
        active: 1,
        built: 0,
        currentActive: 0,
        constructionGhosts: 1,
      },
    })
  })

  it('keeps Population waste recipes balanced against settlement byproducts', () => {
    const populationRecipe = (
      id: string,
      inputs: { productId: string; name: string; quantity: number }[],
      outputs: { productId: string; name: string; quantity: number }[],
    ) => ({
      id,
      name: id,
      durationSeconds: 60,
      assigned: true,
      inputs,
      outputs,
    })
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Population' }],
      [
        {
          ...entity(1, true, true, [populationRecipe(
            'WaterTreatmentT2',
            [
              { productId: 'Product_WasteWater', name: 'Waste Water', quantity: 160 },
              { productId: 'Product_FilterMedia', name: 'Filter Media', quantity: 8 },
              { productId: 'Product_Chlorine', name: 'Chlorine', quantity: 16 },
            ],
            [
              { productId: 'Product_Water', name: 'Water', quantity: 120 },
              { productId: 'Product_Sludge', name: 'Sludge', quantity: 36 },
            ],
          )]),
          prototypeId: 'WaterTreatmentPlant',
          prototypeName: 'Wastewater treatment',
        },
        {
          ...entity(2, true, true, [populationRecipe(
            'SludgeDigestion',
            [{ productId: 'Product_Sludge', name: 'Sludge', quantity: 18 }],
            [
              { productId: 'Product_FuelGas', name: 'Fuel Gas', quantity: 8 },
              { productId: 'Product_Compost', name: 'Compost', quantity: 3 },
            ],
          )]),
          prototypeId: 'AnaerobicDigester',
          prototypeName: 'Anaerobic digester',
        },
        {
          ...entity(3, true, true, [populationRecipe(
            'BiomassCompost',
            [{ productId: 'Product_Biomass', name: 'Biomass', quantity: 24 }],
            [{ productId: 'Product_Compost', name: 'Compost', quantity: 16 }],
          )]),
          prototypeId: 'IndustrialMixerT2',
          prototypeName: 'Mixer II',
        },
      ],
      [],
    )

    expect(module?.recipes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        gameRecipeId: 'WaterTreatmentT2',
        balanceBy: 'input',
        balanceInputIds: ['wasteWater'],
      }),
      expect.objectContaining({
        gameRecipeId: 'SludgeDigestion',
        balanceBy: 'input',
        balanceInputIds: ['sludge'],
      }),
      expect.objectContaining({
        gameRecipeId: 'BiomassCompost',
        balanceBy: 'input',
        balanceInputIds: ['biomass'],
        balanceInputScope: 'module',
      }),
    ]))
  })

  it('infers terrain supply from an operating sorter and assigned crusher recipe', () => {
    const bauxiteMilling = {
      id: 'BauxiteMilling',
      name: 'Bauxite milling',
      durationSeconds: 40,
      assigned: true,
      inputs: [{ productId: 'Product_Bauxite', name: 'Bauxite', quantity: 48 }],
      outputs: [{ productId: 'Product_BauxitePowder', name: 'Bauxite powder', quantity: 48 }],
    }
    const titaniumMilling = {
      id: 'IlmeniteMilling',
      name: 'Ilmenite milling',
      durationSeconds: 30,
      assigned: true,
      inputs: [{ productId: 'Product_TitaniumOre', name: 'Titanium ore', quantity: 48 }],
      outputs: [{
        productId: 'Product_TitaniumOreCrushed',
        name: 'Titanium ore crushed',
        quantity: 48,
      }],
    }
    const crusher = (
      entityId: number,
      zoneId: number,
      zoneName: string,
      selectedRecipe: typeof bauxiteMilling,
    ): SyncedAreaEntity => ({
      ...entity(entityId, true, true, [selectedRecipe]),
      prototypeId: 'CrusherLarge',
      prototypeName: 'Crusher (large)',
      zones: [{ id: zoneId, name: zoneName }],
    })
    const sorter = (
      entityId: number,
      zoneId: number,
      zoneName: string,
      running = true,
    ): SyncedAreaEntity => ({
      ...entity(entityId, true, running, []),
      prototypeId: 'OreSortingPlantT1',
      prototypeName: 'Ore sorting plant',
      zones: [{ id: zoneId, name: zoneName }],
    })
    const mineModules = createLiveAreaModules(
      [
        { id: 18, name: 'North titanium pit' },
        { id: 19, name: 'East bauxite pit' },
      ],
      [
        sorter(1, 18, 'North titanium pit'),
        crusher(2, 18, 'North titanium pit', titaniumMilling),
        sorter(3, 19, 'East bauxite pit'),
        crusher(4, 19, 'East bauxite pit', bauxiteMilling),
        crusher(5, 19, 'East bauxite pit', bauxiteMilling),
        crusher(6, 19, 'East bauxite pit', bauxiteMilling),
      ],
      [],
    )
    const calculateMine = (
      name: string,
      demand: Parameters<typeof calculateNet>[4],
    ) => {
      const mine = mineModules.find(module => module.name === name)

      if (!mine) throw new Error(`Missing ${name}`)

      const preset = mine.presets[0]
      const { lines } = buildModuleLines(mine, preset ?? null)

      return { mine, lines, result: calculateNet(lines, {}, undefined, {}, demand) }
    }
    const bauxite = calculateMine('East bauxite pit', { bauxitePowder: 142.5 })
    const titanium = calculateMine('North titanium pit', { titaniumOreCrushed: 38.8 })
    const bauxiteCrusher = bauxite.result.regularResults.find(result => (
      result.recipe.gameRecipeId === 'BauxiteMilling'
    ))
    const titaniumCrusher = titanium.result.regularResults.find(result => (
      result.recipe.gameRecipeId === 'IlmeniteMilling'
    ))

    expect(bauxite.mine.includedInFactoryTotals).toBe(true)
    expect(titanium.mine.includedInFactoryTotals).toBe(true)
    expect(bauxite.lines.find(line => line.recipe.sourceMode === 'module-demand'))
      .toMatchObject({
        activeBuildings: 1,
        dataSource: 'synced',
        recipe: { hiddenFromModuleView: true },
      })
    expect(titanium.lines.find(line => line.recipe.sourceMode === 'module-demand'))
      .toMatchObject({
        activeBuildings: 1,
        dataSource: 'synced',
        recipe: { hiddenFromModuleView: true },
      })
    expect(titaniumCrusher?.recipe).toMatchObject({
      balanceInputIds: ['titaniumOre'],
      balanceInputScope: 'module',
    })
    expect(bauxiteCrusher).toMatchObject({
      activeBuildings: 3,
      actualInputs: [{ resourceId: 'bauxite', quantity: 142.5 }],
      actualOutputs: [{ resourceId: 'bauxitePowder', quantity: 142.5 }],
    })
    expect(bauxiteCrusher?.supplyRatio).toBeCloseTo(142.5 / 216)
    expect(titaniumCrusher).toMatchObject({
      activeBuildings: 1,
      actualInputs: [{ resourceId: 'titaniumOre', quantity: 38.8 }],
      actualOutputs: [{ resourceId: 'titaniumOreCrushed', quantity: 38.8 }],
    })
    expect(titaniumCrusher?.supplyRatio).toBeCloseTo(38.8 / 96)
    expect(bauxite.result.sourceResults.find(result => (
      result.recipe.sourceMode === 'module-demand'
    ))?.actualOutputs).toEqual([{ resourceId: 'bauxite', quantity: 142.5 }])
    expect(titanium.result.sourceResults.find(result => (
      result.recipe.sourceMode === 'module-demand'
    ))?.actualOutputs).toEqual([{ resourceId: 'titaniumOre', quantity: 38.8 }])
  })

  it('keeps inferred extraction local when another mine uses the same recipe', () => {
    const titaniumMilling = {
      id: 'IlmeniteMilling',
      name: 'Ilmenite milling',
      durationSeconds: 30,
      assigned: true,
      inputs: [{ productId: 'Product_TitaniumOre', name: 'Titanium ore', quantity: 48 }],
      outputs: [{
        productId: 'Product_TitaniumOreCrushed',
        name: 'Titanium ore crushed',
        quantity: 48,
      }],
    }
    const areaEntity = (
      entityId: number,
      zoneId: number,
      zoneName: string,
      prototypeId: string,
      prototypeName: string,
      entityRecipes: SyncedAreaEntity['recipes'],
    ): SyncedAreaEntity => ({
      ...entity(entityId, true, true, entityRecipes),
      prototypeId,
      prototypeName,
      zones: [{ id: zoneId, name: zoneName }],
    })
    const mineModules = createLiveAreaModules(
      [
        { id: 30, name: 'Mine A' },
        { id: 31, name: 'Mine B' },
      ],
      [
        areaEntity(1, 30, 'Mine A', 'OreSortingPlantT1', 'Ore sorting plant', []),
        areaEntity(2, 30, 'Mine A', 'CrusherLarge', 'Crusher (large)', [titaniumMilling]),
        areaEntity(3, 31, 'Mine B', 'OreSortingPlantT2', 'Ore sorting plant (large)', []),
        areaEntity(4, 31, 'Mine B', 'CrusherLarge', 'Crusher (large)', [titaniumMilling]),
      ],
      [],
    )
    const lines = mineModules.flatMap(mine => (
      buildModuleLines(mine, mine.presets[0] ?? null).lines
    ))
    const result = calculateNet(lines, {}, undefined, {}, { titaniumOreCrushed: 150 })
    const crusherResults = result.regularResults.filter(candidate => (
      candidate.recipe.gameRecipeId === 'IlmeniteMilling'
    ))
    const sourceResults = result.sourceResults.filter(candidate => (
      candidate.recipe.sourceMode === 'module-demand'
    ))

    expect(crusherResults.map(candidate => candidate.actualInputs[0]?.quantity))
      .toEqual([96, 54])
    expect(sourceResults.map(candidate => candidate.actualOutputs[0]?.quantity))
      .toEqual([96, 54])
    expect(sourceResults.map(candidate => candidate.moduleId))
      .toEqual(crusherResults.map(candidate => candidate.moduleId))
  })

  it('draws only the primary resource when a sorter also selects incidental terrain', () => {
    const coalSorter: SyncedAreaEntity = {
      ...entity(1, true, true, []),
      prototypeId: 'OreSortingPlantT1',
      prototypeName: 'Ore sorting plant',
      oreSorter: {
        throughputPerCycle: 160,
        conversionLossPercent: 10,
        products: [
          {
            productId: 'Product_Coal',
            name: 'Coal',
            canBeWasted: true,
          },
          {
            productId: 'Product_Dirt',
            name: 'Dirt',
            canBeWasted: false,
          },
          {
            productId: 'Product_Rock',
            name: 'Rock',
            canBeWasted: false,
          },
        ],
      },
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [coalSorter],
      [],
      undefined,
      [{ entityId: 99, assignedOreSorterEntityIds: [1] }],
    )

    if (!module) throw new Error('Missing linked sorter module')

    const { lines } = buildModuleLines(module, module.presets[0] ?? null)
    const result = calculateNet(lines, {}, undefined, {}, {
      coal: 72,
      dirt: 40,
      rock: 80,
    })
    const sorterResults = result.regularResults.filter(candidate => (
      candidate.recipe.sourceKind === 'map-mine'
    ))

    expect(module.includedInFactoryTotals).toBe(true)
    expect(lines).toHaveLength(1)
    expect(new Set(lines.map(line => line.capacityPoolId)).size).toBe(1)
    expect(sorterResults.map(candidate => candidate.actualOutputs[0]?.quantity))
      .toEqual([72])
    expect(result.allResourceFlows.find(flow => flow.resourceId === 'dirt')?.net).toBe(-40)
    expect(result.allResourceFlows.find(flow => flow.resourceId === 'rock')?.net).toBe(-80)
    expect(getModeledTerrainSorterEntityIds(
      [coalSorter],
      [{ entityId: 99, assignedOreSorterEntityIds: [1] }],
      [module],
    )).toEqual(new Set([1]))
  })

  it('treats Rock as the source when a linked sorter selects only incidental terrain', () => {
    const rockSorter: SyncedAreaEntity = {
      ...entity(1, true, true, []),
      prototypeId: 'OreSortingPlantT1',
      prototypeName: 'Ore sorting plant',
      oreSorter: {
        throughputPerCycle: 160,
        conversionLossPercent: 10,
        products: [
          { productId: 'Product_Dirt', name: 'Dirt', canBeWasted: false },
          { productId: 'Product_Rock', name: 'Rock', canBeWasted: false },
          { productId: 'Product_Slag', name: 'Slag', canBeWasted: false },
          { productId: 'Product_Waste', name: 'Waste', canBeWasted: false },
        ],
      },
    }
    const towers = [{ entityId: 99, assignedOreSorterEntityIds: [1] }]
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [rockSorter],
      [],
      undefined,
      towers,
    )

    if (!module) throw new Error('Missing dedicated Rock mine module')

    const { lines } = buildModuleLines(module, module.presets[0] ?? null)
    const result = calculateNet(lines, {}, undefined, {}, { rock: 80, dirt: 20 })

    expect(lines.map(line => line.recipe.outputs[0]?.resourceId)).toEqual(['rock'])
    expect(result.regularResults[0]?.actualOutputs).toEqual([
      { resourceId: 'rock', quantity: 80 },
    ])
    expect(result.allResourceFlows.find(flow => flow.resourceId === 'dirt')?.net).toBe(-20)
    expect(getModeledTerrainSorterEntityIds([rockSorter], towers, [module]))
      .toEqual(new Set([1]))
  })

  it('does not create terrain supply until a mine tower links the sorter', () => {
    const unlinkedSorter: SyncedAreaEntity = {
      ...entity(1, true, true, []),
      prototypeId: 'OreSortingPlantT1',
      prototypeName: 'Ore sorting plant',
      oreSorter: {
        throughputPerCycle: 160,
        conversionLossPercent: 10,
        products: [{
          productId: 'Product_Coal',
          name: 'Coal',
          canBeWasted: true,
        }],
      },
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [unlinkedSorter],
      [],
      undefined,
      [],
    )

    expect(module?.includedInFactoryTotals).toBe(false)
    expect(module?.recipes).toEqual([])
  })

  it('keeps an incidental-only linked sorter out of the terrain supply model', () => {
    const dirtSorter: SyncedAreaEntity = {
      ...entity(1, true, true, []),
      prototypeId: 'OreSortingPlantT1',
      prototypeName: 'Ore sorting plant',
      oreSorter: {
        throughputPerCycle: 160,
        conversionLossPercent: 10,
        products: [
          { productId: 'Product_Dirt', name: 'Dirt', canBeWasted: false },
          { productId: 'Product_Slag', name: 'Slag', canBeWasted: false },
          { productId: 'Product_Waste', name: 'Waste', canBeWasted: false },
        ],
      },
    }
    const towers = [{ entityId: 99, assignedOreSorterEntityIds: [1] }]
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [dirtSorter],
      [],
      undefined,
      towers,
    )

    expect(module?.includedInFactoryTotals).toBe(false)
    expect(module?.recipes).toEqual([])
    expect(getModeledTerrainSorterEntityIds(
      [dirtSorter],
      towers,
      module ? [module] : [],
    )).toEqual(new Set())
  })

  it('does not manage a sorter when its area belongs to a configured module', () => {
    const sorter: SyncedAreaEntity = {
      ...entity(1, true, true, []),
      prototypeId: 'OreSortingPlantT1',
      prototypeName: 'Ore sorting plant',
      zones: [{ id: 16, name: 'Mines' }],
      oreSorter: {
        throughputPerCycle: 160,
        conversionLossPercent: 10,
        products: [{
          productId: 'Product_Coal',
          name: 'Coal',
          canBeWasted: true,
        }],
      },
    }
    const towers = [{ entityId: 99, assignedOreSorterEntityIds: [1] }]
    const liveModules = createLiveAreaModules(
      [{ id: 16, name: 'Mines' }],
      [sorter],
      [{
        id: 'mines',
        name: 'Mines',
        description: '',
        builtBuildings: {},
        presets: [],
        defaultPresetId: null,
      }],
      undefined,
      towers,
    )

    expect(liveModules).toEqual([])
    expect(getModeledTerrainSorterEntityIds([sorter], towers, liveModules))
      .toEqual(new Set())
  })

  it('routes a configured ore through the selected crusher recipe when applicable', () => {
    const bauxiteMilling = {
      id: 'BauxiteMilling',
      name: 'Bauxite milling',
      durationSeconds: 30,
      assigned: true,
      inputs: [{ productId: 'Product_Bauxite', name: 'Bauxite', quantity: 48 }],
      outputs: [{ productId: 'Product_BauxitePowder', name: 'Bauxite powder', quantity: 48 }],
    }
    const sorter: SyncedAreaEntity = {
      ...entity(1, true, true, []),
      prototypeId: 'OreSortingPlantT1',
      prototypeName: 'Ore sorting plant',
      oreSorter: {
        throughputPerCycle: 160,
        conversionLossPercent: 10,
        products: [{
          productId: 'Product_Bauxite',
          name: 'Bauxite',
          canBeWasted: true,
        }],
      },
    }
    const crusher: SyncedAreaEntity = {
      ...entity(2, true, true, [bauxiteMilling]),
      prototypeId: 'CrusherLarge',
      prototypeName: 'Crusher (large)',
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [sorter, crusher],
      [],
      undefined,
      [{ entityId: 99, assignedOreSorterEntityIds: [1] }],
    )

    if (!module) throw new Error('Missing Bauxite mine module')

    const { lines } = buildModuleLines(module, module.presets[0] ?? null)
    const result = calculateNet(lines, {}, undefined, {}, { bauxitePowder: 96 })
    const sorterResult = result.regularResults.find(candidate => (
      candidate.recipe.sourceKind === 'map-mine'
    ))
    const crusherResult = result.regularResults.find(candidate => (
      candidate.recipe.gameRecipeId === 'BauxiteMilling'
    ))

    expect(crusherResult).toMatchObject({
      supplyRatio: 1,
      actualInputs: [{ resourceId: 'bauxite', quantity: 96 }],
      actualOutputs: [{ resourceId: 'bauxitePowder', quantity: 96 }],
    })
    expect(sorterResult).toMatchObject({
      supplyRatio: 96 / 144,
      actualOutputs: [{ resourceId: 'bauxite', quantity: 96 }],
    })
    expect(result.sourceResults).toEqual([])
  })

  it('keeps a paused linked sorter claim with zero active supply', () => {
    const pausedSorter: SyncedAreaEntity = {
      ...entity(1, true, false, []),
      prototypeId: 'OreSortingPlantT1',
      prototypeName: 'Ore sorting plant',
      oreSorter: {
        throughputPerCycle: 160,
        conversionLossPercent: 10,
        products: [{
          productId: 'Product_Coal',
          name: 'Coal',
          canBeWasted: true,
        }],
      },
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [pausedSorter],
      [],
      undefined,
      [{ entityId: 99, assignedOreSorterEntityIds: [1] }],
    )

    if (!module) throw new Error('Missing paused sorter module')

    const { lines } = buildModuleLines(module, module.presets[0] ?? null)
    const result = calculateNet(lines, {}, undefined, {}, { coal: 10 })

    expect(lines[0]).toMatchObject({ activeBuildings: 0, builtBuildings: 1 })
    expect(result.regularResults[0]?.actualOutputs).toEqual([
      { resourceId: 'coal', quantity: 0 },
    ])
  })

  it('does not invent terrain supply when a crusher area has no sorting plant', () => {
    const titaniumMilling = {
      id: 'IlmeniteMilling',
      name: 'Ilmenite milling',
      durationSeconds: 30,
      assigned: true,
      inputs: [{ productId: 'Product_TitaniumOre', name: 'Titanium ore', quantity: 48 }],
      outputs: [{
        productId: 'Product_TitaniumOreCrushed',
        name: 'Titanium ore crushed',
        quantity: 48,
      }],
    }
    const crusher = {
      ...entity(1, true, true, [titaniumMilling]),
      prototypeId: 'CrusherLarge',
      prototypeName: 'Crusher (large)',
    }
    const [module] = createLiveAreaModules([{ id: 16, name: 'Test' }], [crusher], [])
    const { lines } = buildModuleLines(module!, module?.presets[0] ?? null)
    const result = calculateNet(lines, {}, undefined, {}, { titaniumOreCrushed: 96 })

    expect(module?.recipes?.some(recipe => recipe.sourceMode === 'module-demand')).toBe(false)
    expect(module?.includedInFactoryTotals).toBe(false)
    expect(module?.recipes?.[0]).toMatchObject({
      balanceInputIds: ['titaniumOre'],
      balanceInputScope: 'module',
    })
    expect(result.regularResults[0]?.supplyRatio).toBe(0)
  })

  it('normalizes fractional game recipe durations without truncating them', () => {
    const fractionalRecipe = {
      ...recipe,
      durationSeconds: 7.5,
      outputs: [{ productId: 'Product_Oxygen', name: 'Oxygen', quantity: 6 }],
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [entity(1, false, false, [fractionalRecipe])],
      [],
    )

    expect(module?.recipes?.[0]?.outputs).toEqual([
      { resourceId: 'oxygen', quantity: 48 },
    ])
  })

  it('does not duplicate a named area already represented by a configured module', () => {
    const modules = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [],
      [{
        id: 'test',
        name: 'Test',
        description: '',
        builtBuildings: {},
        presets: [],
        defaultPresetId: null,
      }],
    )

    expect(modules).toEqual([])
  })

  it('keeps multi-recipe ghosts visible as a configuration issue', () => {
    const alternative = { ...recipe, id: 'AirSeparationAlternative', assigned: false }
    const ambiguous = entity(2, false, false, [
      { ...recipe, assigned: false },
      alternative,
    ])
    const [module] = createLiveAreaModules([{ id: 16, name: 'Test' }], [ambiguous], [])

    expect(module?.recipes).toEqual([])
    expect(module?.liveArea?.issues).toEqual([
      expect.objectContaining({ building: 'Air Separator', count: 1 }),
    ])
  })

  it('retains the capacity of separate machines assigned to different recipes', () => {
    const oxygenRecipe = { ...recipe, assigned: true }
    const nitrogenRecipe = {
      ...recipe,
      id: 'NitrogenSeparation',
      name: 'Nitrogen Separation',
      assigned: true,
      outputs: [{ productId: 'Product_Nitrogen', name: 'Nitrogen', quantity: 4 }],
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [
        entity(1, true, true, [oxygenRecipe]),
        entity(2, true, true, [nitrogenRecipe]),
      ],
      [],
    )

    expect(module?.presets[0]?.capacityPools).toEqual({
      AirSeparator: {
        active: 2,
        built: 2,
        currentActive: 2,
        constructionGhosts: 0,
      },
    })

    if (!module) throw new Error('Live area module was not created')

    const { lines } = buildModuleLines(module, module.presets[0] ?? null)
    const result = calculateNet(lines)

    expect(module.recipes?.map(candidate => candidate.sharedCapacity)).toEqual([
      undefined,
      undefined,
    ])
    expect(lines.map(line => line.capacityPoolId)).toEqual([undefined, undefined])
    expect(result.regularResults).toHaveLength(2)
    expect(result.regularResults.map(item => item.supplyRatio)).toEqual([0, 0])
  })

  it('keeps a completed boosted Sea Water pump separate from a default-recipe ghost', () => {
    const seawaterPump = {
      id: 'OceanWaterPumping',
      name: 'Ocean Water Pumping',
      durationSeconds: 60,
      assigned: true,
      inputs: [],
      outputs: [{ productId: 'Product_SeaWater', name: 'Sea Water', quantity: 108 }],
    }
    const boostedSeawaterPump = {
      ...seawaterPump,
      id: 'OceanWaterPumping2x',
      name: 'Ocean Water Pumping 2x',
      outputs: [{ productId: 'Product_SeaWater', name: 'Sea Water', quantity: 216 }],
    }
    const pumpEntity = (
      entityId: number,
      constructed: boolean,
      configuredRecipe: typeof seawaterPump,
    ) => ({
      ...entity(entityId, constructed, constructed, [configuredRecipe]),
      prototypeId: 'OceanWaterPumpT1',
      prototypeName: 'Seawater pump',
    })
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [
        pumpEntity(1, true, boostedSeawaterPump),
        pumpEntity(2, false, seawaterPump),
      ],
      [],
      { Test: { requestedExports: { seaWater: 300 } } },
    )

    if (!module) throw new Error('Live area module was not created')

    const preset = module.presets[0] ?? null
    const { lines } = buildModuleLines(module, preset)
    const result = calculateNet(
      lines,
      {},
      undefined,
      {},
      getPresetResourceDemands(preset),
      new Set(),
      new Map(),
      new Map([[module.id, { seaWater: 300 }]]),
    )
    const sourceResult = (gameRecipeId: string) => result.sourceResults.find(candidate => (
      candidate.recipe.gameRecipeId === gameRecipeId
    ))

    expect(lines.map(line => line.capacityPoolId)).toEqual([undefined, undefined])
    expect(sourceResult('OceanWaterPumping2x')).toMatchObject({
      activeBuildings: 1,
      builtBuildings: 1,
      constructionGhosts: 0,
      supplyRatio: 1,
      actualOutputs: [{ resourceId: 'seaWater', quantity: 216 }],
    })
    expect(sourceResult('OceanWaterPumping')).toMatchObject({
      activeBuildings: 1,
      builtBuildings: 0,
      constructionGhosts: 1,
      supplyRatio: 84 / 108,
      actualOutputs: [{ resourceId: 'seaWater', quantity: 84 }],
    })
  })

  it('keeps synced Sea Water pumps local while balancing them to area demand', () => {
    const seawaterPump = {
      id: 'OceanWaterPumping',
      name: 'Ocean Water Pumping',
      durationSeconds: 60,
      assigned: true,
      inputs: [],
      outputs: [{ productId: 'Product_SeaWater', name: 'Sea Water', quantity: 108 }],
    }
    const seawaterPumpBoosted = {
      ...seawaterPump,
      id: 'OceanWaterPumping2x',
      name: 'Ocean Water Pumping 2x',
      outputs: [{ productId: 'Product_SeaWater', name: 'Sea Water', quantity: 216 }],
    }
    const desalination = {
      id: 'DesalinationFromLP',
      name: 'Desalination From LP',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_SeaWater', name: 'Sea Water', quantity: 72 },
        { productId: 'Product_SteamLow', name: 'Steam (Low)', quantity: 24 },
      ],
      outputs: [
        { productId: 'Product_Water', name: 'Water', quantity: 72 },
        { productId: 'Product_Brine', name: 'Brine', quantity: 24 },
      ],
    }
    const pumpEntity = (entityId: number, pumpRecipe: typeof seawaterPump) => ({
      ...entity(entityId, true, true, [pumpRecipe]),
      prototypeId: 'OceanWaterPumpLarge',
      prototypeName: 'Seawater pump',
    })
    const desalinatorEntity = (entityId: number) => ({
      ...entity(entityId, true, true, [desalination]),
      prototypeId: 'ThermalDesalinator',
      prototypeName: 'Thermal desalinator',
    })
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [
        pumpEntity(1, seawaterPump),
        pumpEntity(2, seawaterPumpBoosted),
        ...[3, 4, 5, 6].map(desalinatorEntity),
      ],
      [],
      {
        Test: {
          requestedExports: { water: 288 },
        },
      },
    )

    if (!module) throw new Error('Live area module was not created')

    const { lines } = buildModuleLines(module, module.presets[0] ?? null)
    const result = calculateNet(
      lines,
      { steamLow: 96 },
      undefined,
      {},
      {
        ...getPresetResourceDemands(module.presets[0]),
        seaWater: 72,
      },
      new Set(),
      new Map(),
      new Map(),
      new Map([[module.id, { steamLow: 96 }]]),
    )
    const pumpResults = result.sourceResults.filter(item => (
      item.recipe.building === 'Seawater pump'
    ))
    const desalinatorResult = result.regularResults.find(item => (
      item.recipe.building === 'Thermal desalinator'
    ))
    const seawaterFlow = result.allResourceFlows.find(flow => flow.resourceId === 'seaWater')

    expect(pumpResults.reduce((total, item) => (
      total + (item.actualOutputs[0]?.quantity ?? 0)
    ), 0)).toBe(288)
    expect(pumpResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipe: expect.objectContaining({ sourceMode: 'module-demand-capped' }),
      }),
    ]))
    expect(desalinatorResult).toMatchObject({
      operatingMode: 'balanced',
      supplyRatio: 1,
      actualInputs: expect.arrayContaining([
        { resourceId: 'seaWater', quantity: 288 },
      ]),
    })
    expect(seawaterFlow?.net).toBe(-72)
  })

  it('leaves an auto-balanced producer inactive without requested exports', () => {
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [entity(1, true, true)],
      [],
    )

    if (!module) throw new Error('Live area module was not created')

    const { lines } = buildModuleLines(module, module.presets[0] ?? null)
    const result = calculateNet(lines)

    expect(result.regularResults[0]).toMatchObject({
      operatingMode: 'balanced',
      supplyRatio: 0,
    })
  })

  it('uses installed consumers and dependencies to minimize configured module surplus', () => {
    const copperAndSteam = {
      id: 'TestCopperAndSteam',
      name: 'Test Copper And Steam',
      durationSeconds: 60,
      assigned: true,
      inputs: [],
      outputs: [
        { productId: 'Product_Copper', name: 'Copper', quantity: 1 },
        { productId: 'Product_SteamLow', name: 'Steam (Low)', quantity: 2 },
      ],
    }
    const seawaterPump = {
      id: 'OceanWaterPumping',
      name: 'Ocean Water Pumping',
      durationSeconds: 60,
      assigned: true,
      inputs: [],
      outputs: [{ productId: 'Product_SeaWater', name: 'Sea Water', quantity: 6 }],
    }
    const desalination = {
      id: 'DesalinationFromLP',
      name: 'Desalination From LP',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_SeaWater', name: 'Sea Water', quantity: 6 },
        { productId: 'Product_SteamLow', name: 'Steam (Low)', quantity: 2 },
      ],
      outputs: [
        { productId: 'Product_Water', name: 'Water', quantity: 6 },
        { productId: 'Product_Brine', name: 'Brine', quantity: 2 },
      ],
    }
    const configuredEntity = (
      entityId: number,
      prototypeId: string,
      prototypeName: string,
      configuredRecipe: typeof copperAndSteam,
    ) => ({
      ...entity(entityId, true, true, [configuredRecipe]),
      prototypeId,
      prototypeName,
    })
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [
        configuredEntity(1, 'TestProducer', 'Test producer', copperAndSteam),
        configuredEntity(2, 'OceanWaterPumpT1', 'Seawater pump', seawaterPump),
        configuredEntity(3, 'ThermalDesalinator', 'Thermal desalinator', desalination),
      ],
      [],
      { Test: { requestedExports: { copper: 1 } } },
    )

    if (!module) throw new Error('Live area module was not created')

    const desalinatorRecipe = module.recipes?.find(candidate => (
      candidate.gameRecipeId === 'DesalinationFromLP'
    ))
    const { lines } = buildModuleLines(module, module.presets[0] ?? null)
    const result = calculateNet(
      lines,
      {},
      undefined,
      {},
      getPresetResourceDemands(module.presets[0]),
    )
    const recipeResult = (gameRecipeId: string) => [
      ...result.regularResults,
      ...result.sourceResults,
    ].find(
      candidate => candidate.recipe.gameRecipeId === gameRecipeId,
    )
    const net = (resourceId: string) => result.allResourceFlows.find(
      flow => flow.resourceId === resourceId,
    )?.net ?? 0

    expect(desalinatorRecipe).toMatchObject({
      balanceBy: 'output',
      balanceInputIds: ['seaWater', 'steamLow'],
      balanceInputScope: 'module',
      consumeSurplusInputIds: ['steamLow'],
      consumeSurplusInputScope: 'module',
      surplusConsumptionPriority: 10,
    })
    expect(recipeResult('DesalinationFromLP')?.supplyRatio).toBe(1)
    expect(recipeResult('OceanWaterPumping')?.supplyRatio).toBe(1)
    expect(net('steamLow')).toBe(0)
    expect(net('seaWater')).toBe(0)
    expect(net('water')).toBe(6)
    expect(net('brine')).toBe(2)
  })

  it('uses available Copper Scrap before falling back to Crushed Ore', () => {
    const arcRecipe = {
      id: 'CopperSmeltingArc',
      name: 'Copper Smelting Arc',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_CopperOreCrushed', name: 'Copper Ore Crushed', quantity: 48 },
        { productId: 'Product_Sand', name: 'Sand', quantity: 6 },
        { productId: 'Product_Graphite', name: 'Graphite', quantity: 3 },
        { productId: 'Product_Water', name: 'Water', quantity: 6 },
      ],
      outputs: [
        { productId: 'Product_MoltenCopper', name: 'Molten Copper', quantity: 48 },
        { productId: 'Product_Slag', name: 'Slag', quantity: 18 },
        { productId: 'Product_SteamLow', name: 'Steam (Low)', quantity: 6 },
        { productId: 'Product_Exhaust', name: 'Exhaust', quantity: 12 },
      ],
    }
    const arcScrapRecipe = {
      id: 'CopperSmeltingArcScrap',
      name: 'Copper Smelting Arc Scrap',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_CopperScrap', name: 'Copper Scrap', quantity: 48 },
        { productId: 'Product_Graphite', name: 'Graphite', quantity: 3 },
        { productId: 'Product_Water', name: 'Water', quantity: 6 },
      ],
      outputs: [
        { productId: 'Product_MoltenCopper', name: 'Molten Copper', quantity: 48 },
        { productId: 'Product_SteamLow', name: 'Steam (Low)', quantity: 6 },
        { productId: 'Product_Exhaust', name: 'Exhaust', quantity: 6 },
      ],
    }
    const castingRecipe = {
      id: 'CopperCasting',
      name: 'Copper Casting',
      durationSeconds: 60,
      assigned: true,
      inputs: [{ productId: 'Product_MoltenCopper', name: 'Molten Copper', quantity: 24 }],
      outputs: [{ productId: 'Product_ImpureCopper', name: 'Impure Copper', quantity: 24 }],
    }
    const electrolysisRecipe = {
      id: 'CopperElectrolysisProcess',
      name: 'Copper Electrolysis Process',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_ImpureCopper', name: 'Impure Copper', quantity: 24 },
        { productId: 'Product_Acid', name: 'Acid', quantity: 6 },
      ],
      outputs: [{ productId: 'Product_Copper', name: 'Copper', quantity: 24 }],
    }
    const chainEntity = (
      entityId: number,
      prototypeId: string,
      prototypeName: string,
      entityRecipes: SyncedAreaEntity['recipes'],
    ) => ({
      ...entity(entityId, false, false, entityRecipes),
      prototypeId,
      prototypeName,
      zones: [{ id: 16, name: 'Copper #1' }],
    })
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Copper #1' }],
      [
        ...Array.from({ length: 8 }, (_, index) => (
          chainEntity(index + 1, 'ArcFurnace2', 'Arc furnace II', [
            arcRecipe,
            arcScrapRecipe,
          ])
        )),
        ...Array.from({ length: 16 }, (_, index) => (
          chainEntity(index + 20, 'AirSeparator2', 'Metal caster II', [castingRecipe])
        )),
        ...Array.from({ length: 16 }, (_, index) => (
          chainEntity(index + 40, 'AirSeparator3', 'Copper electrolysis', [electrolysisRecipe])
        )),
      ],
      [],
    )

    if (!module) throw new Error('Copper #1 module was not created')

    const preset = module.presets[0]
    const { lines } = buildModuleLines(module, preset ?? null)
    const result = calculateNet(
      lines,
      { copperScrap: 120 },
      undefined,
      {},
      { copper: 384, slag: 1_000 },
    )

    expect(module.includedInFactoryTotals).toBe(true)
    expect(preset?.requestedExports).toBeUndefined()
    expect(preset?.outputTargets).toBeUndefined()
    const arcResults = result.regularResults.filter(candidate => (
      candidate.recipe.gameRecipeId?.startsWith('CopperSmeltingArc')
    ))

    expect(arcResults.map(candidate => candidate.recipe.gameRecipeId)).toEqual([
      'CopperSmeltingArcScrap',
      'CopperSmeltingArc',
    ])
    expect(arcResults).toEqual([
      expect.objectContaining({
        actualInputs: expect.arrayContaining([
          { resourceId: 'copperScrap', quantity: 120 },
        ]),
        operatingMode: 'balanced',
        supplyRatio: 0.3125,
      }),
      expect.objectContaining({
        recipe: expect.objectContaining({
          balanceOutputIds: ['moltenCopper'],
        }),
        actualInputs: expect.arrayContaining([
          { resourceId: 'copperOreCrushed', quantity: 264 },
        ]),
        operatingMode: 'balanced',
        supplyRatio: 0.6875,
      }),
    ])
    expect(result.regularResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipe: expect.objectContaining({ id: expect.stringContaining('CopperCasting') }),
        operatingMode: 'balanced',
        supplyRatio: 1,
      }),
      expect.objectContaining({
        recipe: expect.objectContaining({ id: expect.stringContaining('CopperElectrolysisProcess') }),
        operatingMode: 'balanced',
        supplyRatio: 1,
      }),
    ]))
    expect(result.allResourceFlows.find(flow => flow.resourceId === 'copper')).toMatchObject({
      consumed: 384,
      produced: 384,
      net: 0,
    })
    expect(result.allResourceFlows.find(flow => flow.resourceId === 'moltenCopper')).toMatchObject({
      net: 0,
    })
    expect(calculateBuildingStats(lines, result)).toMatchObject({
      workers: 224,
      electricityKw: 48_400,
    })
  })

  it('uses a forced Crushed Ore import before available Iron Scrap', () => {
    const arcOreRecipe = {
      id: 'IronSmeltingArc',
      name: 'Iron Smelting Arc',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_IronOreCrushed', name: 'Iron Ore Crushed', quantity: 48 },
        { productId: 'Product_Limestone', name: 'Limestone', quantity: 6 },
        { productId: 'Product_Graphite', name: 'Graphite', quantity: 3 },
        { productId: 'Product_Water', name: 'Water', quantity: 6 },
      ],
      outputs: [
        { productId: 'Product_MoltenIron', name: 'Molten Iron', quantity: 48 },
        { productId: 'Product_Slag', name: 'Slag', quantity: 18 },
        { productId: 'Product_SteamLow', name: 'Steam (Low)', quantity: 6 },
        { productId: 'Product_Exhaust', name: 'Exhaust', quantity: 12 },
      ],
    }
    const arcScrapRecipe = {
      id: 'IronSmeltingArcScrap',
      name: 'Iron Smelting Arc Scrap',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_IronScrap', name: 'Iron Scrap', quantity: 48 },
        { productId: 'Product_Graphite', name: 'Graphite', quantity: 3 },
        { productId: 'Product_Water', name: 'Water', quantity: 6 },
      ],
      outputs: [
        { productId: 'Product_MoltenIron', name: 'Molten Iron', quantity: 48 },
        { productId: 'Product_SteamLow', name: 'Steam (Low)', quantity: 6 },
        { productId: 'Product_Exhaust', name: 'Exhaust', quantity: 6 },
      ],
    }
    const oxygenFurnaceRecipe = {
      id: 'SteelProductionOxygenFurnace2',
      name: 'Steel Production',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_MoltenIron', name: 'Molten Iron', quantity: 48 },
        { productId: 'Product_Oxygen', name: 'Oxygen', quantity: 18 },
      ],
      outputs: [
        { productId: 'Product_MoltenSteel', name: 'Molten Steel', quantity: 24 },
        { productId: 'Product_Exhaust', name: 'Exhaust', quantity: 36 },
      ],
    }
    const casterRecipe = {
      id: 'SteelCasting2',
      name: 'Steel Casting',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_MoltenSteel', name: 'Molten Steel', quantity: 24 },
        { productId: 'Product_Water', name: 'Water', quantity: 12 },
      ],
      outputs: [{ productId: 'Product_Steel', name: 'Steel', quantity: 24 }],
    }
    const chainEntity = (
      entityId: number,
      prototypeId: string,
      prototypeName: string,
      entityRecipes: SyncedAreaEntity['recipes'],
    ) => ({
      ...entity(entityId, false, false, entityRecipes),
      prototypeId,
      prototypeName,
      zones: [{ id: 21, name: 'Future Steel' }],
    })
    const [module] = createLiveAreaModules(
      [{ id: 21, name: 'Future Steel' }],
      [
        ...Array.from({ length: 8 }, (_, index) => (
          chainEntity(index + 1, 'ArcFurnace2', 'Arc furnace II', [
            arcOreRecipe,
            arcScrapRecipe,
          ])
        )),
        ...Array.from({ length: 8 }, (_, index) => (
          chainEntity(index + 20, 'OxygenFurnace2', 'Oxygen furnace II', [
            oxygenFurnaceRecipe,
          ])
        )),
        ...Array.from({ length: 8 }, (_, index) => (
          chainEntity(index + 40, 'AirSeparator3', 'Cooled caster II', [casterRecipe])
        )),
      ],
      [],
      {
        'Future Steel': {
          resourcePool: 'factory',
          requestedImports: { ironOreCrushed: 384 },
          requestedExports: { steel: 192 },
        },
      },
    )

    if (!module) throw new Error('Future Steel module was not created')

    const preset = module.presets[0]

    expect(preset?.requestedImports).toEqual({ ironOreCrushed: 384 })

    const { lines } = buildModuleLines(module, preset ?? null)
    const normalResult = calculateNet(
      lines.map(line => ({ ...line, drivingInputIds: undefined })),
      {
        graphite: 1_000,
        ironOreCrushed: 1_000,
        ironScrap: 120,
        limestone: 1_000,
        oxygen: 1_000,
        water: 1_000,
      },
      undefined,
      {},
      getPresetResourceDemands(preset),
    )
    const normalArcResults = normalResult.regularResults.filter(candidate => (
      candidate.recipe.gameRecipeId?.startsWith('IronSmeltingArc')
    ))

    expect(normalArcResults.map(candidate => candidate.supplyRatio)).toEqual([
      0.3125,
      0,
    ])

    const result = calculateNet(
      lines,
      {
        graphite: 1_000,
        ironOreCrushed: 384,
        ironScrap: 120,
        limestone: 1_000,
        oxygen: 1_000,
        water: 1_000,
      },
      undefined,
      {},
      getPresetResourceDemands(preset),
    )
    const arcResults = result.regularResults.filter(candidate => (
      candidate.recipe.gameRecipeId?.startsWith('IronSmeltingArc')
    ))

    expect(arcResults.map(candidate => candidate.recipe.gameRecipeId)).toEqual([
      'IronSmeltingArcScrap',
      'IronSmeltingArc',
    ])
    expect(arcResults).toEqual([
      expect.objectContaining({
        recipe: expect.objectContaining({
          balanceBy: 'input',
          balanceInputIds: ['ironScrap'],
          electricityMultiplier: 0.6,
        }),
        actualInputs: expect.arrayContaining([
          { resourceId: 'ironScrap', quantity: 0 },
        ]),
        supplyRatio: 0,
      }),
      expect.objectContaining({
        recipe: expect.objectContaining({
          allocation: 'fallback',
          allocationPriority: 50,
          balanceBy: 'output',
          balanceInputIds: [],
          balanceOutputIds: ['moltenIron'],
        }),
        actualInputs: expect.arrayContaining([
          { resourceId: 'ironOreCrushed', quantity: 384 },
        ]),
        supplyRatio: 1,
      }),
    ])
    expect(result.allResourceFlows.find(flow => flow.resourceId === 'steel')).toMatchObject({
      consumed: 192,
      produced: 192,
      net: 0,
    })
    expect(result.allResourceFlows.find(flow => flow.resourceId === 'moltenIron')).toMatchObject({
      net: 0,
    })
  })

  it('preserves the Shredder recycling exception', () => {
    const shredding = {
      id: 'ShreddingRetiredWaste',
      name: 'Shredding Retired Waste',
      durationSeconds: 60,
      assigned: true,
      inputs: [{ productId: 'Product_RetiredWaste', name: 'Retired Waste', quantity: 6 }],
      outputs: [{ productId: 'Product_Recyclables', name: 'Recyclables', quantity: 6 }],
    }
    const shredder = {
      ...entity(3, true, true, [shredding]),
      prototypeId: 'Shredder',
      prototypeName: 'Shredder',
    }
    const [module] = createLiveAreaModules([{ id: 16, name: 'Test' }], [shredder], [])

    expect(module?.recipes?.[0]?.appliesRecyclingEfficiency).toBe(false)
  })

  it('uses the CO2 graphite recipe as a local surplus catcher', () => {
    const scrubber = {
      id: 'TestScrubber',
      name: 'Test scrubber',
      durationSeconds: 60,
      assigned: true,
      inputs: [],
      outputs: [
        { productId: 'Product_Sulfur', name: 'Sulfur', quantity: 1 },
        { productId: 'Product_CarbonDioxide', name: 'Carbon Dioxide', quantity: 38.4 },
      ],
    }
    const graphiteFromCo2 = {
      id: 'GraphiteProductionCo2',
      name: 'Graphite production from CO2',
      durationSeconds: 60,
      assigned: true,
      inputs: [
        { productId: 'Product_CarbonDioxide', name: 'Carbon Dioxide', quantity: 144 },
      ],
      outputs: [{ productId: 'Product_Graphite', name: 'Graphite', quantity: 6 }],
    }
    const configuredEntity = (
      entityId: number,
      prototypeId: string,
      prototypeName: string,
      configuredRecipe: typeof scrubber,
    ) => ({
      ...entity(entityId, true, true, [configuredRecipe]),
      prototypeId,
      prototypeName,
    })
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [
        configuredEntity(1, 'TestProducer', 'Test producer', scrubber),
        configuredEntity(2, 'ChemicalPlant2', 'Chemical plant II', graphiteFromCo2),
      ],
      [],
      { Test: { requestedExports: { sulfur: 1 } } },
    )

    if (!module) throw new Error('Live area module was not created')

    const preset = module.presets[0]
    const { lines } = buildModuleLines(module, preset ?? null)
    const result = calculateNet(
      lines,
      {},
      undefined,
      {},
      getPresetResourceDemands(preset),
    )
    const graphiteRecipe = module.recipes?.find(candidate => (
      candidate.gameRecipeId === 'GraphiteProductionCo2'
    ))
    const graphiteResult = result.regularResults.find(candidate => (
      candidate.recipe.gameRecipeId === 'GraphiteProductionCo2'
    ))

    expect(graphiteRecipe).toMatchObject({
      balanceBy: 'output',
      consumeSurplusInputIds: ['carbonDioxide'],
      consumeSurplusInputScope: 'module',
      surplusConsumptionPriority: 10,
    })
    expect(graphiteResult?.supplyRatio).toBeCloseTo(38.4 / 144)
    expect(result.allResourceFlows.find(
      flow => flow.resourceId === 'carbonDioxide',
    )?.net).toBeCloseTo(0)
    expect(result.allResourceFlows.find(
      flow => flow.resourceId === 'graphite',
    )?.net).toBeCloseTo(1.6)
  })

  it('ignores virtual environmental emissions without dropping material flows', () => {
    const exhaustProducer = {
      id: 'TestExhaustProducer',
      name: 'Test exhaust producer',
      durationSeconds: 60,
      assigned: true,
      inputs: [],
      outputs: [
        { productId: 'Product_Sulfur', name: 'Sulfur', quantity: 1 },
        { productId: 'Product_Exhaust', name: 'Exhaust', quantity: 60 },
      ],
    }
    const smokeStackRecipe = {
      id: 'SmokeStackExhaust',
      name: 'SmokeStackExhaust',
      durationSeconds: 20,
      assigned: true,
      inputs: [{ productId: 'Product_Exhaust', name: 'Exhaust', quantity: 20 }],
      outputs: [
        {
          productId: 'Product_Virtual_PollutedAir',
          name: 'Air pollution',
          quantity: 10,
        },
        {
          productId: 'Product_Virtual_PollutedWater',
          name: 'Water pollution',
          quantity: 5,
        },
      ],
    }
    const smokeStack = {
      ...entity(4, true, true, [smokeStackRecipe]),
      prototypeId: 'SmokeStack',
      prototypeName: 'Smoke stack',
    }
    const producer = {
      ...entity(3, true, true, [exhaustProducer]),
      prototypeId: 'TestProducer',
      prototypeName: 'Test producer',
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [producer, smokeStack],
      [],
      { Test: { requestedExports: { sulfur: 1 } } },
    )

    if (!module) throw new Error('Live area module was not created')

    expect(module?.liveArea?.issues).toEqual([])
    expect(module?.recipes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        gameRecipeId: 'SmokeStackExhaust',
        inputs: [{ resourceId: 'exhaust', quantity: 60 }],
        outputs: [],
        consumeSurplusInputIds: ['exhaust'],
        consumeSurplusInputScope: 'module',
      }),
    ]))

    const preset = module.presets[0]
    const { lines } = buildModuleLines(module, preset ?? null)
    const result = calculateNet(
      lines,
      {},
      undefined,
      {},
      getPresetResourceDemands(preset),
    )
    const smokeStackResult = result.regularResults.find(candidate => (
      candidate.recipe.gameRecipeId === 'SmokeStackExhaust'
    ))

    expect(smokeStackResult?.supplyRatio).toBe(1)
    expect(result.allResourceFlows.find(
      flow => flow.resourceId === 'exhaust',
    )?.net).toBeCloseTo(0)
  })

  it('counts every building affected by an unsupported product', () => {
    const unsupported = {
      ...recipe,
      inputs: [{ productId: 'Product_Unobtainium', name: 'Unobtainium', quantity: 1 }],
    }
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Test' }],
      [entity(4, true, true, [unsupported]), entity(5, false, false, [unsupported])],
      [],
    )

    expect(module?.liveArea?.issues).toEqual([
      expect.objectContaining({ building: 'Air Separator', count: 2 }),
    ])
  })
})
