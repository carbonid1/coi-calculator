'use client'

import { useEffect, useMemo, useState } from 'react'

import { BuildingCardTarget, getBuildingTargetId } from './components/BuildingCardTarget'
import { ChickenFarmSettings } from './components/ChickenFarmSettings'
import { ContractsView } from './components/ContractsView'
import { GameSyncStatus } from './components/GameSyncStatus'
import { LiveAreaStatus } from './components/LiveAreaStatus'
import { MinesView } from './components/MinesView'
import { ModifiersView } from './components/ModifiersView'
import { ModuleSwitcher } from './components/ModuleSwitcher'
import { NetSummary } from './components/NetSummary'
import { NuclearModuleSections } from './components/NuclearModuleSections'
import { NuclearPlanningSettings } from './components/NuclearPlanningSettings'
import { OfficesView } from './components/OfficesView'
import { RecipeCard } from './components/RecipeCard'
import { InfiniteResearchSettings, ResearchSettings } from './components/ResearchSettings'
import { ReservesView } from './components/ReservesView'
import { SharedRecipeCard } from './components/SharedRecipeCard'
import { SinkCard } from './components/SinkCard'
import { StationCardGroup } from './components/StationCardGroup'
import { StorageCard } from './components/StorageCard'
import { buildings } from './db/buildings'
import {
  getChickenFarmLayout,
  resolvedChickenFarmSettings,
  resolvedCurrentChickenFarmSettings,
} from './db/chicken-farm'
import { resolvedCurrentComputingConfig } from './db/computing'
import { activeContracts, contracts, defaultActiveContractIds } from './db/contracts'
import { activeCropFarmGroups } from './db/crop-farming'
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
import { createComputingModule, createLegacyComputingArea } from './db/modules/computing'
import { createDefaultModule, DEFAULT_MODULE_ID } from './db/modules/default'
import {
  createChickenFarmsModule,
  createGreenhousesModule,
  CHICKEN_FARMS_MODULE_ID,
  GREENHOUSES_MODULE_ID,
} from './db/modules/farms'
import { MINES_MODULE_ID } from './db/modules/mines'
import { modules, type Module } from './db/modules/modules'
import {
  createNuclearModule,
  defaultNuclearConfig,
  NUCLEAR_MODULE_ID,
  plannedNuclearOperation,
} from './db/modules/nuclear'
import { createOfficesModule, OFFICES_MODULE_ID } from './db/modules/offices'
import {
  createLegacyPopulationArea,
  createPopulationModule,
} from './db/modules/population'
import { defaultResearchModuleConfig, RESEARCH_MODULE_ID } from './db/modules/research'
import { createReservesModule, RESERVES_MODULE_ID } from './db/modules/reserves'
import {
  createLegacySpaceStationArea,
  createSpaceStationModule,
  selectSpaceStationZone,
  shouldUseSpaceStationFallback,
  SPACE_STATION_ZONE_NAME,
} from './db/modules/space-station'
import { calculateOfficePlan, resolvedCurrentOfficePlan, resolvedOfficePlan } from './db/offices'
import { resolvePlanningBaselines } from './db/planning-baselines'
import { type RecipeGroup } from './db/recipes'
import { emptyInfiniteResearchLevels } from './db/research'
import { mapReserveResources } from './db/reserve-resources'
import { type ResourceId } from './db/resources'
import {
  emptyRocketInfrastructureConfig,
  plannedRocketInfrastructureConfig,
  type RocketInfrastructureConfig,
} from './db/rocket-infrastructure'
import { settlementRecipeIds } from './db/settlement'
import {
  DEFAULT_GROUNDWATER_CLAIM_ID,
  GREENHOUSES_GROUNDWATER_CLAIM_ID,
  groundwaterPumpClaims,
} from './db/shared-machine-claims'
import { plannedSolarPanelTargets } from './db/solar'
import {
  calculateRocketIiRecurringLogistics,
  defaultRocketIiRecurringLogistics,
  defaultSpaceStationConfig,
  defaultSpaceStationLevel,
} from './db/space-station'
import {
  emptyStaticInfrastructureConfig,
  type StaticInfrastructureConfig,
} from './db/static-infrastructure'
import { calculateUnityBudget } from './db/unity'
import {
  AREA_GHOST_SCHEMA_VERSION,
  AREA_INVENTORY_SCHEMA_VERSION,
  COMPUTING_ENTITY_SCHEMA_VERSION,
  MACHINE_INVENTORY_SCHEMA_VERSION,
  MACHINE_ZONE_SCHEMA_VERSION,
  MAINTENANCE_ENTITY_SCHEMA_VERSION,
  NAMED_AREA_ENTITY_SCHEMA_VERSION,
  ROCKET_INFRASTRUCTURE_SCHEMA_VERSION,
  TERRAIN_SORTER_SCHEMA_VERSION,
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
import {
  COMPUTING_ZONE_NAME,
  getComputingZones,
  resolveComputingEntityInventory,
} from './helpers/computing-entity-sync/computing-entity-sync'
import { calculateContractWorkers } from './helpers/contracts/calculate-contracts'
import { calculateFactoryTotal } from './helpers/factory-total/factory-total'
import { calculateGroundwaterClaimLimits } from './helpers/groundwater/calculate-groundwater-production'
import {
  createLiveAreaModules,
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
import {
  getPopulationZones,
  POPULATION_ZONE_NAME,
  resolvePopulationEntityInventory,
} from './helpers/population-entity-sync/population-entity-sync'
import { getPresetResourceDemands } from './helpers/preset-resource-demands/preset-resource-demands'
import { groupProductionCardLines } from './helpers/production-card-groups/production-card-groups'
import { getReserveDrawPerProductionCycle } from './helpers/reserves/reserves'
import {
  getCropFarmConfigurationsFromEntities,
  getSyncedChickenFarmConfigurations,
  getSyncedChickenFarmEntities,
  getSyncedComputingConfigs,
  getSyncedCropFarmConfigurations,
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
const MACHINE_ZONE_ASSIGNMENTS_KEY = 'coi-machine-zone-assignments-v1'

const legacySettingKeys = [
  'coi-active-contract-ids',
  'coi-additional-edict-levels',
  'coi-chicken-farm-settings',
  'coi-chicken-farm-settings-v3',
  'coi-clean-panels-level',
  'coi-computing-config',
  'coi-contract-modes',
  'coi-crop-yield-level',
  'coi-farming-boost-level',
  'coi-housing-count',
  'coi-maintenance-output-level',
  'coi-maintenance-reducer-level',
  'coi-maintenance-statue-count',
  'coi-module',
  'coi-planning-baselines',
  'coi-planning-baselines-v2',
  'coi-presets',
  'coi-recycling-increase-level',
  'coi-research-module-config',
  'coi-solar-panel-counts',
  'coi-solar-power-level',
  'coi-tree-growth-speed-level',
] as const

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
  const machineZoneAssignmentsStorageKey = gameState.snapshot?.saveId
    ? `${MACHINE_ZONE_ASSIGNMENTS_KEY}:${encodeURIComponent(gameState.snapshot.saveId)}`
    : null

  useEffect(() => {
    legacySettingKeys.forEach(key => window.localStorage.removeItem(key))
    window.localStorage.removeItem(MACHINE_ZONE_ASSIGNMENTS_KEY)

    if (!machineZoneAssignmentsStorageKey) {
      const animationFrame = window.requestAnimationFrame(() => {
        setMachineZoneAssignments({})
      })

      return () => window.cancelAnimationFrame(animationFrame)
    }

    const animationFrame = window.requestAnimationFrame(() => {
      try {
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
            groundwaterPumpClaims.some(claim => claim.id === claimId)
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
  }, [machineZoneAssignmentsStorageKey])

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

  const openBuilding = (diagnostic: BuildingDiagnostic) => {
    setBuildingTarget({ key: diagnostic.key, moduleId: diagnostic.moduleId })
    setActiveModuleId(diagnostic.moduleId)
  }

  const sharedMachineAllocation =
    gameState.snapshot && gameState.snapshot.schemaVersion >= MACHINE_INVENTORY_SCHEMA_VERSION
      ? allocateSharedMachines(
          gameState.snapshot.machines,
          groundwaterPumpClaims,
          machineZoneAssignments,
          gameState.snapshot.schemaVersion >= MACHINE_ZONE_SCHEMA_VERSION,
        )
      : null
  const greenhousesGroundwaterResolution =
    sharedMachineAllocation?.claims[GREENHOUSES_GROUNDWATER_CLAIM_ID]
  const defaultGroundwaterResolution = sharedMachineAllocation?.claims[DEFAULT_GROUNDWATER_CLAIM_ID]
  const groundwaterClaimLimits = calculateGroundwaterClaimLimits(
    [
      ...(greenhousesGroundwaterResolution
        ? [
            {
              claimId: GREENHOUSES_GROUNDWATER_CLAIM_ID,
              projectedPumpCount: Math.max(
                greenhousesGroundwaterResolution.running,
                greenhousesGroundwaterResolution.claim.target,
              ),
              machines: [
                ...greenhousesGroundwaterResolution.machines,
                ...greenhousesGroundwaterResolution.suggestedMachines,
              ],
            },
          ]
        : []),
      ...(defaultGroundwaterResolution
        ? [
            {
              claimId: DEFAULT_GROUNDWATER_CLAIM_ID,
              projectedPumpCount: defaultGroundwaterResolution.running,
              machines: [
                ...defaultGroundwaterResolution.machines,
                ...defaultGroundwaterResolution.suggestedMachines,
              ],
            },
          ]
        : []),
    ],
    gameState.snapshot?.groundwater ?? null,
  )
  const greenhousesGroundwaterConstraint = groundwaterClaimLimits[GREENHOUSES_GROUNDWATER_CLAIM_ID]
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
  const productionEntities = gameState.snapshot?.productionEntities ?? []
  const hasExactArea = (name: string) =>
    Boolean(
      gameState.snapshot &&
      gameState.snapshot.schemaVersion >= AREA_INVENTORY_SCHEMA_VERSION &&
      gameState.snapshot.logisticsZones.some(zone => zone.name === name),
    )
  const spaceStationZone = selectSpaceStationZone(
    gameState.snapshot?.logisticsZones ?? [],
    productionEntities,
  )
  const usesSpaceStationArea = Boolean(spaceStationZone)
  const hasAreaBuildingInventory = Boolean(
    gameState.snapshot &&
    gameState.snapshot.schemaVersion >= AREA_INVENTORY_SCHEMA_VERSION &&
    gameState.snapshot.productionEntities,
  )
  const hasMaintenanceDepotInventory = Boolean(
    gameState.snapshot &&
    gameState.snapshot.schemaVersion >= MAINTENANCE_ENTITY_SCHEMA_VERSION &&
    gameState.snapshot.productionEntities,
  )
  const spaceStationAreaEntities = spaceStationZone
    ? productionEntities.filter(entity => (
        entity.zones.some(zone => zone.id === spaceStationZone.id)
      ))
    : []
  const spaceStationAreaCounts = usesSpaceStationArea
    ? resolveAreaBuildingCounts(spaceStationAreaEntities, SPACE_STATION_ZONE_NAME)
    : {}
  const stationPartsAssemblyCount =
    usesSpaceStationArea &&
    (gameState.snapshot?.schemaVersion ?? 0) >= NAMED_AREA_ENTITY_SCHEMA_VERSION
      ? resolveAreaRecipeBuildingCount(
          spaceStationAreaEntities,
          SPACE_STATION_ZONE_NAME,
          'AssemblyRoboticT2',
          'StationPartsAssembly',
        )
      : undefined

  if (gameState.snapshot) {
    for (const id of syncedInfrastructureBuildingIds) {
      const count = gameState.snapshot.buildings[id]

      staticInfrastructureBuiltConfig[id] = count.built
      staticInfrastructureRunningConfig[id] = count.running
    }

    if (gameState.snapshot.schemaVersion >= ROCKET_INFRASTRUCTURE_SCHEMA_VERSION) {
      for (const id of syncedRocketBuildingIds) {
        const count = usesSpaceStationArea
          ? (spaceStationAreaCounts[id] ?? { built: 0, running: 0 })
          : gameState.snapshot.buildings[id]

        rocketInfrastructureBuiltConfig[id] = count.built
        rocketInfrastructureRunningConfig[id] = count.running
      }
    }

    staticInfrastructureBuiltConfig.vehicles = gameState.snapshot.vehicles.workersAssigned
    staticInfrastructureRunningConfig.vehicles = gameState.snapshot.vehicles.workersAssigned
  }

  const syncedSpaceStation = gameState.snapshot?.spaceStation
  const spaceStationConfig = syncedSpaceStation
    ? {
        ...defaultSpaceStationConfig,
        currentLevel: syncedSpaceStation.currentLevel,
        highestLevelAchieved: syncedSpaceStation.highestLevelAchieved,
      }
    : defaultSpaceStationConfig
  const planningBaselines = resolvePlanningBaselines(gameState.snapshot)
  const syncedHistory = gameState.snapshot?.history
  const syncedMaintenance = syncedHistory?.maintenance
  const maintenanceDemand = {
    maintenanceI: syncedMaintenance?.maintenanceI.averagePerCycle ?? 0,
    maintenanceII: syncedMaintenance?.maintenanceII.averagePerCycle ?? 0,
    maintenanceIII: syncedMaintenance?.maintenanceIII.averagePerCycle ?? 0,
  }
  const hasOperatingHistory = Boolean(
    syncedHistory &&
    (syncedHistory.hydrogenFuel.total.sampleMonths > 0 ||
      syncedHistory.electricityGeneration.byType.some(generation => generation.sampleMonths > 0)),
  )
  const hasMaintenanceHistory = Boolean(
    syncedMaintenance && Object.values(syncedMaintenance).some(average => average.sampleMonths > 0),
  )
  const syncedResearchLevels = gameState.snapshot?.research
  const researchLevels = syncedResearchLevels ?? emptyInfiniteResearchLevels
  const rocketIiRecurringLogistics = calculateRocketIiRecurringLogistics(
    defaultSpaceStationLevel,
    researchLevels.rocketsCapacity,
  )
  const officePlan = resolvedOfficePlan.value
  const officePlanCalculation = calculateOfficePlan(officePlan, researchLevels.focusPoints)
  const focusBonuses = officePlanCalculation.bonuses
  const syncedEdictStates = gameState.snapshot?.edicts
  const resolvedEdictLevels = mapEdictValues(edictId =>
    resolveEdictLevel(edictId, syncedEdictStates?.[edictId].activeLevel),
  )
  const edictLevels: Record<EdictId, EdictLevel> = mapEdictValues(
    edictId => resolvedEdictLevels[edictId].value,
  )
  const edictSources = mapEdictValues(edictId => resolvedEdictLevels[edictId].source)
  const activeContractIds = defaultActiveContractIds
  const researchModuleConfig = defaultResearchModuleConfig
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
  const globalSyncedComputingConfigs = gameState.snapshot?.computing
    ? getSyncedComputingConfigs(gameState.snapshot.computing)
    : null
  const hasComputingEntityInventory = Boolean(
    gameState.snapshot &&
    gameState.snapshot.schemaVersion >= COMPUTING_ENTITY_SCHEMA_VERSION &&
    gameState.snapshot.productionEntities,
  )
  const syncedComputingConfigs =
    hasComputingEntityInventory
      ? resolveComputingEntityInventory(productionEntities)
      : globalSyncedComputingConfigs
  const computingBuiltConfig = syncedComputingConfigs?.built ?? resolvedCurrentComputingConfig.value
  const computingRunningConfig =
    syncedComputingConfigs?.running ?? resolvedCurrentComputingConfig.value
  const computingCurrentSource = syncedComputingConfigs
    ? ('synced' as const)
    : resolvedCurrentComputingConfig.source
  const currentChickenConfigurations = gameState.snapshot?.chickenFarms
    ? getSyncedChickenFarmConfigurations(gameState.snapshot.chickenFarms)
    : null
  const currentChickenFarmEntities = gameState.snapshot?.chickenFarms
    ? getSyncedChickenFarmEntities(gameState.snapshot.chickenFarms)
    : null
  const allCurrentCropFarmEntities = gameState.snapshot?.cropFarms
    ? getSyncedCropFarmEntities(gameState.snapshot.cropFarms)
    : null
  const usesGreenhousesArea = hasExactArea('Greenhouses')
  const currentCropFarmEntities = usesGreenhousesArea
    ? (allCurrentCropFarmEntities?.filter(entity =>
        entity.zones?.some(zone => zone.name === 'Greenhouses'),
      ) ?? [])
    : allCurrentCropFarmEntities
  const globalCropFarmConfigurations = gameState.snapshot?.cropFarms
    ? getSyncedCropFarmConfigurations(gameState.snapshot.cropFarms)
    : null
  const currentCropFarmConfigurations = usesGreenhousesArea
    ? getCropFarmConfigurationsFromEntities(currentCropFarmEntities ?? [])
    : globalCropFarmConfigurations
  const plannedChickenFarmLayout = resolvedChickenFarmSettings.value
  const ownedChickenFarmEntities =
    currentChickenFarmEntities?.filter(entity =>
      entity.zones.some(zone => zone.name === 'Chicken Farms'),
    ) ?? []
  const desiredChickenConfigurations =
    currentChickenConfigurations?.filter(
      configuration => configuration.slaughtering === plannedChickenFarmLayout.slaughtering,
    ) ?? []
  const desiredRunningChickenFarms = currentChickenFarmEntities?.length
    ? ownedChickenFarmEntities.filter(
        entity => entity.running && entity.slaughtering === plannedChickenFarmLayout.slaughtering,
      ).length
    : desiredChickenConfigurations.reduce(
        (total, configuration) => total + configuration.running,
        0,
      )
  const desiredRunningChickens = currentChickenFarmEntities?.length
    ? ownedChickenFarmEntities
        .filter(
          entity => entity.running && entity.slaughtering === plannedChickenFarmLayout.slaughtering,
        )
        .reduce((total, entity) => total + entity.chickens, 0)
    : desiredChickenConfigurations.reduce(
        (total, configuration) => total + configuration.runningChickens,
        0,
      )
  const plannedChickenFarmCount = getChickenFarmLayout(
    plannedChickenFarmLayout.totalChickenCount,
  ).farmCount
  const chickenPlanReached = Boolean(
    currentChickenConfigurations &&
    desiredRunningChickenFarms >= plannedChickenFarmCount &&
    desiredRunningChickens >= plannedChickenFarmLayout.totalChickenCount,
  )
  const chickenFarmSettings = chickenPlanReached
    ? {
        totalChickenCount: desiredRunningChickens,
        slaughtering: plannedChickenFarmLayout.slaughtering,
      }
    : plannedChickenFarmLayout
  const hasPopulationEntityInventory = Boolean(
    gameState.snapshot &&
    gameState.snapshot.schemaVersion >= NAMED_AREA_ENTITY_SCHEMA_VERSION &&
    gameState.snapshot.productionEntities,
  )

  const createConfiguredSpaceStationModule = (generatedArea?: Module) => (
    createSpaceStationModule(
      spaceStationConfig,
      rocketInfrastructureBuiltConfig,
      plannedRocketInfrastructureConfig,
      {
        rocketRunningConfig: rocketInfrastructureRunningConfig,
        rocketSource:
          (gameState.snapshot?.schemaVersion ?? 0) >= ROCKET_INFRASTRUCTURE_SCHEMA_VERSION
            ? 'synced'
            : 'modeled',
        stationPartsAssembly: stationPartsAssemblyCount
          ? { ...stationPartsAssemblyCount, source: 'synced' }
          : undefined,
        stationSource: syncedSpaceStation ? 'synced' : 'modeled',
      },
      generatedArea,
    )
  )

  const configureModules = () =>
    modules.map(module => {
      if (module.id === DEFAULT_MODULE_ID) {
        return createDefaultModule(
          defaultGroundwaterResolution,
          defaultGroundwaterConstraint,
          rocketIiRecurringLogistics,
        )
      }

      if (module.id === CHICKEN_FARMS_MODULE_ID) {
        return createChickenFarmsModule(
          resolvedChickenFarmSettings.value,
          resolvedCurrentChickenFarmSettings.value,
          resolvedChickenFarmSettings.source,
          currentChickenConfigurations ? 'synced' : resolvedCurrentChickenFarmSettings.source,
          currentChickenConfigurations ?? undefined,
          undefined,
          currentChickenFarmEntities?.length ? currentChickenFarmEntities : undefined,
        )
      }

      if (module.id === GREENHOUSES_MODULE_ID) {
        return currentCropFarmConfigurations
          ? createGreenhousesModule(
              activeCropFarmGroups,
              currentCropFarmConfigurations,
              'synced',
              undefined,
              greenhousesGroundwaterResolution,
              currentCropFarmEntities ?? undefined,
              greenhousesGroundwaterConstraint,
            )
          : createGreenhousesModule()
      }

      if (module.id === NUCLEAR_MODULE_ID) {
        return createNuclearModule(
          defaultNuclearConfig,
          planningBaselines,
          plannedNuclearOperation,
          gameState.snapshot?.productionEntities ?? undefined,
        )
      }

      if (module.id === OFFICES_MODULE_ID) {
        return createOfficesModule(
          officePlan,
          resolvedCurrentOfficePlan.value,
          resolvedOfficePlan.source,
          resolvedCurrentOfficePlan.source,
        )
      }

      if (module.id === RESERVES_MODULE_ID) {
        return createReservesModule(gameState.snapshot?.reserves ?? null)
      }

      return module
    })
  const configuredAreaModules = [
    ...configureModules(),
    ...(shouldUseSpaceStationFallback(gameState.snapshot?.schemaVersion)
      ? [createConfiguredSpaceStationModule()]
      : []),
  ]
  const generatedLiveAreaModules =
    (gameState.snapshot?.schemaVersion ?? 0) >= AREA_GHOST_SCHEMA_VERSION
      ? createLiveAreaModules(
          gameState.snapshot?.logisticsZones ?? [],
          gameState.snapshot?.areaEntities ?? [],
          configuredAreaModules,
          undefined,
          (gameState.snapshot?.schemaVersion ?? 0) >= TERRAIN_SORTER_SCHEMA_VERSION
            ? gameState.snapshot?.mineTowers
            : undefined,
        )
      : []
  const terrainSorterEntityIds =
    (gameState.snapshot?.schemaVersion ?? 0) >= TERRAIN_SORTER_SCHEMA_VERSION
      ? getModeledTerrainSorterEntityIds(
          gameState.snapshot?.areaEntities ?? [],
          gameState.snapshot?.mineTowers ?? [],
          generatedLiveAreaModules,
        )
      : new Set<number>()
  const generatedLiveAreaZoneIds = new Set(
    generatedLiveAreaModules.flatMap(module => (
      module.liveArea ? [module.liveArea.zoneId] : []
    )),
  )
  const legacyComputingAreas =
    hasComputingEntityInventory
      ? getComputingZones(productionEntities)
          .filter(zone => !generatedLiveAreaZoneIds.has(zone.id))
          .map(zone => createLegacyComputingArea(zone, productionEntities))
      : []
  const legacyPopulationAreas =
    hasPopulationEntityInventory
      ? getPopulationZones(productionEntities)
          .filter(zone => !generatedLiveAreaZoneIds.has(zone.id))
          .map(zone => createLegacyPopulationArea(zone, productionEntities))
      : []
  const legacySpaceStationAreas =
    hasAreaBuildingInventory
      ? (gameState.snapshot?.logisticsZones ?? [])
          .filter(zone => zone.name === SPACE_STATION_ZONE_NAME)
          .filter(zone => !generatedLiveAreaZoneIds.has(zone.id))
          .map(zone => createLegacySpaceStationArea(zone, productionEntities))
      : []
  const configuredLiveAreaModules = [
    ...generatedLiveAreaModules,
    ...legacyComputingAreas,
    ...legacyPopulationAreas,
    ...legacySpaceStationAreas,
  ].map(module => {
    if (!module.liveArea) return module

    if (
      module.name === SPACE_STATION_ZONE_NAME
      && module.liveArea.zoneId === spaceStationZone?.id
    ) {
      return createConfiguredSpaceStationModule(module)
    }

    if (module.name === POPULATION_ZONE_NAME && hasPopulationEntityInventory) {
      return createPopulationModule(
        resolvePopulationEntityInventory(productionEntities, module.liveArea.zoneId),
        module,
        housingCapacityLevel,
      )
    }

    if (module.name !== COMPUTING_ZONE_NAME) return module

    const areaComputingConfigs =
      hasComputingEntityInventory
        ? resolveComputingEntityInventory(
            productionEntities,
            module.liveArea.zoneId,
          )
        : syncedComputingConfigs

    return createComputingModule(
      areaComputingConfigs?.built ?? computingBuiltConfig,
      areaComputingConfigs?.running ?? computingRunningConfig,
      areaComputingConfigs ? 'synced' : computingCurrentSource,
      module,
    )
  })
  const modulesWithLiveAreas = [
    ...transferTerrainMineOwnership(configuredAreaModules, configuredLiveAreaModules),
    ...configuredLiveAreaModules,
  ]
  const maintenanceAssignments = resolveMaintenanceDepotModuleAssignments({
    defaultModuleId: DEFAULT_MODULE_ID,
    demand: maintenanceDemand,
    modules: modulesWithLiveAreas,
    productionEntities: hasMaintenanceDepotInventory ? productionEntities : undefined,
  })
  const configuredModulesWithoutSolar = modulesWithLiveAreas.map(module => {
    const assignment = maintenanceAssignments[module.id]

    return assignment
      ? attachMaintenanceDepotsToModule(
          module,
          assignment,
          hasMaintenanceDepotInventory ? 'synced' : 'modeled',
        )
      : module
  })
  const solarAssignments = resolveSolarPanelModuleAssignments({
    defaultModuleId: DEFAULT_MODULE_ID,
    fallbackInventory: {
      builtCounts: {
        standard: gameState.snapshot?.buildings.solarPanel?.built ?? 0,
        mono: gameState.snapshot?.buildings.solarPanelMono?.built ?? 0,
      },
      runningCounts: {
        standard: gameState.snapshot?.buildings.solarPanel?.running ?? 0,
        mono: gameState.snapshot?.buildings.solarPanelMono?.running ?? 0,
      },
    },
    modules: configuredModulesWithoutSolar,
    plannedTargets: plannedSolarPanelTargets,
    productionEntities: hasAreaBuildingInventory ? productionEntities : undefined,
  })
  const configuredBaseModules = configuredModulesWithoutSolar.map(module => {
    const solarAssignment = solarAssignments[module.id]

    if (!solarAssignment) return module

    return attachSolarPanelsToModule(
      module,
      solarAssignment.builtCounts,
      solarAssignment.runningCounts,
      solarAssignment.plannedTargets,
      gameState.snapshot ? 'synced' : 'modeled',
    )
  })
  const staticInfrastructureAssignments = resolveStaticInfrastructureModuleAssignments({
    areaEntities:
      (gameState.snapshot?.schemaVersion ?? 0) >= AREA_GHOST_SCHEMA_VERSION
        ? gameState.snapshot?.areaEntities
        : undefined,
    builtConfig: staticInfrastructureBuiltConfig,
    defaultModuleId: DEFAULT_MODULE_ID,
    modules: configuredBaseModules,
    managedEntityIds: terrainSorterEntityIds,
    productionEntities: hasAreaBuildingInventory ? productionEntities : undefined,
    runningConfig: staticInfrastructureRunningConfig,
  })
  const configuredModules = configuredBaseModules.map(module => {
    const assignment = staticInfrastructureAssignments[module.id]

    return assignment
      ? attachStaticInfrastructureToModule(
          module,
          assignment,
          gameState.snapshot ? 'synced' : 'modeled',
        )
      : module
  })
  const configuredComputingModules = configuredModules.filter(module => (
    module.name === COMPUTING_ZONE_NAME && module.liveArea
  ))
  const configuredPopulationModules = configuredModules.filter(module => (
    module.name === POPULATION_ZONE_NAME && module.liveArea
  ))
  const configuredSpaceStationModules = configuredModules.filter(module => (
    module.name === SPACE_STATION_ZONE_NAME && module.includedInFactoryTotals !== false
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
  ))
  const researchEfficiency = calculateResearchEfficiency({
    edictLevel: edictLevels.researchEfficiency,
    focusBonusPercent: focusBonuses.researchEfficiency,
    population: populationCapacity,
    stationBonusPercent: spaceStationIncludedInFactoryTotals
      ? defaultSpaceStationLevel.researchEfficiencyBonusPercent
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
  const enabledContracts = activeContracts
  const resolvedModuleResourceLinks = resolveModuleResourceLinks(
    configuredModules,
    moduleResourceLinkDefinitions,
  )
  const calculationRevision = `${gameState.snapshot?.exportedAtUtc ?? 'modeled'}:${JSON.stringify(
    machineZoneAssignments,
  )}`
  const { factoryResult, linkedModulesResult } = useMemo(() => {
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
    // Every calculation input above is a pure derivation of these two state values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculationRevision])
  const isModifiers = activeModuleId === MODIFIERS_ID
  const isContracts = activeModuleId === CONTRACTS_ID
  const isFactoryTotal = activeModuleId === FACTORY_TOTAL_ID
  const activeModule =
    isModifiers || isContracts || isFactoryTotal
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
  const unityBudget = calculateUnityBudget({
    housing: activeHousingType,
    housingCount,
    additionalHousing: [{ housing: housingTypes.housingII, housingCount: housingIiCount }],
    housingCapacityMultiplier: housingCapacity.multiplier,
    unityCapacityMultiplier: unityCapacity.multiplier,
    edictLevels,
    buildingConsumption:
      researchModuleConfig.activeResearchLabIvCount > 0
        ? [
            {
              id: 'research-lab-iv',
              name: 'Research Lab IV',
              amount:
                researchModuleConfig.activeResearchLabIvCount *
                (buildings['Research Lab IV']?.unityPerCycle ?? 0),
            },
          ]
        : [],
    buildingGeneration:
      spaceStationIncludedInFactoryTotals && defaultSpaceStationLevel.unityPerCycle > 0
        ? [
            {
              id: 'space-station',
              name: `Space Station level ${defaultSpaceStationLevel.level}`,
              amount: defaultSpaceStationLevel.unityPerCycle,
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
  const factoryBuildingDiagnostics = calculateBuildingDiagnostics(
    configuredModules,
    factoryResult.flows,
    [...factoryResult.calculation.regularResults, ...linkedRegularResults],
    [...factoryResult.calculation.sourceResults, ...linkedSourceResults],
    [...factoryResult.calculation.sinkResults, ...linkedSinkResults],
  )
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
  const nuclearGenerationCapacityMw =
    activeModule?.id === NUCLEAR_MODULE_ID && moduleResult
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
    ? [MINES_MODULE_ID, NUCLEAR_MODULE_ID, RESERVES_MODULE_ID].includes(activeModule.id)
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Captain of Industry</h1>
          <p className="text-sm text-muted-foreground">Production Chain Calculator</p>
        </div>
        <GameSyncStatus
          isFresh={gameState.isFresh}
          snapshot={gameState.snapshot}
          source={gameState.source}
          status={gameState.status}
        />
      </div>

      <ModuleSwitcher
        modules={configuredModules}
        active={activeModuleId}
        modifiersId={MODIFIERS_ID}
        contractsId={CONTRACTS_ID}
        factoryTotalId={FACTORY_TOTAL_ID}
        onChange={setActiveModuleId}
      />

      {activeModule?.description && (
        <p className="text-sm text-muted-foreground">{activeModule.description}</p>
      )}

      {activeModule?.liveArea && <LiveAreaStatus state={activeModule.liveArea} />}

      {isModifiers && (
        <ModifiersView
          computingCapacityTflops={computingCapacityTflops}
          computingConfig={configuredComputingModules.length > 0 ? computingRunningConfig : undefined}
          populationCapacity={configuredPopulationModules.length > 0 ? populationCapacity : undefined}
          spaceStation={configuredSpaceStationModules.length > 0
            ? {
                station: defaultSpaceStationLevel,
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
          activeContractIds={activeContractIds}
          contracts={contracts}
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
          machineAllocationIssues={sharedMachineAllocation?.issues}
          machineInventory={sharedMachineAllocation?.inventory}
          machineZoneClaims={groundwaterPumpClaims}
          machineZones={sharedMachineAllocation?.zones}
          plannedModules={configuredModules}
          onAssignMachineZone={assignMachineZone}
          onOpenBuilding={openBuilding}
        />
      )}

      {activeModule?.id === NUCLEAR_MODULE_ID && syncedHistory && hasOperatingHistory && (
        <NuclearPlanningSettings history={syncedHistory} values={planningBaselines} />
      )}

      {activeModule?.id === RESEARCH_MODULE_ID && (
        <ResearchSettings config={researchModuleConfig} efficiency={researchEfficiency} />
      )}

      {activeModule?.id === OFFICES_MODULE_ID && (
        <OfficesView
          calculation={officePlanCalculation}
          focusResearchLevel={researchLevels.focusPoints}
          plan={officePlan}
          source={resolvedOfficePlan.source}
        />
      )}

      {activeModule?.id === CHICKEN_FARMS_MODULE_ID && (
        <ChickenFarmSettings settings={chickenFarmSettings} />
      )}

      {activeModule?.id === RESERVES_MODULE_ID && (
        <ReservesView
          balances={gameState.snapshot?.reserves ?? null}
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

          {activeModule.id === NUCLEAR_MODULE_ID ? (
            <NuclearModuleSections
              focusedTargetKey={
                buildingTarget?.moduleId === activeModule.id ? buildingTarget.key : undefined
              }
              lines={moduleResult.lines}
              regularResults={moduleResult.regularResults}
              sourceResults={moduleResult.sourceResults}
              sinkResults={moduleResult.sinkResults}
              diagnostics={activeBuildingDiagnostics}
              outputModifiers={outputModifiers}
            />
          ) : (
            activeModule.id !== MINES_MODULE_ID &&
            activeModule.id !== RESERVES_MODULE_ID &&
            grouped.map(({ group, label, items }) => {
              const groupTargetKey =
                activeModule.id === GREENHOUSES_MODULE_ID && group === 'production'
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
            })
          )}

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

      {activeModule?.id === RESEARCH_MODULE_ID && (
        <InfiniteResearchSettings levels={researchLevels} synced={Boolean(syncedResearchLevels)} />
      )}
    </div>
  )
}
