import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'

import { type ChickenFarmDefinition } from '../app/chicken-farm-state'
import { getCropFarmingData, type CropFarmingDefinitions } from '../app/crop-farming-state'
import { type CropFarmGroup } from '../app/db/crop-farming'
import { createCropFarmAreaModule, createDefaultCropFarmModule, getCropFarmGroundwaterRecipeId } from '../app/db/modules/crop-farm-areas'
import { createChickenFarmsModule } from '../app/db/modules/farms'
import { createSpaceStationModule } from '../app/db/modules/space-station'
import { calculateSpaceStationLevel } from '../app/db/space-station'
import { normalizeGameStateSnapshot, type GameStateSnapshot } from '../app/game-state'
import { buildModuleLines } from '../app/helpers/build-module-lines/build-module-lines'
import { calculateBuildingStats } from '../app/helpers/building-stats/building-stats'
import { calculateNet } from '../app/helpers/calculate/calculate'
import { deriveCalculatorModel } from '../app/helpers/calculator-model/derive-calculator-model'
import { calculateContractWorkers } from '../app/helpers/contracts/calculate-contracts'
import { calculateFactoryCalculation } from '../app/helpers/factory-calculation/factory-calculation'
import { calculateAquiferPumpsForCeiling, calculateAquiferSustainableCeiling, calculateAquiferSustainableOutput, calculateGroundwaterClaimLimits, getAquiferRainRechargePerDay, getDryEmergencyRechargePerDay } from '../app/helpers/groundwater/calculate-groundwater-production'
import { createLiveAreaModules } from '../app/helpers/live-area-modules/live-area-modules'
import { createSpaceResearchAttention } from '../app/helpers/space-research-attention/space-research-attention'
import { getSyncedCropFarmEntities } from '../app/helpers/synced-production-config/synced-production-config'
import { resolveSyncedResourceId } from '../app/helpers/synced-resources/synced-resources'
import { buildWaterSourceInventory, getRainwaterHarvesterPotential, simulateWaterSource, summarizeWeather } from '../app/helpers/water-planning/water-planning'
import { calculateFarmIrrigationRates } from '../app/helpers/weather/calculate-farm-irrigation'
import { getAverageSunIntensityPercent } from '../app/helpers/weather/planning-weather'
import { type RocketIiDefinition } from '../app/rocket-state'
import { type SpaceStationLevelDefinition } from '../app/space-station-state'

// Update 4.3 factory with native farm and Rocket II definitions read by Bridge.
const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/factory.json.gz', import.meta.url))).toString())
const round = (value: number) => Number(value.toFixed(4)) || 0

it('replays native climate, all aquifers, shared withdrawal and dry-period upgrade scenarios', () => {
  const snapshot = normalizeGameStateSnapshot(capture)

  if (!snapshot) throw new Error('Recorded water data is incompatible')
  const weather = snapshot.weather
  const summary = summarizeWeather(weather)

  expect(weather.startDate).toEqual({ year: 24575, month: 7, day: 24 })
  expect(weather.periods[0]).toEqual({ days: 7, sunIntensityPercent: 50, rainIntensityPercent: 50 })
  expect(weather.periods).toHaveLength(2401)
  expect(weather.periods.reduce((days, period) => days + period.days, 0)).toBe(36_000)
  expect(summary).toMatchObject({ averageRainIntensityPercent: 12.5, nextRainCycles: 0, longestDryCycles: 12 })
  expect(summary.averageSunIntensityPercent).toBe(getAverageSunIntensityPercent(weather))
  expect(summary.cycles[0]?.rainIntensityPercent).toBeCloseTo(50 * 7 / 30, 10)
  expect(getRainwaterHarvesterPotential(summary, 1.5)).toEqual({ nextYearPerCycle: 5.625, averagePerCycle: 5.625 })

  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {}, revision: 'water-replay' })
  const { factoryResult, linkedModulesResult } = calculateFactoryCalculation(model.factoryCalculationInput)
  const sourceResults = [...factoryResult.calculation.sourceResults,
    ...[...linkedModulesResult.moduleResults.values()].flatMap(result => result.sourceResults)]
  const inventory = buildWaterSourceInventory(snapshot, sourceResults)

  expect(inventory).toHaveLength(13)
  expect(inventory.filter(row => row.builtPumps === 0)).toHaveLength(10)
  expect(new Set(inventory.map(row => row.source.id)).size).toBe(13)
  const unused = inventory.find(row => row.source.id === '1041:3242')

  expect(unused).toMatchObject({ source: { position: { x: 1041, y: 3242 }, radius: 60, quantity: 20_000 },
    builtPumps: 0, projectedPumps: 0, pumpsForCeiling: 3, sustainableOutputPerCycle: 0, projectedWithdrawalPerCycle: 0 })
  expect(unused?.sustainableCeilingPerCycle).toBeGreaterThan(0)
  for (const row of inventory) {
    const output = calculateAquiferSustainableOutput(row.source, row.pumpsForCeiling, snapshot.groundwater, weather)
    const fewer = calculateAquiferSustainableOutput(row.source, row.pumpsForCeiling - 1, snapshot.groundwater, weather)

    expect(output).toBeGreaterThanOrEqual(row.sustainableCeilingPerCycle - 0.005)
    expect(fewer).toBeLessThan(row.sustainableCeilingPerCycle - 0.005)
  }
  const actualWithdrawal = sourceResults.filter(result => result.recipe.sourceKind === 'groundwater')
    .reduce((total, result) => total + (result.actualOutputs.find(output => output.resourceId === 'water')?.quantity ?? 0), 0)

  expect(inventory.reduce((sum, row) => sum + row.projectedWithdrawalPerCycle, 0)).toBeCloseTo(actualWithdrawal, 8)
  const source = inventory[0]?.source
  const pump = snapshot.machines[0]

  if (!source || !pump) throw new Error('Aquifer scenario requires an installed pump')
  const normal = { depletedPumpSpeedPercent: 40, replenishWhenLowPercent: 7 }

  // Oracle values evaluated with installed 0.8.8 GetDailyReplenishQuantity,
  // Percent.Apply and IntExtensions.ScaledByToFix32. Percent multiplication
  // truncates before Quantity rounds: a half-rain day at 20k gives 18, not 19.
  for (const [capacity, halfRain, fullRain, emergency] of [[10_000, 9, 19, 1.330078125],
    [20_000, 18, 37, 2.58984375], [25_000, 23, 46, 3.2197265625], [30_000, 28, 56, 3.919921875]]) {
    const aquifer = { ...source, capacity, configuredCapacity: capacity }

    expect(getAquiferRainRechargePerDay(aquifer, 50)).toBe(halfRain)
    expect(getAquiferRainRechargePerDay(aquifer, 100)).toBe(fullRain)
    expect(getDryEmergencyRechargePerDay(aquifer, normal)).toBe(emergency)
  }
  const ceiling = calculateAquiferSustainableCeiling(source, normal, weather)
  const assistedPumpsForCeiling = calculateAquiferPumpsForCeiling(source, normal, weather)

  expect(assistedPumpsForCeiling).toBeGreaterThan(Math.ceil(ceiling / 48))
  expect(calculateAquiferSustainableOutput(source, assistedPumpsForCeiling, normal, weather)).toBeGreaterThanOrEqual(ceiling - 0.005)
  const fivePumps = calculateAquiferSustainableOutput(source, 5, normal, weather)
  const claims = calculateGroundwaterClaimLimits([
    { claimId: 'farm', projectedPumpCount: 4, machines: [1, 2, 3, 4].map(id => ({ ...pump, entityId: id, aquifer: source })) },
    { claimId: 'default', projectedPumpCount: 1, machines: [{ ...pump, entityId: 5, aquifer: source }] },
  ], normal, weather)

  expect(fivePumps).toBeGreaterThan(0)
  expect(fivePumps).toBeLessThanOrEqual(ceiling)
  expect(fivePumps).toBeLessThan(5 * 48)
  expect(claims.farm?.sustainableOutputPerCycle).toBeCloseTo(fivePumps * 0.8, 9)
  expect(claims.default?.sustainableOutputPerCycle).toBeCloseTo(fivePumps * 0.2, 9)
  expect(calculateAquiferSustainableOutput({ ...source, quantity: 0 }, 1, normal, weather)).toBeCloseTo(48, 9)
  const paused = calculateGroundwaterClaimLimits([{ claimId: 'paused', projectedPumpCount: 0,
    machines: [{ ...pump, aquifer: source }] }], normal, weather).paused

  expect(paused).toMatchObject({ aquiferCount: 1, currentReserve: source.quantity, pumpCapacityPerCycle: 0, sustainableOutputPerCycle: 0 })
  const dry = { ...weather, currentRainIntensityPercent: 0,
    periods: weather.periods.map(period => ({ ...period, rainIntensityPercent: 0, sunIntensityPercent: 100 })) }
  const wet = { ...weather, currentRainIntensityPercent: 100,
    periods: weather.periods.map(period => ({ ...period, rainIntensityPercent: 100, sunIntensityPercent: 20 })) }
  const noAssistance = { depletedPumpSpeedPercent: 0, replenishWhenLowPercent: 0 }
  const smallReserve = { ...source, quantity: 60, emergencyQuantity: 0 }
  const drought = simulateWaterSource(smallReserve, noAssistance, dry, 1, 30)

  expect(drought).toMatchObject({ firstShortfallCycle: 61 / 30, minimumReserve: 0, firstYearShortfallQuantity: 300 })
  expect(simulateWaterSource({ ...source, quantity: source.capacity }, noAssistance, dry, 1, 60)?.firstShortfallCycle).toBe(1 / 30)
  expect(simulateWaterSource(smallReserve, noAssistance, wet, 1, 30)?.firstShortfallCycle).toBeNull()
  expect(simulateWaterSource({ ...source, quantity: 0, emergencyQuantity: 0 }, normal, dry, 1, 10)?.firstShortfallCycle).toBeNull()
  expect(simulateWaterSource({ ...source, quantity: 0, emergencyQuantity: 0 }, noAssistance, dry, 1, 10)?.firstShortfallCycle).toBe(1 / 30)
  expect(simulateWaterSource(source, normal, { ...weather, hasOverride: true }, 1, 30)).toBeNull()
  const hiddenReserve = { ...source, quantity: 0, emergencyQuantity: 5 }

  expect(simulateWaterSource(hiddenReserve, { ...normal, replenishWhenLowPercent: 0 }, dry, 1, 10)?.firstShortfallCycle).toBeGreaterThan(1 / 30)
  const group: CropFarmGroup = { id: 'water-crop', name: 'Wheat', farmCount: 1, tierId: 'greenhouseII', schedule: ['wheat'], fertilizer: null }
  const dryFarm = calculateFarmIrrigationRates(group, snapshot.cropFarming, 1, 1.5, dry)
  const wetFarm = calculateFarmIrrigationRates(group, snapshot.cropFarming, 1, 1.5, wet)

  expect(dryFarm.importedWaterPerMonth).toBeGreaterThan(wetFarm.importedWaterPerMonth)
  expect(wetFarm.importedWaterPerMonth).toBe(0)
  expect(getAverageSunIntensityPercent(dry)).toBe(100)
  expect(getAverageSunIntensityPercent(wet)).toBe(20)
  expect(calculateAquiferSustainableOutput(source, 5, noAssistance, dry)).toBe(0)
  expect(calculateAquiferPumpsForCeiling(source, noAssistance, dry)).toBe(0)
  expect(calculateAquiferSustainableOutput(source, 5, normal, dry)).toBeGreaterThan(0)
}, 60_000)

it('replays the recorded factory through validation, planning, dispatch, contracts and resource balances', () => {
  const snapshot = normalizeGameStateSnapshot(capture)

  if (!snapshot) throw new Error('Recorded factory no longer matches the supported Bridge schema')
  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {}, revision: 'recorded-factory' })
  const { factoryResult, linkedModulesResult } = calculateFactoryCalculation(model.factoryCalculationInput)
  const stats = calculateBuildingStats(factoryResult.allLines, factoryResult.calculation, model.outputModifiers)
  const linkedStats = [...linkedModulesResult.moduleResults.values()].map(result => (
    calculateBuildingStats(result.lines, result, model.outputModifiers)
  ))
  const report = {
    modules: model.configuredModules.map(module => ({
      id: module.id, name: module.name,
    })),
    totals: {
      lines: factoryResult.allLines.length,
      workers: stats.workers + linkedStats.reduce((sum, value) => sum + value.workers, 0)
        + calculateContractWorkers(model.enabledContracts) + model.worldMines.workers,
      electricityMw: round(factoryResult.electricityDemandMw + linkedStats.reduce((sum, value) => sum + value.electricityKw, 0) / 1000),
      computingTflops: round(factoryResult.computingDemandTflops + linkedStats.reduce((sum, value) => sum + value.computingTflops, 0)),
      populationCapacity: model.populationCapacity,
      focus: model.officePlanCalculation.focusPointsCapacity,
      recyclingPercent: model.recyclingEfficiencyPercent,
    },
    modifiers: Object.fromEntries(Object.entries(model.outputModifiers).flatMap(([key, value]) => (
      typeof value === 'number' ? [[key, round(value)]] : []
    ))),
    contracts: factoryResult.contractResults.map(result => ({
      id: result.contract.id, imported: round(result.imported), requiredImported: round(result.requiredImported),
      exported: round(result.exported),
    })),
    flows: factoryResult.flows.map(flow => ({
      resource: flow.resourceId, produced: round(flow.produced), consumed: round(flow.consumed), net: round(flow.net),
    })),
  }

  expect(report).toEqual(JSON.parse(readFileSync(new URL('./fixtures/factory-baseline.json', import.meta.url), 'utf8')))
  expect(factoryResult.allLines.every(line => line.recipe.buildingData !== undefined)).toBe(true)
  expect(factoryResult.flows.every(flow => Number.isFinite(flow.net))).toBe(true)

  // A second complete solve proves costs come from the supplied catalog, not
  // the retired tables. Resource priorities must survive a metadata change.
  const updated = structuredClone(snapshot)
  const office = updated.buildingDefinitions.find(definition => definition.id === 'OfficeBuildingT3')

  if (!office) throw new Error('Recorded factory must exercise Office III')
  office.workers += 200
  office.electricityKw += 100
  office.computingTflops += 12
  const changedModel = deriveCalculatorModel({ snapshot: updated, machineZoneAssignments: {}, revision: 'changed-catalog' })
  const changed = calculateFactoryCalculation(changedModel.factoryCalculationInput).factoryResult
  const changedStats = calculateBuildingStats(changed.allLines, changed.calculation, changedModel.outputModifiers)

  expect(changedStats.workers - stats.workers).toBe(600)
  expect(changedStats.electricityKw - stats.electricityKw).toBeCloseTo(300, 4)
  expect(changedStats.computingTflops - stats.computingTflops).toBeCloseTo(144, 4)
  expect(changedModel.officePlanCalculation.focusPointsCapacity).toBe(6552)
  expect(changed.flows).toEqual(factoryResult.flows)
  expect(changed.contractResults).toEqual(factoryResult.contractResults)
}, 60_000)

it('replays station plans and Rocket II supply through native capacities, recipes and building pressure', () => {
  const replay = (definition?: RocketIiDefinition) => {
    const raw = structuredClone(capture)

    if (definition) raw.rocketIiDefinition = definition
    const snapshot = normalizeGameStateSnapshot(raw)

    if (!snapshot) throw new Error('Recorded rocket data is incompatible')
    const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {}, revision: 'rocket-replay' })
    const stationModule = model.configuredModules.find(candidate => candidate.recipes?.some(recipe => recipe.id === 'space-station-operations'))

    if (!stationModule) throw new Error('Recorded factory must exercise Space Station planning')
    const lines = buildModuleLines(stationModule, stationModule.presets[0], model.outputModifiers).lines
      .filter(line => line.recipe.id.startsWith('rocket-ii-'))
    const result = calculateNet(lines)
    const launch = result.regularResults.find(line => line.recipe.id === 'rocket-ii-launch-amortized')
    const assembly = result.regularResults.find(line => line.recipe.id === 'rocket-ii-assembly')

    if (!launch || !assembly) throw new Error('Rocket supply chain is missing')
    return { snapshot, model, launch, assembly }
  }
  const current = replay()
  const definition = current.snapshot.rocketIiDefinition
  const quantity = (inputs: readonly { resourceId: string; quantity: number }[], id: string) => (
    inputs.find(input => input.resourceId === id)?.quantity ?? 0
  )
  const verify = (run: ReturnType<typeof replay>, launches: number) => {
    const data = run.snapshot.rocketIiDefinition

    expect(quantity(run.launch.actualInputs, 'rocketII')).toBeCloseTo(launches, 10)
    expect(quantity(run.assembly.actualOutputs, 'rocketII')).toBeCloseTo(launches, 10)
    for (const [products, actual] of [[data.buildInputs, run.assembly.actualInputs], [data.launchInputs, run.launch.actualInputs]] as const) {
      for (const product of products) {
        const resourceId = resolveSyncedResourceId(product)

        if (!resourceId) throw new Error(`Unsupported rocket product ${product.productId}`)
        expect(quantity(actual, resourceId)).toBeCloseTo(product.quantity * launches, 10)
      }
    }
    expect(run.assembly.recipe.cycleDurationSeconds).toBe(data.buildCycles * 60)
    expect(run.model.rocketIiRecurringLogistics).toMatchObject({ cargoCapacity: data.cargoCapacity,
      crewCapacity: data.crewCapacity, payloadCapacityBonusPercent: data.capacityBonusPercent,
      researchLevel: run.snapshot.research.rocketsCapacity })
    expect(run.model.rocketIiRecurringLogistics.assemblyDepotUtilization).toBeCloseTo(launches * data.buildCycles, 10)
  }

  // This capture plans level four from a destroyed station. Both its supply
  // rows and its overview must use the new definition, without a default ratio.
  expect(current.snapshot.spaceStation.currentLevel).toBe(0)
  const station = calculateSpaceStationLevel(4, current.snapshot.spaceStationLevels)
  const cargo = station.maintenancePartsPerCycle + station.crewSuppliesPerCycle + station.researchSuppliesPerCycle
  const launches = cargo / definition.cargoCapacity + Math.ceil(station.crew / definition.crewCapacity) / definition.crewRotationCycles

  verify(current, launches)
  const changed: RocketIiDefinition = { ...definition, cargoCapacity: 80, crewCapacity: 2,
    capacityBonusPercent: 25, buildCycles: 3, crewRotationCycles: 12,
    buildInputs: definition.buildInputs.map(input => ({ ...input, quantity: input.quantity * 2 })),
    launchInputs: definition.launchInputs.map(input => ({ ...input, quantity: input.quantity * 3 })),
    compositePanelInputs: definition.compositePanelInputs.map(input => ({ ...input, quantity: input.quantity * 4 })),
    compositePanelOutput: definition.compositePanelOutput * 2 }
  const updated = replay(changed)
  const changedLaunches = cargo / 80 + Math.ceil(station.crew / 2) / 12

  verify(updated, changedLaunches)
  expect(updated.model.rocketIiRecurringLogistics.aluminumPerCycle / changedLaunches)
    .toBeCloseTo(current.model.rocketIiRecurringLogistics.aluminumPerCycle / launches * 4, 10)
  const constrained = replay({ ...changed, buildCycles: 12 })

  expect(quantity(constrained.launch.actualInputs, 'rocketII')).toBeCloseTo(changedLaunches, 10)
  expect(quantity(constrained.assembly.actualOutputs, 'rocketII')).toBeCloseTo(1 / 12, 10)

  // Multiple pads share one launch stream; an absent station needs none.
  for (const level of [0, 1, 2, 3, 4]) {
    const stationModule = createSpaceStationModule({ currentLevel: level, highestLevelAchieved: 4 }, current.snapshot.spaceStationLevels, changed,
      { rocketAssemblyDepot: 2, rocketLaunchPad: 2 })
    const lines = buildModuleLines(stationModule, stationModule.presets[0], { buildingDefinitions: current.snapshot.buildingDefinitions }).lines
    const result = calculateNet(lines)
    const logistics = calculateSpaceStationLevel(level, current.snapshot.spaceStationLevels)
    const expected = (logistics.maintenancePartsPerCycle + logistics.crewSuppliesPerCycle + logistics.researchSuppliesPerCycle) / changed.cargoCapacity
      + Math.ceil(logistics.crew / changed.crewCapacity) / changed.crewRotationCycles
    const launch = result.regularResults.find(line => line.recipe.id === 'rocket-ii-launch-amortized')

    expect(quantity(launch?.actualInputs ?? [], 'rocketII')).toBeCloseTo(expected, 10)
    const stats = calculateBuildingStats(lines, result)
    const nativeWorkers = (id: string) => current.snapshot.buildingDefinitions.find(item => item.id === id)?.workers ?? 0

    expect(stats.workers).toBe(2 * (nativeWorkers('RocketAssemblyDepot') + nativeWorkers('RocketLaunchPad')) + logistics.crew)
  }
}, 60_000)

it('replays native station tiers through operations, crew requirements, research plans and attention', () => {
  const source = normalizeGameStateSnapshot(capture)

  if (!source) throw new Error('Recorded station data is incompatible')
  const replay = (level: number, levels = source.spaceStationLevels, requiredPoints?: number) => {
    const snapshot = normalizeGameStateSnapshot({ ...source, spaceStationLevels: levels,
      spaceStation: { currentLevel: level, highestLevelAchieved: 4 } })

    if (!snapshot) throw new Error('Station replay is incompatible')
    const stationModule = createSpaceStationModule(snapshot.spaceStation, levels, snapshot.rocketIiDefinition,
      { rocketAssemblyDepot: 1, rocketLaunchPad: 1 }, {}, undefined,
      requiredPoints === undefined ? undefined : { requiredPoints })
    const lines = buildModuleLines(stationModule, stationModule.presets[0], { buildingDefinitions: snapshot.buildingDefinitions }).lines
    const result = calculateNet(lines)
    const stats = calculateBuildingStats(lines, result)
    const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {}, revision: 'native-station-replay' })

    return { stationModule, lines, result, stats, model }
  }
  const amount = (products: readonly { resourceId: string; quantity: number }[], resourceId: string) => (
    products.find(product => product.resourceId === resourceId)?.quantity ?? 0
  )
  const stationCrew = (result: ReturnType<typeof replay>) => result.lines.find(line => (
    line.recipe.id === 'space-station-operations'
  ))?.recipe.buildingData?.workers
  const attention = (run: ReturnType<typeof replay>, labs: number, fallback = false) => createSpaceResearchAttention({
    mode: 'with-space', runningResearchLabs: labs, station: run.model.currentSpaceStationLevel,
    stationLevels: source.spaceStationLevels,
    stationModule: fallback ? undefined : run.stationModule,
    fallbackTarget: fallback ? { module: run.stationModule, navigationKey: 'general:research-lab-iv' } : undefined,
  })

  for (const definition of source.spaceStationLevels) {
    const run = replay(definition.level)
    const operations = run.result.regularResults.find(line => line.recipe.id === 'space-station-operations')
    const research = run.result.regularResults.find(line => line.recipe.id === 'space-station-orbital-research')

    if (!operations || !research) throw new Error('Station operations are missing')
    for (const product of [definition.maintenance, definition.crewSupplies]) {
      const id = resolveSyncedResourceId(product)

      if (!id) throw new Error('Station product is unsupported')
      expect(amount(operations.actualInputs, id)).toBe(product.quantity)
    }
    expect(amount(research.actualInputs, 'electronicsIv')).toBe(definition.researchSupplies.quantity)
    expect(amount(research.actualOutputs, 'spaceResearchPoints')).toBe(definition.spaceResearchPointsPerCycle)
    expect(stationCrew(run)).toBe(definition.crew)
    expect(run.model.currentSpaceStationLevel).toMatchObject({ constructionParts: definition.construction.quantity,
      crew: definition.crew, unityPerCycle: definition.unityPerCycle,
      researchEfficiencyBonusPercent: definition.researchEfficiencyBonusPercent })
    const grouped = run.lines.filter(line => line.recipe.displayGroup?.id === 'space-station')

    expect(grouped).toHaveLength(2)
    expect(grouped.every(line => line.recipe.sharedCapacity === undefined)).toBe(true)
    if (definition.level < 4) expect(attention(run, 2))
      .toMatchObject({ attention: 'upgrade', level: { current: definition.level, target: 4 } })
    else expect(attention(run, 2)).toBeNull()
  }
  const absent = replay(0)

  expect(absent.model.currentSpaceStationLevel).toMatchObject({ crew: 0, unityPerCycle: 0, researchEfficiencyBonusPercent: 0 })
  expect(attention(absent, 0)).toBeNull()
  expect(attention(absent, 1)).toMatchObject({ attention: 'build', level: { current: 0, target: 3 } })
  expect(attention(absent, 1, true)).toMatchObject({ navigationKey: 'general:research-lab-iv', attention: 'build' })
  expect(attention(replay(0, source.spaceStationLevels, 96), 2)).toBeNull()
  expect(attention(replay(4), 2)).toBeNull()

  const changed: SpaceStationLevelDefinition[] = source.spaceStationLevels.map(level => ({ ...level,
    crew: level.crew + 8, construction: { ...level.construction, quantity: level.construction.quantity * 2 },
    maintenance: { ...level.maintenance, quantity: level.maintenance.quantity * 3 },
    crewSupplies: { ...level.crewSupplies, quantity: level.crewSupplies.quantity * 4 },
    researchSupplies: { ...level.researchSupplies, quantity: level.researchSupplies.quantity * 5 },
    spaceResearchPointsPerCycle: level.spaceResearchPointsPerCycle * 3,
    researchEfficiencyBonusPercent: level.researchEfficiencyBonusPercent + 11, unityPerCycle: level.unityPerCycle + 2 }))
  const updated = replay(3, changed)

  expect(stationCrew(updated)).toBe(changed[2].crew)
  expect(updated.stats.workers - replay(3).stats.workers).toBe(8)
  expect(updated.model.researchEfficiency.stationBonusPercent).toBe(changed[2].researchEfficiencyBonusPercent)
  expect(updated.model.currentSpaceStationLevel.unityPerCycle).toBe(changed[2].unityPerCycle)
  expect(updated.model.currentSpaceStationLevel.constructionParts).toBe(changed[2].construction.quantity)
  const changedOperations = updated.result.regularResults.find(line => line.recipe.id === 'space-station-operations')
  const changedResearch = updated.result.regularResults.find(line => line.recipe.id === 'space-station-orbital-research')

  expect(amount(changedOperations?.actualInputs ?? [], 'stationParts')).toBe(changed[2].maintenance.quantity)
  expect(amount(changedOperations?.actualInputs ?? [], 'crewSupplies')).toBe(changed[2].crewSupplies.quantity)
  expect(amount(changedResearch?.actualInputs ?? [], 'electronicsIv')).toBe(changed[2].researchSupplies.quantity)
  expect(amount(changedResearch?.actualOutputs ?? [], 'spaceResearchPoints')).toBe(changed[2].spaceResearchPointsPerCycle)
  expect(updated.model.configuredModules.flatMap(mod => mod.presets.flatMap(preset => preset.planMismatches ?? []))
    .some(mismatch => mismatch.recipeId === 'space-station-operations')).toBe(false)
  const earlyLevels = source.spaceStationLevels.map(level => level.level > 2 ? level : ({ ...level,
    maintenance: { ...level.maintenance, productId: 'Product_SpaceStationParts', name: 'Station parts (basic)' } }))
  const early = replay(1, earlyLevels)
  const earlyOperations = early.result.regularResults.find(line => line.recipe.id === 'space-station-operations')

  expect(amount(earlyOperations?.actualInputs ?? [], 'stationPartsBasic')).toBe(earlyLevels[0].maintenance.quantity)
  expect(amount(earlyOperations?.actualInputs ?? [], 'stationParts')).toBe(0)
}, 60_000)

it('replays crop rotations, fertilizer limits, irrigation and expansion using the native definitions', () => {
  const source = normalizeGameStateSnapshot(capture)

  if (!source) throw new Error('Recorded crop data is incompatible')
  const farm = source.cropFarms.find(entity => entity.prototypeId === 'FarmT4')
  const building = source.areaEntities.find(entity => entity.entityId === farm?.entityId)

  if (!farm || !building) throw new Error('Recorded factory must contain a Greenhouse II')
  const zone = 1_000_010
  const zones = [{ id: -1, name: 'Default' }, { id: zone, name: 'Crop smoke' }, { id: zone + 1, name: 'Other crop area' }]

  type FarmState = Partial<GameStateSnapshot['cropFarms'][number]> & { ghost?: boolean }
  const replay = (states: FarmState[], definitions = source.cropFarming, plan?: CropFarmGroup[]) => {
    const raw = structuredClone(source)

    raw.cropFarming = definitions
    raw.cropFarms = []
    raw.areaEntities = []
    raw.logisticsZones = zones.filter(zone => zone.id > 0)
    for (const [index, state] of states.entries()) {
      const entity = { ...farm, entityId: 1_800_001_000 + index, running: true,
        schedule: ['Crop_Potato', 'Crop_Fruits', 'Crop_Wheat', 'Crop_Soybeans'],
        fertilityTargetPercent: 110, fertilizerProductId: 'Product_Fertilizer2' as const,
        zones: [zones[1]], ...state }

      entity.schedule = Array.from({ length: 4 }, (_, slot) => entity.schedule[slot] ?? null)

      if (!state.ghost) raw.cropFarms.push(entity)
      raw.areaEntities.push({ ...building, entityId: entity.entityId, zones: entity.zones ?? [],
        running: !state.ghost && entity.running, constructed: !state.ghost,
        constructionState: state.ghost ? 'InConstruction' : 'Constructed' })
    }
    const snapshot = normalizeGameStateSnapshot(raw)

    if (!snapshot) throw new Error('Crop replay is invalid')
    const entities = getSyncedCropFarmEntities(snapshot.cropFarms)
    const areas = createLiveAreaModules(zones, snapshot.areaEntities).map(area => area.liveArea?.zoneId === -1
      ? createDefaultCropFarmModule(area, entities, snapshot.cropFarming)
      : createCropFarmAreaModule(area, entities, snapshot.cropFarming, undefined, area.liveArea?.zoneId === zone ? plan : undefined))
    const report = (id = zone) => {
      const area = areas.find(area => area.liveArea?.zoneId === id)

      if (!area) throw new Error(`Crop area ${id} is missing`)
      const preset = area.presets[0]
      const lines = buildModuleLines(area, preset, { buildingDefinitions: source.buildingDefinitions, weather: source.weather }).lines
      const result = calculateNet(lines, undefined, undefined, { weather: source.weather })

      return { area, preset, lines, result }
    }

    return { report, snapshot }
  }
  const quantity = (run: ReturnType<ReturnType<typeof replay>['report']>, id: string, side: 'produced' | 'consumed' = 'produced') => (
    run.result.allResourceFlows.find(flow => flow.resourceId === id)?.[side] ?? 0
  )
  const native = getCropFarmingData(source.cropFarming)
  const wheat = native.crop('wheat')
  const corn = native.crop('corn')
  const empty = native.crop('none')

  // Empty slots disappear; an explicit No Crop still occupies its native duration.
  for (const [schedule, months] of [
    [['Crop_Wheat', null, null, null], wheat.growthMonths],
    [['Crop_Wheat', null, 'Crop_Corn', null], wheat.growthMonths + corn.growthMonths],
    [['Crop_Wheat', 'Crop_Corn', 'Crop_NoCrop', null], wheat.growthMonths + corn.growthMonths + empty.growthMonths],
  ] as const) {
    const run = replay([{ schedule: [...schedule], fertilityTargetPercent: 140 }]).report()

    expect(quantity(run, 'wheat')).toBeCloseTo(wheat.quantityPerHarvest * 1.5 * 1.4 / months)
    expect(run.lines[0].dataSource).toBe('synced')
  }
  const mixed = replay([{}, {}, { fertilizerProductId: 'Product_Fertilizer' }, { fertilityTargetPercent: 120 }]).report()

  expect(mixed.lines.map(line => line.builtBuildings).toSorted()).toEqual([1, 1, 2])
  const overlapping = replay([{ zones: [zones[2], zones[1]] }, { zones: [] }])

  expect(overlapping.report().lines).toHaveLength(1)
  expect(overlapping.report(zone + 1).lines).toHaveLength(0)
  expect(overlapping.report(-1).lines).toHaveLength(1)
  for (const schedule of [[], ['Crop_Modded'], ['Crop_NoCrop']]) {
    const run = replay([{ schedule, fertilityTargetPercent: 0, fertilizerProductId: null }]).report()

    expect(run.result.allResourceFlows.every(flow => flow.produced === 0)).toBe(true)
    if (schedule[0] === 'Crop_Modded') expect(run.area.liveArea?.issues)
      .toContainEqual(expect.objectContaining({ id: 'crop-farms:unsupported-crop' }))
  }
  const limited = replay([{ fertilizerProductId: 'Product_FertilizerOrganic', fertilityTargetPercent: 140 }]).report()
  const reachable = replay([{ fertilizerProductId: 'Product_FertilizerOrganic', fertilityTargetPercent: 100 }]).report()

  expect(limited.lines[0].recipe.outputs).toEqual(reachable.lines[0].recipe.outputs)
  expect(limited.area.liveArea?.issues).toContainEqual(expect.objectContaining({ id: 'crop-farms:fertilizer-limit' }))
  const plan: CropFarmGroup[] = [{ id: 'corn-wheat', name: 'Corn / Wheat', farmCount: 2, tierId: 'greenhouseII',
    schedule: ['corn', 'wheat'], fertilizer: { id: 'fertilizerII', targetFertilityPercent: 140 } }]
  const planned = replay([{ schedule: [], running: false }, { ghost: true }], source.cropFarming, plan).report()

  expect(planned.lines.find(line => line.recipe.id.includes(':crop-farm-plan:')))
    .toMatchObject({ builtBuildings: 1, activeBuildings: 2, currentActiveBuildings: 0, constructionGhosts: 1, dataSource: 'planned' })
  expect(planned.preset.unplacedPlannedBuildings).toEqual({})
  const changed: CropFarmingDefinitions = structuredClone(source.cropFarming)
  const changedWheat = changed.crops.find(crop => crop.id === 'Crop_Wheat')
  const fertilizer = changed.fertilizers.find(fertilizer => fertilizer.productId === 'Product_Fertilizer2')

  if (!changedWheat || !fertilizer) throw new Error('Crop smoke definitions are missing')
  changedWheat.quantityPerHarvest *= 3
  changedWheat.growthMonths *= 2
  changedWheat.waterPerDay *= 2
  fertilizer.fertilityPercentPerUnit *= 2
  const original = replay([{ schedule: ['Crop_Wheat'] }]).report()
  const updated = replay([{ schedule: ['Crop_Wheat'] }], changed).report()

  expect(quantity(updated, 'wheat')).toBeCloseTo(quantity(original, 'wheat') * 1.5)
  expect(quantity(updated, 'fertilizerII', 'consumed')).toBeCloseTo(quantity(original, 'fertilizerII', 'consumed') / 2)
  const group = plan[0]
  const water = calculateFarmIrrigationRates(group, source.cropFarming, 1, 1, source.weather)
  const rain = calculateFarmIrrigationRates(group, source.cropFarming, 1, 1.5, source.weather)
  const changedWater = calculateFarmIrrigationRates({ ...group, schedule: ['wheat'] }, changed, 1, 1, source.weather)
  const originalWater = calculateFarmIrrigationRates({ ...group, schedule: ['wheat'] }, source.cropFarming, 1, 1, source.weather)

  expect(rain.grossWaterPerMonth).toBe(water.grossWaterPerMonth)
  expect(rain.importedWaterPerMonth).toBeLessThan(water.importedWaterPerMonth)
  expect(changedWater.grossWaterPerMonth).toBeGreaterThan(originalWater.grossWaterPerMonth * 1.9)
  expect(changedWater.importedWaterPerMonth).toBeGreaterThan(originalWater.importedWaterPerMonth)

  const pumpId = getCropFarmGroundwaterRecipeId(zone)
  const base = replay([{}]).report().area
  const constrained = createCropFarmAreaModule({ ...base, recipes: [{ id: pumpId, name: 'Pump', building: 'Groundwater Pump',
    group: 'source', inputs: [], outputs: [{ resourceId: 'water', quantity: 48 }] }],
  }, [], source.cropFarming, { aquiferCount: 1, currentReserve: 12_000, reserveCapacity: 20_000,
    projectedPumpCount: 3, aquiferSustainableCeilingPerCycle: 90, pumpCapacityPerCycle: 144, sustainableOutputPerCycle: 90 })

  expect(constrained.recipes?.find(recipe => recipe.id === pumpId)).toMatchObject({ sourceMode: 'module-demand-capped', sourceKind: 'groundwater',
    outputs: [{ resourceId: 'water', quantity: 30 }] })
}, 60_000)

it('replays chicken inventory, construction and plans using the supplied farm definition', () => {
  const source = normalizeGameStateSnapshot(capture)

  if (!source) throw new Error('Recorded factory is incompatible')
  const farm = source.chickenFarms[0]
  const building = source.areaEntities.find(entity => entity.entityId === farm?.entityId)

  if (!farm || !building) throw new Error('Recorded factory must contain chicken inventory')
  const zone = 1_000_001
  const otherZone = zone + 1
  const workers = source.buildingDefinitions.find(definition => definition.id === 'ChickenFarm')?.workers

  if (workers === undefined) throw new Error('Chicken farm worker definition is missing')

  interface FarmState { running?: boolean; chickens?: number; slaughtering?: boolean; ghost?: boolean; zones?: number[] }
  const replay = (states: FarmState[], definition: ChickenFarmDefinition = source.chickenFarmDefinition) => {
    const snapshot = structuredClone(source)

    snapshot.chickenFarmDefinition = definition
    snapshot.logisticsZones.push({ id: zone, name: 'Farm smoke' }, { id: otherZone, name: 'Other farm area' })
    snapshot.chickenFarms = []
    snapshot.areaEntities = snapshot.areaEntities.filter(entity => entity.prototypeId !== 'ChickenFarm')
    snapshot.productionEntities = snapshot.productionEntities.filter(entity => entity.prototypeId !== 'ChickenFarm')
    for (const [index, state] of states.entries()) {
      const entityId = 1_800_000_000 + index
      const zones = (state.zones ?? [zone]).map(id => ({ id, name: id === zone ? 'Farm smoke' : 'Other farm area' }))
      const running = !state.ghost && (state.running ?? false)

      if (!state.ghost) snapshot.chickenFarms.push({
        ...farm, entityId, running, zones, chickens: state.chickens ?? 0, slaughtering: state.slaughtering ?? true,
      })
      snapshot.areaEntities.push({
        ...building, entityId, zones, running, constructed: !state.ghost,
        constructionState: state.ghost ? 'InConstruction' : 'Constructed',
      })
    }
    const compatible = normalizeGameStateSnapshot(snapshot)

    if (!compatible) throw new Error('Farm replay snapshot is invalid')
    const model = deriveCalculatorModel({ snapshot: compatible, machineZoneAssignments: {}, revision: 'farm-smoke' })
    const reports = model.configuredModules.filter(module => module.liveArea).map(module => {
      const preset = module.presets[0]
      const { lines } = buildModuleLines(module, preset, model.outputModifiers)
      const result = calculateNet(lines)

      return { module, preset, lines, result, workers: calculateBuildingStats(lines, result).workers }
    })
    const area = (id = zone) => {
      const report = reports.find(value => value.module.liveArea?.zoneId === id)

      if (!report) throw new Error(`Farm area ${id} is missing`)
      return report
    }

    return { area, definition }
  }
  const production = (area: ReturnType<ReturnType<typeof replay>['area']>, resourceId: string) => (
    area.result.allResourceFlows.find(flow => flow.resourceId === resourceId)?.produced ?? 0
  )
  const slaughtering = 'chicken-farm-slaughtering'
  const eggsOnly = 'chicken-farm-eggs-only'

  const ghosts = replay(Array.from({ length: 21 }, () => ({ ghost: true }))).area()

  expect(ghosts.lines[0]).toMatchObject({ activeBuildings: 21, builtBuildings: 0,
    currentActiveBuildings: 0, constructionGhosts: 21, speedLevel: 1, dataSource: 'planned' })
  expect(production(ghosts, 'chickenCarcass')).toBe(210)
  expect(ghosts.workers).toBe(21 * workers)
  const paused = replay(Array.from({ length: 21 }, () => ({}))).area()

  expect(paused.lines[0]).toMatchObject({ activeBuildings: 0, builtBuildings: 21, speedLevel: 0, dataSource: 'synced' })
  expect(paused.result.allResourceFlows.every(flow => flow.produced === 0 && flow.consumed === 0)).toBe(true)
  const mixed = replay([{ running: true, chickens: 337 }, {}, { running: true, chickens: 500, slaughtering: false }]).area()

  expect(mixed.lines.find(line => line.recipe.id === slaughtering)).toMatchObject({ builtBuildings: 2, activeBuildings: 1, speedLevel: 337 / 500 })
  expect(mixed.lines.find(line => line.recipe.id === eggsOnly)).toMatchObject({ builtBuildings: 1, activeBuildings: 1, speedLevel: 1 })
  expect(production(mixed, 'chickenCarcass')).toBeCloseTo(6.74)
  expect(mixed.workers).toBe(2 * workers)
  const expansion = replay([{ running: true, chickens: 250 }, {}, { ghost: true }]).area()

  expect(expansion.lines[0]).toMatchObject({ builtBuildings: 2, activeBuildings: 2,
    currentActiveBuildings: 1, constructionGhosts: 1, speedLevel: 0.75, dataSource: 'planned' })
  const ownership = replay([{ running: true, chickens: 500, zones: [otherZone, zone] },
    { ghost: true, zones: [otherZone, zone] }, { running: true, chickens: 500, zones: [] }])

  expect(ownership.area().lines[0]).toMatchObject({ builtBuildings: 1, constructionGhosts: 1 })
  expect(ownership.area(otherZone).lines).toEqual([])
  expect(ownership.area(-1).lines.find(line => line.recipe.id === slaughtering))
    .toMatchObject({ builtBuildings: 1, activeBuildings: 1 })

  const changedDefinition = { ...source.chickenFarmDefinition, capacity: 1000, countStep: 100,
    feedPerChicken: source.chickenFarmDefinition.feedPerChicken * 2,
    waterPerChicken: source.chickenFarmDefinition.waterPerChicken * 3,
    eggsPerChicken: source.chickenFarmDefinition.eggsPerChicken * 4,
    birthsPer100Chickens: source.chickenFarmDefinition.birthsPer100Chickens * 2,
    carcassPerSlaughteredChicken: source.chickenFarmDefinition.carcassPerSlaughteredChicken * 3 }
  const changed = replay([{ running: true, chickens: 337 }, {}, { running: true, chickens: 500, slaughtering: false }], changedDefinition).area()

  expect(changed.lines[0].recipe).toMatchObject({ animalPopulationCapacity: 1000, animalPopulationStep: 100 })
  expect(production(changed, 'eggs')).toBeCloseTo(production(mixed, 'eggs') * 4)
  expect(production(changed, 'chickenCarcass')).toBeCloseTo(production(mixed, 'chickenCarcass') * 6)
  for (const [resourceId, multiplier] of [['animalFeed', 2], ['water', 3]] as const) {
    expect(changed.result.allResourceFlows.find(flow => flow.resourceId === resourceId)?.consumed)
      .toBeCloseTo((mixed.result.allResourceFlows.find(flow => flow.resourceId === resourceId)?.consumed ?? 0) * multiplier)
  }
  const largerGhost = replay([{ ghost: true }], changedDefinition).area()

  expect(production(largerGhost, 'eggs')).toBeCloseTo(1000 * changedDefinition.eggsPerChicken)
  const plan = createChickenFarmsModule(changedDefinition, { totalChickenCount: 2350, slaughtering: true }, [])
  const planLines = buildModuleLines(plan, plan.presets[0], { buildingDefinitions: source.buildingDefinitions }).lines

  expect(planLines[0]).toMatchObject({ activeBuildings: 3, unplacedPlannedBuildings: 3, speedLevel: 0.8, dataSource: 'planned' })
  expect(plan.presets[0].planMismatches?.[0].target).toBe(2350)
}, 60_000)
