import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'

import { type ChickenFarmDefinition } from '../app/chicken-farm-state'
import { createChickenFarmsModule } from '../app/db/modules/farms'
import { createSpaceStationModule } from '../app/db/modules/space-station'
import { calculateSpaceStationLevel } from '../app/db/space-station'
import { normalizeGameStateSnapshot } from '../app/game-state'
import { buildModuleLines } from '../app/helpers/build-module-lines/build-module-lines'
import { calculateBuildingStats } from '../app/helpers/building-stats/building-stats'
import { calculateNet } from '../app/helpers/calculate/calculate'
import { deriveCalculatorModel } from '../app/helpers/calculator-model/derive-calculator-model'
import { calculateContractWorkers } from '../app/helpers/contracts/calculate-contracts'
import { calculateFactoryCalculation } from '../app/helpers/factory-calculation/factory-calculation'
import { resolveSyncedResourceId } from '../app/helpers/synced-resources/synced-resources'
import { type RocketIiDefinition } from '../app/rocket-state'

// Update 4.3 factory with native farm and Rocket II definitions read by Bridge.
const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/factory.json.gz', import.meta.url))).toString())
const round = (value: number) => Number(value.toFixed(4)) || 0

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
  const station = calculateSpaceStationLevel(4, 4)
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
    const stationModule = createSpaceStationModule({ currentLevel: level, highestLevelAchieved: 4 }, changed,
      { rocketAssemblyDepot: 2, rocketLaunchPad: 2 })
    const lines = buildModuleLines(stationModule, stationModule.presets[0], { buildingDefinitions: current.snapshot.buildingDefinitions }).lines
    const result = calculateNet(lines)
    const logistics = calculateSpaceStationLevel(level, 4)
    const expected = (logistics.maintenancePartsPerCycle + logistics.crewSuppliesPerCycle + logistics.researchSuppliesPerCycle) / changed.cargoCapacity
      + Math.ceil(logistics.crew / changed.crewCapacity) / changed.crewRotationCycles
    const launch = result.regularResults.find(line => line.recipe.id === 'rocket-ii-launch-amortized')

    expect(quantity(launch?.actualInputs ?? [], 'rocketII')).toBeCloseTo(expected, 10)
    const stats = calculateBuildingStats(lines, result)
    const nativeWorkers = (id: string) => current.snapshot.buildingDefinitions.find(item => item.id === id)?.workers ?? 0

    expect(stats.workers).toBe(2 * (nativeWorkers('RocketAssemblyDepot') + nativeWorkers('RocketLaunchPad')) + logistics.crew)
  }
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
