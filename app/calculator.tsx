'use client'

import { Button, Toaster, toast } from '@carbonid1/design-system'
import { useEffect, useMemo, useRef, useState } from 'react'


import { BuildingCardTarget, getBuildingTargetId } from './components/BuildingCardTarget'
import { ContractsView } from './components/ContractsView'
import { FactoryStartup } from './components/FactoryStartup'
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
import { ResourceNavigationProvider } from './components/ResourceNavigation'
import { ResourceProductsProvider } from './components/ResourceProducts'
import { ResourceSupplyView } from './components/ResourceSupplyView'
import { SharedRecipeCard } from './components/SharedRecipeCard'
import { SinkCard } from './components/SinkCard'
import { StationCardGroup } from './components/StationCardGroup'
import { WaterPlanningView } from './components/WaterPlanningView'
import { WorldMinesView } from './components/WorldMinesView'
import { getBuildingData } from './db/buildings'
import { baseConfig } from './db/config'
import { getHousingTypes } from './db/housing'
import { selectMaintenanceDepotLines } from './db/modules/area-maintenance'
import {
  partitionStationLines,
  selectStaticInfrastructureLines,
} from './db/modules/area-static-infrastructure'
import { DEFAULT_MODULE_ID } from './db/modules/default'
import { MINES_MODULE_ID } from './db/modules/mines'
import { FOCUS_DASHBOARD_ID } from './db/modules/offices'
import { RESEARCH_MODULE_ID } from './db/modules/research'
import { RESERVES_MODULE_ID } from './db/modules/reserves'
import { type RecipeGroup } from './db/recipes'
import { mapReserveResources } from './db/reserve-resources'
import { type ResourceId } from './db/resources'
import { calculateUnityBudget } from './db/unity'
import {
  calculateBuildingDiagnostics,
  type BuildingDiagnostic,
} from './helpers/building-diagnostics/building-diagnostics'
import { calculateBuildingStats } from './helpers/building-stats/building-stats'
import { type ProductionLine } from './helpers/calculate/calculate'
import {
  deriveCalculatorModel,
} from './helpers/calculator-model/derive-calculator-model'
import { calculateContractWorkers } from './helpers/contracts/calculate-contracts'
import { calculateFactoryTotal } from './helpers/factory-total/factory-total'
import { type MachineZoneAssignments } from './helpers/machine-allocation/machine-allocation'
import { getRecipeOutputQuantity } from './helpers/modifiers/recipe-output'
import { extractModuleResult } from './helpers/module-result/module-result'
import { getPresetResourceDemands } from './helpers/preset-resource-demands/preset-resource-demands'
import { groupProductionCardLines, hasBuildingInventory } from './helpers/production-card-groups/production-card-groups'
import { getReserveDrawPerProductionCycle } from './helpers/reserves/reserves'
import { createSpaceResearchAttention } from './helpers/space-research-attention/space-research-attention'
import { getWorldMinePreferencesStorageKey } from './helpers/world-mines/world-mine-planning'
import { useContractPreferences } from './hooks/use-contract-preferences'
import { useFactoryCalculation } from './hooks/use-factory-calculation'
import { type GameStateResult, useGameState } from './hooks/use-game-state'
import { useKeepReadyPreferences } from './hooks/use-keep-ready-preferences'
import { useOperatingPreferences } from './hooks/use-operating-preferences'
import { useResourcePriorities } from './hooks/use-resource-priorities'

const groupLabels: Record<RecipeGroup, string> = {
  source: 'Sources',
  electricity: 'Electricity',
  production: 'Production',
  waste: 'Waste processing',
  sink: 'Sinks',
}

const groupOrder: RecipeGroup[] = ['source', 'electricity', 'production', 'waste', 'sink']

const FACTORY_TOTAL_ID = 'factory-total'
const RESOURCE_SUPPLY_ID = 'resource-supply'
const CONTRACTS_ID = 'contracts'
const MODIFIERS_ID = 'modifiers'
const VIEW_MODULE_IDS = [MINES_MODULE_ID, RESERVES_MODULE_ID] as const
const MACHINE_ZONE_ASSIGNMENTS_KEY = 'coi-machine-zone-assignments-v1'

interface Props {
  initialGameState: GameStateResult
  calculationVersion: string
}

export const Calculator: React.FC<Props> = ({ initialGameState, calculationVersion }) => {
  const gameState = useGameState(initialGameState)
  const resourcePriorities = useResourcePriorities(gameState.snapshot?.saveId)
  const contractPreferences = useContractPreferences(gameState.snapshot?.saveId)
  const worldMinePreferences = useOperatingPreferences(getWorldMinePreferencesStorageKey(gameState.snapshot?.saveId))
  const { preferences: keepReadyPreferences, canSave: canSaveKeepReady, setKeepReady } = useKeepReadyPreferences(gameState.snapshot?.saveId)
  const changeKeepReady = canSaveKeepReady ? (diagnostic: BuildingDiagnostic, enabled: boolean) => {
    if (!setKeepReady(diagnostic.key, enabled)) {
      toast.error('Could not save Keep ready. Check browser storage and try again.')
      return
    }

    const toastId = `keep-ready:${diagnostic.key}`

    toast(enabled ? 'Keep ready enabled' : 'Pause suggestions restored', {
      id: toastId,
      description: `${diagnostic.recipeName} В· ${diagnostic.moduleName}`,
      action: {
        label: 'Undo',
        onClick: () => {
          if (setKeepReady(diagnostic.key, diagnostic.keepReady === true)) {
            toast.dismiss(toastId)
          } else {
            toast.error('Could not undo Keep ready. Check browser storage and try again.')
          }
        },
      },
    })
  } : undefined
  const [activeModuleId, setActiveModuleId] = useState(FACTORY_TOTAL_ID)
  const [supplyResourceId, setSupplyResourceId] = useState<ResourceId>('carbonDioxide')
  const [supplyOriginId, setSupplyOriginId] = useState<string | null>(null)
  const factorySummaryRef = useRef<HTMLHeadingElement>(null)
  const focusFactorySummary = useRef(false)
  const [machineZoneAssignments, setMachineZoneAssignments] = useState<MachineZoneAssignments>({})
  const [loadedAssignmentsKey, setLoadedAssignmentsKey] = useState<string | null>(null)
  const [buildingTarget, setBuildingTarget] = useState<{
    key: string
    moduleId: string
  } | null>(null)
  const latestSnapshot = gameState.snapshot
  const latestRevision = gameState.revision
  // Derivation is cheap; the factory solve behind it is not, so it runs off the
  // main thread and the previous model stays on screen until it settles.
  const latestModel = useMemo(() => (
    latestSnapshot
      ? deriveCalculatorModel({
          contractFullThrottlePreferences: contractPreferences.preferences,
          worldMineFullThrottlePreferences: worldMinePreferences.preferences,
          machineZoneAssignments,
          resourcePriorityOverrides: resourcePriorities.overrides,
          revision: latestRevision,
          snapshot: latestSnapshot,
        })
      : null
  ), [latestRevision, latestSnapshot, machineZoneAssignments, resourcePriorities.overrides, contractPreferences.preferences, worldMinePreferences.preferences])
  const groundwaterPumpClaimIds = (latestModel?.groundwaterPumpClaims ?? [])
    .map(claim => claim.id)
    .join('|')
  const machineZoneAssignmentsStorageKey = gameState.snapshot?.saveId
    ? `${MACHINE_ZONE_ASSIGNMENTS_KEY}:${encodeURIComponent(gameState.snapshot.saveId)}`
    : null
  const { failed, retry, settled } = useFactoryCalculation(
    loadedAssignmentsKey === machineZoneAssignmentsStorageKey && resourcePriorities.ready && contractPreferences.ready && worldMinePreferences.ready ? latestModel : null,
    calculationVersion,
  )

  useEffect(() => {
    if (!machineZoneAssignmentsStorageKey) {
      const animationFrame = window.requestAnimationFrame(() => {
        setMachineZoneAssignments({})
        setLoadedAssignmentsKey(null)
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
        setMachineZoneAssignments({})
      } finally {
        setLoadedAssignmentsKey(machineZoneAssignmentsStorageKey)
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

    const scheduled: { clearTimer?: number } = {}
    const animationFrame = window.requestAnimationFrame(() => {
      const target = document.getElementById(getBuildingTargetId(buildingTarget.key))

      if (!target) {
        setBuildingTarget(null)
        return
      }

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
      target.focus({ preventScroll: true })
      scheduled.clearTimer = window.setTimeout(() => {
        setBuildingTarget(current => (current === buildingTarget ? null : current))
      }, 1_800)
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
      if (scheduled.clearTimer !== undefined) window.clearTimeout(scheduled.clearTimer)
    }
  }, [activeModuleId, buildingTarget])

  useEffect(() => {
    if (activeModuleId !== FACTORY_TOTAL_ID || !focusFactorySummary.current) return

    factorySummaryRef.current?.scrollIntoView({ block: 'start' })
    factorySummaryRef.current?.focus({ preventScroll: true })
    focusFactorySummary.current = false
  }, [activeModuleId])

  const calculationStatus = ((): 'loading' | 'updating' | 'error' | 'ready' => {
    if (failed) return 'error'
    if (settled?.isStale) return 'updating'
    if (!settled && latestSnapshot) return 'loading'

    return 'ready'
  })()
  const displayedSnapshot = settled?.model.snapshot ?? gameState.snapshot

  const header = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Captain of Industry</h1>
        <p className="text-sm text-muted-foreground">Production Chain Calculator</p>
      </div>
      <GameSyncStatus
        calculationStatus={calculationStatus}
        exportedAtUtc={settled?.isStale ? settled.model.snapshot.exportedAtUtc : gameState.exportedAtUtc}
        isFresh={gameState.isFresh}
        isSyncing={gameState.isSyncing}
        onSync={gameState.syncNow}
        snapshot={failed && !settled ? null : displayedSnapshot}
        source={gameState.source}
        status={gameState.status}
      />
    </div>
  )

  if (!settled) {
    return (
      <div className="mx-auto min-h-svh max-w-7xl space-y-4 p-4 sm:p-5">
        {header}
        <FactoryStartup failed={failed} hasSnapshot={Boolean(latestSnapshot)} onRetry={retry} />
      </div>
    )
  }

  const { factoryResult, linkedModulesResult } = settled.calculation
  const {
    averageSunIntensityPercent,
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
    focusBonuses,
    groundwaterPumpClaims,
    hasMaintenanceHistory,
    housingCount,
    housingIiCount,
    maintenanceOutputLevel,
    maintenanceStatueCount,
    focusAllocations,
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
    snapshot,
    solarPowerLevel,
    spaceStationIncludedInFactoryTotals,
    syncedComputingConfigs,
    syncedMaintenance,
    treeGrowthSpeedLevel,
    unityCapacity,
    worldMineOutputLevel,
    worldMines: syncedWorldMines,
  } = settled.model
  const worldMines = settled.calculation.worldMines ?? syncedWorldMines

  const openBuilding = (diagnostic: BuildingDiagnostic) => {
    setBuildingTarget({
      key: diagnostic.navigationKey ?? diagnostic.key,
      moduleId: diagnostic.moduleId,
    })
    setActiveModuleId(diagnostic.moduleId)
  }
  const isModifiers = activeModuleId === MODIFIERS_ID
  const isContracts = activeModuleId === CONTRACTS_ID
  const isFactoryTotal = activeModuleId === FACTORY_TOTAL_ID
  const isResourceSupply = activeModuleId === RESOURCE_SUPPLY_ID
  const isFocus = activeModuleId === FOCUS_DASHBOARD_ID
  const isResearch = activeModuleId === RESEARCH_MODULE_ID
  const activeModule =
    isModifiers || isContracts || isFactoryTotal || isFocus || isResearch || isResourceSupply
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
  const housingTypes = getHousingTypes(snapshot.planningDefinitions)
  const activeHousingType = housingTypes.housingIII
  const unityBudget = calculateUnityBudget({
    definitions: snapshot.planningDefinitions,
    housing: activeHousingType,
    housingCount,
    additionalHousing: [{ housing: housingTypes.housingII, housingCount: housingIiCount }],
    unityCapacityMultiplier: unityCapacity.multiplier,
    settlementUnity: snapshot.settlement.unity,
    edictLevels,
    buildingConsumption: [
      ...(activeResearchLabCount > 0
        ? [
            {
              id: 'research-lab-iv',
              name: 'Research Lab IV',
              amount:
                activeResearchLabCount
                * (getBuildingData('Research Lab IV', snapshot.buildingDefinitions)?.unityPerCycle ?? 0),
            },
          ]
        : []),
      ...snapshot.world.mines.map(mine => ({ id: 'world-mine-' + mine.entityId, name: mine.name, amount: mine.unityPerCycle })),
      ...worldMines.routes.map(cargo => ({ id: 'world-cargo-unity-' + cargo.route.depotEntityId,
        name: cargo.route.depotCustomTitle || cargo.route.depotPrototypeName, amount: cargo.unityPerCycle })),
    ],
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
  })
  const activeModuleFactoryResult =
    activeModule?.includedInFactoryTotals === false && !activeLinkedModuleResult
      ? calculateFactoryTotal(
          [{ ...activeModule, includedInFactoryTotals: true }],
          {
            recyclingEfficiencyPercent,
            outputModifiers,
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
    line => !line.recipe.hiddenFromModuleView && hasBuildingInventory(line),
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
    + worldMines.workers
  const calculatedFactoryBuildingDiagnostics = calculateBuildingDiagnostics(
    configuredModules,
    factoryResult.flows,
    [...factoryResult.calculation.regularResults, ...linkedRegularResults],
    [...factoryResult.calculation.sourceResults, ...linkedSourceResults],
    [...factoryResult.calculation.sinkResults, ...linkedSinkResults],
    keepReadyPreferences,
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
    stationLevels: snapshot.spaceStationLevels,
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
          keepReadyPreferences,
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
  const hasPlannedChanges = (lines: readonly ProductionLine[]) => lines.some(line => (
    line.dataSource === 'planned'
    || (line.constructionGhosts ?? 0) > 0
    || (line.unplacedPlannedBuildings ?? 0) > 0
    || (line.currentActiveBuildings != null && Math.abs(line.activeBuildings - line.currentActiveBuildings) > 0.001)
  ))
  const factoryHasPlannedChanges = hasPlannedChanges([...factoryResult.allLines, ...linkedModuleLines])
    || configuredModules.some(module => (module.includedInFactoryTotals !== false || module.liveArea) && module.presets.some(preset => (
      preset.id === module.defaultPresetId && (
        (preset.planMismatches?.length ?? 0) > 0
        || Object.values(preset.requestedImports ?? {}).some(quantity => (quantity ?? 0) > 0)
        || Object.values(preset.requestedExports ?? {}).some(quantity => (quantity ?? 0) > 0)
      )
    )))
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
          ...selectMaintenanceDepotLines(moduleResult.lines).filter(hasBuildingInventory),
          ...selectStaticInfrastructureLines(stationSections.content),
        ]
      : []
  const focusedModuleTargetKey = buildingTarget && buildingTarget.moduleId === activeModule?.id
    ? buildingTarget.key
    : undefined
  const inspectResource = (resourceId: ResourceId) => {
    if (resourceId === 'electricity' || resourceId === 'computing') {
      focusFactorySummary.current = true
      setActiveModuleId(FACTORY_TOTAL_ID)
      return
    }
    if (activeModuleId !== RESOURCE_SUPPLY_ID) setSupplyOriginId(activeModuleId)
    setSupplyResourceId(resourceId)
    setActiveModuleId(RESOURCE_SUPPLY_ID)
  }

  const page = (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-5">
      <Toaster />
      {header}
      {failed && <Button variant="ghost" onClick={retry}>Retry update</Button>}

      <ModuleSwitcher
        modules={configuredModules}
        active={activeModuleId}
        modifiersId={MODIFIERS_ID}
        contractsId={CONTRACTS_ID}
        factoryTotalId={FACTORY_TOTAL_ID}
        resourceSupplyId={RESOURCE_SUPPLY_ID}
        focusId={FOCUS_DASHBOARD_ID}
        onChange={id => {
          if (id === RESOURCE_SUPPLY_ID && activeModuleId !== RESOURCE_SUPPLY_ID) setSupplyOriginId(activeModuleId)
          setActiveModuleId(id)
        }}
        researchId={RESEARCH_MODULE_ID}
        viewModuleIds={VIEW_MODULE_IDS}
        backId={isResourceSupply ? supplyOriginId ?? undefined : undefined}
        onBack={isResourceSupply && supplyOriginId ? () => setActiveModuleId(supplyOriginId) : undefined}
      />

      {activeModule?.description && activeModule.id !== MINES_MODULE_ID && (
        <p className="text-sm text-muted-foreground">{activeModule.description}</p>
      )}

      {activeModule?.liveArea && <LiveAreaStatus state={activeModule.liveArea} />}

      {isModifiers && (
        <ModifiersView
          planningDefinitions={snapshot.planningDefinitions}
          recyclingEfficiencyPercent={recyclingEfficiencyPercent}
          averageSunIntensityPercent={averageSunIntensityPercent}
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
          fullThrottlePreferences={contractPreferences.preferences}
          onFullThrottleChange={contractPreferences.canSave ? (contractGameId, enabled) => {
            if (!contractPreferences.setFullThrottle(contractGameId, enabled)) {
              toast.error('Could not save contract mode. Check browser storage and try again.')
            }
          } : undefined}
          issues={contractResolution.issues}
          results={factoryResult.contractResults}
        />
      )}

      {isFactoryTotal && (!worldMines.fuelComplete || factoryResult.contractResults.some(result => result.routes.some(route => route.fuelUnavailable))) && (
        <p className="text-sm text-muted-foreground" role="status">Shipping fuel demand is incomplete. Check the cargo routes.</p>
      )}
      {isFactoryTotal && factoryResult && (
        <NetSummary
          headingRef={factorySummaryRef}
          flows={factoryResult.flows}
          contractFlows={factoryResult.contractFlows}
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
          reserveBalances={snapshot.reserves}
          hasPlannedChanges={factoryHasPlannedChanges}
          regularResults={[
            ...factoryResult.calculation.regularResults,
            ...linkedRegularResults,
          ]}
          passiveResults={[
            ...factoryResult.calculation.sourceResults,
            ...factoryResult.calculation.sinkResults,
          ]}
          blockedRoutes={factoryResult.calculation.blockedRoutes}
          buildingDiagnostics={factoryBuildingDiagnostics}
          machineAllocationIssues={sharedMachineAllocation.issues}
          machineInventory={sharedMachineAllocation.inventory}
          machineZoneClaims={groundwaterPumpClaims}
          machineZones={sharedMachineAllocation.zones}
          plannedModules={configuredModules}
          onAssignMachineZone={assignMachineZone}
          onOpenBuilding={openBuilding}
          onKeepReadyChange={changeKeepReady}
          onInspectResource={inspectResource}
        />
      )}

      {isResourceSupply && (
        <ResourceSupplyView
          key={supplyResourceId}
          initialResourceId={supplyResourceId}
          modules={configuredModules}
          priorityModules={latestModel?.configuredModules ?? configuredModules}
          calculation={settled.calculation}
          onProcessingPriorityChange={(zoneId, resourceId, priority) => {
            if (!resourcePriorities.setPriority(zoneId, resourceId, priority)) {
              toast.error('Could not save processing priority. Check browser storage and try again.')
            }
          }}
        />
      )}

      {isResearch && (
        <ResearchSettings efficiency={researchEfficiency} />
      )}

      {isFocus && (
        <FocusView
          calculation={officePlanCalculation}
          allocations={focusAllocations}
          definitions={snapshot.officeFocusDefinitions}
        />
      )}

      {activeModule?.id === RESERVES_MODULE_ID && (
        <ReservesView
          balances={snapshot.reserves}
          drawsPerProductionCycle={reserveDrawsPerProductionCycle}
          growthPerProductionCycle={mapReserveResources(({ resourceId }) => Math.max(0,
            factoryResult.flows.find(flow => flow.resourceId === resourceId)?.net ?? 0))}
          burstCyclesRemaining={worldMines.routes.reduce<number | null>((remaining, route) => route.burstCyclesRemaining === null
            ? remaining : Math.min(remaining ?? Infinity, route.burstCyclesRemaining), null)}
        />
      )}

      {moduleResult && activeModule && (
        <>
          {activeModule.id === MINES_MODULE_ID && (
            <>
              <WorldMinesView world={snapshot.world} result={worldMines} storages={snapshot.storages}
                fullThrottlePreferences={worldMinePreferences.preferences}
                onFullThrottleChange={worldMinePreferences.canSave ? (productId, enabled) => {
                  if (!worldMinePreferences.setFullThrottle(productId, enabled)) toast.error('Could not save mine mode. Check browser storage and try again.')
                } : undefined} />
              <WaterPlanningView snapshot={snapshot}
                farmResults={factoryResult.calculation.regularResults}
                outputModifiers={outputModifiers}
                sourceResults={[...factoryResult.calculation.sourceResults, ...linkedSourceResults]}
                waterFlow={factoryResult.flows.find(flow => flow.resourceId === 'water')}
                rainwaterYieldMultiplier={outputModifiers.rainwaterYield} />
              <MinesView
                focusedTargetKey={focusedModuleTargetKey}
                sourceResults={[]}
                sinkResults={moduleResult.sinkResults.filter(hasBuildingInventory)}
              />
            </>
          )}

          {activeModule.id !== MINES_MODULE_ID && activeModule.id !== RESERVES_MODULE_ID && (
            <NetSummary
              key={activeModule.id}
              hasPlannedChanges={hasPlannedChanges(moduleResult.lines)
                || (preset?.planMismatches?.length ?? 0) > 0
                || Object.values(preset?.requestedImports ?? {}).some(quantity => (quantity ?? 0) > 0)
                || Object.values(preset?.requestedExports ?? {}).some(quantity => (quantity ?? 0) > 0)}
              flows={displayedResourceFlows}
              regularResults={moduleResult.regularResults}
              blockedRoutes={moduleResult.blockedRoutes}
              moduleId={activeModule.id}
              transfersIncludedInBalance={Boolean(activeLinkedModuleResult)}
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
              const groupTargetKey = `${activeModule.id}:group:${group}`

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
                      const diagnostic = activeBuildingDiagnostics.find(candidate => candidate.key === targetKey)
                      // Long flows need their own row instead of stretching neighboring cards.
                      const cardClassName = lines.reduce((count, { recipe }) => count + recipe.inputs.length + recipe.outputs.length, 0) > 12
                        ? 'md:col-span-full' : undefined

                      if (!line) return null

                      if (group === 'source') {
                        const result = moduleResult.sourceResults.find(
                          source => source.recipe.id === line.recipe.id,
                        )

                        return result ? (
                          <BuildingCardTarget
                            key={key}
                            className={cardClassName}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <SinkCard dataSource={line.dataSource} result={result} role="source" diagnostic={diagnostic} onKeepReadyChange={changeKeepReady} />
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
                            className={cardClassName}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <SinkCard dataSource={line.dataSource} result={result} role="sink" diagnostic={diagnostic} onKeepReadyChange={changeKeepReady} />
                          </BuildingCardTarget>
                        ) : null
                      }

                      if (lines.length > 1) {
                        return (
                          <BuildingCardTarget
                            key={key}
                            className={cardClassName}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <SharedRecipeCard
                              wide={cardClassName != null}
                              dataSource={line.dataSource}
                              lines={lines}
                              results={lines.map(sharedLine =>
                                moduleResult.regularResults.find(
                                  result => result.recipe.id === sharedLine.recipe.id,
                                ),
                              )}
                              outputModifiers={outputModifiers}
                              diagnostic={diagnostic}
                              onKeepReadyChange={changeKeepReady}
                            />
                          </BuildingCardTarget>
                        )
                      }

                      const result = moduleResult.regularResults.find(
                        regularResult => regularResult.recipe.id === line.recipe.id,
                      )

                      return (
                        <BuildingCardTarget
                          key={key}
                          className={cardClassName}
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
                            diagnostic={diagnostic}
                            onKeepReadyChange={changeKeepReady}
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
                      className={line.recipe.inputs.length + line.recipe.outputs.length > 12 ? 'md:col-span-full' : undefined}
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
                        onKeepReadyChange={changeKeepReady}
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
          definitions={snapshot.planningDefinitions}
          levels={researchLevels}
          mode={baseConfig.researchMode}
        />
      )}
    </div>
  )

  return (
    <ResourceProductsProvider products={gameState.snapshot?.products}
      current={gameState.source === 'live' && gameState.status === 'available' && gameState.isFresh}>
      <ResourceNavigationProvider onInspectResource={inspectResource}>{page}</ResourceNavigationProvider>
    </ResourceProductsProvider>
  )
}
