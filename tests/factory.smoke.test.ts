import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, it, vi } from 'vitest'

import { type ChickenFarmDefinition } from '../app/chicken-farm-state'
import { getCropFarmingData, type CropFarmingDefinitions } from '../app/crop-farming-state'
import { getRackAllocation } from '../app/db/computing'
import { getContractCatalog } from '../app/db/contracts'
import { activeCropFarmGroups } from '../app/db/crop-farm-plans'
import { calculateCropFarmGroupRates, type CropFarmGroup } from '../app/db/crop-farming'
import { getEdictCatalog, mapEdictValues } from '../app/db/edicts'
import { getHousingTypes } from '../app/db/housing'
import { createCropFarmAreaModule, createDefaultCropFarmModule, getCropFarmGroundwaterRecipeId } from '../app/db/modules/crop-farm-areas'
import { createChickenFarmsModule } from '../app/db/modules/farms'
import { type Module } from '../app/db/modules/modules'
import { createSpaceStationModule } from '../app/db/modules/space-station'
import { officeCatalog } from '../app/db/office-catalog'
import { factoryRecipeBindings } from '../app/db/recipe-bindings'
import { recipes } from '../app/db/recipes'
import { calculateInfiniteResearchLevelCost, calculateInfiniteResearchRemainingCost, getInfiniteResearchCatalog } from '../app/db/research'
import { calculateSpaceStationLevel } from '../app/db/space-station'
import { calculateUnityBudget } from '../app/db/unity'
import { getLabSpacePoints } from '../app/factory-definitions'
import { normalizeGameStateSnapshot, type GameStateSnapshot } from '../app/game-state'
import { buildModuleLines } from '../app/helpers/build-module-lines/build-module-lines'
import { calculateBuildingStats } from '../app/helpers/building-stats/building-stats'
import { calculateNet } from '../app/helpers/calculate/calculate'
import { deriveCalculatorModel } from '../app/helpers/calculator-model/derive-calculator-model'
import { applyContracts, calculateContractWorkers } from '../app/helpers/contracts/calculate-contracts'
import { resolveSyncedContracts } from '../app/helpers/contracts/resolve-synced-contracts'
import { calculateFactoryCalculation } from '../app/helpers/factory-calculation/factory-calculation'
import { calculateAquiferPumpsForCeiling, calculateAquiferSustainableCeiling, calculateAquiferSustainableOutput, calculateGroundwaterClaimLimits, getAquiferRainRechargePerDay, getDryEmergencyRechargePerDay } from '../app/helpers/groundwater/calculate-groundwater-production'
import { createLiveAreaModules } from '../app/helpers/live-area-modules/live-area-modules'
import { calculatePopulationResearchBonus } from '../app/helpers/modifiers/calculate-research-efficiency'
import { withFactoryDefinition } from '../app/helpers/planning-recipes/factory-recipes'
import { withPlanningDefinition } from '../app/helpers/planning-recipes/planning-recipes'
import { calculateReserveRunway, getReserveDrawPerProductionCycle } from '../app/helpers/reserves/reserves'
import { createSpaceResearchAttention } from '../app/helpers/space-research-attention/space-research-attention'
import { getSyncedCropFarmEntities } from '../app/helpers/synced-production-config/synced-production-config'
import { resolveSyncedResourceId } from '../app/helpers/synced-resources/synced-resources'
import { getConnectedWaterBuffer } from '../app/helpers/water-planning/connected-water-buffer'
import { calculateFarmWaterDemand } from '../app/helpers/water-planning/farm-water-demand'
import { buildWaterSourceInventory, getRainwaterHarvesterPotential, simulateWaterSource, summarizeWeather } from '../app/helpers/water-planning/water-planning'
import { calculateFarmIrrigationRates } from '../app/helpers/weather/calculate-farm-irrigation'
import { getAverageSunIntensityPercent } from '../app/helpers/weather/planning-weather'
import { getFocusDefinitions, type OfficeFocusDefinitions } from '../app/office-focus-state'
import { type PlanningDefinitions } from '../app/planning-state'
import { type RocketIiDefinition } from '../app/rocket-state'
import { type SpaceStationLevelDefinition } from '../app/space-station-state'

// Update 4.3 factory with native farm and Rocket II definitions read by Bridge.
const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/factory.json.gz', import.meta.url))).toString())
const round = (value: number) => Number(value.toFixed(4)) || 0

it('replays connected tank and pipe reserves, refill and shared-source exclusions through the existing shortfall forecast', () => {
  const original = normalizeGameStateSnapshot(capture)

  if (!original) throw new Error('Recorded water snapshot is incompatible')
  const snapshot = structuredClone(original)
  const pump = snapshot.machines.find(pump => pump.running && pump.aquifer)

  if (!pump?.aquifer) throw new Error('Native pump required')
  snapshot.machines = [pump]
  const aquifer = snapshot.groundwater.aquifers.find(source => source.id === pump.aquifer?.id)

  if (!aquifer) throw new Error('Native aquifer required')
  const network = { pumpIds: [pump.entityId], activePumpIds: [pump.entityId], aquiferIds: [aquifer.id],
    consumerIds: [snapshot.cropFarms[0].entityId], hasOtherSources: false,
    buffers: [{ entityId: 1_999_000_001, kind: 'tank' as const, quantity: 57, capacity: 120 },
      { entityId: 1_999_000_002, kind: 'pipe' as const, quantity: 3, capacity: 3 }] }

  snapshot.groundwater.networks = [network]
  expect(normalizeGameStateSnapshot(snapshot)).not.toBeNull()
  const buffer = getConnectedWaterBuffer(snapshot, aquifer.id, 1)

  expect(buffer).toEqual({ quantity: 60, capacity: 123 })
  const dry = { ...snapshot.weather, periods: snapshot.weather.periods.map(period => ({ ...period, rainIntensityPercent: 0 })) }
  const groundwater = { ...snapshot.groundwater, depletedPumpSpeedPercent: 0, replenishWhenLowPercent: 0 }
  const empty = { ...aquifer, quantity: 0, emergencyQuantity: 0 }
  const bare = simulateWaterSource(empty, groundwater, dry, 1, 30)
  const stored = simulateWaterSource(empty, groundwater, dry, 1, 30, undefined, buffer)

  expect(bare?.firstShortfallCycle).toBe(1 / 30)
  expect(stored).toMatchObject({ firstShortfallCycle: 61 / 30, firstYearShortfallQuantity: 300 })
  const refill = simulateWaterSource({ ...empty, quantity: 100 }, groundwater, dry, 1, 30, undefined, buffer)

  expect(refill?.firstShortfallCycle).toBe(161 / 30)
  expect(getConnectedWaterBuffer(snapshot, aquifer.id, 2)).toBeUndefined()
  for (const changed of [{ ...network, hasOtherSources: true },
    { ...network, aquiferIds: [aquifer.id, 'other-aquifer'] }, { ...network, consumerIds: [] }]) {
    expect(getConnectedWaterBuffer({ ...snapshot, groundwater: { ...snapshot.groundwater, networks: [changed] } }, aquifer.id, 1)).toBeUndefined()
  }
  for (const networks of [null, [{ ...network, activePumpIds: [] }], [{ ...network, pumpIds: [999_999_999] }],
    [{ ...network, aquiferIds: ['wrong-aquifer'] }], [{ ...network, consumerIds: [999_999_999] }],
    [{ ...network, buffers: [...network.buffers, network.buffers[0]] }],
    [{ ...network, buffers: network.buffers.map(buffer => ({ ...buffer, quantity: buffer.capacity + 1 })) }],
    [network, network]]) expect(normalizeGameStateSnapshot({ ...snapshot, groundwater: { ...snapshot.groundwater, networks } })).toBeNull()
  expect(normalizeGameStateSnapshot({ ...snapshot, groundwater: { ...snapshot.groundwater, networks: undefined } })).not.toBeNull()
})

it('replays live crop phase and soil reserves into the existing water forecast while retaining steady production plans', () => {
  const snapshot = normalizeGameStateSnapshot(capture)

  if (!snapshot) throw new Error('Recorded farm definitions are incompatible')
  const weather = { ...snapshot.weather, periods: snapshot.weather.periods.map(period => ({ ...period, rainIntensityPercent: 0 })) }
  const aquifer = snapshot.groundwater.aquifers[0]
  const groundwater = { ...snapshot.groundwater, depletedPumpSpeedPercent: 0, replenishWhenLowPercent: 0 }
  const sourceId = getCropFarmGroundwaterRecipeId(10)
  const pump = recipes.find(recipe => recipe.id === 'groundwater-pump')

  if (!pump) throw new Error('Pump recipe missing')
  const replay = (soilWater: number, daysRemaining = 1) => {
    const native = { ...snapshot.cropFarms[0], prototypeId: 'FarmT4' as const, running: true,
      schedule: ['Crop_Corn', null, 'Crop_NoCrop', null], zones: [{ id: 10, name: 'Farms' }],
      runtime: { scheduleIndex: 0, cropId: 'Crop_Corn', daysRemaining, cropStarted: true,
        irrigating: false, soilWater, waterCredit: 0, rainPartial: 0, evaporatedWater: 0 } }

    expect(normalizeGameStateSnapshot({ ...snapshot, cropFarms: [native] })).not.toBeNull()
    const entities = getSyncedCropFarmEntities([native])
    const farmModule: Module = { id: 'live-area-10', name: 'Farms', description: '',
      builtBuildings: { [sourceId]: 1 }, recipes: [{ ...pump, id: sourceId }], defaultPresetId: 'live',
      presets: [{ id: 'live', name: 'Live', description: '', activeBuildings: { [sourceId]: 1 }, fixed: [] }],
      liveArea: { zoneId: 10, trackedBuildings: 1, constructedBuildings: 1, activeBuildings: 1,
        pausedBuildings: 0, constructionGhosts: 0, issues: [] } }
    const area = createCropFarmAreaModule(farmModule, entities, snapshot.cropFarming, {
      aquiferCount: 1, currentReserve: 0, reserveCapacity: aquifer.capacity, projectedPumpCount: 1,
      aquiferSustainableCeilingPerCycle: 48, pumpCapacityPerCycle: 48, sustainableOutputPerCycle: 48,
      aquiferAllocations: [{ aquiferId: aquifer.id, pumpCount: 1, sustainableOutputPerCycle: 48 }],
    })
    const modifiers = { weather, cropWater: 1, rainwaterYield: 1, planningDefinitions: snapshot.planningDefinitions }
    const lines = buildModuleLines(area, area.presets[0], modifiers).lines
    const calculation = calculateNet(lines, { fertilizerII: 10000 }, 0, modifiers)
    const demand = calculateFarmWaterDemand(calculation.regularResults, modifiers)
    const source = buildWaterSourceInventory(snapshot, calculation.sourceResults, demand).find(row => row.source.id === aquifer.id)

    if (!source?.dailyWithdrawal) throw new Error('Live farm demand did not reach the water source')
    return { calculation, source, native, demand }
  }
  const empty = replay(0)
  const full = replay(snapshot.cropFarming.simulation.soilWaterCapacity)
  const growing = replay(0, 90)

  expect(empty.source.dailyWithdrawal?.[1]).toBeGreaterThan(full.source.dailyWithdrawal?.[1] ?? Infinity)
  expect(empty.source.dailyWithdrawal).not.toEqual(growing.source.dailyWithdrawal)
  expect(empty.calculation.resourceFlows).toEqual(full.calculation.resourceFlows)
  expect(empty.source.dailyWithdrawal).toHaveLength(361)
  expect(empty.source.dailyWithdrawal?.every(value => Number.isFinite(value) && value >= 0)).toBe(true)
  const dry = { ...aquifer, quantity: 0, emergencyQuantity: 0 }
  const forecast = simulateWaterSource(dry, groundwater, weather, 1, empty.source.projectedWithdrawalPerCycle, empty.source.dailyWithdrawal)
  const buffered = simulateWaterSource(dry, groundwater, weather, 1, full.source.projectedWithdrawalPerCycle, full.source.dailyWithdrawal)

  expect(forecast?.firstYearShortfallQuantity).toBeGreaterThan(buffered?.firstYearShortfallQuantity ?? Infinity)
  const startupOnly = new Map([...empty.demand].map(([id, demand]) => [id, { ...demand, steadyPerCycle: 0,
    dailyDifference: demand.dailyDifference.map((_quantity, day) => Number(day === 1) * 3) }]))
  const zeroDraw = empty.calculation.sourceResults.map(result => ({ ...result,
    actualOutputs: result.actualOutputs.map(output => output.resourceId === 'water' ? { ...output, quantity: 0 } : output) }))
  const startup = buildWaterSourceInventory(snapshot, zeroDraw, startupOnly).find(row => row.source.id === aquifer.id)

  expect(startup?.projectedWithdrawalPerCycle).toBe(0)
  expect(startup?.dailyWithdrawal?.[1]).toBe(3)
  expect(simulateWaterSource(dry, groundwater, weather, 1, 0, startup?.dailyWithdrawal))
    .toMatchObject({ firstShortfallCycle: 1 / 30, firstYearShortfallQuantity: 3 })
  const skippedSlot = getSyncedCropFarmEntities([{ ...empty.native, runtime: { ...empty.native.runtime, scheduleIndex: 1 } }])[0]

  expect(skippedSlot?.runtime?.scheduleIndex).toBe(0)
  const legacy = { ...empty.native, runtime: undefined }

  expect(normalizeGameStateSnapshot({ ...snapshot, cropFarms: [legacy] })).not.toBeNull()
  for (const [schedule, expected] of [
    [[null, 'Crop_Wheat', null, 'Crop_Corn'], ['wheat', 'corn']],
    [['Crop_Wheat', 'Crop_NoCrop', null, null], ['wheat', 'none']],
    [[null, null, null, null], []],
  ] as const) {
    const mapped = getSyncedCropFarmEntities([{ ...legacy, running: false, fertilityTargetPercent: 110,
      fertilizerProductId: 'Product_Fertilizer2', schedule: [...schedule] }])[0]

    expect(mapped).toMatchObject({ entityId: legacy.entityId, tierId: 'greenhouseII', running: false,
      fertilizerId: 'fertilizerII', fertilityTargetPercent: 110, schedule: [...expected], zones: legacy.zones })
  }
  for (const runtime of [{ ...empty.native.runtime, soilWater: -1 }, { ...empty.native.runtime, daysRemaining: NaN },
    { ...empty.native.runtime, scheduleIndex: 4 }, { ...empty.native.runtime, cropId: null }]) {
    expect(normalizeGameStateSnapshot({ ...snapshot, cropFarms: [{ ...empty.native, runtime }] })).toBeNull()
  }
})

it('replays the complete native recipe catalog, contract definitions, farm tiers and water rules without legacy rate tables', () => {
  const snapshot = normalizeGameStateSnapshot(capture)

  if (!snapshot) throw new Error('Native definition replay is incompatible')
  const definitions = snapshot.planningDefinitions
  const resolve = (id: string, source = definitions) => {
    const recipe = recipes.find(recipe => recipe.id === id)

    if (!recipe) throw new Error('Recipe policy missing: ' + id)
    return withFactoryDefinition(recipe, source)
  }

  for (const id of Object.keys(factoryRecipeBindings)) {
    const recipe = resolve(id)

    expect(recipe.factoryRecipe).toBeUndefined()
    expect([...recipe.inputs, ...recipe.outputs].every(item => Number.isFinite(item.quantity))).toBe(true)
    expect([...recipe.inputs, ...recipe.outputs].some(item => item.quantity > 0)).toBe(true)
    expect(withFactoryDefinition(recipe, definitions)).toEqual(recipe)
  }
  // Evaluated against installed NuclearReactor.Recipe, Generator II and storage prototypes.
  expect(resolve('fbr-0x').inputs).toContainEqual({ resourceId: 'coreFuel', quantity: 4 })
  expect(resolve('fbr-3x').inputs).toContainEqual({ resourceId: 'blanketFuel', quantity: 12 })
  for (const [id, output] of [['turbine-super', 15], ['turbine-high', 10], ['turbine-low', 5]] as const) {
    expect(resolve(id).outputs).toContainEqual({ resourceId: 'electricity', quantity: output })
  }
  const storage = recipes.find(recipe => recipe.factoryRecipe?.storage)

  if (!storage) throw new Error('Native decay storage policy missing')
  expect(resolve(storage.id).decayStorage).toEqual({ capacity: 2400, decayCycles: 1200 })
  expect(getLabSpacePoints(definitions.factory, 'ResearchLab4')).toBe(24)
  expect(getLabSpacePoints(definitions.factory, 'ResearchLab5')).toBe(48)
  expect(calculatePopulationResearchBonus(definitions, 7488)).toBe(37)

  const changed = structuredClone(definitions)

  for (const recipe of changed.factory.recipes) {
    for (const product of [...recipe.inputs, ...recipe.outputs]) product.quantity *= 2
    recipe.electricityOutputMw *= 2
  }
  changed.factory.populationResearch = { numerator: 7, rounding: 500, denominator: 1000 }
  expect(resolve('fbr-0x', changed).inputs).toContainEqual({ resourceId: 'coreFuel', quantity: 8 })
  expect(resolve('seawater-pump', changed).outputs[0].quantity).toBe(resolve('seawater-pump').outputs[0].quantity * 2)
  expect(resolve('turbine-super', changed).outputs).toContainEqual({ resourceId: 'electricity', quantity: 30 })
  expect(calculatePopulationResearchBonus(changed, 7488)).toBe(52)

  const first = definitions.factory.contracts[0]
  const novel = { ...first, gameId: 'FutureWaterForBread', exportedProduct: { productId: 'Product_Bread', name: 'Bread' },
    importedProduct: { productId: 'Product_Water', name: 'Water' }, exportedQuantity: 7, importedQuantity: 31 }
  const catalog = getContractCatalog([novel, { ...novel, gameId: 'SecondWaterForBread' }])

  expect(new Set(catalog.map(contract => contract.id)).size).toBe(2)
  expect(catalog[0].exchange).toEqual({ exported: { resourceId: 'bread', quantity: 7 }, imported: { resourceId: 'water', quantity: 31 } })
  expect(resolveSyncedContracts({ established: [novel], routes: [] }).contracts[0].exchange).toEqual(catalog[0].exchange)
  const active = resolveSyncedContracts(snapshot.contracts).contracts.find(contract => contract.routes.some(route => route.ship && route.shipping.fuelPerTrip !== null))

  if (!active) throw new Error('Recorded shipping oracle missing')
  const route = active.routes.find(route => route.ship && route.shipping.fuelPerTrip !== null)

  if (!route) throw new Error('Recorded cargo route missing')
  const enabledRoute = { ...route, enabled: true, running: true, operation: undefined,
    ship: route.ship ? { ...route.ship, running: true } : null,
    cargoModules: route.cargoModules.map(module => ({ ...module, running: true })),
    importedPerProductionCycle: 1, shipping: { ...route.shipping, fuelPerTrip: 289 } }
  const shipping = applyContracts([], [{ ...active, routes: [enabledRoute] }]).contractResults[0]
  const expensive = applyContracts([], [{ ...active, routes: [{ ...enabledRoute, shipping: { ...enabledRoute.shipping, fuelPerTrip: 578 } }] }]).contractResults[0]

  expect(shipping.imported).toBeGreaterThan(0)
  expect(expensive.fuelPerProductionCycle).toBe(shipping.fuelPerProductionCycle * 2)
  expect(applyContracts([], [{ ...active, routes: [{ ...enabledRoute,
    shipping: { ...enabledRoute.shipping, fuelPerTrip: null } }] }]).contractResults[0].imported).toBe(0)
  expect(applyContracts([], [{ ...active, routes: [{ ...enabledRoute, operation: route.operation,
    shipping: { ...enabledRoute.shipping, fuelPerTrip: null } }] }]).contractResults[0].routes[0].fuelUnavailable).toBe(true)

  const group: CropFarmGroup = { id: 'native-farm', name: 'Native farm', farmCount: 1, tierId: 'greenhouseII',
    schedule: ['corn'], fertilizer: { id: 'fertilizerII', targetFertilityPercent: 120 } }
  const farm = calculateCropFarmGroupRates(group, snapshot.cropFarming)
  const farming = structuredClone(snapshot.cropFarming)

  for (const tier of farming.tiers) { tier.yieldMultiplier *= 2; tier.demandMultiplier *= 2 }
  const upgraded = calculateCropFarmGroupRates(group, farming)

  expect(upgraded.outputsPerMonth.get('corn')).toBe(farm.outputsPerMonth.get('corn')! * 2)
  expect(upgraded.waterPerMonth).toBe(farm.waterPerMonth * 2)
  const aquifer = snapshot.groundwater.aquifers[0]

  expect(getAquiferRainRechargePerDay(aquifer, { ...snapshot.groundwater, capacityReplenishRawPercent: 0 }, 100)).toBe(0)
  expect(calculateAquiferSustainableOutput(aquifer, 1, { ...snapshot.groundwater, pumpCapacityPerCycle: 24 }, snapshot.weather))
    .toBeLessThanOrEqual(24)
  for (const factory of [undefined, { ...definitions.factory, recipes: [...definitions.factory.recipes, definitions.factory.recipes[0]] },
    { ...definitions.factory, populationResearch: { numerator: 5, rounding: 500, denominator: 0 } }]) {
    expect(normalizeGameStateSnapshot({ ...snapshot, planningDefinitions: { ...definitions, factory } })).toBeNull()
  }
  for (const cropFarming of [{ ...farming, tiers: [] }, { ...farming, simulation: undefined }]) {
    expect(normalizeGameStateSnapshot({ ...snapshot, cropFarming })).toBeNull()
  }
}, 60_000)

it('replays native Office tiers, boost curves, Focus allocations and changed cost tables through the factory model', () => {
  const source = normalizeGameStateSnapshot(capture)

  if (!source) throw new Error('Recorded Office definitions are incompatible')
  const original = source.areaEntities.find(entity => entity.prototypeId === 'OfficeBuildingT3')

  if (!original) throw new Error('Recorded factory must contain Offices')
  const replay = (states: { tier: number; boost: 0 | 1 | 2; running?: boolean; ghost?: boolean }[],
    definitions: OfficeFocusDefinitions = source.officeFocusDefinitions) => {
    const snapshot = structuredClone(source)

    snapshot.saveId = 'office-definition-replay'
    snapshot.officeFocusDefinitions = definitions
    snapshot.areaEntities = snapshot.areaEntities.filter(entity => !entity.prototypeId.startsWith('OfficeBuilding'))
    snapshot.productionEntities = snapshot.productionEntities.filter(entity => !entity.prototypeId.startsWith('OfficeBuilding'))
    for (const [index, state] of states.entries()) {
      const entityId = 1_700_000_000 + index
      const office = officeCatalog[state.tier]

      if (!office) throw new Error('Unknown Office smoke tier')
      snapshot.areaEntities.push({ ...original, entityId, prototypeId: office.prototypeId, prototypeName: office.name,
        running: !state.ghost && (state.running ?? true), constructed: !state.ghost,
        constructionState: state.ghost ? 'InConstruction' : 'Constructed', office: { computingBoostStep: state.boost } })
      if (!state.ghost) snapshot.productionEntities.push({ entityId, prototypeId: office.prototypeId,
        running: state.running ?? true, recipeIds: [], zones: original.zones,
        nuclearReactor: null, dataCenterRacks: null, trainStation: null })
    }
    const validated = normalizeGameStateSnapshot(snapshot)

    if (!validated) throw new Error('Office replay failed snapshot validation')
    const model = deriveCalculatorModel({ snapshot: validated, machineZoneAssignments: {}, revision: 'office-smoke' })
    const lines = model.configuredModules.flatMap(module => buildModuleLines(module, module.presets[0], model.outputModifiers).lines)
      .filter(line => line.recipe.id.startsWith('officeI'))

    return { model, lines }
  }
  const states = officeCatalog.flatMap((_office, tier) => ([0, 1, 2] as const).map(boost => ({ tier, boost })))
  const run = replay(states)
  const capacity = states.reduce((sum, state) => {
    const binding = officeCatalog[state.tier]
    const office = source.officeFocusDefinitions.offices.find(office => office.prototypeId === binding.prototypeId)
    const building = source.buildingDefinitions.find(building => building.id === binding.prototypeId)

    if (!office || !building) throw new Error('Office oracle is incomplete')
    return sum + Math.round(building.workers * source.officeFocusDefinitions.pointsMultiplierPercent / 100)
      + Math.round(building.workers * office.boosts[state.boost].focusBonusPercent / 100)
  }, 0)

  expect(run.lines).toHaveLength(9)
  expect(run.model.officePlanCalculation.focusPointsCapacity).toBe(capacity)
  expect(run.model.officePlanCalculation.officeSuppliesPerCycle).toBe(42)
  expect(run.model.officePlanCalculation.computingTflops).toBe(420)
  expect(run.lines.reduce((sum, line) => sum + line.recipe.inputs[0].quantity * line.activeBuildings, 0)).toBe(42)
  expect(run.lines.reduce((sum, line) => sum + (line.recipe.buildingData?.computingTflops ?? 0) * line.activeBuildings, 0)).toBe(420)
  expect(replay(states.map(state => ({ ...state, running: false }))).model.officePlanCalculation)
    .toMatchObject({ focusPointsCapacity: 0, computingTflops: 0, officeSuppliesPerCycle: 0 })
  expect(replay(states.map(state => ({ ...state, ghost: true }))).model.officePlanCalculation).toEqual(run.model.officePlanCalculation)

  const changed = structuredClone(source.officeFocusDefinitions)

  changed.pointsMultiplierPercent = 137.5
  for (const office of changed.offices) {
    office.suppliesPerCycle *= 1.5
    for (const boost of office.boosts) { boost.computingTflops *= 2; boost.focusBonusPercent *= 1.5 }
  }
  for (const focus of changed.focuses) {
    focus.pointCosts = focus.pointCosts.map((cost, step) => cost + step ** 2 * 7)
    for (const effect of focus.effects) effect.percentPerStep *= 1.5
  }
  const updated = replay(states, changed)

  expect(updated.model.officePlanCalculation.officeSuppliesPerCycle).toBe(63)
  expect(updated.model.officePlanCalculation.computingTflops).toBe(840)
  expect(updated.model.officePlanCalculation.focusPointsCapacity).toBeGreaterThan(capacity)
  expect(updated.lines.reduce((sum, line) => sum + line.recipe.inputs[0].quantity * line.activeBuildings, 0)).toBe(63)
  expect(updated.lines.reduce((sum, line) => sum + (line.recipe.buildingData?.computingTflops ?? 0) * line.activeBuildings, 0)).toBe(840)
  const cost = getFocusDefinitions(changed).reduce((sum, focus) => sum + focus.pointCosts[source.focus[focus.id].targetStep], 0)

  expect(updated.model.officePlanCalculation.focusPointsRequired).toBe(cost)
  for (const focus of getFocusDefinitions(changed)) {
    expect(updated.model.focusBonuses[focus.id]).toBe(source.focus[focus.id].targetStep * focus.percentPerStep)
    expect(updated.model.focusAllocations[focus.id].source).toBe('synced')
  }
  const allocation = structuredClone(source)

  allocation.focus.contractsProfitability = { targetStep: 7, activeStep: 3 }
  allocation.focus.foodConsumption = { targetStep: 2, activeStep: 0 }
  const selected = deriveCalculatorModel({ snapshot: allocation, machineZoneAssignments: {}, revision: 'selected-focus' })

  expect(selected.focusBonuses.contractsProfitability).toBe(14)
  expect(selected.focusBonuses.foodConsumption).toBe(-4)
  allocation.focus.contractsProfitability = { targetStep: 15, activeStep: 15 }
  expect(deriveCalculatorModel({ snapshot: allocation, machineZoneAssignments: {}, revision: 'completed-focus' })
    .focusBonuses.contractsProfitability).toBe(30)
  const extended = structuredClone(source)
  const crop = extended.officeFocusDefinitions.focuses.find(focus => focus.id === 'cropYield')

  if (!crop) throw new Error('Crop Focus definition is missing')
  crop.pointCosts.push(crop.pointCosts.at(-1)! + 1000)
  extended.focus.cropYield = { targetStep: 151, activeStep: 151 }
  expect(normalizeGameStateSnapshot(extended)?.focus.cropYield.targetStep).toBe(151)
  for (const invalid of [undefined, null,
    { ...changed, pointsMultiplierPercent: -1 },
    { ...changed, offices: changed.offices.slice(1) },
    { ...changed, offices: changed.offices.map(office => ({ ...office, boosts: office.boosts.slice(1) })) },
    { ...changed, focuses: changed.focuses.slice(1) },
    { ...changed, focuses: changed.focuses.map(focus => ({ ...focus, pointCosts: [0, 100, 50] })) },
    { ...changed, focuses: changed.focuses.map(focus => ({ ...focus, effects: [] })) },
    { ...changed, focuses: changed.focuses.map(focus => ({ ...focus, effects: [{ propertyId: 'WrongProperty', percentPerStep: 1 }] })) },
  ]) expect(normalizeGameStateSnapshot({ ...source, officeFocusDefinitions: invalid })).toBeNull()
}, 60_000)

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
  expect(getRainwaterHarvesterPotential(summary, 1.5, snapshot.planningDefinitions.factory.rainwaterPerDay)).toEqual({ nextYearPerCycle: 5.625, averagePerCycle: 5.625 })

  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {}, revision: 'water-replay' })
  const { factoryResult, linkedModulesResult } = calculateFactoryCalculation(model.factoryCalculationInput)
  const sourceResults = [...factoryResult.calculation.sourceResults,
    ...[...linkedModulesResult.moduleResults.values()].flatMap(result => result.sourceResults)]
  const inventory = buildWaterSourceInventory(snapshot, sourceResults)

  expect(inventory).toHaveLength(13)
  expect(inventory.filter(row => row.builtPumps === 0)).toHaveLength(10)
  expect(new Set(inventory.map(row => row.source.id)).size).toBe(13)
  const refreshed = normalizeGameStateSnapshot(JSON.parse(JSON.stringify(snapshot)))

  if (!refreshed?.products) throw new Error('Refreshed factory is incompatible')
  refreshed.products.inventory.Product_Salt.quantity += 123
  const replayedDays = vi.spyOn(refreshed.weather.periods, Symbol.iterator)

  expect(buildWaterSourceInventory(refreshed, sourceResults)).toEqual(inventory)
  expect(replayedDays).not.toHaveBeenCalled()
  replayedDays.mockRestore()
  const pausedSnapshot = structuredClone(snapshot)

  pausedSnapshot.groundwater.aquifers.reverse()
  pausedSnapshot.machines.reverse().forEach(machine => { machine.running = false })
  const pausedInventory = buildWaterSourceInventory(pausedSnapshot, [])

  expect(pausedInventory.map(row => row.source.id)).toEqual(inventory.map(row => row.source.id))
  expect(pausedInventory.every(row => row.activePumps === 0 && row.projectedWithdrawalPerCycle === 0)).toBe(true)
  expect(inventory.some(row => row.activePumps > 0 && row.projectedWithdrawalPerCycle > 0)).toBe(true)
  const unused = inventory.find(row => row.source.id === '1041:3242')

  expect(unused).toMatchObject({ source: { position: { x: 1041, y: 3242 }, radius: 60, quantity: 20_000 },
    builtPumps: 0, projectedPumps: 0, pumpsForCeiling: 3, sustainableOutputPerCycle: 0, projectedWithdrawalPerCycle: 0 })
  expect(unused?.sustainableCeilingPerCycle).toBeGreaterThan(0)
  expect(unused?.areaIds).toEqual([])
  expect(inventory.find(row => row.source.id === '3247:647')).toMatchObject({ areaIds: [10], areas: ['Greenhouses'] })
  expect(inventory.find(row => row.source.id === '1858:795')).toMatchObject({ areaIds: [14], areas: ['Population'], projectedWithdrawalPerCycle: 0 })
  expect(pausedInventory.map(row => row.areaIds)).toEqual(inventory.map(row => row.areaIds))
  for (const row of inventory) {
    const output = calculateAquiferSustainableOutput(row.source, row.pumpsForCeiling, snapshot.groundwater, weather)
    const fewer = calculateAquiferSustainableOutput(row.source, row.pumpsForCeiling - 1, snapshot.groundwater, weather)

    expect(output).toBeGreaterThanOrEqual(row.sustainableCeilingPerCycle - 0.005)
    expect(fewer).toBeLessThan(row.sustainableCeilingPerCycle - 0.005)
  }
  const actualWithdrawal = sourceResults.filter(result => result.recipe.sourceKind === 'groundwater')
    .reduce((total, result) => total + (result.actualOutputs.find(output => output.resourceId === 'water')?.quantity ?? 0), 0)

  expect(inventory.reduce((sum, row) => sum + row.projectedWithdrawalPerCycle, 0)).toBeCloseTo(actualWithdrawal, 8)
  const source = inventory.find(row => row.projectedWithdrawalPerCycle > 0)?.source
  const pump = snapshot.machines[0]

  if (!source || !pump) throw new Error('Aquifer scenario requires an installed pump')
  const normal = { ...snapshot.groundwater, depletedPumpSpeedPercent: 40, replenishWhenLowPercent: 7 }

  // Oracle values evaluated with installed 0.8.8 GetDailyReplenishQuantity,
  // Percent.Apply and IntExtensions.ScaledByToFix32. Percent multiplication
  // truncates before Quantity rounds: a half-rain day at 20k gives 18, not 19.
  for (const [capacity, halfRain, fullRain, emergency] of [[10_000, 9, 19, 1.330078125],
    [20_000, 18, 37, 2.58984375], [25_000, 23, 46, 3.2197265625], [30_000, 28, 56, 3.919921875]]) {
    const aquifer = { ...source, capacity, configuredCapacity: capacity }

    expect(getAquiferRainRechargePerDay(aquifer, normal, 50)).toBe(halfRain)
    expect(getAquiferRainRechargePerDay(aquifer, normal, 100)).toBe(fullRain)
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
  const noAssistance = { ...snapshot.groundwater, depletedPumpSpeedPercent: 0, replenishWhenLowPercent: 0 }
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
  const irrigation = calculateFarmIrrigationRates(group, snapshot.cropFarming, 1, 1.5, weather)
  const repeatedDays = vi.spyOn(refreshed.weather.periods, Symbol.iterator)

  expect(calculateFarmIrrigationRates(group, refreshed.cropFarming, 1, 1.5, refreshed.weather)).toEqual(irrigation)
  expect(repeatedDays).not.toHaveBeenCalled()
  repeatedDays.mockRestore()
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
  // Installed 0.8.8 Farm.SetFertilityTarget quantizes targets to ten-percent steps.
  for (const group of activeCropFarmGroups) if (group.fertilizer)
    expect(group.fertilizer.targetFertilityPercent % 10).toBe(0)
  for (const { schedule } of activeCropFarmGroups) for (const [index, cropId] of schedule.entries()) {
    if (getCropFarmingData(snapshot.cropFarming).crop(cropId).fertilityPercentPerDay > 0)
      expect(cropId).not.toBe(schedule[(index + 1) % schedule.length])
  }
  const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {}, revision: 'recorded-factory' })
  const { factoryResult, linkedModulesResult } = calculateFactoryCalculation(model.factoryCalculationInput)
  const rockDraw = getReserveDrawPerProductionCycle(factoryResult.calculation.sourceResults, 'rock-virtual-provision', 'rock')
  const rockBalance = snapshot.reserves?.rock ?? 0

  expect(rockBalance).toBeGreaterThan(0)
  expect(rockDraw).toBeCloseTo(74.0711, 4)
  expect(factoryResult.flows.find(flow => flow.resourceId === 'rock')?.net).toBeCloseTo(0)
  expect(calculateReserveRunway(rockBalance, rockDraw)).toMatchObject({
    status: 'draining', inGameYearsRemaining: rockBalance / rockDraw / 12,
  })
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
  const officeBoost = updated.officeFocusDefinitions.offices.find(definition => definition.prototypeId === 'OfficeBuildingT3')?.boosts[2]

  if (!officeBoost) throw new Error('Recorded Office boost definition is missing')
  officeBoost.computingTflops += 48
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
    const lines = buildModuleLines(stationModule, stationModule.presets[0], { buildingDefinitions: current.snapshot.buildingDefinitions, planningDefinitions: current.snapshot.planningDefinitions }).lines
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
    const lines = buildModuleLines(stationModule, stationModule.presets[0], { buildingDefinitions: snapshot.buildingDefinitions, planningDefinitions: snapshot.planningDefinitions }).lines
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
      const lines = buildModuleLines(area, preset, { planningDefinitions: source.planningDefinitions, buildingDefinitions: source.buildingDefinitions, weather: source.weather }).lines
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
  const planLines = buildModuleLines(plan, plan.presets[0], { planningDefinitions: source.planningDefinitions, buildingDefinitions: source.buildingDefinitions }).lines

  expect(planLines[0]).toMatchObject({ activeBuildings: 3, unplacedPlannedBuildings: 3, speedLevel: 0.8, dataSource: 'planned' })
  expect(plan.presets[0].planMismatches?.[0].target).toBe(2350)
}, 60_000)


it('replays native research, edicts, housing, settlement composition, computing, solar and statue data through the factory', () => {
  const source = normalizeGameStateSnapshot(capture)

  if (!source) throw new Error('Recorded planning data is incompatible')
  const replay = (definitions: PlanningDefinitions) => {
    const snapshot = normalizeGameStateSnapshot({ ...source, planningDefinitions: definitions })

    if (!snapshot) throw new Error('Planning replay is incompatible')
    const model = deriveCalculatorModel({ snapshot, machineZoneAssignments: {}, revision: 'planning-replay' })
    const lines = model.configuredModules.flatMap(module => buildModuleLines(module, module.presets[0], model.outputModifiers).lines)
    const housing = getHousingTypes(definitions)
    const budget = (settlementUnity = snapshot.settlement.unity) => calculateUnityBudget({
      definitions, housing: housing.housingIII, housingCount: model.housingCount,
      additionalHousing: [{ housing: housing.housingII, housingCount: model.housingIiCount }],
      unityCapacityMultiplier: model.unityCapacity.multiplier, settlementUnity,
      edictLevels: mapEdictValues(id => model.edictLevels[id]), contracts: [],
    })

    return { model, lines, budget }
  }
  const recyclingSnapshot = structuredClone(source)
  const recyclingFocus = recyclingSnapshot.officeFocusDefinitions.focuses.find(f => f.id === 'recyclingEfficiency')?.effects.find(e => e.propertyId === 'RecyclingRatioDiff')

  if (!recyclingFocus) throw new Error('Native recycling Focus definition missing')
  recyclingFocus.percentPerStep = 2
  recyclingSnapshot.focus.recyclingEfficiency = { targetStep: 7, activeStep: 3 }
  expect(deriveCalculatorModel({ snapshot: recyclingSnapshot, machineZoneAssignments: {}, revision: 'recycling-focus-replay' }).recyclingEfficiencyPercent)
    .toBeCloseTo(source.recycling.efficiencyPercent + 8, 8)
  const original = replay(source.planningDefinitions)
  const housing = getHousingTypes(source.planningDefinitions)
  const research = getInfiniteResearchCatalog(source.planningDefinitions)
  const maintenance = research.find(r => r.id === 'maintenanceOutput')
  const rockets = research.find(r => r.id === 'rocketsCapacity')

  if (!maintenance || !rockets) throw new Error('Research cost oracle missing')
  expect(calculateInfiniteResearchLevelCost(maintenance, 1)).toBe(23040)
  expect(calculateInfiniteResearchLevelCost(rockets, 1)).toBe(27840)
  expect(calculateInfiniteResearchRemainingCost(rockets, 0, 2)).toBe(75168)
  expect(housing.housingIII).toMatchObject({ populationCapacity: 240, unityStorage: 18,
    serviceDemandMultipliers: { electricity: 1.2, water: 1.1, householdGoods: 1.05 } })
  const edicts = getEdictCatalog(source.planningDefinitions)

  expect(edicts.find(e => e.id === 'cleanPanels')?.levels[3]).toMatchObject({ unityCostPerCycle: 2.5, modeledEffects: { solarPowerIncreasePercent: 30 } })
  expect(edicts.find(e => e.id === 'researchEfficiency')?.levels[5]).toMatchObject({ unityCostPerCycle: 6, modeledEffects: { researchEfficiencyBonusPercent: 60 } })
  expect(original.budget().storageCapacity).toBe((20 + 18 * original.model.housingCount + 12 * original.model.housingIiCount) * original.model.unityCapacity.multiplier)
  expect(original.budget(null).netPerCycle).toBeNull()
  const signedBudget = calculateUnityBudget({ definitions: source.planningDefinitions,
    housing: housing.housingIII, housingCount: 1, unityCapacityMultiplier: 1.25,
    settlementUnity: [{ id: 'food', name: 'Food', amount: 2.75 }, { id: 'quality', name: 'Quality', amount: 0.23 }, { id: 'health', name: 'Health', amount: -0.4 }],
    edictLevels: mapEdictValues(() => 0), contracts: [{ id: 'uranium', name: 'Uranium', importedPerCycle: 54, fixedUnityPerCycle: 0.3, unityPer100Imported: 0.1 }],
    contractsUnityCostPercent: -25, buildingGeneration: [{ id: 'station', name: 'Station', amount: 0.3 }], buildingConsumption: [{ id: 'lab', name: 'Lab', amount: 0.5 }],
  })

  expect(signedBudget).toMatchObject({ storageCapacity: 47.5 })
  expect(signedBudget.generationPerCycle).toBeCloseTo(3.28)
  expect(signedBudget.consumptionPerCycle).toBeCloseTo(0.4 + 0.354 * 0.75 + 0.5)
  const changed = structuredClone(source.planningDefinitions)

  expect(getRackAllocation(source.planningDefinitions.computing, 100)).toEqual([48, 48, 4])
  changed.computing.rackCapacity = 96
  changed.computing.computingPerRack *= 2
  changed.computing.coolantInPerRack *= 3
  changed.computing.coolantOutPerRack *= 2
  for (const input of changed.computing.chillerInputs) input.quantity *= 2
  for (const output of changed.computing.chillerOutputs) output.quantity *= 2
  expect(getRackAllocation(changed.computing, 100)).toEqual([96, 4])
  for (const solar of changed.solar) solar.productionKw *= 2
  for (const house of changed.housing) { house.capacity *= 2; house.unityStorage *= 3 }
  changed.unityBaseCapacity += 10
  changed.settlement.waterPerPop *= 2
  changed.settlement.electricityKwPerPop *= 2
  changed.settlement.goodsPerPop *= 2
  for (const food of changed.settlement.foods) food.perHundredPops *= 2
  for (const product of changed.settlement.biomassPerProduct) product.quantity *= 2
  changed.statue.fuelPerCycle = 7
  for (const edict of changed.edicts) edict.unityCost *= 2
  const crop = changed.research.find(r => r.id === 'cropYield')

  if (!crop) throw new Error('Crop research oracle missing')
  for (const effect of crop.effects) effect.percent *= 2
  const updated = replay(changed)

  const computingCapacity = (run: ReturnType<typeof replay>) => run.lines.reduce((total, line) => total
    + (line.recipe.outputs.find(output => output.resourceId === 'computing')?.quantity ?? 0) * line.activeBuildings, 0)

  expect(computingCapacity(updated)).toBe(computingCapacity(original) * 2)
  expect(updated.model.populationCapacity).toBe(original.model.populationCapacity * 2)
  expect(updated.model.outputModifiers.cropYield).toBeGreaterThan(original.model.outputModifiers.cropYield)
  expect(updated.budget().consumptionPerCycle).toBeCloseTo(original.budget().consumptionPerCycle * 2)
  expect(updated.budget().generationPerCycle).toBeCloseTo((original.budget().generationPerCycle ?? 0)
    + (edicts.find(e => e.id === 'plentyOfFood')?.levels[original.model.edictLevels.plentyOfFood]?.unityProductionPerCycle ?? 0))
  for (const recipeId of ['housing-residents', 'housing-ii-residents', 'solar-panel', 'solar-panel-mono', 'statue-of-maintenance-golden', 'computing-basic-rack', 'computing-water-chiller']) {
    const template = recipes.find(r => r.id === recipeId)

    if (!template) throw new Error('Planning recipe oracle missing')
    const initial = withPlanningDefinition(template, source.planningDefinitions)
    const altered = withPlanningDefinition(template, changed)

    expect(withPlanningDefinition(altered)).toEqual(altered)
    if (recipeId.startsWith('housing')) {
      expect(altered.inputs.find(i => i.resourceId === 'water')?.quantity).toBeCloseTo((initial.inputs.find(i => i.resourceId === 'water')?.quantity ?? 0) * 4)
      expect(altered.outputs.find(i => i.resourceId === 'biomass')?.quantity).toBeCloseTo((initial.outputs.find(i => i.resourceId === 'biomass')?.quantity ?? 0) * 8)
      expect(altered.buildingData?.electricityKw).toBeCloseTo((initial.buildingData?.electricityKw ?? 0) * 4)
    } else if (recipeId === 'computing-basic-rack') {
      expect(altered.inputs[0].quantity).toBe(initial.inputs[0].quantity * 3)
      expect(altered.outputs).toEqual(initial.outputs.map(output => ({ ...output, quantity: output.quantity * 2 })))
    } else if (recipeId === 'computing-water-chiller') {
      expect(altered.inputs).toEqual(initial.inputs.map(input => ({ ...input, quantity: input.quantity * 2 })))
      expect(altered.outputs).toEqual(initial.outputs.map(output => ({ ...output, quantity: output.quantity * 2 })))
    } else if (recipeId.startsWith('solar')) expect(altered.outputs[0].quantity).toBe(initial.outputs[0].quantity * 2)
    else expect(altered.inputs).toEqual([{ resourceId: 'fuelGas', quantity: 7 }])
  }
  const same = structuredClone(source.planningDefinitions)
  const extendedResearch = same.research.find(r => r.id === 'housingCapacity')

  if (!extendedResearch) throw new Error('Housing research missing')
  extendedResearch.costs.push((extendedResearch.costs.at(-1) ?? 0) + 1)
  expect(normalizeGameStateSnapshot({ ...source, planningDefinitions: same, research: { ...source.research, housingCapacity: extendedResearch.costs.length - 1 } })?.research.housingCapacity)
    .toBe(extendedResearch.costs.length - 1)
  for (const invalid of [undefined, null, { ...same, unityBaseCapacity: -1 }, { ...same, settlement: undefined }, { ...same, computing: undefined }, { ...same, computing: { ...same.computing, rackCapacity: 0 } },
    { ...same, research: same.research.slice(1) },
    { ...same, research: same.research.map(r => ({ ...r, costs: [0, 100, 50] })) },
    { ...same, research: same.research.map(r => ({ ...r, effects: [] })) },
    { ...same, edicts: same.edicts.map(e => ({ ...e, effects: [] })) },
    { ...same, research: same.research.map(r => ({ ...r, effects: r.effects.filter(e => e.id !== 'FarmWaterConsumptionMultiplier') })) },
    { ...same, edicts: same.edicts.filter(e => e.id !== 'cleanPanels' || e.level !== 1) },
    { ...same, solar: same.solar.slice(1) }, { ...same, housing: same.housing.slice(1) },
    { ...same, statue: { ...same.statue, reductionsByCount: [0, 4, 3] } },
  ]) expect(normalizeGameStateSnapshot({ ...source, planningDefinitions: invalid })).toBeNull()
}, 60_000)
