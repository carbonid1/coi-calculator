import { describe, expect, it } from 'vitest'

import { type SyncedAreaEntity } from '../../game-state'
import { buildModuleLines } from '../build-module-lines/build-module-lines'
import { calculateNet } from '../calculate/calculate'
import { getPresetResourceDemands } from '../preset-resource-demands/preset-resource-demands'
import { createLiveAreaModules } from './live-area-modules'

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

    expect(result.regularResults).toHaveLength(2)
    expect(result.regularResults.map(item => item.supplyRatio)).toEqual([0, 0])
  })

  it('balances input-free suppliers to matching demand inside the live area', () => {
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
      {},
      undefined,
      {},
      getPresetResourceDemands(module.presets[0]),
    )
    const pumpResults = result.regularResults.filter(item => (
      item.recipe.building === 'Seawater pump'
    ))
    const desalinatorResult = result.regularResults.find(item => (
      item.recipe.building === 'Thermal desalinator'
    ))
    const seawaterFlow = result.resourceFlows.find(flow => flow.resourceId === 'seaWater')

    expect(pumpResults.reduce((total, item) => (
      total + (item.actualOutputs[0]?.quantity ?? 0)
    ), 0)).toBe(288)
    expect(pumpResults.map(item => item.operatingMode)).toEqual(['balanced', 'balanced'])
    expect(desalinatorResult).toMatchObject({
      operatingMode: 'balanced',
      supplyRatio: 1,
      actualInputs: expect.arrayContaining([
        { resourceId: 'seaWater', quantity: 288 },
      ]),
    })
    expect(seawaterFlow).toBeUndefined()
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
    const recipeResult = (gameRecipeId: string) => result.regularResults.find(
      candidate => candidate.recipe.gameRecipeId === gameRecipeId,
    )
    const net = (resourceId: string) => result.allResourceFlows.find(
      flow => flow.resourceId === resourceId,
    )?.net ?? 0

    expect(desalinatorRecipe).toMatchObject({
      balanceBy: 'output',
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

  it('propagates the Copper #1 export request through the full chain', () => {
    const arcRecipe = {
      id: 'CopperSmeltingArc',
      name: 'Copper Smelting Arc',
      durationSeconds: 60,
      assigned: true,
      inputs: [{ productId: 'Product_CopperOreCrushed', name: 'Copper Ore Crushed', quantity: 48 }],
      outputs: [{ productId: 'Product_MoltenCopper', name: 'Molten Copper', quantity: 48 }],
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
      entityRecipe: typeof arcRecipe,
    ) => ({
      ...entity(entityId, true, true, [entityRecipe]),
      prototypeId,
      prototypeName,
      zones: [{ id: 16, name: 'Copper #1' }],
    })
    const [module] = createLiveAreaModules(
      [{ id: 16, name: 'Copper #1' }],
      [
        ...Array.from({ length: 8 }, (_, index) => (
          chainEntity(index + 1, 'AirSeparator', 'Arc furnace II', arcRecipe)
        )),
        ...Array.from({ length: 16 }, (_, index) => (
          chainEntity(index + 20, 'AirSeparator2', 'Metal caster II', castingRecipe)
        )),
        ...Array.from({ length: 16 }, (_, index) => (
          chainEntity(index + 40, 'AirSeparator3', 'Copper electrolysis', electrolysisRecipe)
        )),
      ],
      [],
    )

    if (!module) throw new Error('Copper #1 module was not created')

    const preset = module.presets[0]
    const { lines } = buildModuleLines(module, preset ?? null)
    const result = calculateNet(
      lines,
      {},
      undefined,
      {},
      getPresetResourceDemands(preset),
    )

    expect(preset?.requestedExports).toEqual({ copper: 384 })
    expect(result.regularResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recipe: expect.objectContaining({ id: expect.stringContaining('CopperSmeltingArc') }),
        operatingMode: 'balanced',
        supplyRatio: 1,
      }),
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
