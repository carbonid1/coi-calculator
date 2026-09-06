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
import {
  activeHousingType,
  calculatePopulationCapacity,
  housingTypes,
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
  getCropFarmOwnerZones,
  getCropFarmRelatedZoneIds,
} from '../../db/modules/crop-farm-areas'
import {
  applyDefaultAreaPlan,
  createDefaultModule,
  DEFAULT_MODULE_ID,
  plannedResearchLabTarget,
  spaceResearchPointsPerLab,
} from '../../db/modules/default'
import { createChickenFarmAreaModule } from '../../db/modules/farms'
import { mines } from '../../db/modules/mines'
import { hasModuleCapability, type Module } from '../../db/modules/modules'
import {
  createNuclearModule,
  plannedNuclearOperation,
} from '../../db/modules/nuclear'
import {
  applySyncedOfficeInventory,
  createOfficeAreaModule,
  createPlannedOfficeModule,
  getOfficeAreaZoneIds,
  getSyncedOfficeConfigurations,
  hasAttachedOfficeRecipes,
} from '../../db/modules/offices'
import {
  createPopulationModule,
  resolvePopulationHousingPlanTargets,
} from '../../db/modules/population'
import { createReservesModule } from '../../db/modules/reserves'
import {
  createSpaceStationModule,
  selectSpaceStationZone,
} from '../../db/modules/space-station'
import { calculateOfficePlan, defaultOfficePlan, plannedOfficePlan } from '../../db/offices'
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
  defaultRocketIiRecurringLogistics,
  getMinimumSpaceStationLevelForResearchPoints,
} from '../../db/space-station'
import {
  emptyStaticInfrastructureConfig,
  type StaticInfrastructureConfig,
} from '../../db/static-infrastructure'
import { type GameStateSnapshot } from '../../game-state'
import {
  resolveAreaBuildingCounts,
  resolveAreaRecipeBuildingCount,
  syncedInfrastructureBuildingIds,
  syncedRocketBuildingIds,
} from '../area-building-sync/area-building-sync'
import { resolveComputingEntityInventory } from '../computing-entity-sync/computing-entity-sync'
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
import { applySettlementState } from '../population-entity-sync/apply-settlement-state'
import { resolvePopulationEntityInventory } from '../population-entity-sync/population-entity-sync'
import {
  getSyncedChickenFarmEntities,
  getSyncedCropFarmEntities,
} from '../synced-production-config/synced-production-config'
import { transferTerrainMineOwnership } from '../terrain-mine-ownership/terrain-mine-ownership'
import { getAverageSunIntensityPercent } from '../weather/generate-planning-weather'

export interface DeriveCalculatorModelOptions {
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
export const deriveCalculatorModel = ({
  machineZoneAssignments,
  revision,
  snapshot,
}: DeriveCalculatorModelOptions) => {
  const averageSunIntensityPercent = getAverageSunIntensityPercent(snapshot.weather)
  const currentCropFarmEntities = getSyncedCropFarmEntities(snapshot.cropFarms)
  const cropFarmOwnerZones = getCropFarmOwnerZones(currentCropFarmEntities)
  const cropFarmRelatedZoneIds = getCropFarmRelatedZoneIds(currentCropFarmEntities)
  const groundwaterPumpClaims = createGroundwaterPumpClaims(cropFarmOwnerZones)
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
  )
  const enabledContracts = contractResolution.contracts
  const productionEntities = snapshot.productionEntities.filter(
    entity => !contractResolution.claimedEntityIds.has(entity.entityId),
  )
  const areaEntities = snapshot.areaEntities.filter(
    entity => !contractResolution.claimedEntityIds.has(entity.entityId),
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
    spaceStationConfig.highestLevelAchieved,
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
  const plannedResearchLabCount = baseConfig.researchMode === 'with-space'
    ? runningOtherResearchLabCount + (hasDefaultResearchLabInventory
        ? Math.max(runningDefaultResearchLabCount, plannedResearchLabTarget)
        : 0)
    : 0
  const plannedSpaceResearchPoints = plannedResearchLabCount * spaceResearchPointsPerLab
  const projectedSpaceStationTargetLevel = Math.max(
    currentSpaceStationLevel.level,
    getMinimumSpaceStationLevelForResearchPoints(plannedSpaceResearchPoints),
  )
  const projectedSpaceStationLevel = calculateSpaceStationLevel(
    projectedSpaceStationTargetLevel,
    Math.max(
      spaceStationConfig.highestLevelAchieved,
      projectedSpaceStationTargetLevel,
    ),
  )
  const planningBaselines = resolvePlanningBaselines(snapshot)
  const syncedHistory = snapshot.history
  const syncedMaintenance = syncedHistory.maintenance
  const maintenanceDemand = {
    maintenanceI: syncedMaintenance.maintenanceI.averagePerCycle,
    maintenanceII: syncedMaintenance.maintenanceII.averagePerCycle,
    maintenanceIII: syncedMaintenance.maintenanceIII.averagePerCycle,
  }
  const hasMaintenanceHistory = Object.values(syncedMaintenance).some(
    average => average.sampleMonths > 0,
  )
  const researchLevels = snapshot.research
  const rocketIiRecurringLogistics = calculateRocketIiRecurringLogistics(
    projectedSpaceStationLevel,
    researchLevels.rocketsCapacity,
  )
  const hasSyncedOfficeAreaInventory = officeAreaZoneIds.size > 0
  const officePlan = hasSyncedOfficeAreaInventory
    ? applySyncedOfficeInventory(plannedOfficePlan, productionEntities)
    : plannedOfficePlan
  const officeBuiltPlan = hasSyncedOfficeAreaInventory
    ? applySyncedOfficeInventory(plannedOfficePlan, productionEntities, 'built')
    : defaultOfficePlan
  const officeCurrentPlan = hasSyncedOfficeAreaInventory ? officePlan : defaultOfficePlan
  const syncedOfficeConfigurations = getSyncedOfficeConfigurations(areaEntities)
  const officePlanCalculation = calculateOfficePlan(
    officePlan,
    researchLevels.focusPoints,
    syncedOfficeConfigurations,
  )
  const focusBonuses = officePlanCalculation.bonuses
  const resolvedEdictLevels = mapEdictValues(edictId =>
    resolveEdictLevel(edictId, snapshot.edicts[edictId].activeLevel),
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
        defaultGroundwaterResolution,
        defaultGroundwaterConstraint,
      ),
      currentCropFarmEntities,
    ),
    mines,
    createReservesModule(snapshot.reserves),
  ]
  const generatedLiveAreaModules = createLiveAreaModules(
    [
      { id: DEFAULT_LIVE_AREA_ZONE_ID, name: 'Default' },
      ...snapshot.logisticsZones,
    ],
    areaEntities,
    getLiveAreaPlans(snapshot.saveId),
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
  const populationHousingPlanTargets = resolvePopulationHousingPlanTargets(
    unconfiguredLiveAreaModules.flatMap(module => {
      if (!hasModuleCapability(module, 'population') || !module.liveArea) return []
      const syncedInventory = populationInventoriesByZone.get(module.liveArea.zoneId)

      return syncedInventory ? [{ generatedArea: module, syncedInventory }] : []
    }),
  )
  const configuredLiveAreaModules = unconfiguredLiveAreaModules.map(module => {
    if (!module.liveArea) return module

    let configuredModule = module

    if (module.id === DEFAULT_MODULE_ID) {
      configuredModule = createDefaultCropFarmModule(
        applyDefaultAreaPlan(module),
        currentCropFarmEntities,
        defaultGroundwaterConstraint,
      )
    } else if (nuclearReactorZoneIds.has(module.liveArea.zoneId)) {
      const appliesPlan = module.liveArea.zoneId === plannedNuclearZoneId

      configuredModule = createNuclearModule(
        appliesPlan ? planningBaselines : emptyPlanningBaselines,
        appliesPlan ? plannedNuclearOperation : undefined,
        productionEntities,
        module,
      )
    } else if (
      hasModuleCapability(module, 'space-station')
      && module.liveArea.zoneId === spaceStationZone?.id
    ) {
      configuredModule = createConfiguredSpaceStationModule(module)
    } else if (hasModuleCapability(module, 'population')) {
      const syncedInventory = populationInventoriesByZone.get(module.liveArea.zoneId)

      if (syncedInventory) {
        configuredModule = applySettlementState(createPopulationModule(
          syncedInventory,
          module,
          housingCapacityLevel,
          populationHousingPlanTargets.get(module.liveArea.zoneId) ?? null,
        ), snapshot.settlement, productionEntities)
      }
    } else if (hasModuleCapability(module, 'computing')) {
      const areaComputingConfigs = resolveComputingEntityInventory(
        productionEntities,
        module.liveArea.zoneId,
      )

      configuredModule = createComputingModule(
        areaComputingConfigs.built,
        areaComputingConfigs.running,
        module,
      )
    }

    configuredModule = createChickenFarmAreaModule(
      configuredModule,
      currentChickenFarmEntities,
      areaEntities,
    )

    if (cropFarmRelatedZoneIds.has(module.liveArea.zoneId)) {
      configuredModule = createCropFarmAreaModule(
        configuredModule,
        currentCropFarmEntities,
        groundwaterClaimLimits[getCropFarmGroundwaterClaimId(module.liveArea.zoneId)],
      )
    }

    return officeAreaZoneIds.has(module.liveArea.zoneId)
      ? createOfficeAreaModule(
          configuredModule,
          areaEntities,
          officePlan,
        )
      : configuredModule
  })
  const hasGeneratedOfficeModule = configuredLiveAreaModules.some(hasAttachedOfficeRecipes)
  const hasOfficeFallbackInventory = (
    officePlan.officeSuppliesAssemblyVCount > 0
    || officeBuiltPlan.officeSuppliesAssemblyVCount > 0
    || Object.values(officePlan.offices).some(office => office.count > 0)
    || Object.values(officeBuiltPlan.offices).some(office => office.count > 0)
  )
  const officeFallbackModules = !hasGeneratedOfficeModule && hasOfficeFallbackInventory
    ? [createPlannedOfficeModule(
        officePlan,
        officeBuiltPlan,
        officeCurrentPlan,
      )]
    : []
  const baseAreaModules = configuredAreaModules.filter(module => (
    module.id !== DEFAULT_MODULE_ID
  ))
  const modulesWithLiveAreas = [
    ...transferTerrainMineOwnership(baseAreaModules, configuredLiveAreaModules),
    ...officeFallbackModules,
    ...configuredLiveAreaModules,
  ]
  const maintenanceAssignments = resolveMaintenanceDepotModuleAssignments({
    defaultModuleId: DEFAULT_MODULE_ID,
    demand: maintenanceDemand,
    modules: modulesWithLiveAreas,
    productionEntities,
  })
  const configuredModulesWithoutSolar = modulesWithLiveAreas.map(module => {
    const assignment = maintenanceAssignments[module.id]

    return assignment
      ? attachMaintenanceDepotsToModule(
          module,
          assignment,
        )
      : module
  })
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
    plannedTargets: plannedSolarPanelTargets,
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
  const configuredModules = configuredBaseModules.map(module => {
    const assignment = staticInfrastructureAssignments[module.id]

    return assignment
      ? attachStaticInfrastructureToModule(
          module,
          assignment,
        )
      : module
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
  const housingCapacity = calculateHousingCapacity(housingCapacityLevel)
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
  )) && currentSpaceStationLevel.level > 0
  const researchEfficiency = calculateResearchEfficiency({
    edictLevel: edictLevels.researchEfficiency,
    focusBonusPercent: focusBonuses.researchEfficiency,
    population: snapshot.settlement.population,
    stationBonusPercent: spaceStationIncludedInFactoryTotals
      ? currentSpaceStationLevel.researchEfficiencyBonusPercent
      : 0,
  })

  const recyclingEfficiencyPercent = calculateRecyclingEfficiency(
    edictLevels.recyclingIncrease,
    focusBonuses.recyclingEfficiency,
  ).effectivePercent
  const foodConsumption = calculateFoodConsumption(
    edictLevels.foodSaver,
    edictLevels.plentyOfFood,
    focusBonuses.foodConsumption,
  )
  const maintenanceOutput = calculateMaintenanceOutput(
    maintenanceOutputLevel,
    focusBonuses.maintenanceProduction,
  )
  const solarPowerOutput = calculateSolarPower(
    solarPowerLevel,
    normalizeCleanPanelsLevel(edictLevels.cleanPanels),
    averageSunIntensityPercent,
  )
  const cropFarming = calculateCropFarmingModifiers(
    cropYieldLevel,
    normalizeFarmingBoostLevel(edictLevels.farmingBoost),
    focusBonuses.cropYield,
  )
  const waterSaverLevel = getEdict('waterSaver').levels.find(
    level => level.level === edictLevels.waterSaver,
  )
  const waterSaverMultiplier =
    1 - (waterSaverLevel?.modeledEffects?.waterDemandReductionPercent ?? 0) / 100
  const rainwaterYield = calculateRainwaterYield(rainwaterYieldLevel)
  const settlementWaterUse = calculateSettlementWaterUse(settlementWaterUseLevel)
  const settlementConsumptionMultiplier = 1 + focusBonuses.settlementConsumption / 100
  const treeGrowthSpeed = calculateTreeGrowthSpeed(treeGrowthSpeedLevel)
  const unityCapacity = calculateUnityCapacity(unityCapacityLevel)
  const shipsFuelUse = calculateShipsFuelUse(shipsFuelUseLevel)
  const outputModifiers = {
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
    rocketLaunches:
      defaultRocketIiRecurringLogistics.launchesPerCycle > 0
        ? rocketIiRecurringLogistics.launchesPerCycle /
          defaultRocketIiRecurringLogistics.launchesPerCycle
        : 1,
  }
  const resolvedModuleResourceLinks = resolveModuleResourceLinks(
    configuredModules,
    snapshot.saveId,
    moduleResourceLinkDefinitions,
  )
  const calculationRevision = `${
    revision ?? snapshot.exportedAtUtc
  }:${JSON.stringify(machineZoneAssignments)}`
  // Every calculation input above is a pure derivation of the game-state
  // revision and machine-zone assignments identified by `calculationRevision`.
  const factoryCalculationInput: FactoryCalculationInput = {
    contracts: enabledContracts,
    contractsProfitMultiplier: 1 + focusBonuses.contractsProfitability / 100,
    links: resolvedModuleResourceLinks,
    modules: configuredModules,
    outputModifiers,
    recyclingEfficiencyPercent,
    shipsFuelUseMultiplier: shipsFuelUse.multiplier,
  }

  return {
    averageSunIntensityPercent,
    calculationRevision,
    configuredComputingModules,
    configuredModules,
    configuredPopulationModules,
    configuredSpaceStationModules,
    contractResolution,
    cropYieldLevel,
    currentSpaceStationLevel,
    edictLevels,
    edictSources,
    enabledContracts,
    factoryCalculationInput,
    focusBonuses,
    groundwaterPumpClaims,
    hasMaintenanceHistory,
    housingCount,
    housingIiCount,
    maintenanceOutputLevel,
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

export type CalculatorModel = ReturnType<typeof deriveCalculatorModel>
