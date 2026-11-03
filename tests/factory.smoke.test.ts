import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'

import { type ChickenFarmDefinition } from '../app/chicken-farm-state'
import { createChickenFarmsModule } from '../app/db/modules/farms'
import { normalizeGameStateSnapshot } from '../app/game-state'
import { buildModuleLines } from '../app/helpers/build-module-lines/build-module-lines'
import { calculateBuildingStats } from '../app/helpers/building-stats/building-stats'
import { calculateNet } from '../app/helpers/calculate/calculate'
import { deriveCalculatorModel } from '../app/helpers/calculator-model/derive-calculator-model'
import { calculateContractWorkers } from '../app/helpers/contracts/calculate-contracts'
import { calculateFactoryCalculation } from '../app/helpers/factory-calculation/factory-calculation'

// Update 4.3 factory, with the Bridge 45 chicken-farm definition read from the game.
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
