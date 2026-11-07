import { baseConfig } from '../../db/config'
import { contractRoutePlans } from '../../db/contract-plans'
import {
  getEdict,
  mapEdictValues,
  resolveEdictLevel,
  type EdictId,
  type EdictLevel,
  normalizeCleanPanelsLevel,
  normalizeFarmingBoostLevel,
} from '../../db/edicts'
import { getFactoryPreset, resolvePlanAreaTargets, type FactoryPresetId, type PlanLayerId } from '../../db/factory-presets'
import {
  getHousingTypes,
  calculatePopulationCapacity,
} from '../../db/housing'
import { getLiveAreaPlans } from '../../db/live-area-plans'
import {
  moduleResourceLinkDefinitions,
  resolveModuleResourceLinks,
} from '../../db/module-resource-links'
import {
  attachMaintenanceDepotsToModule,
  resolveMaintenanceDepotModuleAssignments,
} from '../../db/modules/area-maintenance'
import {
  attachSolarPanelsToModule,
  resolveSolarPanelModuleAssignments,
} from '../../db/modules/area-solar'
import {
  attachStaticInfrastructureToModule,
  resolveStaticInfrastructureModuleAssignments,
} from '../../db/modules/area-static-infrastructure'
import { createComputingModule } from '../../db/modules/computing'
import {
  createCropFarmAreaModule,
  createDefaultCropFarmModule,
  getCropFarmGroundwaterClaimId,
  getCropFarmRelatedZoneIds,
} from '../../db/modules/crop-farm-areas'
import {
  applyDefaultAreaPlan,
  createDefaultModule,
  DEFAULT_MODULE_ID,
  plannedResearchLabTarget,
} from '../../db/modules/default'
import { createChickenFarmAreaModule } from '../../db/modules/farms'
import { mines } from '../../db/modules/mines'
import { hasModuleCapability, type Module } from '../../db/modules/modules'
import {
  createNuclearModule,
  plannedNuclearOperation,
  thirdFbrNuclearOperation,
} from '../../db/modules/nuclear'
import {
  applySyncedOfficeInventory,
  createOfficeAreaModule,
  createPlannedOfficeModule,
  getOfficeAreaZoneIds,
  getModuleOfficeConfigurations,
  hasAttachedOfficeRecipes,
} from '../../db/modules/offices'
import {
  createPopulationModule,
  resolvePopulationHousingPlanTargets,
  thirdFbrBiomassMixerCount,
  thirdFbrHousingCount,
} from '../../db/modules/population'
import { createReservesModule } from '../../db/modules/reserves'
import {
  createSpaceStationModule,
  selectSpaceStationZone,
} from '../../db/modules/space-station'
import { calculateOfficePlan, defaultOfficePlan, mapFocusValues, officeCatalog, plannedOfficePlan } from '../../db/offices'
import { emptyPlanningBaselines, resolvePlanningBaselines } from '../../db/planning-baselines'
import {
  emptyRocketInfrastructureConfig,
  type RocketInfrastructureConfig,
} from '../../db/rocket-infrastructure'
import { settlementRecipeIds } from '../../db/settlement'
import {
  DEFAULT_GROUNDWATER_CLAIM_ID,
  createGroundwaterPumpClaims,
} from '../../db/shared-machine-claims'
import { plannedSolarPanelTargets } from '../../db/solar'
import {
  calculateRocketIiRecurringLogistics,
  calculateSpaceStationLevel,
  getMinimumSpaceStationLevelForResearchPoints,
} from '../../db/space-station'
import {
  emptyStaticInfrastructureConfig,
  type StaticInfrastructureConfig,
} from '../../db/static-infrastructure'
import { getLabSpacePoints } from '../../factory-definitions'
import { resolveFocusAllocations } from '../../focus-state'
import { type GameStateSnapshot } from '../../game-state'
import { getFocusDefinitions } from '../../office-focus-state'
import {
  resolveAreaBuildingCounts,
  resolveAreaRecipeBuildingCount,
  syncedInfrastructureBuildingIds,
  syncedRocketBuildingIds,
} from '../area-building-sync/area-building-sync'
import { resolveComputingEntityInventory } from '../computing-entity-sync/computing-entity-sync'
import { type ContractFullThrottlePreferences } from '../contracts/contract-preferences'
import { resolveSyncedContracts } from '../contracts/resolve-synced-contracts'
import { type FactoryCalculationInput } from '../factory-calculation/factory-calculation'
import { calculateGroundwaterClaimLimits } from '../groundwater/calculate-groundwater-production'
import {
  createLiveAreaModules,
  DEFAULT_LIVE_AREA_ZONE_ID,
  getModeledTerrainSorterEntityIds,
} from '../live-area-modules/live-area-modules'
import {
  allocateSharedMachines,
  type MachineZoneAssignments,
} from '../machine-allocation/machine-allocation'
import { projectMaintenance } from '../maintenance-planning/maintenance-planning'
import { calculateCropFarmingModifiers } from '../modifiers/calculate-crop-farming'
import { calculateFoodConsumption } from '../modifiers/calculate-food-consumption'
import { calculateHousingCapacity } from '../modifiers/calculate-housing-capacity'
import { calculateMaintenanceOutput } from '../modifiers/calculate-maintenance-output'
import { calculateRainwaterYield } from '../modifiers/calculate-rainwater-yield'
import { calculateRecyclingEfficiency } from '../modifiers/calculate-recycling-efficiency'
import { calculateResearchEfficiency } from '../modifiers/calculate-research-efficiency'
import { calculateSettlementWaterUse } from '../modifiers/calculate-settlement-water-use'
import { calculateShipsFuelUse } from '../modifiers/calculate-ships-fuel-use'
import { calculateSolarPower } from '../modifiers/calculate-solar-power'
import { calculateTreeGrowthSpeed } from '../modifiers/calculate-tree-growth-speed'
import { calculateUnityCapacity } from '../modifiers/calculate-unity-capacity'
import { applySettlementState, resolveProjectedPopulation } from '../population-entity-sync/apply-settlement-state'
import { resolvePopulationEntityInventory } from '../population-entity-sync/population-entity-sync'
import { type ResourcePriorityOverrides } from '../resource-priorities/resource-priorities'
import {
  getSyncedChickenFarmEntities,
  getSyncedCropFarmEntities,
} from '../synced-production-config/synced-production-config'
import { getAverageSunIntensityPercent } from '../weather/planning-weather'
import { calculateWorldMines, getWorldClaimedEntityIds } from '../world-mines/calculate-world-mines'

export interface DeriveCalculatorModelOptions {
  presetId?: FactoryPresetId
  operatingOverrides?: boolean
  worldMineFullThrottlePreferences?: Readonly<Record<string, boolean>>
  contractFullThrottlePreferences?: ContractFullThrottlePreferences
  resourcePriorityOverrides?: ResourcePriorityOverrides
  machineZoneAssignments: MachineZoneAssignments
  /** Snapshot revision; falls back to the export time when unavailable. */
  revision: string | null
  snapshot: GameStateSnapshot
}

/**
 * Derives every module, modifier, and plan the calculator renders from a game
 * snapshot. Cheap enough for the main thread; the expensive factory solve runs
 * separately on `factoryCalculationInput`.
 */
const deriveUncalibratedCalculatorModel = ({
  presetId = 'current',
  operatingOverrides = false,
  machineZoneAssignments,
  revision,
  snapshot,
  resourcePriorityOverrides: savedResourcePriorities = {},
  contractFullThrottlePreferences: savedContractModes = {},
  worldMineFullThrottlePreferences: savedWorldMineModes = {},
}: DeriveCalculatorModelOptions) => {
  const plan = getFactoryPreset(presetId)
  const targets = new Set<PlanLayerId>(plan.layers)
  const nuclearOperation = targets.has('third-fbr') ? thirdFbrNuclearOperation : plannedNuclearOperation
  const resourcePriorityOverrides = operatingOverrides ? savedResourcePriorities : {}
  const contractFullThrottlePreferences = operatingOverrides ? savedContractModes : {}
  const worldMineFullThrottlePreferences = operatingOverrides ? savedWorldMineModes : {}
  const planningDefinitions = snapshot.planningDefinitions
  const housingTypes = getHousingTypes(planningDefinitions)
  const activeHousingType = housingTypes.housingIII
  const averageSunIntensityPercent = getAverageSunIntensityPercent(snapshot.weather)
  const currentCropFarmEntities = getSyncedCropFarmEntities(snapshot.cropFarms)
  const cropFarmRelatedZoneIds = getCropFarmRelatedZoneIds(currentCropFarmEntities)
  const groundwaterPumpClaims = createGroundwaterPumpClaims(snapshot.logisticsZones)
    .map(claim => targets.has('power-water') ? claim : { ...claim, target: 0 })
  const sharedMachineAllocation =
    allocateSharedMachines(snapshot.machines, groundwaterPumpClaims, machineZoneAssignments, true)
  const defaultGroundwaterResolution = sharedMachineAllocation.claims[DEFAULT_GROUNDWATER_CLAIM_ID]
  const groundwaterClaimLimits = calculateGroundwaterClaimLimits(
    Object.values(sharedMachineAllocation.claims).map(resolution => ({
      claimId: resolution.claim.id,
      projectedPumpCount: resolution.running,
      machines: [
        ...resolution.machines,
        ...resolution.suggestedMachines,
      ],
    })),
    snapshot.groundwater,
    snapshot.weather,
  )
  const defaultGroundwaterConstraint = groundwaterClaimLimits[DEFAULT_GROUNDWATER_CLAIM_ID]
  const staticInfrastructureBuiltConfig: StaticInfrastructureConfig = {
    ...emptyStaticInfrastructureConfig,
  }
  const staticInfrastructureRunningConfig: StaticInfrastructureConfig = {
    ...emptyStaticInfrastructureConfig,
  }
  const rocketInfrastructureBuiltConfig: RocketInfrastructureConfig = {
    ...emptyRocketInfrastructureConfig,
  }
  const rocketInfrastructureRunningConfig: RocketInfrastructureConfig = {
    ...emptyRocketInfrastructureConfig,
  }
  const contractResolution = resolveSyncedContracts(
    snapshot.contracts,
    contractRoutePlans,
    contractFullThrottlePreferences,
  )
  const enabledContracts = contractResolution.contracts
  const worldMines = calculateWorldMines(snapshot.world)
  const cargoEntityIds = new Set([...contractResolution.claimedEntityIds, ...getWorldClaimedEntityIds(snapshot.world)])
  const cargoElectricityKw = worldMines.electricityKw + enabledContracts.reduce((total, contract) => total
    + contract.routes.reduce((routeTotal, route) => routeTotal + (route.enabled
      ? route.operation?.modules.reduce((sum, module) => sum + module.electricityKw, 0) ?? 0 : 0), 0), 0)
  const productionEntities = snapshot.productionEntities.filter(
    entity => !cargoEntityIds.has(entity.entityId),
  )
  const areaEntities = snapshot.areaEntities.filter(
    entity => !cargoEntityIds.has(entity.entityId) && (targets.has('construction') || entity.constructed),
  )
  const globalBuildingCounts = resolveAreaBuildingCounts(productionEntities)
  const officeAreaZoneIds = getOfficeAreaZoneIds(areaEntities)
  const nuclearReactorZoneIds = new Set(productionEntities.flatMap(entity => (
    entity.prototypeId === 'FastBreederReactor'
      ? entity.zones.map(zone => zone.id)
      : []
  )))
  const plannedNuclearZoneId = nuclearReactorZoneIds.size === 1
    ? [...nuclearReactorZoneIds][0]
    : undefined
  const spaceStationZone = selectSpaceStationZone(
    snapshot.logisticsZones,
    productionEntities,
  )
  const usesSpaceStationArea = Boolean(spaceStationZone)
  const spaceStationAreaEntities = spaceStationZone
    ? productionEntities.filter(entity => (
        entity.zones.some(zone => zone.id === spaceStationZone.id)
      ))
    : []
  const spaceStationAreaCounts = spaceStationZone
    ? resolveAreaBuildingCounts(spaceStationAreaEntities, spaceStationZone.id)
    : {}
  const stationPartsAssemblyCount =
    spaceStationZone
      ? resolveAreaRecipeBuildingCount(
          spaceStationAreaEntities,
          spaceStationZone.id,
          'AssemblyRoboticT2',
          'StationPartsAssembly',
        )
      : undefined

  for (const id of syncedInfrastructureBuildingIds) {
    const count = globalBuildingCounts[id] ?? { built: 0, running: 0 }

    staticInfrastructureBuiltConfig[id] = count.built
    staticInfrastructureRunningConfig[id] = count.running
  }

  for (const id of syncedRocketBuildingIds) {
    const count = usesSpaceStationArea
      ? (spaceStationAreaCounts[id] ?? { built: 0, running: 0 })
      : (globalBuildingCounts[id] ?? { built: 0, running: 0 })

    rocketInfrastructureBuiltConfig[id] = count.built
    rocketInfrastructureRunningConfig[id] = count.running
  }

  staticInfrastructureBuiltConfig.vehicles = snapshot.vehicles.workersAssigned
  staticInfrastructureRunningConfig.vehicles = snapshot.vehicles.workersAssigned

  const spaceStationConfig = {
    currentLevel: snapshot.spaceStation.currentLevel,
    highestLevelAchieved: snapshot.spaceStation.highestLevelAchieved,
  }
  const currentSpaceStationLevel = calculateSpaceStationLevel(
    spaceStationConfig.currentLevel,
    snapshot.spaceStationLevels,
  )
  const researchLabEntities = productionEntities.filter(entity => (
    entity.prototypeId === 'ResearchLab4' || entity.prototypeId === 'ResearchLab5'
  ))
  const defaultResearchLabEntities = researchLabEntities.filter(entity => (
    !entity.zones.some(zone => Boolean(zone.name))
  ))
  const runningResearchLabCount = researchLabEntities.filter(entity => entity.running).length
  const runningDefaultResearchLabCount = defaultResearchLabEntities.filter(
    entity => entity.running,
  ).length
  const runningOtherResearchLabCount = runningResearchLabCount - runningDefaultResearchLabCount
  const hasDefaultResearchLabInventory = defaultResearchLabEntities.length > 0
  const plannedResearchLabCount = targets.has('science') && baseConfig.researchMode === 'with-space'
    ? runningOtherResearchLabCount + (hasDefaultResearchLabInventory
        ? Math.max(runningDefaultResearchLabCount, plannedResearchLabTarget)
        : 0)
    : 0
  const runningSpaceResearchPoints = researchLabEntities.filter(entity => entity.running).reduce((total, entity) => total
    + getLabSpacePoints(planningDefinitions.factory, entity.prototypeId), 0)
  const plannedSpaceResearchPoints = targets.has('science') && baseConfig.researchMode === 'with-space'
    ? runningSpaceResearchPoints + Math.max(0, plannedResearchLabCount - runningResearchLabCount)
      * getLabSpacePoints(planningDefinitions.factory, defaultResearchLabEntities[0]?.prototypeId ?? 'ResearchLab5')
    : 0
  const projectedSpaceStationTargetLevel = Math.max(
    currentSpaceStationLevel.level,
    getMinimumSpaceStationLevelForResearchPoints(plannedSpaceResearchPoints, snapshot.spaceStationLevels),
  )
  const projectedSpaceStationLevel = calculateSpaceStationLevel(
    projectedSpaceStationTargetLevel,
    snapshot.spaceStationLevels,
  )
  const planningBaselines = resolvePlanningBaselines(snapshot, true)
  const syncedHistory = snapshot.history
  const syncedMaintenance = syncedHistory.maintenance
  const hasMaintenanceHistory = Object.values(syncedMaintenance).some(
    average => average.sampleMonths > 0,
  )
  const researchLevels = snapshot.research
  const rocketIiRecurringLogistics = calculateRocketIiRecurringLogistics(
    projectedSpaceStationLevel,
    snapshot.rocketIiDefinition,
    researchLevels.rocketsCapacity,
  )
  const hasSyncedOfficeAreaInventory = officeAreaZoneIds.size > 0
  const requestedOfficePlan = targets.has('computing') ? plannedOfficePlan : defaultOfficePlan
  const officeInventoryPlan = hasSyncedOfficeAreaInventory
    ? applySyncedOfficeInventory(requestedOfficePlan, productionEntities)
    : requestedOfficePlan
  const officeBuiltPlan = hasSyncedOfficeAreaInventory
    ? applySyncedOfficeInventory(requestedOfficePlan, productionEntities, 'built')
    : defaultOfficePlan
  const officeCurrentPlan = hasSyncedOfficeAreaInventory ? officeInventoryPlan : defaultOfficePlan
  const resolvedEdictLevels = mapEdictValues(edictId =>
    resolveEdictLevel(edictId, snapshot.edicts[edictId].activeLevel, targets.has('settlement')),
  )
  const edictLevels: Record<EdictId, EdictLevel> = mapEdictValues(
    edictId => resolvedEdictLevels[edictId].value,
  )
  const edictSources = mapEdictValues(edictId => resolvedEdictLevels[edictId].source)
  const maintenanceStatueCount = staticInfrastructureRunningConfig.maintenanceStatue
  const maintenanceOutputLevel = researchLevels.maintenanceOutput
  const solarPowerLevel = researchLevels.solarPower
  const cropYieldLevel = researchLevels.cropYield
  const rainwaterYieldLevel = researchLevels.rainwaterYield
  const settlementWaterUseLevel = researchLevels.settlementWaterUse
  const treeGrowthSpeedLevel = researchLevels.treeGrowthSpeed
  const worldMineOutputLevel = researchLevels.worldMineOutput
  const unityCapacityLevel = researchLevels.unityCapacity
  const housingCapacityLevel = researchLevels.housingCapacity
  const shipsFuelUseLevel = researchLevels.shipsFuelUse
  const syncedComputingConfigs = resolveComputingEntityInventory(productionEntities)
  const currentChickenFarmEntities = getSyncedChickenFarmEntities(snapshot.chickenFarms)

  const createConfiguredSpaceStationModule = (generatedArea: Module) => {
    return createSpaceStationModule(
      spaceStationConfig,
      snapshot.spaceStationLevels,
      snapshot.rocketIiDefinition,
      rocketInfrastructureBuiltConfig,
      {
        rocketRunningConfig: rocketInfrastructureRunningConfig,
        stationPartsAssembly: {
          ...(stationPartsAssemblyCount ?? { built: 0, running: 0 }),
        },
      },
      generatedArea,
      plannedSpaceResearchPoints > 0
        ? { requiredPoints: plannedSpaceResearchPoints }
        : undefined,
    )
  }

  const configuredAreaModules = [
    createDefaultCropFarmModule(
      createDefaultModule(
        planningDefinitions.factory,
        defaultGroundwaterResolution,
        defaultGroundwaterConstraint,
      ),
      currentCropFarmEntities,
      snapshot.cropFarming,
    ),
    mines,
    createReservesModule(snapshot.reserves),
  ]
  const liveAreaPlans = resolvePlanAreaTargets(getLiveAreaPlans(snapshot.saveId), targets)
  const generatedLiveAreaModules = createLiveAreaModules(
    [
      { id: DEFAULT_LIVE_AREA_ZONE_ID, name: 'Default' },
      ...snapshot.logisticsZones,
    ],
    areaEntities,
    liveAreaPlans,
    snapshot.mineTowers,
  )
  const terrainSorterEntityIds = getModeledTerrainSorterEntityIds(
    areaEntities,
    generatedLiveAreaModules,
  )
  const unconfiguredLiveAreaModules = generatedLiveAreaModules
  const populationInventoriesByZone = new Map(
    unconfiguredLiveAreaModules.flatMap(module => (
      hasModuleCapability(module, 'population') && module.liveArea
        ? [[
            module.liveArea.zoneId,
            resolvePopulationEntityInventory(productionEntities, module.liveArea.zoneId),
          ] as const]
        : []
    )),
  )
  const populationHousingPlanTargets = targets.has('settlement') ? resolvePopulationHousingPlanTargets(
    unconfiguredLiveAreaModules.flatMap(module => {
      if (!hasModuleCapability(module, 'population') || !module.liveArea) return []
      const syncedInventory = populationInventoriesByZone.get(module.liveArea.zoneId)

      return syncedInventory ? [{ generatedArea: module, syncedInventory }] : []
    }),
    targets.has('third-fbr') ? thirdFbrHousingCount : undefined,
  ) : new Map<number, number>()
  const configuredLiveAreaModules = unconfiguredLiveAreaModules.map(module => {
    if (!module.liveArea) return module

    const configured = { module }

    if (module.id === DEFAULT_MODULE_ID) {
      configured.module = createDefaultCropFarmModule(
        applyDefaultAreaPlan(planningDefinitions.factory, module, baseConfig.researchMode, {
          science: targets.has('science'), refining: targets.has('refining'),
          uranium: targets.has('third-fbr'),
          food: targets.has('third-fbr'),
        }),
        currentCropFarmEntities,
        snapshot.cropFarming,
        defaultGroundwaterConstraint,
      )
    } else if (nuclearReactorZoneIds.has(module.liveArea.zoneId)) {
      const appliesPlan = module.liveArea.zoneId === plannedNuclearZoneId

      configured.module = createNuclearModule(
        appliesPlan ? planningBaselines : emptyPlanningBaselines,
        appliesPlan && targets.has('power-water') ? nuclearOperation : undefined,
        productionEntities,
        module,
      )
    } else if (
      hasModuleCapability(module, 'space-station')
      && module.liveArea.zoneId === spaceStationZone?.id
    ) {
      configured.module = createConfiguredSpaceStationModule(module)
    } else if (hasModuleCapability(module, 'population')) {
      const syncedInventory = populationInventoriesByZone.get(module.liveArea.zoneId)

      if (syncedInventory) {
        configured.module = applySettlementState(planningDefinitions, createPopulationModule(
          planningDefinitions,
          syncedInventory,
          module,
          housingCapacityLevel,
          populationHousingPlanTargets.get(module.liveArea.zoneId) ?? null,
          targets.has('settlement'),
          targets.has('third-fbr') ? thirdFbrBiomassMixerCount : null,
        ), snapshot.settlement, productionEntities)
      }
    } else if (hasModuleCapability(module, 'computing')) {
      const areaComputingConfigs = resolveComputingEntityInventory(
        productionEntities,
        module.liveArea.zoneId,
      )

      configured.module = createComputingModule(
        planningDefinitions.computing,
        areaComputingConfigs.built,
        areaComputingConfigs.running,
        module,
        liveAreaPlans[module.liveArea.zoneId]?.computing,
        areaComputingConfigs.entities
          .filter(entity => entity.prototypeId === 'DataCenter' && !entity.running)
          .map(entity => entity.dataCenterRacks ?? 0),
      )
    }

    configured.module = createChickenFarmAreaModule(
      configured.module,
      currentChickenFarmEntities,
      areaEntities,
      snapshot.chickenFarmDefinition,
      liveAreaPlans[module.liveArea.zoneId]?.chickenFarms,
      liveAreaPlans[module.liveArea.zoneId]?.foodPackProduction,
    )

    if (cropFarmRelatedZoneIds.has(module.liveArea.zoneId) || liveAreaPlans[module.liveArea.zoneId]?.cropFarms) {
      configured.module = createCropFarmAreaModule(
        configured.module,
        currentCropFarmEntities,
        snapshot.cropFarming,
        groundwaterClaimLimits[getCropFarmGroundwaterClaimId(module.liveArea.zoneId)],
        liveAreaPlans[module.liveArea.zoneId]?.cropFarms,
      )
    }

    return officeAreaZoneIds.has(module.liveArea.zoneId) || liveAreaPlans[module.liveArea.zoneId]?.offices
      ? createOfficeAreaModule(
          configured.module,
          areaEntities,
          officeInventoryPlan,
          liveAreaPlans[module.liveArea.zoneId]?.offices,
        )
      : configured.module
  })
  const hasGeneratedOfficeModule = configuredLiveAreaModules.some(hasAttachedOfficeRecipes)
  const hasOfficeFallbackInventory = (
    officeInventoryPlan.officeSuppliesAssemblyVCount > 0
    || officeBuiltPlan.officeSuppliesAssemblyVCount > 0
    || Object.values(officeInventoryPlan.offices).some(office => office.count > 0)
    || Object.values(officeBuiltPlan.offices).some(office => office.count > 0)
  )
  const officeFallbackModules = !hasGeneratedOfficeModule && hasOfficeFallbackInventory
    ? [createPlannedOfficeModule(
        officeInventoryPlan,
        officeBuiltPlan,
        officeCurrentPlan,
      )]
    : []
  const officeConfigurations = getModuleOfficeConfigurations([
    ...configuredLiveAreaModules,
    ...officeFallbackModules,
  ])
  const focusAllocations = resolveFocusAllocations(snapshot.focus, {}, !targets.has('computing'))
  const officePlan = {
    ...officeInventoryPlan,
    offices: { ...officeInventoryPlan.offices },
    focusSteps: mapFocusValues(id => targets.has('computing') ? snapshot.focus[id].targetStep : snapshot.focus[id].activeStep),
  }

  for (const office of officeCatalog) {
    officePlan.offices[office.id] = {
      ...officePlan.offices[office.id],
      count: officeConfigurations.filter(configuration => configuration.tierId === office.id)
        .reduce((total, configuration) => total + configuration.count, 0),
    }
  }
  const officePlanCalculation = calculateOfficePlan(
    officePlan,
    snapshot.officeFocusDefinitions,
    officeConfigurations,
    snapshot.buildingDefinitions,
  )
  const focusBonuses = officePlanCalculation.bonuses
  const baseAreaModules = configuredAreaModules.filter(module => (
    module.id !== DEFAULT_MODULE_ID
  ))
  const modulesWithLiveAreas = [
    ...baseAreaModules,
    ...officeFallbackModules,
    ...configuredLiveAreaModules,
  ]
  const configuredModulesWithoutSolar = modulesWithLiveAreas
  const solarAssignments = resolveSolarPanelModuleAssignments({
    defaultModuleId: DEFAULT_MODULE_ID,
    fallbackInventory: {
      builtCounts: {
        standard: globalBuildingCounts.solarPanel?.built ?? 0,
        mono: globalBuildingCounts.solarPanelMono?.built ?? 0,
      },
      runningCounts: {
        standard: globalBuildingCounts.solarPanel?.running ?? 0,
        mono: globalBuildingCounts.solarPanelMono?.running ?? 0,
      },
    },
    modules: configuredModulesWithoutSolar,
    plannedTargets: targets.has('power-water') ? plannedSolarPanelTargets : undefined,
    productionEntities,
  })
  const configuredBaseModules = configuredModulesWithoutSolar.map(module => {
    const solarAssignment = solarAssignments[module.id]

    if (!solarAssignment) return module

    return attachSolarPanelsToModule(
      module,
      solarAssignment.builtCounts,
      solarAssignment.runningCounts,
      solarAssignment.plannedTargets,
    )
  })
  const staticInfrastructureAssignments = resolveStaticInfrastructureModuleAssignments({
    areaEntities,
    builtConfig: staticInfrastructureBuiltConfig,
    defaultModuleId: DEFAULT_MODULE_ID,
    modules: configuredBaseModules,
    managedEntityIds: terrainSorterEntityIds,
    productionEntities,
    runningConfig: staticInfrastructureRunningConfig,
  })
  const configuredModulesWithoutMaintenance = configuredBaseModules.map(module => {
    const assignment = staticInfrastructureAssignments[module.id]
    const configured = assignment
      ? attachStaticInfrastructureToModule(
          module,
          assignment,
        )
      : module
    const zoneId = configured.liveArea?.zoneId
    const priorities = zoneId == null ? {} : {
      ...liveAreaPlans[zoneId]?.resourceProcessingPriorities,
      ...resourcePriorityOverrides[zoneId],
    }

    return Object.keys(priorities).length === 0 ? configured : {
      ...configured,
      presets: configured.presets.map(preset => ({ ...preset, resourceProcessingPriorities: priorities })),
    }
  })
  const maintenanceProjection = projectMaintenance(syncedMaintenance, configuredModulesWithoutMaintenance, {
    planningDefinitions, buildingDefinitions: snapshot.buildingDefinitions,
    officeFocusDefinitions: snapshot.officeFocusDefinitions,
  }, snapshot.maintenancePlanning)
  const maintenanceAssignments = resolveMaintenanceDepotModuleAssignments({
    definitions: planningDefinitions,
    defaultModuleId: DEFAULT_MODULE_ID,
    demand: maintenanceProjection.projected ?? maintenanceProjection.synced,
    modules: configuredModulesWithoutMaintenance,
    productionEntities,
  })
  const configuredModules = configuredModulesWithoutMaintenance.map(module => {
    const assignment = maintenanceAssignments[module.id]

    return assignment ? attachMaintenanceDepotsToModule(module, assignment) : module
  })
  const configuredComputingModules = configuredModules.filter(module => (
    hasModuleCapability(module, 'computing') && module.liveArea
  ))
  const configuredPopulationModules = configuredModules.filter(module => (
    hasModuleCapability(module, 'population') && module.liveArea
  ))
  const configuredSpaceStationModules = configuredModules.filter(module => (
    hasModuleCapability(module, 'space-station')
    && module.includedInFactoryTotals !== false
  ))
  const housingCapacity = calculateHousingCapacity(planningDefinitions, housingCapacityLevel)
  const populationHousingCounts = configuredPopulationModules.reduce(
    (counts, module) => {
      const preset = module.presets.find(candidate => candidate.id === module.defaultPresetId)
        ?? module.presets[0]

      counts.housing += preset?.activeBuildings[settlementRecipeIds.residents] ?? 0
      counts.housingII += preset?.activeBuildings[settlementRecipeIds.residentsII] ?? 0

      return counts
    },
    { housing: 0, housingII: 0 },
  )
  const housingCount = populationHousingCounts.housing
  const housingIiCount = populationHousingCounts.housingII
  const populationCapacity =
    calculatePopulationCapacity(activeHousingType, housingCount, housingCapacity.multiplier) +
    calculatePopulationCapacity(housingTypes.housingII, housingIiCount, housingCapacity.multiplier)
  const spaceStationIncludedInFactoryTotals = configuredSpaceStationModules.some(module => (
    module.includedInFactoryTotals !== false
  )) && projectedSpaceStationLevel.level > 0
  const projectedPopulation = resolveProjectedPopulation(
    planningDefinitions,
    configuredPopulationModules,
    snapshot.settlement,
    productionEntities,
  )
  const hasProjectedSpaceStation = configuredSpaceStationModules.length > 0
    && projectedSpaceStationLevel.level > 0
  const researchEfficiency = {
    ...calculateResearchEfficiency({
      definitions: planningDefinitions,
      edictLevel: edictLevels.researchEfficiency,
      focusBonusPercent: focusBonuses.researchEfficiency,
      population: Math.max(0, projectedPopulation.population - snapshot.settlement.population
        + snapshot.settlement.settlements.reduce((total, settlement) => total + settlement.population, 0)),
      stationBonusPercent: hasProjectedSpaceStation
        ? projectedSpaceStationLevel.researchEfficiencyBonusPercent
        : 0,
    }),
    populationIsPlanned: projectedPopulation.isPlanned,
    stationIsPlanned: hasProjectedSpaceStation
      && projectedSpaceStationLevel.level > currentSpaceStationLevel.level,
  }

  const plannedRecyclingEfficiency = calculateRecyclingEfficiency(planningDefinitions,
    edictLevels.recyclingIncrease,
    focusBonuses.recyclingEfficiency,
  ).effectivePercent
  const currentRecyclingEfficiency = calculateRecyclingEfficiency(planningDefinitions,
    snapshot.edicts.recyclingIncrease.activeLevel,
    snapshot.focus.recyclingEfficiency.activeStep * (getFocusDefinitions(snapshot.officeFocusDefinitions).find(f => f.id === 'recyclingEfficiency')?.percentPerStep ?? 0),
  ).effectivePercent
  const recyclingEfficiencyPercent = Math.min(100, Math.max(0,
    snapshot.recycling.efficiencyPercent + plannedRecyclingEfficiency - currentRecyclingEfficiency,
  ))
  const foodConsumption = calculateFoodConsumption(planningDefinitions,
    edictLevels.foodSaver,
    edictLevels.plentyOfFood,
    focusBonuses.foodConsumption,
  )
  const maintenanceOutput = calculateMaintenanceOutput(planningDefinitions,
    maintenanceOutputLevel,
    focusBonuses.maintenanceProduction,
  )
  const solarPowerOutput = calculateSolarPower(planningDefinitions,
    solarPowerLevel,
    normalizeCleanPanelsLevel(edictLevels.cleanPanels),
    averageSunIntensityPercent,
  )
  const cropFarming = calculateCropFarmingModifiers(planningDefinitions,
    cropYieldLevel,
    normalizeFarmingBoostLevel(edictLevels.farmingBoost),
    focusBonuses.cropYield,
  )
  const waterSaverLevel = getEdict('waterSaver', planningDefinitions).levels.find(
    level => level.level === edictLevels.waterSaver,
  )
  const waterSaverMultiplier =
    1 - (waterSaverLevel?.modeledEffects?.waterDemandReductionPercent ?? 0) / 100
  const rainwaterYield = calculateRainwaterYield(planningDefinitions, rainwaterYieldLevel)
  const settlementWaterUse = calculateSettlementWaterUse(planningDefinitions, settlementWaterUseLevel)
  const settlementConsumptionMultiplier = 1 + focusBonuses.settlementConsumption / 100
  const treeGrowthSpeed = calculateTreeGrowthSpeed(planningDefinitions, treeGrowthSpeedLevel)
  const unityCapacity = calculateUnityCapacity(planningDefinitions, unityCapacityLevel)
  const shipsFuelUse = calculateShipsFuelUse(planningDefinitions, shipsFuelUseLevel)
  const outputModifiers = {
    officeFocusDefinitions: snapshot.officeFocusDefinitions,
    planningDefinitions,
    spaceResearch: baseConfig.researchMode === 'with-space',
    buildingDefinitions: snapshot.buildingDefinitions,
    products: snapshot.products ? { catalog: snapshot.products.catalog } : undefined,
    recycling: { ...snapshot.recycling, efficiencyPercent: recyclingEfficiencyPercent },
    weather: snapshot.weather,
    foodConsumption: foodConsumption.multiplier,
    maintenanceOutput: maintenanceOutput.multiplier,
    solarPower: solarPowerOutput.multiplier,
    cropYield: cropFarming.yieldMultiplier,
    cropWater: cropFarming.waterDemandMultiplier * waterSaverMultiplier,
    rainwaterYield: rainwaterYield.multiplier,
    settlementConsumption: settlementConsumptionMultiplier,
    settlementWater:
      settlementWaterUse.multiplier * waterSaverMultiplier * settlementConsumptionMultiplier,
    treeGrowthSpeed: treeGrowthSpeed.multiplier,
  }
  const resolvedModuleResourceLinks = resolveModuleResourceLinks(
    configuredModules,
    snapshot.saveId,
    moduleResourceLinkDefinitions,
  )
  const calculationRevision = `${
    revision ?? snapshot.exportedAtUtc
  }:${JSON.stringify(machineZoneAssignments)}:${JSON.stringify(resourcePriorityOverrides)}:${JSON.stringify(contractFullThrottlePreferences)}:${JSON.stringify(worldMineFullThrottlePreferences)}:${presetId}:${operatingOverrides}`
  // Every calculation input above is a pure derivation of the game-state
  // revision, assignments, operating modes, and the factory preset identified by `calculationRevision`.
  const factoryCalculationInput: FactoryCalculationInput = {
    contracts: enabledContracts,
    worldMinePlanning: { world: snapshot.world, fullThrottle: worldMineFullThrottlePreferences },
    externalDemands: { electricity: cargoElectricityKw / 1000 },
    contractsProfitMultiplier: 1 + focusBonuses.contractsProfitability / 100,
    links: resolvedModuleResourceLinks,
    modules: configuredModules,
    outputModifiers,
    recyclingEfficiencyPercent,
  }

  return {
    averageSunIntensityPercent,
    calculationRevision,
    configuredComputingModules,
    configuredModules,
    configuredPopulationModules,
    configuredSpaceStationModules,
    contractResolution,
    worldMines,
    cargoElectricityKw,
    cropYieldLevel,
    currentSpaceStationLevel,
    projectedSpaceStationLevel,
    presetId,
    operatingOverrides,
    edictLevels,
    edictSources,
    enabledContracts,
    factoryCalculationInput,
    focusBonuses,
    focusAllocations,
    groundwaterPumpClaims,
    hasMaintenanceHistory,
    housingCount,
    housingIiCount,
    maintenanceOutputLevel,
    maintenanceProjection,
    maintenanceStatueCount,
    officePlan,
    officePlanCalculation,
    outputModifiers,
    populationCapacity,
    rainwaterYieldLevel,
    recyclingEfficiencyPercent,
    researchEfficiency,
    researchLevels,
    rocketIiRecurringLogistics,
    runningResearchLabCount,
    settlementWaterUseLevel,
    sharedMachineAllocation,
    shipsFuelUse,
    snapshot,
    solarPowerLevel,
    spaceStationIncludedInFactoryTotals,
    syncedComputingConfigs,
    syncedMaintenance,
    treeGrowthSpeedLevel,
    unityCapacity,
    worldMineOutputLevel,
  }
}

export const deriveCalculatorModel = (options: DeriveCalculatorModelOptions) => {
  const model = deriveUncalibratedCalculatorModel(options)
  const electricity = options.snapshot.electricity

  if (electricity) {
    model.factoryCalculationInput.powerPlanning = {
      measuredDemandMw: electricity.demandMw,
      bufferPercent: 20,
      ...((model.presetId !== 'current' || model.operatingOverrides) ? {
        baseline: deriveUncalibratedCalculatorModel({ ...options, presetId: 'current', operatingOverrides: false }).factoryCalculationInput,
      } : {}),
    }
  }
  return model
}

export type CalculatorModel = ReturnType<typeof deriveCalculatorModel>
