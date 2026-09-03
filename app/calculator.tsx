'use client'

import { useEffect, useState } from 'react'

import { BuildingCardTarget, getBuildingTargetId } from './components/BuildingCardTarget'
import { ContractsView } from './components/ContractsView'
import { FocusView } from './components/FocusView'
import { GameSyncStatus } from './components/GameSyncStatus'
import { LiveAreaStatus } from './components/LiveAreaStatus'
import { MinesView } from './components/MinesView'
import { ModifiersView } from './components/ModifiersView'
import { ModuleSwitcher } from './components/ModuleSwitcher'
import { NetSummary } from './components/NetSummary'
import { RecipeCard } from './components/RecipeCard'
import { InfiniteResearchSettings, ResearchSettings } from './components/ResearchSettings'
import { ReservesView } from './components/ReservesView'
import { SharedRecipeCard } from './components/SharedRecipeCard'
import { SinkCard } from './components/SinkCard'
import { StationCardGroup } from './components/StationCardGroup'
import { StorageCard } from './components/StorageCard'
import { getBuildingData } from './db/buildings'
import { plannedChickenFarmSettings } from './db/chicken-farm'
import { baseConfig } from './db/config'
import { contractRoutePlans } from './db/contract-plans'
import { contracts } from './db/contracts'
import {
  getEdict,
  mapEdictValues,
  resolveEdictLevel,
  type EdictId,
  type EdictLevel,
  normalizeCleanPanelsLevel,
  normalizeFarmingBoostLevel,
} from './db/edicts'
import {
  activeHousingType,
  calculatePopulationCapacity,
  housingTypes,
} from './db/housing'
import { getLiveAreaPlans } from './db/live-area-plans'
import {
  moduleResourceLinkDefinitions,
  resolveModuleResourceLinks,
} from './db/module-resource-links'
import {
  attachMaintenanceDepotsToModule,
  resolveMaintenanceDepotModuleAssignments,
  selectMaintenanceDepotLines,
} from './db/modules/area-maintenance'
import {
  attachSolarPanelsToModule,
  resolveSolarPanelModuleAssignments,
} from './db/modules/area-solar'
import {
  attachStaticInfrastructureToModule,
  partitionStationLines,
  resolveStaticInfrastructureModuleAssignments,
  selectStaticInfrastructureLines,
} from './db/modules/area-static-infrastructure'
import { createComputingModule } from './db/modules/computing'
import {
  createCropFarmAreaModule,
  createDefaultCropFarmModule,
  getCropFarmGroundwaterClaimId,
  getCropFarmOwnerZones,
  getCropFarmRelatedZoneIds,
} from './db/modules/crop-farm-areas'
import {
  applyDefaultAreaPlan,
  createDefaultModule,
  DEFAULT_MODULE_ID,
  plannedResearchLabTarget,
  spaceResearchPointsPerLab,
} from './db/modules/default'
import {
  createChickenFarmsModule,
  CHICKEN_FARMS_MODULE_ID,
} from './db/modules/farms'
import { MINES_MODULE_ID } from './db/modules/mines'
import { hasModuleCapability, modules, type Module } from './db/modules/modules'
import {
  createNuclearModule,
  plannedNuclearOperation,
} from './db/modules/nuclear'
import {
  applySyncedOfficeInventory,
  createOfficeAreaModule,
  createPlannedOfficeModule,
  FOCUS_DASHBOARD_ID,
  getOfficeAreaZoneIds,
  getSyncedOfficeConfigurations,
  hasAttachedOfficeRecipes,
} from './db/modules/offices'
import {
  createPopulationModule,
  resolvePopulationHousingPlanTargets,
} from './db/modules/population'
import { RESEARCH_MODULE_ID } from './db/modules/research'
import { createReservesModule, RESERVES_MODULE_ID } from './db/modules/reserves'
import {
  createSpaceStationModule,
  selectSpaceStationZone,
} from './db/modules/space-station'
import { calculateOfficePlan, defaultOfficePlan, plannedOfficePlan } from './db/offices'
import { emptyPlanningBaselines, resolvePlanningBaselines } from './db/planning-baselines'
import { type RecipeGroup } from './db/recipes'
import { mapReserveResources } from './db/reserve-resources'
import { type ResourceId } from './db/resources'
import {
  emptyRocketInfrastructureConfig,
  type RocketInfrastructureConfig,
} from './db/rocket-infrastructure'
import { settlementRecipeIds } from './db/settlement'
import {
  DEFAULT_GROUNDWATER_CLAIM_ID,
  createGroundwaterPumpClaims,
} from './db/shared-machine-claims'
import { plannedSolarPanelTargets } from './db/solar'
import {
  calculateRocketIiRecurringLogistics,
  calculateSpaceStationLevel,
  defaultRocketIiRecurringLogistics,
  getMinimumSpaceStationLevelForResearchPoints,
} from './db/space-station'
import {
  emptyStaticInfrastructureConfig,
  type StaticInfrastructureConfig,
} from './db/static-infrastructure'
import { calculateUnityBudget } from './db/unity'
import {
  syncedInfrastructureBuildingIds,
  syncedRocketBuildingIds,
} from './game-state'
import {
  resolveAreaBuildingCounts,
  resolveAreaRecipeBuildingCount,
} from './helpers/area-building-sync/area-building-sync'
import {
  calculateBuildingDiagnostics,
  type BuildingDiagnostic,
} from './helpers/building-diagnostics/building-diagnostics'
import { calculateBuildingStats } from './helpers/building-stats/building-stats'
import { type ProductionLine } from './helpers/calculate/calculate'
import { calculateLinkedModules } from './helpers/calculate-linked-modules/calculate-linked-modules'
import { resolveComputingEntityInventory } from './helpers/computing-entity-sync/computing-entity-sync'
import { calculateContractWorkers } from './helpers/contracts/calculate-contracts'
import { resolveSyncedContracts } from './helpers/contracts/resolve-synced-contracts'
import { calculateFactoryTotal } from './helpers/factory-total/factory-total'
import { calculateGroundwaterClaimLimits } from './helpers/groundwater/calculate-groundwater-production'
import { createLatestRevisionCache } from './helpers/latest-revision-cache/latest-revision-cache'
import {
  createLiveAreaModules,
  DEFAULT_LIVE_AREA_ZONE_ID,
  getModeledTerrainSorterEntityIds,
} from './helpers/live-area-modules/live-area-modules'
import {
  allocateSharedMachines,
  type MachineZoneAssignments,
} from './helpers/machine-allocation/machine-allocation'
import { calculateCropFarmingModifiers } from './helpers/modifiers/calculate-crop-farming'
import { calculateFoodConsumption } from './helpers/modifiers/calculate-food-consumption'
import { calculateHousingCapacity } from './helpers/modifiers/calculate-housing-capacity'
import { calculateMaintenanceOutput } from './helpers/modifiers/calculate-maintenance-output'
import { calculateRainwaterYield } from './helpers/modifiers/calculate-rainwater-yield'
import { calculateRecyclingEfficiency } from './helpers/modifiers/calculate-recycling-efficiency'
import { calculateResearchEfficiency } from './helpers/modifiers/calculate-research-efficiency'
import { calculateSettlementWaterUse } from './helpers/modifiers/calculate-settlement-water-use'
import { calculateShipsFuelUse } from './helpers/modifiers/calculate-ships-fuel-use'
import { calculateSolarPower } from './helpers/modifiers/calculate-solar-power'
import { calculateTreeGrowthSpeed } from './helpers/modifiers/calculate-tree-growth-speed'
import { calculateUnityCapacity } from './helpers/modifiers/calculate-unity-capacity'
import { getRecipeOutputQuantity } from './helpers/modifiers/recipe-output'
import { extractModuleResult } from './helpers/module-result/module-result'
import {
  createPooledLinkSourceShadows,
  hasPooledLinkSourceConnections,
} from './helpers/pooled-link-source-shadows/pooled-link-source-shadows'
import { resolvePopulationEntityInventory } from './helpers/population-entity-sync/population-entity-sync'
import { getPresetResourceDemands } from './helpers/preset-resource-demands/preset-resource-demands'
import { groupProductionCardLines } from './helpers/production-card-groups/production-card-groups'
import { getReserveDrawPerProductionCycle } from './helpers/reserves/reserves'
import { createSpaceResearchAttention } from './helpers/space-research-attention/space-research-attention'
import {
  getSyncedChickenFarmEntities,
  getSyncedCropFarmEntities,
} from './helpers/synced-production-config/synced-production-config'
import { transferTerrainMineOwnership } from './helpers/terrain-mine-ownership/terrain-mine-ownership'
import { type GameStateResult, useGameState } from './hooks/use-game-state'

const groupLabels: Record<RecipeGroup, string> = {
  source: 'Sources',
  electricity: 'Electricity',
  production: 'Production',
  waste: 'Waste processing',
  sink: 'Sinks',
}

const groupOrder: RecipeGroup[] = ['source', 'electricity', 'production', 'waste', 'sink']

const FACTORY_TOTAL_ID = 'factory-total'
const CONTRACTS_ID = 'contracts'
const MODIFIERS_ID = 'modifiers'
const VIEW_MODULE_IDS = [MINES_MODULE_ID, RESERVES_MODULE_ID] as const
const MACHINE_ZONE_ASSIGNMENTS_KEY = 'coi-machine-zone-assignments-v1'

interface FactoryCalculation {
  factoryResult: ReturnType<typeof calculateFactoryTotal>
  linkedModulesResult: ReturnType<typeof calculateLinkedModules>
}

const getFactoryCalculation = createLatestRevisionCache<FactoryCalculation>()

interface Props {
  initialGameState: GameStateResult
}

export const Calculator: React.FC<Props> = ({ initialGameState }) => {
  const gameState = useGameState(initialGameState)
  const [activeModuleId, setActiveModuleId] = useState(FACTORY_TOTAL_ID)
  const [machineZoneAssignments, setMachineZoneAssignments] = useState<MachineZoneAssignments>({})
  const [buildingTarget, setBuildingTarget] = useState<{
    key: string
    moduleId: string
  } | null>(null)
  const currentCropFarmEntities = gameState.snapshot?.cropFarms
    ? getSyncedCropFarmEntities(gameState.snapshot.cropFarms)
    : []
  const cropFarmOwnerZones = getCropFarmOwnerZones(currentCropFarmEntities)
  const cropFarmRelatedZoneIds = getCropFarmRelatedZoneIds(currentCropFarmEntities)
  const groundwaterPumpClaims = createGroundwaterPumpClaims(cropFarmOwnerZones)
  const groundwaterPumpClaimIds = groundwaterPumpClaims.map(claim => claim.id).join('|')
  const machineZoneAssignmentsStorageKey = gameState.snapshot?.saveId
    ? `${MACHINE_ZONE_ASSIGNMENTS_KEY}:${encodeURIComponent(gameState.snapshot.saveId)}`
    : null

  useEffect(() => {
    if (!machineZoneAssignmentsStorageKey) {
      const animationFrame = window.requestAnimationFrame(() => {
        setMachineZoneAssignments({})
      })

      return () => window.cancelAnimationFrame(animationFrame)
    }

    const animationFrame = window.requestAnimationFrame(() => {
      try {
        const validGroundwaterPumpClaimIds = new Set(
          groundwaterPumpClaimIds.split('|').filter(Boolean),
        )
        const stored: unknown = JSON.parse(
          window.localStorage.getItem(machineZoneAssignmentsStorageKey) ?? '{}',
        )

        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
          setMachineZoneAssignments({})
          return
        }

        const assignments: Record<number, string> = {}

        for (const [zoneId, claimId] of Object.entries(stored)) {
          if (
            /^-?\d+$/.test(zoneId) &&
            typeof claimId === 'string' &&
            validGroundwaterPumpClaimIds.has(claimId)
          ) {
            assignments[Number(zoneId)] = claimId
          }
        }

        setMachineZoneAssignments(assignments)
      } catch {
        window.localStorage.removeItem(machineZoneAssignmentsStorageKey)
        setMachineZoneAssignments({})
      }
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [machineZoneAssignmentsStorageKey, groundwaterPumpClaimIds])

  const assignMachineZone = (zoneId: number, claimId: string | null) => {
    setMachineZoneAssignments(current => {
      const next = { ...current }

      if (claimId) {
        next[zoneId] = claimId
      } else {
        delete next[zoneId]
      }

      if (machineZoneAssignmentsStorageKey) {
        window.localStorage.setItem(machineZoneAssignmentsStorageKey, JSON.stringify(next))
      }
      return next
    })
  }

  useEffect(() => {
    if (!buildingTarget || buildingTarget.moduleId !== activeModuleId) return undefined

    let clearTimer: number | undefined
    const animationFrame = window.requestAnimationFrame(() => {
      const target = document.getElementById(getBuildingTargetId(buildingTarget.key))

      if (!target) {
        setBuildingTarget(null)
        return
      }

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
      target.focus({ preventScroll: true })
      clearTimer = window.setTimeout(() => {
        setBuildingTarget(current => (current === buildingTarget ? null : current))
      }, 1_800)
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
      if (clearTimer !== undefined) window.clearTimeout(clearTimer)
    }
  }, [activeModuleId, buildingTarget])

  const header = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Captain of Industry</h1>
        <p className="text-sm text-muted-foreground">Production Chain Calculator</p>
      </div>
      <GameSyncStatus
        exportedAtUtc={gameState.exportedAtUtc}
        isFresh={gameState.isFresh}
        snapshot={gameState.snapshot}
        source={gameState.source}
        status={gameState.status}
      />
    </div>
  )

  if (!gameState.snapshot) {
    return <div className="mx-auto max-w-7xl p-4 sm:p-5">{header}</div>
  }

  const snapshot = gameState.snapshot

  const openBuilding = (diagnostic: BuildingDiagnostic) => {
    setBuildingTarget({
      key: diagnostic.navigationKey ?? diagnostic.key,
      moduleId: diagnostic.moduleId,
    })
    setActiveModuleId(diagnostic.moduleId)
  }

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
    const count = snapshot.buildings[id]

    staticInfrastructureBuiltConfig[id] = count.built
    staticInfrastructureRunningConfig[id] = count.running
  }

  for (const id of syncedRocketBuildingIds) {
    const count = usesSpaceStationArea
      ? (spaceStationAreaCounts[id] ?? { built: 0, running: 0 })
      : snapshot.buildings[id]

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

  const configureModules = () =>
    modules.map(module => {
      if (module.id === DEFAULT_MODULE_ID) {
        return createDefaultCropFarmModule(
          createDefaultModule(
            defaultGroundwaterResolution,
            defaultGroundwaterConstraint,
          ),
          currentCropFarmEntities,
        )
      }

      if (module.id === CHICKEN_FARMS_MODULE_ID) {
        return createChickenFarmsModule(
          plannedChickenFarmSettings,
          currentChickenFarmEntities,
        )
      }

      if (module.id === RESERVES_MODULE_ID) {
        return createReservesModule(snapshot.reserves)
      }

      return module
    })
  const configuredAreaModules = configureModules()
  const generatedLiveAreaModules = createLiveAreaModules(
    [
      { id: DEFAULT_LIVE_AREA_ZONE_ID, name: 'Default' },
      ...snapshot.logisticsZones,
    ],
    areaEntities,
    configuredAreaModules,
    getLiveAreaPlans(snapshot.saveId),
    snapshot.mineTowers,
  )
  const terrainSorterEntityIds = getModeledTerrainSorterEntityIds(
    areaEntities,
    snapshot.mineTowers,
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
    } else if (hasModuleCapability(module, 'chicken-farming')) {
      const areaChickenFarms = currentChickenFarmEntities.filter(entity => (
        entity.zones.some(zone => zone.id === module.liveArea?.zoneId)
      ))

      if (areaChickenFarms.length) {
        configuredModule = createChickenFarmsModule(
          plannedChickenFarmSettings,
          areaChickenFarms,
          undefined,
          module,
        )
      }
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
        configuredModule = createPopulationModule(
          syncedInventory,
          module,
          housingCapacityLevel,
          populationHousingPlanTargets.get(module.liveArea.zoneId) ?? null,
        )
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
  const hasGeneratedChickenFarmModule = configuredLiveAreaModules.some(module => (
    hasModuleCapability(module, 'chicken-farming')
  ))
  const baseAreaModules = configuredAreaModules.filter(module => (
    module.id !== DEFAULT_MODULE_ID
    && (!hasGeneratedChickenFarmModule || module.id !== CHICKEN_FARMS_MODULE_ID)
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
        standard: snapshot.buildings.solarPanel.built,
        mono: snapshot.buildings.solarPanelMono.built,
      },
      runningCounts: {
        standard: snapshot.buildings.solarPanel.running,
        mono: snapshot.buildings.solarPanelMono.running,
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
    population: populationCapacity,
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
    gameState.revision ?? snapshot.exportedAtUtc
  }:${JSON.stringify(machineZoneAssignments)}`
  const calculateFactoryCalculation = (): FactoryCalculation => {
    const calculateFactory = (
      linkedResult: ReturnType<typeof calculateLinkedModules>,
      moduleFixedDemands: ReadonlyMap<
        string,
        Partial<Record<ResourceId, number>>
      > = new Map(),
      moduleSuppliedResources: ReadonlyMap<
        string,
        Partial<Record<ResourceId, number>>
      > = new Map(),
    ) => calculateFactoryTotal(
      configuredModules,
      {
        boundaryDemands: linkedResult.boundaryDemands,
        boundarySupplies: linkedResult.boundarySupplies,
        contracts: enabledContracts,
        recyclingEfficiencyPercent,
        outputModifiers,
        shipsFuelUseMultiplier: shipsFuelUse.multiplier,
        contractsProfitMultiplier: 1 + focusBonuses.contractsProfitability / 100,
        moduleFixedDemands,
        moduleSuppliedResources,
      },
    )
    const baseLinkedModulesResult = calculateLinkedModules({
      links: resolvedModuleResourceLinks,
      modules: configuredModules,
      outputModifiers,
      recyclingEfficiencyPercent,
    })

    if (!hasPooledLinkSourceConnections(resolvedModuleResourceLinks, configuredModules)) {
      return {
        linkedModulesResult: baseLinkedModulesResult,
        factoryResult: calculateFactory(baseLinkedModulesResult),
      }
    }

    const baseFactoryResult = calculateFactory(baseLinkedModulesResult)
    const pooledLinkSources = createPooledLinkSourceShadows({
      calculation: baseFactoryResult.calculation,
      lines: baseFactoryResult.allLines,
      links: resolvedModuleResourceLinks,
      modules: configuredModules,
      outputModifiers,
    })
    const rawLinkedModulesResult = calculateLinkedModules({
      links: resolvedModuleResourceLinks,
      modules: [
        ...configuredModules.filter(moduleDefinition => (
          !pooledLinkSources.sourceModuleIds.has(moduleDefinition.id)
        )),
        ...pooledLinkSources.modules,
      ],
      outputModifiers,
      recyclingEfficiencyPercent,
    })
    const resolvedLinkedModulesResult = {
      ...rawLinkedModulesResult,
      moduleResults: new Map(
        [...rawLinkedModulesResult.moduleResults].filter(([moduleId]) => (
          !pooledLinkSources.sourceModuleIds.has(moduleId)
        )),
      ),
    }
    const linkedDemandsByPooledSource = new Map<
      string,
      Partial<Record<ResourceId, number>>
    >()
    const linkedSuppliesByPooledTarget = new Map<
      string,
      Partial<Record<ResourceId, number>>
    >()

    for (const transfer of resolvedLinkedModulesResult.transfers) {
      if (pooledLinkSources.sourceModuleIds.has(transfer.sourceModuleId)) {
        const demands = linkedDemandsByPooledSource.get(transfer.sourceModuleId) ?? {}

        demands[transfer.resourceId] = (demands[transfer.resourceId] ?? 0) + transfer.quantity
        linkedDemandsByPooledSource.set(transfer.sourceModuleId, demands)
      }
      if (pooledLinkSources.sourceModuleIds.has(transfer.targetModuleId)) {
        const supplies = linkedSuppliesByPooledTarget.get(transfer.targetModuleId) ?? {}

        supplies[transfer.resourceId] = (supplies[transfer.resourceId] ?? 0)
          + transfer.quantity
        linkedSuppliesByPooledTarget.set(transfer.targetModuleId, supplies)
      }
    }

    return {
      linkedModulesResult: resolvedLinkedModulesResult,
      factoryResult: calculateFactory(
        resolvedLinkedModulesResult,
        linkedDemandsByPooledSource,
        linkedSuppliesByPooledTarget,
      ),
    }
  }
  // Every calculation input above is a pure derivation of the game-state revision
  // and machine-zone assignments used by this bounded shared cache.
  const { factoryResult, linkedModulesResult } = getFactoryCalculation(
    calculationRevision,
    calculateFactoryCalculation,
  )
  const isModifiers = activeModuleId === MODIFIERS_ID
  const isContracts = activeModuleId === CONTRACTS_ID
  const isFactoryTotal = activeModuleId === FACTORY_TOTAL_ID
  const isFocus = activeModuleId === FOCUS_DASHBOARD_ID
  const isResearch = activeModuleId === RESEARCH_MODULE_ID
  const activeModule =
    isModifiers || isContracts || isFactoryTotal || isFocus || isResearch
      ? null
      : (configuredModules.find(m => m.id === activeModuleId) ?? configuredModules[0])
  const preset =
    activeModule && activeModule.defaultPresetId
      ? (activeModule.presets.find(p => p.id === activeModule.defaultPresetId) ??
        activeModule.presets[0] ??
        null)
      : null
  const activeLinkedModuleResult = activeModule
    ? linkedModulesResult.moduleResults.get(activeModule.id)
    : undefined
  const reserveDrawsPerProductionCycle = mapReserveResources(({ recipeId, resourceId }) =>
    getReserveDrawPerProductionCycle(factoryResult.calculation.sourceResults, recipeId, resourceId),
  )
  const activeResearchLabCounts = new Map<string, number>()

  for (const line of factoryResult.allLines) {
    if (!line.recipe.gameBuildingId?.startsWith('ResearchLab')) continue

    const key = line.capacityPoolId ?? `${line.moduleId}:${line.recipe.id}`
    const active = line.capacityPoolActiveBuildings ?? line.activeBuildings

    activeResearchLabCounts.set(key, Math.max(activeResearchLabCounts.get(key) ?? 0, active))
  }

  const activeResearchLabCount = [...activeResearchLabCounts.values()].reduce(
    (total, count) => total + count,
    0,
  )
  const unityBudget = calculateUnityBudget({
    housing: activeHousingType,
    housingCount,
    additionalHousing: [{ housing: housingTypes.housingII, housingCount: housingIiCount }],
    housingCapacityMultiplier: housingCapacity.multiplier,
    unityCapacityMultiplier: unityCapacity.multiplier,
    edictLevels,
    buildingConsumption:
      activeResearchLabCount > 0
        ? [
            {
              id: 'research-lab-iv',
              name: 'Research Lab IV',
              amount:
                activeResearchLabCount
                * (getBuildingData('Research Lab IV')?.unityPerCycle ?? 0),
            },
          ]
        : [],
    buildingGeneration:
      spaceStationIncludedInFactoryTotals && currentSpaceStationLevel.unityPerCycle > 0
        ? [
            {
              id: 'space-station',
              name: `Space Station level ${currentSpaceStationLevel.level}`,
              amount: currentSpaceStationLevel.unityPerCycle,
            },
          ]
        : [],
    contracts: factoryResult.contractResults.map(result => ({
      id: result.contract.id,
      name: result.contract.name,
      importedPerCycle: result.imported,
      fixedUnityPerCycle: result.contract.unity.perProductionCycle,
      unityPer100Imported: result.contract.unity.per100Imported,
    })),
    contractsUnityCostPercent: focusBonuses.contractsUnityCost,
    settlementUnityBonusPercent: focusBonuses.unityProduction,
  })
  const activeModuleFactoryResult =
    activeModule?.includedInFactoryTotals === false && !activeLinkedModuleResult
      ? calculateFactoryTotal(
          [{ ...activeModule, includedInFactoryTotals: true }],
          {
            recyclingEfficiencyPercent,
            outputModifiers,
            shipsFuelUseMultiplier: shipsFuelUse.multiplier,
            contractsProfitMultiplier: 1 + focusBonuses.contractsProfitability / 100,
          },
        )
      : factoryResult
  const moduleResult = activeModule
    ? activeLinkedModuleResult ?? (() => {
        const lines = activeModuleFactoryResult.allLines.filter(
          line => line.moduleId === activeModule.id,
        )
        const displayDemands = getPresetResourceDemands(preset)

        for (const transfer of linkedModulesResult.transfers) {
          if (transfer.sourceModuleId !== activeModule.id) continue

          displayDemands[transfer.resourceId] = (
            displayDemands[transfer.resourceId] ?? 0
          ) + transfer.quantity
        }
        const calc = extractModuleResult(
          activeModule.id,
          activeModuleFactoryResult.calculation,
          displayDemands,
          preset?.requestedImports,
        )

        return { lines, ...calc }
      })()
    : null

  const displayedModuleLines = moduleResult?.lines.filter(
    line => !line.recipe.hiddenFromModuleView,
  ) ?? []
  const displayedRegularResults = moduleResult?.regularResults ?? []
  const displayedSourceResults = moduleResult?.sourceResults ?? []
  const displayedSinkResults = moduleResult?.sinkResults ?? []
  const displayedResourceFlows = moduleResult?.resourceFlows ?? []
  const buildingStats =
    activeModule && moduleResult
      ? calculateBuildingStats(
          displayedModuleLines,
          {
            regularResults: displayedRegularResults,
            sourceResults: displayedSourceResults,
            sinkResults: displayedSinkResults,
          },
          outputModifiers,
        )
      : { workers: 0, electricityKw: 0, computingTflops: 0 }

  const factoryStats = calculateBuildingStats(
    factoryResult.allLines,
    factoryResult.calculation,
    outputModifiers,
  )
  const linkedFactoryStats = [...linkedModulesResult.moduleResults.values()].reduce(
    (total, result) => {
      const stats = calculateBuildingStats(
        result.lines,
        {
          regularResults: result.regularResults,
          sourceResults: result.sourceResults,
          sinkResults: result.sinkResults,
        },
        outputModifiers,
      )

      return {
        computingTflops: total.computingTflops + stats.computingTflops,
        electricityKw: total.electricityKw + stats.electricityKw,
        workers: total.workers + stats.workers,
      }
    },
    { computingTflops: 0, electricityKw: 0, workers: 0 },
  )
  const linkedRegularResults = [...linkedModulesResult.moduleResults.values()]
    .flatMap(result => result.regularResults)
  const linkedSourceResults = [...linkedModulesResult.moduleResults.values()]
    .flatMap(result => result.sourceResults)
  const linkedSinkResults = [...linkedModulesResult.moduleResults.values()]
    .flatMap(result => result.sinkResults)
  const factoryWorkers = factoryStats.workers
    + linkedFactoryStats.workers
    + calculateContractWorkers(enabledContracts)
  const calculatedFactoryBuildingDiagnostics = calculateBuildingDiagnostics(
    configuredModules,
    factoryResult.flows,
    [...factoryResult.calculation.regularResults, ...linkedRegularResults],
    [...factoryResult.calculation.sourceResults, ...linkedSourceResults],
    [...factoryResult.calculation.sinkResults, ...linkedSinkResults],
  )
  const defaultResearchLine = factoryResult.allLines.find(line => (
    line.moduleId === DEFAULT_MODULE_ID
    && line.recipe.gameBuildingId?.startsWith('ResearchLab')
  ))
  const defaultModule = configuredModules.find(module => module.id === DEFAULT_MODULE_ID)
  const spaceResearchAttention = createSpaceResearchAttention({
    fallbackTarget: defaultModule && defaultResearchLine
      ? {
          module: defaultModule,
          navigationKey: defaultResearchLine.capacityPoolId
            ?? `${defaultResearchLine.moduleId}:${defaultResearchLine.recipe.id}`,
        }
      : undefined,
    mode: baseConfig.researchMode,
    runningResearchLabs: runningResearchLabCount,
    station: currentSpaceStationLevel,
    stationModule: configuredSpaceStationModules[0],
  })
  const factoryBuildingDiagnostics = spaceResearchAttention
    ? [
        ...calculatedFactoryBuildingDiagnostics.filter(
          diagnostic => diagnostic.key !== spaceResearchAttention.key,
        ),
        spaceResearchAttention,
      ]
    : calculatedFactoryBuildingDiagnostics
  const activeBuildingDiagnostics =
    activeModule?.includedInFactoryTotals === false && moduleResult
      ? calculateBuildingDiagnostics(
          [activeModule],
          moduleResult.resourceFlows,
          moduleResult.regularResults,
          moduleResult.sourceResults,
          moduleResult.sinkResults,
        )
      : factoryBuildingDiagnostics
  const calculateGenerationCapacityMw = (lines: ProductionLine[]) =>
    lines.reduce(
      (total, line) =>
        total +
        line.recipe.outputs.reduce(
          (lineTotal, output) =>
            output.resourceId === 'electricity'
              ? lineTotal +
                getRecipeOutputQuantity(line.recipe, output, outputModifiers) *
                  line.activeBuildings *
                  line.speedLevel
              : lineTotal,
          0,
        ),
      0,
    )
  const linkedModuleLines = [...linkedModulesResult.moduleResults.values()]
    .flatMap(result => result.lines)
  const factoryGenerationCapacityMw = calculateGenerationCapacityMw([
    ...factoryResult.allLines,
    ...linkedModuleLines,
  ])
  const calculateComputingCapacityTflops = (lines: ProductionLine[]) =>
    lines.reduce(
      (total, line) =>
        total +
        line.recipe.outputs.reduce(
          (lineTotal, output) =>
            output.resourceId === 'computing'
              ? lineTotal + output.quantity * line.activeBuildings * line.speedLevel
              : lineTotal,
          0,
        ),
      0,
    )
  const factoryComputingCapacityTflops = calculateComputingCapacityTflops([
    ...factoryResult.allLines,
    ...linkedModuleLines,
  ])
  const configuredComputingModuleIds = new Set(
    configuredComputingModules.map(module => module.id),
  )
  const computingCapacityTflops = calculateComputingCapacityTflops(
    factoryResult.allLines.filter(line => configuredComputingModuleIds.has(line.moduleId)),
  )
  const activeComputingCapacityTflops = activeModule && configuredComputingModuleIds.has(activeModule.id)
    ? calculateComputingCapacityTflops(
        factoryResult.allLines.filter(line => line.moduleId === activeModule.id),
    )
    : undefined
  const isActiveNuclearPlant = moduleResult?.lines.some(
    line => line.recipe.gameBuildingId === 'FastBreederReactor',
  ) ?? false
  const nuclearGenerationCapacityMw =
    isActiveNuclearPlant && moduleResult
      ? calculateGenerationCapacityMw(moduleResult.lines)
      : undefined
  const stationSections = moduleResult
    ? partitionStationLines(displayedModuleLines)
    : { input: [], unconfigured: [], content: [], export: [] }
  const grouped = moduleResult
    ? groupOrder
        .map(group => ({
          group,
          label: groupLabels[group],
          items: stationSections.content.filter(l => l.recipe.group === group),
        }))
        .filter(g => g.items.length > 0)
    : []
  const usesSpecializedAreaLayout = activeModule
    ? [MINES_MODULE_ID, RESERVES_MODULE_ID].includes(activeModule.id)
    : false
  const supplementalAreaLines =
    usesSpecializedAreaLayout && moduleResult
      ? [
          ...selectMaintenanceDepotLines(moduleResult.lines),
          ...selectStaticInfrastructureLines(stationSections.content),
        ]
      : []
  const focusedModuleTargetKey = buildingTarget && buildingTarget.moduleId === activeModule?.id
    ? buildingTarget.key
    : undefined

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-5">
      {header}

      <ModuleSwitcher
        modules={configuredModules}
        active={activeModuleId}
        modifiersId={MODIFIERS_ID}
        contractsId={CONTRACTS_ID}
        factoryTotalId={FACTORY_TOTAL_ID}
        focusId={FOCUS_DASHBOARD_ID}
        onChange={setActiveModuleId}
        researchId={RESEARCH_MODULE_ID}
        viewModuleIds={VIEW_MODULE_IDS}
      />

      {activeModule?.description && (
        <p className="text-sm text-muted-foreground">{activeModule.description}</p>
      )}

      {activeModule?.liveArea && <LiveAreaStatus state={activeModule.liveArea} />}

      {isModifiers && (
        <ModifiersView
          computingCapacityTflops={computingCapacityTflops}
          computingConfig={configuredComputingModules.length > 0
            ? syncedComputingConfigs.running
            : undefined}
          populationCapacity={configuredPopulationModules.length > 0 ? populationCapacity : undefined}
          spaceStation={spaceStationIncludedInFactoryTotals
            ? {
                station: currentSpaceStationLevel,
                logistics: rocketIiRecurringLogistics,
              }
            : undefined}
          electricityGenerationCapacityMw={factoryGenerationCapacityMw}
          maintenanceHistory={hasMaintenanceHistory ? (syncedMaintenance ?? null) : null}
          edictLevels={edictLevels}
          edictSources={edictSources}
          unityBudget={unityBudget}
          maintenanceStatueCount={maintenanceStatueCount}
          maintenanceOutputLevel={maintenanceOutputLevel}
          solarPowerLevel={solarPowerLevel}
          cropYieldLevel={cropYieldLevel}
          rainwaterYieldLevel={rainwaterYieldLevel}
          settlementWaterUseLevel={settlementWaterUseLevel}
          treeGrowthSpeedLevel={treeGrowthSpeedLevel}
          worldMineOutputLevel={worldMineOutputLevel}
          focusBonuses={focusBonuses}
        />
      )}

      {isContracts && factoryResult && (
        <ContractsView
          contracts={contracts}
          issues={contractResolution.issues}
          results={factoryResult.contractResults}
        />
      )}

      {isFactoryTotal && factoryResult && (
        <NetSummary
          flows={factoryResult.flows}
          workers={factoryWorkers}
          electricityConsumptionKw={
            factoryResult.electricityDemandMw * 1000 + linkedFactoryStats.electricityKw
          }
          electricityGenerationCapacityMw={factoryGenerationCapacityMw}
          computingConsumptionTflops={
            factoryResult.computingDemandTflops + linkedFactoryStats.computingTflops
          }
          computingGenerationCapacityTflops={factoryComputingCapacityTflops}
          populationCapacity={populationCapacity}
          unityBudget={unityBudget}
          groupByBalance
          regularResults={[
            ...factoryResult.calculation.regularResults,
            ...linkedRegularResults,
          ]}
          buildingDiagnostics={factoryBuildingDiagnostics}
          machineAllocationIssues={sharedMachineAllocation.issues}
          machineInventory={sharedMachineAllocation.inventory}
          machineZoneClaims={groundwaterPumpClaims}
          machineZones={sharedMachineAllocation.zones}
          plannedModules={configuredModules}
          onAssignMachineZone={assignMachineZone}
          onOpenBuilding={openBuilding}
        />
      )}

      {isResearch && (
        <ResearchSettings efficiency={researchEfficiency} />
      )}

      {isFocus && (
        <FocusView
          calculation={officePlanCalculation}
          plan={officePlan}
          source="planned"
        />
      )}

      {activeModule?.id === RESERVES_MODULE_ID && (
        <ReservesView
          balances={snapshot.reserves}
          drawsPerProductionCycle={reserveDrawsPerProductionCycle}
        />
      )}

      {moduleResult && activeModule && (
        <>
          {activeModule.id === MINES_MODULE_ID && (
            <MinesView
              focusedTargetKey={
                buildingTarget?.moduleId === activeModule.id ? buildingTarget.key : undefined
              }
              sourceResults={moduleResult.sourceResults}
              sinkResults={moduleResult.sinkResults}
            />
          )}

          {activeModule.id !== MINES_MODULE_ID && activeModule.id !== RESERVES_MODULE_ID && (
            <NetSummary
              flows={displayedResourceFlows}
              moduleId={activeModule.id}
              requestedImports={preset?.requestedImports}
              requestedExports={preset?.requestedExports}
              resourceTransfers={linkedModulesResult.transfers}
              workers={buildingStats.workers}
              electricityConsumptionKw={buildingStats.electricityKw}
              electricityGenerationCapacityMw={nuclearGenerationCapacityMw}
              computingConsumptionTflops={buildingStats.computingTflops}
              computingGenerationCapacityTflops={activeComputingCapacityTflops}
            />
          )}

          <StationCardGroup
            role="input"
            lines={stationSections.input}
            results={moduleResult.regularResults}
            diagnostics={activeBuildingDiagnostics}
            focusedTargetKey={focusedModuleTargetKey}
            outputModifiers={outputModifiers}
          />

          <StationCardGroup
            role="unconfigured"
            lines={stationSections.unconfigured}
            results={moduleResult.regularResults}
            diagnostics={activeBuildingDiagnostics}
            focusedTargetKey={focusedModuleTargetKey}
            outputModifiers={outputModifiers}
          />

          {activeModule.id !== MINES_MODULE_ID &&
            activeModule.id !== RESERVES_MODULE_ID &&
            grouped.map(({ group, label, items }) => {
              const containsCropFarms = items.some(item => item.recipe.inputs.some(
                input => input.weatherAdjustedFarm != null,
              ))
              const groupTargetKey =
                containsCropFarms && group === 'production'
                  ? `${activeModule.id}:crop-rebalance`
                  : `${activeModule.id}:group:${group}`

              return (
                <BuildingCardTarget
                  key={group}
                  className="space-y-2"
                  focused={buildingTarget?.key === groupTargetKey}
                  stretchChild={false}
                  targetKey={groupTargetKey}
                >
                  <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {label}
                  </h2>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {groupProductionCardLines(items).map(({ key, targetKey, lines }) => {
                      const line = lines[0]

                      if (!line) return null

                      if (group === 'source') {
                        const result = moduleResult.sourceResults.find(
                          source => source.recipe.id === line.recipe.id,
                        )

                        return result ? (
                          <BuildingCardTarget
                            key={key}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <SinkCard dataSource={line.dataSource} result={result} role="source" />
                          </BuildingCardTarget>
                        ) : null
                      }
                      if (group === 'sink') {
                        const result = moduleResult.sinkResults.find(
                          sink => sink.recipe.id === line.recipe.id,
                        )

                        return result ? (
                          <BuildingCardTarget
                            key={key}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <SinkCard dataSource={line.dataSource} result={result} role="sink" />
                          </BuildingCardTarget>
                        ) : null
                      }

                      if (lines.length > 1) {
                        return (
                          <BuildingCardTarget
                            key={key}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <SharedRecipeCard
                              dataSource={line.dataSource}
                              lines={lines}
                              results={lines.map(sharedLine =>
                                moduleResult.regularResults.find(
                                  result => result.recipe.id === sharedLine.recipe.id,
                                ),
                              )}
                              outputModifiers={outputModifiers}
                              diagnostic={activeBuildingDiagnostics.find(
                                diagnostic => diagnostic.key === targetKey,
                              )}
                            />
                          </BuildingCardTarget>
                        )
                      }

                      const result = moduleResult.regularResults.find(
                        regularResult => regularResult.recipe.id === line.recipe.id,
                      )

                      if (line.recipe.decayStorage) {
                        return (
                          <BuildingCardTarget
                            key={key}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <StorageCard
                              dataSource={line.dataSource}
                              recipe={line.recipe}
                              storage={line.recipe.decayStorage}
                              activeBuildings={line.activeBuildings}
                              currentActiveBuildings={line.currentActiveBuildings}
                              builtBuildings={line.builtBuildings}
                              constructionGhosts={line.constructionGhosts}
                              unplacedPlannedBuildings={line.unplacedPlannedBuildings}
                              operatingMode={result?.operatingMode ?? 'balanced'}
                            />
                          </BuildingCardTarget>
                        )
                      }

                      return (
                        <BuildingCardTarget
                          key={key}
                          focused={buildingTarget?.key === targetKey}
                          targetKey={targetKey}
                        >
                          <RecipeCard
                            dataSource={line.dataSource}
                            recipe={line.recipe}
                            activeBuildings={line.activeBuildings}
                            currentActiveBuildings={line.currentActiveBuildings}
                            builtBuildings={line.builtBuildings}
                            constructionGhosts={line.constructionGhosts}
                            unplacedPlannedBuildings={line.unplacedPlannedBuildings}
                            diagnostic={activeBuildingDiagnostics.find(
                              diagnostic => diagnostic.key === targetKey,
                            )}
                            supplyRatio={result?.supplyRatio ?? 1}
                            operatingMode={result?.operatingMode ?? 'balanced'}
                            speedLevel={line.speedLevel}
                            actualInputs={result?.actualInputs}
                            actualOutputs={result?.actualOutputs}
                            outputModifiers={outputModifiers}
                          />
                        </BuildingCardTarget>
                      )
                    })}
                  </div>
                </BuildingCardTarget>
              )
            })}

          {supplementalAreaLines.length > 0 && (
            <section className="space-y-2" aria-labelledby="area-buildings-heading">
              <h2
                id="area-buildings-heading"
                className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
              >
                Area buildings
              </h2>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {supplementalAreaLines.map(line => {
                  const targetKey = line.capacityPoolId ?? `${line.moduleId}:${line.recipe.id}`
                  const result = moduleResult.regularResults.find(
                    candidate => candidate.recipe.id === line.recipe.id,
                  )

                  return (
                    <BuildingCardTarget
                      key={line.recipe.id}
                      focused={buildingTarget?.key === targetKey}
                      targetKey={targetKey}
                    >
                      <RecipeCard
                        dataSource={line.dataSource}
                        recipe={line.recipe}
                        activeBuildings={line.activeBuildings}
                        currentActiveBuildings={line.currentActiveBuildings}
                        builtBuildings={line.builtBuildings}
                        constructionGhosts={line.constructionGhosts}
                        unplacedPlannedBuildings={line.unplacedPlannedBuildings}
                        diagnostic={activeBuildingDiagnostics.find(
                          candidate => candidate.key === targetKey,
                        )}
                        supplyRatio={result?.supplyRatio ?? 1}
                        operatingMode={result?.operatingMode ?? 'balanced'}
                        speedLevel={line.speedLevel}
                        actualInputs={result?.actualInputs}
                        actualOutputs={result?.actualOutputs}
                        outputModifiers={outputModifiers}
                      />
                    </BuildingCardTarget>
                  )
                })}
              </div>
            </section>
          )}

          <StationCardGroup
            role="export"
            lines={stationSections.export}
            results={moduleResult.regularResults}
            diagnostics={activeBuildingDiagnostics}
            focusedTargetKey={focusedModuleTargetKey}
            outputModifiers={outputModifiers}
          />
        </>
      )}

      {isResearch && (
        <InfiniteResearchSettings
          levels={researchLevels}
          mode={baseConfig.researchMode}
        />
      )}
    </div>
  )
}
