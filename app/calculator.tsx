'use client'

import { Toaster, toast } from '@carbonid1/design-system'
import { useEffect, useMemo, useState } from 'react'

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
import { baseConfig } from './db/config'
import { contracts } from './db/contracts'
import { activeHousingType, housingTypes } from './db/housing'
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
import { calculateUnityBudget } from './db/unity'
import {
  calculateBuildingDiagnostics,
  type BuildingDiagnostic,
} from './helpers/building-diagnostics/building-diagnostics'
import { calculateBuildingStats } from './helpers/building-stats/building-stats'
import { type ProductionLine } from './helpers/calculate/calculate'
import {
  type CalculatorModel,
  deriveCalculatorModel,
} from './helpers/calculator-model/derive-calculator-model'
import { calculateContractWorkers } from './helpers/contracts/calculate-contracts'
import { calculateFactoryTotal } from './helpers/factory-total/factory-total'
import { type MachineZoneAssignments } from './helpers/machine-allocation/machine-allocation'
import { getRecipeOutputQuantity } from './helpers/modifiers/recipe-output'
import { extractModuleResult } from './helpers/module-result/module-result'
import { getPresetResourceDemands } from './helpers/preset-resource-demands/preset-resource-demands'
import { groupProductionCardLines } from './helpers/production-card-groups/production-card-groups'
import { getReserveDrawPerProductionCycle } from './helpers/reserves/reserves'
import { createSpaceResearchAttention } from './helpers/space-research-attention/space-research-attention'
import { useFactoryCalculation } from './hooks/use-factory-calculation'
import { type GameStateResult, useGameState } from './hooks/use-game-state'
import { useKeepReadyPreferences } from './hooks/use-keep-ready-preferences'

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

const getFactoryCalculationInput = (model: CalculatorModel) => model.factoryCalculationInput

interface Props {
  initialGameState: GameStateResult
}

export const Calculator: React.FC<Props> = ({ initialGameState }) => {
  const gameState = useGameState(initialGameState)
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
  const [machineZoneAssignments, setMachineZoneAssignments] = useState<MachineZoneAssignments>({})
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
          machineZoneAssignments,
          revision: latestRevision,
          snapshot: latestSnapshot,
        })
      : null
  ), [latestRevision, latestSnapshot, machineZoneAssignments])
  const settled = useFactoryCalculation(
    latestModel?.calculationRevision ?? null,
    latestModel,
    getFactoryCalculationInput,
  )
  const groundwaterPumpClaimIds = (latestModel?.groundwaterPumpClaims ?? [])
    .map(claim => claim.id)
    .join('|')
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

  if (!settled) {
    return <div className="mx-auto max-w-7xl p-4 sm:p-5">{header}</div>
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
  } = settled.model

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
    unityCapacityMultiplier: unityCapacity.multiplier,
    settlementUnity: snapshot.settlement.unity,
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
      <Toaster />
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
          onKeepReadyChange={changeKeepReady}
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
              regularResults={moduleResult.regularResults}
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
                      const diagnostic = activeBuildingDiagnostics.find(candidate => candidate.key === targetKey)

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
                              diagnostic={diagnostic}
                              onKeepReadyChange={changeKeepReady}
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
                              diagnostic={diagnostic}
                              onKeepReadyChange={changeKeepReady}
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
          levels={researchLevels}
          mode={baseConfig.researchMode}
        />
      )}
    </div>
  )
}
