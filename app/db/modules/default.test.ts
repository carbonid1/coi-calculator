import { describe, expect, it } from 'vitest'

import { buildModuleLines } from '../../helpers/build-module-lines/build-module-lines'
import { calculateBuildingDiagnostics } from '../../helpers/building-diagnostics/building-diagnostics'
import { calculateBuildingStats } from '../../helpers/building-stats/building-stats'
import { calculateNet } from '../../helpers/calculate/calculate'
import { getPlannedConfigurationSummaries } from '../../helpers/planned-builds/planned-builds'
import { getPresetResourceDemands } from '../../helpers/preset-resource-demands/preset-resource-demands'
import { type Recipe } from '../recipes'
import {
  applyDefaultAreaPlan,
  createDefaultModule,
  defaultArea,
  plannedCrackingUnitDieselTarget,
  plannedNewDefaultBuildings,
} from './default'
import { type Module } from './modules'

const runtimeCookingOilDiesel: Recipe = {
  id: 'general:ChemicalPlant2:EthanolCookingOilReforming',
  gameBuildingId: 'ChemicalPlant2',
  gameRecipeId: 'EthanolCookingOilReforming',
  name: 'Ethanol reforming',
  building: 'Chemical plant II',
  group: 'production',
  cycleDurationSeconds: 60,
  balanceBy: 'output',
  balanceOutputIds: [],
  consumeSurplusInputIds: ['cookingOil'],
  inputs: [
    { resourceId: 'ethanol', quantity: 15 },
    { resourceId: 'cookingOil', quantity: 30 },
  ],
  outputs: [{ resourceId: 'diesel', quantity: 54 }],
}

const runtimeResearchLab: Recipe = {
  id: 'general:ResearchLab5:research-lab-iv',
  gameBuildingId: 'ResearchLab5',
  gameRecipeId: 'research-lab-iv',
  name: 'Research Lab IV',
  building: 'Research Lab IV',
  group: 'production',
  inputs: [{ resourceId: 'labEquipmentIv', quantity: 48 }],
  outputs: [{ resourceId: 'recyclables', quantity: 48 }],
}

const runtimeCrackingUnitDiesel: Recipe = {
  id: 'general:HydroCrackerT1:FuelGasReforming',
  gameBuildingId: 'HydroCrackerT1',
  gameRecipeId: 'FuelGasReforming',
  name: 'Fuel Gas reforming',
  building: 'Cracking Unit',
  group: 'production',
  cycleDurationSeconds: 20,
  balanceBy: 'input',
  balanceInputIds: ['fuelGas'],
  balanceOutputIds: ['diesel'],
  allocation: 'surplus',
  allocationPriority: 100,
  inputs: [
    { resourceId: 'fuelGas', quantity: 36 },
    { resourceId: 'oxygen', quantity: 18 },
  ],
  outputs: [
    { resourceId: 'diesel', quantity: 24 },
    { resourceId: 'water', quantity: 6 },
  ],
}

const runtimeRailParts: Recipe = {
  id: 'general:AssemblyRoboticT2:RailPartsAssembly',
  gameBuildingId: 'AssemblyRoboticT2',
  gameRecipeId: 'RailPartsAssembly',
  name: 'RailPartsAssembly',
  building: 'Assembly V',
  group: 'production',
  cycleDurationSeconds: 60,
  balanceBy: 'output',
  balanceOutputIds: ['railParts'],
  inputs: [
    { resourceId: 'concreteSlab', quantity: 32 },
    { resourceId: 'steel', quantity: 16 },
  ],
  outputs: [{ resourceId: 'railParts', quantity: 64 }],
}

const syncedDefault = ({
  built,
  running,
  ghosts = 0,
}: {
  built: number
  running: number
  ghosts?: number
}): Module => ({
  id: 'general',
  name: 'Default',
  description: '',
  gameSynced: true,
  includedInFactoryTotals: true,
  builtBuildings: { [runtimeCookingOilDiesel.id]: built },
  recipes: [runtimeCookingOilDiesel],
  presets: [{
    id: 'live',
    name: 'Live area',
    description: '',
    activeBuildings: { [runtimeCookingOilDiesel.id]: running + ghosts },
    currentActiveBuildings: { [runtimeCookingOilDiesel.id]: running },
    builtBuildings: { [runtimeCookingOilDiesel.id]: built },
    constructionGhosts: { [runtimeCookingOilDiesel.id]: ghosts },
    dataSources: { [runtimeCookingOilDiesel.id]: 'synced' },
    fixed: [],
  }],
  defaultPresetId: 'live',
})

const syncedDefaultWithResearchLabs = ({
  built,
  running,
}: {
  built: number
  running: number
}): Module => {
  const defaultModule = syncedDefault({ built: 1, running: 1 })
  const preset = defaultModule.presets[0]

  if (!preset) throw new Error('Missing synced Default preset')

  return {
    ...defaultModule,
    builtBuildings: {
      ...defaultModule.builtBuildings,
      [runtimeResearchLab.id]: built,
    },
    recipes: [...(defaultModule.recipes ?? []), runtimeResearchLab],
    presets: [{
      ...preset,
      activeBuildings: {
        ...preset.activeBuildings,
        [runtimeResearchLab.id]: running,
      },
      currentActiveBuildings: {
        ...preset.currentActiveBuildings,
        [runtimeResearchLab.id]: running,
      },
      builtBuildings: {
        ...preset.builtBuildings,
        [runtimeResearchLab.id]: built,
      },
      dataSources: {
        ...preset.dataSources,
        [runtimeResearchLab.id]: 'synced',
      },
      fixed: [runtimeResearchLab.id],
    }],
  }
}

const syncedDefaultWithCrackingUnits = ({
  built,
  ghosts = 0,
  running,
}: {
  built: number
  ghosts?: number
  running: number
}): Module => {
  const defaultModule = syncedDefault({ built: 1, running: 1 })
  const preset = defaultModule.presets[0]

  if (!preset) throw new Error('Missing synced Default preset')

  return {
    ...defaultModule,
    builtBuildings: {
      ...defaultModule.builtBuildings,
      [runtimeCrackingUnitDiesel.id]: built,
    },
    recipes: [...(defaultModule.recipes ?? []), runtimeCrackingUnitDiesel],
    presets: [{
      ...preset,
      activeBuildings: {
        ...preset.activeBuildings,
        [runtimeCrackingUnitDiesel.id]: running + ghosts,
      },
      currentActiveBuildings: {
        ...preset.currentActiveBuildings,
        [runtimeCrackingUnitDiesel.id]: running,
      },
      builtBuildings: {
        ...preset.builtBuildings,
        [runtimeCrackingUnitDiesel.id]: built,
      },
      dataSources: {
        ...preset.dataSources,
        [runtimeCrackingUnitDiesel.id]: 'synced',
      },
      constructionGhosts: {
        ...preset.constructionGhosts,
        [runtimeCrackingUnitDiesel.id]: ghosts,
      },
    }],
  }
}

describe('Default area plans', () => {
  it('contains no manually modeled current production', () => {
    expect(defaultArea.builtBuildings).toEqual({
      'chemical-plant-ii-cooking-oil-diesel': 0,
      'cracking-unit-fuel-gas-diesel': 0,
    })
    expect(plannedNewDefaultBuildings).toEqual({
      'chemical-plant-ii-cooking-oil-diesel': 1,
    })
    expect(defaultArea.presets[0]?.dataSources).toEqual({
      'chemical-plant-ii-cooking-oil-diesel': 'planned',
      'cracking-unit-fuel-gas-diesel': 'planned',
    })
  })

  it('binds the plan to the equivalent runtime recipe', () => {
    const defaultModule = applyDefaultAreaPlan(syncedDefault({ built: 0, running: 0 }))
    const preset = defaultModule.presets[0]
    const line = buildModuleLines(defaultModule, preset ?? null).lines.find(
      candidate => candidate.recipe.id === runtimeCookingOilDiesel.id,
    )

    expect(defaultModule.recipes).toContain(runtimeCookingOilDiesel)
    expect(line).toMatchObject({
      activeBuildings: 1,
      builtBuildings: 0,
      currentActiveBuildings: 0,
      dataSource: 'planned',
      recipe: { id: runtimeCookingOilDiesel.id },
      unplacedPlannedBuildings: 1,
    })
    expect(preset?.planMismatches).toContainEqual(expect.objectContaining({
      recipeId: runtimeCookingOilDiesel.id,
      current: 0,
      target: 1,
      actions: [{ type: 'build', label: 'Build 1 Chemical Plant II' }],
    }))
  })

  it('does not bind a matching recipe ID from a different building prototype', () => {
    const synced = syncedDefault({ built: 1, running: 1 })
    const wrongBuildingRecipe = {
      ...runtimeCookingOilDiesel,
      gameBuildingId: 'ChemicalPlant1',
    }

    synced.recipes = [wrongBuildingRecipe]
    const defaultModule = applyDefaultAreaPlan(synced)
    const preset = defaultModule.presets[0]

    expect(defaultModule.recipes).toEqual(expect.arrayContaining([
      wrongBuildingRecipe,
      expect.objectContaining({ id: 'chemical-plant-ii-cooking-oil-diesel' }),
    ]))
    expect(preset?.activeBuildings[wrongBuildingRecipe.id]).toBe(1)
    expect(preset?.activeBuildings['chemical-plant-ii-cooking-oil-diesel']).toBe(1)
    expect(preset?.dataSources?.['chemical-plant-ii-cooking-oil-diesel']).toBe('planned')
  })

  it('drops the override after the live recipe reaches its target', () => {
    const synced = syncedDefault({ built: 1, running: 1 })
    const sourcePreset = synced.presets[0]

    if (sourcePreset) {
      sourcePreset.unplacedPlannedBuildings = { [runtimeCookingOilDiesel.id]: 1 }
    }

    const defaultModule = applyDefaultAreaPlan(synced)
    const preset = defaultModule.presets[0]
    const line = buildModuleLines(defaultModule, preset ?? null).lines.find(
      candidate => candidate.recipe.id === runtimeCookingOilDiesel.id,
    )

    expect(line).toMatchObject({
      activeBuildings: 1,
      builtBuildings: 1,
      currentActiveBuildings: 1,
      dataSource: 'synced',
      unplacedPlannedBuildings: 0,
    })
    expect(preset?.unplacedPlannedBuildings?.[runtimeCookingOilDiesel.id]).toBeUndefined()
    expect(preset?.planMismatches).not.toContainEqual(expect.objectContaining({
      recipeId: runtimeCookingOilDiesel.id,
    }))
  })

  it('accepts a synced construction ghost as projected capacity', () => {
    const defaultModule = applyDefaultAreaPlan(syncedDefault({ built: 0, running: 0, ghosts: 1 }))
    const preset = defaultModule.presets[0]
    const line = buildModuleLines(defaultModule, preset ?? null).lines.find(
      candidate => candidate.recipe.id === runtimeCookingOilDiesel.id,
    )

    expect(line).toMatchObject({
      activeBuildings: 1,
      constructionGhosts: 1,
      dataSource: 'synced',
      unplacedPlannedBuildings: 0,
    })
    expect(preset?.planMismatches).not.toContainEqual(expect.objectContaining({
      recipeId: runtimeCookingOilDiesel.id,
    }))
  })

  it('plans three synced Diesel Cracking Units at full load', () => {
    const defaultModule = applyDefaultAreaPlan(
      syncedDefaultWithCrackingUnits({ built: 3, running: 3 }),
    )
    const preset = defaultModule.presets[0]
    const crackingLine = buildModuleLines(defaultModule, preset ?? null).lines.find(
      line => line.recipe.id === runtimeCrackingUnitDiesel.id,
    )

    if (!crackingLine) throw new Error('Missing planned Cracking Unit line')

    const calculation = calculateNet([crackingLine])
    const diagnostics = calculateBuildingDiagnostics(
      [defaultModule],
      calculation.allResourceFlows,
      calculation.regularResults,
    )

    expect(plannedCrackingUnitDieselTarget).toBe(3)
    expect(crackingLine).toMatchObject({
      activeBuildings: 3,
      builtBuildings: 3,
      currentActiveBuildings: 3,
      dataSource: 'planned',
      operatingMode: 'fixed',
    })
    expect(calculation.allResourceFlows).toEqual(expect.arrayContaining([
      expect.objectContaining({ resourceId: 'fuelGas', net: -108 }),
      expect.objectContaining({ resourceId: 'oxygen', net: -54 }),
      expect.objectContaining({ resourceId: 'diesel', net: 72 }),
      expect.objectContaining({ resourceId: 'water', net: 18 }),
    ]))
    expect(preset?.planMismatches).not.toContainEqual(expect.objectContaining({
      recipeId: runtimeCrackingUnitDiesel.id,
    }))
    expect(getPlannedConfigurationSummaries([defaultModule], diagnostics)).toEqual([])
  })

  it('keeps the planned Diesel Cracking Unit count at three', () => {
    const defaultModule = applyDefaultAreaPlan(
      syncedDefaultWithCrackingUnits({ built: 4, running: 4 }),
    )
    const preset = defaultModule.presets[0]
    const crackingLine = buildModuleLines(defaultModule, preset ?? null).lines.find(
      line => line.recipe.id === runtimeCrackingUnitDiesel.id,
    )

    expect(crackingLine).toMatchObject({
      activeBuildings: 3,
      currentActiveBuildings: 4,
      dataSource: 'planned',
      operatingMode: 'fixed',
    })
    expect(preset?.planMismatches).toContainEqual(expect.objectContaining({
      recipeId: runtimeCrackingUnitDiesel.id,
      current: 4,
      target: 3,
      direction: 'at-most',
      actions: [{ type: 'pause', label: 'Pause 1 Cracking Unit' }],
    }))
  })

  it('cancels excess Cracking Unit construction before pausing running capacity', () => {
    const defaultModule = applyDefaultAreaPlan(
      syncedDefaultWithCrackingUnits({ built: 3, running: 3, ghosts: 1 }),
    )
    const preset = defaultModule.presets[0]

    expect(preset?.planMismatches).toContainEqual(expect.objectContaining({
      recipeId: runtimeCrackingUnitDiesel.id,
      current: 4,
      currentLabel: '3 running · 1 under construction',
      target: 3,
      direction: 'at-most',
      actions: [{
        type: 'cancel-build',
        label: 'Cancel construction of 1 Cracking Unit',
      }],
    }))
  })

  it('plans two paused Research Lab IV buildings as fixed consumption', () => {
    const defaultModule = applyDefaultAreaPlan(
      syncedDefaultWithResearchLabs({ built: 3, running: 0 }),
    )
    const preset = defaultModule.presets[0]
    const lines = buildModuleLines(defaultModule, preset ?? null).lines
    const researchLine = lines.find(line => line.recipe.id === runtimeResearchLab.id)
    const calculation = calculateNet(lines)

    if (!researchLine) throw new Error('Missing planned Research Lab line')

    const researchCalculation = calculateNet([researchLine])
    const researchStats = calculateBuildingStats([researchLine], researchCalculation)

    expect(researchLine).toMatchObject({
      activeBuildings: 2,
      builtBuildings: 3,
      currentActiveBuildings: 0,
      dataSource: 'planned',
      operatingMode: 'fixed',
    })
    expect(calculation.allResourceFlows.find(
      flow => flow.resourceId === 'labEquipmentIv',
    )?.net).toBe(-96)
    expect(calculation.allResourceFlows.find(
      flow => flow.resourceId === 'spaceResearchPoints',
    )?.net).toBe(-96)
    expect(researchStats).toEqual({
      workers: 160,
      electricityKw: 2_000,
      computingTflops: 24,
    })
    expect(preset?.planMismatches).toContainEqual(expect.objectContaining({
      recipeId: runtimeResearchLab.id,
      current: 0,
      target: 2,
      actions: [{ type: 'unpause', label: 'Unpause 2 Research Lab IV' }],
    }))
  })

  it('keeps two running Research Lab IV buildings fixed without a plan mismatch', () => {
    const defaultModule = applyDefaultAreaPlan(
      syncedDefaultWithResearchLabs({ built: 3, running: 2 }),
    )
    const preset = defaultModule.presets[0]
    const researchLine = buildModuleLines(defaultModule, preset ?? null).lines.find(
      line => line.recipe.id === runtimeResearchLab.id,
    )

    expect(researchLine).toMatchObject({
      activeBuildings: 2,
      builtBuildings: 3,
      currentActiveBuildings: 2,
      dataSource: 'synced',
      operatingMode: 'fixed',
    })
    expect(preset?.planMismatches).not.toContainEqual(expect.objectContaining({
      recipeId: runtimeResearchLab.id,
    }))
  })

  it('can disable the temporary Space Research pressure setting', () => {
    const defaultModule = applyDefaultAreaPlan(
      syncedDefaultWithResearchLabs({ built: 3, running: 2 }),
      'before-space',
    )
    const preset = defaultModule.presets[0]
    const researchLine = buildModuleLines(defaultModule, preset ?? null).lines.find(
      line => line.recipe.id === runtimeResearchLab.id,
    )

    expect(researchLine?.recipe.inputs).toEqual([
      { resourceId: 'labEquipmentIv', quantity: 48 },
    ])
  })

  it('keeps the Rail Parts construction allowance as a plan with a ready assembly', () => {
    const expectedDemandPerCycle = 0.62
    const synced = syncedDefault({ built: 1, running: 1 })
    const sourcePreset = synced.presets[0]

    if (!sourcePreset) throw new Error('Missing synced Default preset')

    synced.recipes = [...(synced.recipes ?? []), runtimeRailParts]
    synced.builtBuildings[runtimeRailParts.id] = 1
    sourcePreset.activeBuildings[runtimeRailParts.id] = 1
    sourcePreset.currentActiveBuildings = {
      ...sourcePreset.currentActiveBuildings,
      [runtimeRailParts.id]: 1,
    }
    sourcePreset.builtBuildings = {
      ...sourcePreset.builtBuildings,
      [runtimeRailParts.id]: 1,
    }
    sourcePreset.dataSources = {
      ...sourcePreset.dataSources,
      [runtimeRailParts.id]: 'synced',
    }

    const defaultModule = applyDefaultAreaPlan(synced)
    const preset = defaultModule.presets[0]
    const lines = buildModuleLines(defaultModule, preset ?? null).lines
    const calculation = calculateNet(
      lines,
      undefined,
      undefined,
      undefined,
      getPresetResourceDemands(preset),
    )
    const railPartsResult = calculation.regularResults.find(result => (
      result.recipe.id === runtimeRailParts.id
    ))
    const diagnostic = calculateBuildingDiagnostics(
      [defaultModule],
      calculation.allResourceFlows,
      calculation.regularResults,
    ).find(candidate => candidate.buildingName === 'Assembly V')

    expect(preset?.fixedDemands?.railParts).toBeUndefined()
    expect(preset?.plannedDemands?.railParts).toBe(expectedDemandPerCycle)
    expect(railPartsResult?.recipe.standbyPlan).toEqual({ resourceId: 'railParts', quantity: expectedDemandPerCycle })
    expect(railPartsResult?.actualOutputs).toContainEqual({
      resourceId: 'railParts',
      quantity: expectedDemandPerCycle,
    })
    expect(railPartsResult?.supplyRatio).toBeCloseTo(
      expectedDemandPerCycle / 64,
    )
    expect(diagnostic).toMatchObject({
      attention: null,
      load: expectedDemandPerCycle / 64,
    })
  })

  it('lets downstream demand drive Composite Panel and Titanium Alloy production', () => {
    const defaultModule = createDefaultModule()

    expect(defaultModule.presets[0]?.outputTargets).toBeUndefined()
  })
})
