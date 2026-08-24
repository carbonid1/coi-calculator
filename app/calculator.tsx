"use client";

import { useEffect, useState } from "react";

import {
  BuildingCardTarget,
  getBuildingTargetId,
} from "./components/BuildingCardTarget";
import { ChickenFarmSettings } from "./components/ChickenFarmSettings";
import { ComputingSettings } from "./components/ComputingSettings";
import { ContractsView } from "./components/ContractsView";
import { GameSyncStatus } from "./components/GameSyncStatus";
import { HousingView } from "./components/HousingView";
import { InfrastructureWorkforceView } from "./components/InfrastructureWorkforceView";
import { MaintenancePlanningSettings } from "./components/MaintenancePlanningSettings";
import { MinesView } from "./components/MinesView";
import { ModifiersView } from "./components/ModifiersView";
import { ModuleSwitcher } from "./components/ModuleSwitcher";
import { NetSummary } from "./components/NetSummary";
import { NuclearModuleSections } from "./components/NuclearModuleSections";
import { NuclearPlanningSettings } from "./components/NuclearPlanningSettings";
import { OfficesView } from "./components/OfficesView";
import { RecipeCard } from "./components/RecipeCard";
import {
  InfiniteResearchSettings,
  ResearchSettings,
} from "./components/ResearchSettings";
import { ReservesView } from "./components/ReservesView";
import { SharedRecipeCard } from "./components/SharedRecipeCard";
import { SinkCard } from "./components/SinkCard";
import { SolarPowerSettings } from "./components/SolarPowerSettings";
import { SpaceStationView } from "./components/SpaceStationView";
import { StorageCard } from "./components/StorageCard";
import { TrainTrafficAlert } from "./components/TrainTrafficAlert";
import { buildings } from "./db/buildings";
import { defaultChickenFarmSettings } from "./db/chicken-farm";
import { defaultComputingConfig } from "./db/computing";
import {
  activeContracts,
  contracts,
  defaultActiveContractIds,
} from "./db/contracts";
import {
  getEdict,
  inactiveEdictLevels,
  mapEdictValues,
  type EdictId,
  type EdictLevel,
  normalizeCleanPanelsLevel,
  normalizeFarmingBoostLevel,
} from "./db/edicts";
import {
  activeHousingType,
  calculatePopulationCapacity,
  defaultHousingCount,
} from "./db/housing";
import { COMPUTING_MODULE_ID } from "./db/modules/computing";
import {
  CHICKEN_FARMS_MODULE_ID,
  GREENHOUSES_MODULE_ID,
} from "./db/modules/farms";
import { createHousingModule, HOUSING_MODULE_ID } from "./db/modules/housing";
import {
  createMaintenanceModule,
  MAINTENANCE_MODULE_ID,
} from "./db/modules/maintenance";
import { MINES_MODULE_ID } from "./db/modules/mines";
import { modules } from "./db/modules/modules";
import {
  createNuclearModule,
  defaultNuclearConfig,
  NUCLEAR_MODULE_ID,
} from "./db/modules/nuclear";
import {
  createOfficesModule,
  OFFICES_MODULE_ID,
} from "./db/modules/offices";
import { defaultResearchModuleConfig, RESEARCH_MODULE_ID } from "./db/modules/research";
import {
  createReservesModule,
  RESERVES_MODULE_ID,
} from "./db/modules/reserves";
import {
  createSolarPowerModule,
  SOLAR_POWER_MODULE_ID,
} from "./db/modules/solar-power";
import { SPACE_STATION_MODULE_ID } from "./db/modules/space-station";
import {
  createStaticInfrastructureModule,
  STATIC_INFRASTRUCTURE_MODULE_ID,
} from "./db/modules/static-infrastructure";
import {
  calculateOfficePlan,
  resolvedOfficePlan,
} from "./db/offices";
import { resolvePlanningBaselines } from "./db/planning-baselines";
import { type RecipeGroup } from "./db/recipes";
import {
  emptyInfiniteResearchLevels,
} from "./db/research";
import {
  mapReserveResources,
} from "./db/reserve-resources";
import { emptySolarPanelCounts } from "./db/solar";
import {
  calculateRocketIiRecurringLogistics,
  defaultRocketIiRecurringLogistics,
  defaultSpaceStationConfig,
  defaultSpaceStationLevel,
} from "./db/space-station";
import {
  emptyStaticInfrastructureConfig,
  type StaticInfrastructureConfig,
} from "./db/static-infrastructure";
import { calculateUnityBudget } from "./db/unity";
import { syncedInfrastructureBuildingIds } from "./game-state";
import {
  calculateBuildingDiagnostics,
  type BuildingDiagnostic,
} from "./helpers/building-diagnostics/building-diagnostics";
import { calculateBuildingStats } from "./helpers/building-stats/building-stats";
import { type ProductionLine } from "./helpers/calculate/calculate";
import { calculateContractWorkers } from "./helpers/contracts/calculate-contracts";
import { calculateFactoryTotal } from "./helpers/factory-total/factory-total";
import { calculateCropFarmingModifiers } from "./helpers/modifiers/calculate-crop-farming";
import { calculateFoodConsumption } from "./helpers/modifiers/calculate-food-consumption";
import { calculateHousingCapacity } from "./helpers/modifiers/calculate-housing-capacity";
import { calculateMaintenanceOutput } from "./helpers/modifiers/calculate-maintenance-output";
import { calculateRainwaterYield } from "./helpers/modifiers/calculate-rainwater-yield";
import { calculateRecyclingEfficiency } from "./helpers/modifiers/calculate-recycling-efficiency";
import { calculateResearchEfficiency } from "./helpers/modifiers/calculate-research-efficiency";
import { calculateSettlementWaterUse } from "./helpers/modifiers/calculate-settlement-water-use";
import { calculateShipsFuelUse } from "./helpers/modifiers/calculate-ships-fuel-use";
import { calculateSolarPower } from "./helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "./helpers/modifiers/calculate-tree-growth-speed";
import { calculateUnityCapacity } from "./helpers/modifiers/calculate-unity-capacity";
import { getRecipeOutputQuantity } from "./helpers/modifiers/recipe-output";
import { extractModuleResult } from "./helpers/module-result/module-result";
import { getReserveDrawPerProductionCycle } from "./helpers/reserves/reserves";
import {
  type GameStateResult,
  useGameState,
} from "./hooks/use-game-state";

const groupLabels: Record<RecipeGroup, string> = {
  source: "Sources",
  electricity: "Electricity",
  production: "Production",
  waste: "Waste processing",
  sink: "Sinks",
};

const groupOrder: RecipeGroup[] = ["source", "electricity", "production", "waste", "sink"];

const FACTORY_TOTAL_ID = "factory-total";
const CONTRACTS_ID = "contracts";
const MODIFIERS_ID = "modifiers";

const groupSharedProductionLines = (lines: ProductionLine[]) => {
  const groups: { key: string; lines: ProductionLine[] }[] = [];
  const groupByPool = new Map<string, ProductionLine[]>();

  for (const line of lines) {
    if (!line.capacityPoolId) {
      groups.push({ key: line.recipe.id, lines: [line] });
      continue;
    }

    const existing = groupByPool.get(line.capacityPoolId);

    if (existing) {
      existing.push(line);
      continue;
    }

    const sharedLines = [line];

    groupByPool.set(line.capacityPoolId, sharedLines);
    groups.push({ key: line.capacityPoolId, lines: sharedLines });
  }

  return groups.toSorted((a, b) => (
    (a.lines[0]?.recipe.sharedCapacity?.displayOrder ?? 0)
    - (b.lines[0]?.recipe.sharedCapacity?.displayOrder ?? 0)
  ));
};

const legacySettingKeys = [
  "coi-active-contract-ids",
  "coi-additional-edict-levels",
  "coi-chicken-farm-settings",
  "coi-chicken-farm-settings-v3",
  "coi-clean-panels-level",
  "coi-computing-config",
  "coi-contract-modes",
  "coi-crop-yield-level",
  "coi-farming-boost-level",
  "coi-housing-count",
  "coi-maintenance-output-level",
  "coi-maintenance-reducer-level",
  "coi-maintenance-statue-count",
  "coi-module",
  "coi-planning-baselines",
  "coi-planning-baselines-v2",
  "coi-presets",
  "coi-recycling-increase-level",
  "coi-research-module-config",
  "coi-solar-panel-counts",
  "coi-solar-power-level",
  "coi-tree-growth-speed-level",
] as const;

interface Props {
  initialGameState: GameStateResult;
}

export const Calculator: React.FC<Props> = ({ initialGameState }) => {
  const [activeModuleId, setActiveModuleId] = useState(FACTORY_TOTAL_ID);
  const [buildingTarget, setBuildingTarget] = useState<{
    key: string;
    moduleId: string;
  } | null>(null);

  useEffect(() => {
    legacySettingKeys.forEach((key) => window.localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    if (!buildingTarget || buildingTarget.moduleId !== activeModuleId) return undefined;

    let clearTimer: number | undefined;
    const animationFrame = window.requestAnimationFrame(() => {
      const target = document.getElementById(getBuildingTargetId(buildingTarget.key));

      if (!target) {
        setBuildingTarget(null);
        return;
      }

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      target.focus({ preventScroll: true });
      clearTimer = window.setTimeout(() => {
        setBuildingTarget((current) => current === buildingTarget ? null : current);
      }, 1_800);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (clearTimer !== undefined) window.clearTimeout(clearTimer);
    };
  }, [activeModuleId, buildingTarget]);

  const openBuilding = (diagnostic: BuildingDiagnostic) => {
    setBuildingTarget({ key: diagnostic.key, moduleId: diagnostic.moduleId });
    setActiveModuleId(diagnostic.moduleId);
  };

  const gameState = useGameState(initialGameState);
  const staticInfrastructureBuiltConfig: StaticInfrastructureConfig = {
    ...emptyStaticInfrastructureConfig,
  };
  const staticInfrastructureRunningConfig: StaticInfrastructureConfig = {
    ...emptyStaticInfrastructureConfig,
  };

  if (gameState.snapshot) {
    for (const id of syncedInfrastructureBuildingIds) {
      const count = gameState.snapshot.buildings[id];

      staticInfrastructureBuiltConfig[id] = count.built;
      staticInfrastructureRunningConfig[id] = count.running;
    }

    staticInfrastructureBuiltConfig.vehicles = gameState.snapshot.vehicles.workersAssigned;
    staticInfrastructureRunningConfig.vehicles = gameState.snapshot.vehicles.workersAssigned;
  }

  const solarPanelBuiltCounts = gameState.snapshot
    ? {
        standard: gameState.snapshot.buildings.solarPanel.built,
        mono: gameState.snapshot.buildings.solarPanelMono.built,
      }
    : emptySolarPanelCounts;
  const solarPanelRunningCounts = gameState.snapshot
    ? {
        standard: gameState.snapshot.buildings.solarPanel.running,
        mono: gameState.snapshot.buildings.solarPanelMono.running,
      }
    : emptySolarPanelCounts;
  const planningBaselines = resolvePlanningBaselines(gameState.snapshot);
  const syncedHistory = gameState.snapshot?.history;
  const syncedMaintenance = syncedHistory?.maintenance;
  const maintenanceDemand = {
    maintenanceI: syncedMaintenance?.maintenanceI.averagePerCycle ?? 0,
    maintenanceII: syncedMaintenance?.maintenanceII.averagePerCycle ?? 0,
    maintenanceIII: syncedMaintenance?.maintenanceIII.averagePerCycle ?? 0,
  };
  const hasOperatingHistory = Boolean(
    syncedHistory && (
      syncedHistory.hydrogenFuel.total.sampleMonths > 0
      || syncedHistory.electricityGeneration.byType.some(
        generation => generation.sampleMonths > 0,
      )
    ),
  );
  const hasMaintenanceHistory = Boolean(
    syncedMaintenance && Object.values(syncedMaintenance).some(
      average => average.sampleMonths > 0,
    ),
  );
  const syncedResearchLevels = gameState.snapshot?.research;
  const researchLevels = syncedResearchLevels ?? emptyInfiniteResearchLevels;
  const officePlan = resolvedOfficePlan.value;
  const officePlanCalculation = calculateOfficePlan(
    officePlan,
    researchLevels.focusPoints,
  );
  const focusBonuses = officePlanCalculation.bonuses;
  const syncedEdictStates = gameState.snapshot?.edicts;
  const edictLevels: Record<EdictId, EdictLevel> = syncedEdictStates
    ? mapEdictValues((edictId) => syncedEdictStates[edictId].activeLevel)
    : inactiveEdictLevels;
  const activeContractIds = defaultActiveContractIds;
  const researchModuleConfig = defaultResearchModuleConfig;
  const maintenanceStatueCount = staticInfrastructureRunningConfig.maintenanceStatue;
  const maintenanceOutputLevel = researchLevels.maintenanceOutput;
  const solarPowerLevel = researchLevels.solarPower;
  const cropYieldLevel = researchLevels.cropYield;
  const rainwaterYieldLevel = researchLevels.rainwaterYield;
  const settlementWaterUseLevel = researchLevels.settlementWaterUse;
  const treeGrowthSpeedLevel = researchLevels.treeGrowthSpeed;
  const worldMineOutputLevel = researchLevels.worldMineOutput;
  const unityCapacityLevel = researchLevels.unityCapacity;
  const housingCapacityLevel = researchLevels.housingCapacity;
  const shipsFuelUseLevel = researchLevels.shipsFuelUse;
  const computingConfig = defaultComputingConfig;
  const chickenFarmSettings = defaultChickenFarmSettings;
  const housingCount = defaultHousingCount;

  const configuredModules = modules.map(module => {
    if (module.id === STATIC_INFRASTRUCTURE_MODULE_ID) {
      return createStaticInfrastructureModule(
        staticInfrastructureBuiltConfig,
        staticInfrastructureRunningConfig,
      );
    }

    if (module.id === SOLAR_POWER_MODULE_ID) {
      return createSolarPowerModule(
        solarPanelBuiltCounts,
        solarPanelRunningCounts,
      );
    }

    if (module.id === NUCLEAR_MODULE_ID) {
      return createNuclearModule(defaultNuclearConfig, planningBaselines);
    }

    if (module.id === MAINTENANCE_MODULE_ID) {
      return createMaintenanceModule(maintenanceDemand);
    }

    if (module.id === OFFICES_MODULE_ID) {
      return createOfficesModule(officePlan);
    }

    if (module.id === HOUSING_MODULE_ID) {
      return createHousingModule(housingCount, housingCapacityLevel);
    }

    if (module.id === RESERVES_MODULE_ID) {
      return createReservesModule(gameState.snapshot?.reserves ?? null);
    }

    return module;
  });
  const housingCapacity = calculateHousingCapacity(housingCapacityLevel);
  const populationCapacity = calculatePopulationCapacity(
    activeHousingType,
    housingCount,
    housingCapacity.multiplier,
  );
  const spaceStationIncludedInFactoryTotals = configuredModules.find(
    (module) => module.id === SPACE_STATION_MODULE_ID,
  )?.includedInFactoryTotals !== false;
  const researchEfficiency = calculateResearchEfficiency({
    edictLevel: edictLevels.researchEfficiency,
    focusBonusPercent: focusBonuses.researchEfficiency,
    population: populationCapacity,
    stationBonusPercent: spaceStationIncludedInFactoryTotals
      ? defaultSpaceStationLevel.researchEfficiencyBonusPercent
      : 0,
  });

  const isModifiers = activeModuleId === MODIFIERS_ID;
  const isContracts = activeModuleId === CONTRACTS_ID;
  const isFactoryTotal = activeModuleId === FACTORY_TOTAL_ID;
  const activeModule = isModifiers || isContracts || isFactoryTotal
    ? null
    : (configuredModules.find((m) => m.id === activeModuleId) ?? configuredModules[0]);

  const preset = activeModule && activeModule.defaultPresetId
    ? activeModule.presets.find((p) => p.id === activeModule.defaultPresetId)
      ?? activeModule.presets[0]
      ?? null
    : null;

  const resolvedExternalInputs = preset?.externalInputs ?? activeModule?.externalInputs;
  const recyclingEfficiencyPercent = calculateRecyclingEfficiency(
    edictLevels.recyclingIncrease,
    focusBonuses.recyclingEfficiency,
  ).effectivePercent;
  const foodConsumption = calculateFoodConsumption(
    edictLevels.foodSaver,
    edictLevels.plentyOfFood,
    focusBonuses.foodConsumption,
  );
  const maintenanceOutput = calculateMaintenanceOutput(
    maintenanceOutputLevel,
    focusBonuses.maintenanceProduction,
  );
  const solarPowerOutput = calculateSolarPower(
    solarPowerLevel,
    normalizeCleanPanelsLevel(edictLevels.cleanPanels),
  );
  const cropFarming = calculateCropFarmingModifiers(
    cropYieldLevel,
    normalizeFarmingBoostLevel(edictLevels.farmingBoost),
    focusBonuses.cropYield,
  );
  const waterSaverLevel = getEdict("waterSaver").levels.find(
    (level) => level.level === edictLevels.waterSaver,
  );
  const waterSaverMultiplier = 1 - (
    waterSaverLevel?.modeledEffects?.waterDemandReductionPercent ?? 0
  ) / 100;
  const rainwaterYield = calculateRainwaterYield(rainwaterYieldLevel);
  const settlementWaterUse = calculateSettlementWaterUse(settlementWaterUseLevel);
  const settlementConsumptionMultiplier = 1
    + focusBonuses.settlementConsumption / 100;
  const treeGrowthSpeed = calculateTreeGrowthSpeed(treeGrowthSpeedLevel);
  const unityCapacity = calculateUnityCapacity(unityCapacityLevel);
  const shipsFuelUse = calculateShipsFuelUse(shipsFuelUseLevel);
  const rocketIiRecurringLogistics = calculateRocketIiRecurringLogistics(
    defaultSpaceStationLevel,
    researchLevels.rocketsCapacity,
  );
  const outputModifiers = {
    foodConsumption: foodConsumption.multiplier,
    maintenanceOutput: maintenanceOutput.multiplier,
    solarPower: solarPowerOutput.multiplier,
    cropYield: cropFarming.yieldMultiplier,
    cropWater: cropFarming.waterDemandMultiplier * waterSaverMultiplier,
    rainwaterYield: rainwaterYield.multiplier,
    settlementConsumption: settlementConsumptionMultiplier,
    settlementWater: settlementWaterUse.multiplier
      * waterSaverMultiplier
      * settlementConsumptionMultiplier,
    treeGrowthSpeed: treeGrowthSpeed.multiplier,
    rocketLaunches: defaultRocketIiRecurringLogistics.launchesPerCycle > 0
      ? rocketIiRecurringLogistics.launchesPerCycle
        / defaultRocketIiRecurringLogistics.launchesPerCycle
      : 1,
  };
  const enabledContracts = activeContracts;
  const factoryResult = calculateFactoryTotal(
    configuredModules,
    enabledContracts,
    recyclingEfficiencyPercent,
    outputModifiers,
    shipsFuelUse.multiplier,
    1 + focusBonuses.contractsProfitability / 100,
  );
  const reserveDrawsPerProductionCycle = mapReserveResources(
    ({ recipeId, resourceId }) => getReserveDrawPerProductionCycle(
      factoryResult.calculation.sourceResults,
      recipeId,
      resourceId,
    ),
  );
  const unityBudget = calculateUnityBudget({
    housing: activeHousingType,
    housingCount,
    housingCapacityMultiplier: housingCapacity.multiplier,
    unityCapacityMultiplier: unityCapacity.multiplier,
    edictLevels,
    buildingConsumption: researchModuleConfig.activeResearchLabIvCount > 0
      ? [{
          id: "research-lab-iv",
          name: "Research Lab IV",
          amount: researchModuleConfig.activeResearchLabIvCount
            * (buildings["Research Lab IV"]?.unityPerCycle ?? 0),
        }]
      : [],
    buildingGeneration: spaceStationIncludedInFactoryTotals
      && defaultSpaceStationLevel.unityPerCycle > 0
      ? [{
          id: "space-station",
          name: `Space Station level ${defaultSpaceStationLevel.level}`,
          amount: defaultSpaceStationLevel.unityPerCycle,
        }]
      : [],
    contracts: factoryResult.contractResults.map((result) => ({
      id: result.contract.id,
      name: result.contract.name,
      importedPerCycle: result.imported,
      fixedUnityPerCycle: result.contract.unity.perProductionCycle,
      unityPer100Imported: result.contract.unity.per100Imported,
    })),
    contractsUnityCostPercent: focusBonuses.contractsUnityCost,
    settlementUnityBonusPercent: focusBonuses.unityProduction,
  });
  const activeModuleFactoryResult = activeModule?.includedInFactoryTotals === false
    ? calculateFactoryTotal(
        [{ ...activeModule, includedInFactoryTotals: true }],
        [],
        recyclingEfficiencyPercent,
        outputModifiers,
        shipsFuelUse.multiplier,
        1 + focusBonuses.contractsProfitability / 100,
      )
    : factoryResult;
  const moduleResult = activeModule
    ? (() => {
        const lines = activeModuleFactoryResult.allLines.filter(
          (line) => line.moduleId === activeModule.id,
        );
        const calc = extractModuleResult(
          activeModule.id,
          activeModuleFactoryResult.calculation,
          preset?.fixedDemands,
        );

        return { lines, ...calc };
      })()
    : null;

  const buildingStats = activeModule && moduleResult
    ? calculateBuildingStats(moduleResult.lines, moduleResult, outputModifiers)
    : { workers: 0, electricityKw: 0, computingTflops: 0 };

  const factoryStats = calculateBuildingStats(
    factoryResult.allLines,
    factoryResult.calculation,
    outputModifiers,
  );
  const factoryWorkers = factoryStats.workers + calculateContractWorkers(enabledContracts);
  const factoryBuildingDiagnostics = calculateBuildingDiagnostics(
    configuredModules,
    factoryResult.flows,
    factoryResult.calculation.regularResults,
    factoryResult.calculation.sourceResults,
    factoryResult.calculation.sinkResults,
  );
  const activeBuildingDiagnostics = activeModule?.includedInFactoryTotals === false
    ? calculateBuildingDiagnostics(
        [activeModule],
        activeModuleFactoryResult.flows,
        activeModuleFactoryResult.calculation.regularResults,
        activeModuleFactoryResult.calculation.sourceResults,
        activeModuleFactoryResult.calculation.sinkResults,
      )
    : factoryBuildingDiagnostics;
  const calculateGenerationCapacityMw = (lines: ProductionLine[]) => lines.reduce(
    (total, line) => (
      total + line.recipe.outputs.reduce((lineTotal, output) => (
        output.resourceId === "electricity"
          ? lineTotal
            + getRecipeOutputQuantity(line.recipe, output, outputModifiers)
              * line.activeBuildings
              * line.speedLevel
          : lineTotal
      ), 0)
    ),
    0,
  );
  const factoryGenerationCapacityMw = calculateGenerationCapacityMw(factoryResult.allLines);
  const calculateComputingCapacityTflops = (lines: ProductionLine[]) => lines.reduce(
    (total, line) => total + line.recipe.outputs.reduce((lineTotal, output) => (
      output.resourceId === "computing"
        ? lineTotal + output.quantity * line.activeBuildings * line.speedLevel
        : lineTotal
    ), 0),
    0,
  );
  const factoryComputingCapacityTflops = calculateComputingCapacityTflops(factoryResult.allLines);
  const computingCapacityTflops = calculateComputingCapacityTflops(
    factoryResult.allLines.filter((line) => line.moduleId === COMPUTING_MODULE_ID),
  );
  const solarGenerationCapacityMw = calculateGenerationCapacityMw(
    factoryResult.allLines.filter((line) => line.moduleId === SOLAR_POWER_MODULE_ID),
  );
  const nuclearGenerationCapacityMw = activeModule?.id === NUCLEAR_MODULE_ID && moduleResult
    ? calculateGenerationCapacityMw(moduleResult.lines)
    : undefined;
  const grouped = moduleResult
    ? groupOrder
        .map((group) => ({
          group,
          label: groupLabels[group],
          items: moduleResult.lines.filter((l) => l.recipe.group === group),
        }))
        .filter((g) => g.items.length > 0)
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Captain of Industry
          </h1>
          <p className="text-sm text-muted-foreground">
            Production Chain Calculator
          </p>
        </div>
        <GameSyncStatus
          isFresh={gameState.isFresh}
          snapshot={gameState.snapshot}
          source={gameState.source}
          status={gameState.status}
        />
      </div>

      <TrainTrafficAlert
        isFresh={gameState.isFresh}
        snapshot={gameState.snapshot}
      />

      <ModuleSwitcher modules={configuredModules} active={activeModuleId} modifiersId={MODIFIERS_ID} contractsId={CONTRACTS_ID} factoryTotalId={FACTORY_TOTAL_ID} onChange={setActiveModuleId} />

      {activeModule?.description && activeModule.id !== SOLAR_POWER_MODULE_ID && (
        <p className="text-sm text-muted-foreground">
          {activeModule.description}
        </p>
      )}

      {isModifiers && (
        <ModifiersView
          edictLevels={edictLevels}
          edictStates={syncedEdictStates ?? null}
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
          electricityConsumptionKw={factoryResult.electricityDemandMw * 1000}
          electricityGenerationCapacityMw={factoryGenerationCapacityMw}
          computingConsumptionTflops={factoryResult.computingDemandTflops}
          computingGenerationCapacityTflops={factoryComputingCapacityTflops}
          populationCapacity={populationCapacity}
          unityBudget={unityBudget}
          groupByBalance
          regularResults={factoryResult.calculation.regularResults}
          buildingDiagnostics={factoryBuildingDiagnostics}
          onOpenBuilding={openBuilding}
        />
      )}

      {activeModule?.id === SOLAR_POWER_MODULE_ID && (
        <SolarPowerSettings
          averageGenerationMw={solarGenerationCapacityMw}
          builtCounts={solarPanelBuiltCounts}
          runningCounts={solarPanelRunningCounts}
        />
      )}

      {activeModule?.id === NUCLEAR_MODULE_ID && syncedHistory && hasOperatingHistory && (
        <NuclearPlanningSettings
          history={syncedHistory}
          values={planningBaselines}
        />
      )}

      {activeModule?.id === MAINTENANCE_MODULE_ID
        && syncedMaintenance
        && hasMaintenanceHistory && (
        <MaintenancePlanningSettings
          demand={maintenanceDemand}
          history={syncedMaintenance}
        />
      )}

      {activeModule?.id === COMPUTING_MODULE_ID && (
        <ComputingSettings
          config={computingConfig}
          computingCapacityTflops={computingCapacityTflops}
        />
      )}

      {activeModule?.id === STATIC_INFRASTRUCTURE_MODULE_ID && (
        <InfrastructureWorkforceView
          builtConfig={staticInfrastructureBuiltConfig}
          runningConfig={staticInfrastructureRunningConfig}
          gameState={gameState.snapshot}
        />
      )}

      {activeModule?.id === RESEARCH_MODULE_ID && (
        <ResearchSettings
          config={researchModuleConfig}
          efficiency={researchEfficiency}
        />
      )}

      {activeModule?.id === OFFICES_MODULE_ID && (
        <OfficesView
          calculation={officePlanCalculation}
          focusResearchLevel={researchLevels.focusPoints}
          plan={officePlan}
          source={resolvedOfficePlan.source}
        />
      )}

      {activeModule?.id === SPACE_STATION_MODULE_ID && (
        <SpaceStationView
          config={defaultSpaceStationConfig}
          logistics={rocketIiRecurringLogistics}
        />
      )}

      {activeModule?.id === CHICKEN_FARMS_MODULE_ID && (
        <ChickenFarmSettings settings={chickenFarmSettings} />
      )}

      {activeModule?.id === HOUSING_MODULE_ID && (
        <HousingView
          housing={activeHousingType}
          buildingCount={housingCount}
          capacityBonusPercent={housingCapacity.bonusPercent}
          capacityMultiplier={housingCapacity.multiplier}
          serviceMultiplier={unityBudget.housingMultiplier}
        />
      )}

      {activeModule?.id === RESERVES_MODULE_ID && (
        <ReservesView
          balances={gameState.snapshot?.reserves ?? null}
          drawsPerProductionCycle={reserveDrawsPerProductionCycle}
        />
      )}

      {moduleResult
        && activeModule
        && activeModule.id !== SOLAR_POWER_MODULE_ID
        && activeModule.id !== STATIC_INFRASTRUCTURE_MODULE_ID
        && activeModule.id !== RESERVES_MODULE_ID && (
        <>
          {activeModule.id === MINES_MODULE_ID && (
            <MinesView
              focusedTargetKey={buildingTarget?.moduleId === activeModule.id
                ? buildingTarget.key
                : undefined}
              sourceResults={moduleResult.sourceResults}
              sinkResults={moduleResult.sinkResults}
            />
          )}

          {activeModule.id !== SPACE_STATION_MODULE_ID
            && activeModule.id !== MINES_MODULE_ID && (
            <NetSummary
              flows={moduleResult.resourceFlows}
              externalInputs={resolvedExternalInputs}
              workers={buildingStats.workers}
              electricityConsumptionKw={buildingStats.electricityKw}
              electricityGenerationCapacityMw={nuclearGenerationCapacityMw}
              computingConsumptionTflops={buildingStats.computingTflops}
              computingGenerationCapacityTflops={activeModule.id === COMPUTING_MODULE_ID
                ? computingCapacityTflops
                : undefined}
            />
          )}

          {activeModule.id === NUCLEAR_MODULE_ID ? (
            <NuclearModuleSections
              focusedTargetKey={buildingTarget?.moduleId === activeModule.id
                ? buildingTarget.key
                : undefined}
              lines={moduleResult.lines}
              regularResults={moduleResult.regularResults}
              sourceResults={moduleResult.sourceResults}
              sinkResults={moduleResult.sinkResults}
              diagnostics={activeBuildingDiagnostics}
              outputModifiers={outputModifiers}
            />
          ) : activeModule.id !== MINES_MODULE_ID
            && activeModule.id !== SPACE_STATION_MODULE_ID
            && grouped.map(({ group, label, items }) => {
              const groupTargetKey = activeModule.id === GREENHOUSES_MODULE_ID
                && group === "production"
                ? `${activeModule.id}:crop-rebalance`
                : `${activeModule.id}:group:${group}`;

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
                    {groupSharedProductionLines(items).map(({ key, lines }) => {
                      const line = lines[0];

                      if (!line) return null;

                      const targetKey = line.capacityPoolId
                        ?? `${line.moduleId}:${line.recipe.id}`;

                      if (group === "source") {
                        const result = moduleResult.sourceResults.find(
                          (source) => source.recipe.id === line.recipe.id,
                        );

                        return result ? (
                          <BuildingCardTarget
                            key={key}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <SinkCard result={result} role="source" />
                          </BuildingCardTarget>
                        ) : null;
                      }
                      if (group === "sink") {
                        const result = moduleResult.sinkResults.find(
                          (sink) => sink.recipe.id === line.recipe.id,
                        );

                        return result ? (
                          <BuildingCardTarget
                            key={key}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <SinkCard result={result} role="sink" />
                          </BuildingCardTarget>
                        ) : null;
                      }

                      if (lines.length > 1) {
                        return (
                          <BuildingCardTarget
                            key={key}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <SharedRecipeCard
                              lines={lines}
                              results={lines.map((sharedLine) => (
                                moduleResult.regularResults.find(
                                  (result) => result.recipe.id === sharedLine.recipe.id,
                                )
                              ))}
                              outputModifiers={outputModifiers}
                              diagnostic={activeBuildingDiagnostics.find(
                                (diagnostic) => diagnostic.key === key,
                              )}
                            />
                          </BuildingCardTarget>
                        );
                      }

                      const result = moduleResult.regularResults.find(
                        (regularResult) => regularResult.recipe.id === line.recipe.id,
                      );

                      if (line.recipe.decayStorage) {
                        return (
                          <BuildingCardTarget
                            key={key}
                            focused={buildingTarget?.key === targetKey}
                            targetKey={targetKey}
                          >
                            <StorageCard
                              recipe={line.recipe}
                              storage={line.recipe.decayStorage}
                              activeBuildings={line.activeBuildings}
                              builtBuildings={line.builtBuildings}
                              operatingMode={result?.operatingMode ?? "balanced"}
                            />
                          </BuildingCardTarget>
                        );
                      }

                      return (
                        <BuildingCardTarget
                          key={key}
                          focused={buildingTarget?.key === targetKey}
                          targetKey={targetKey}
                        >
                          <RecipeCard
                            recipe={line.recipe}
                            activeBuildings={line.activeBuildings}
                            builtBuildings={line.builtBuildings}
                            diagnostic={factoryBuildingDiagnostics.find(
                              (diagnostic) => diagnostic.key === key,
                            )}
                            supplyRatio={result?.supplyRatio ?? 1}
                            operatingMode={result?.operatingMode ?? "balanced"}
                            speedLevel={line.speedLevel}
                            actualInputs={result?.actualInputs}
                            actualOutputs={result?.actualOutputs}
                            outputModifiers={outputModifiers}
                          />
                        </BuildingCardTarget>
                      );
                    })}
                  </div>
                </BuildingCardTarget>
              );
            })}
        </>
      )}

      {activeModule?.id === RESEARCH_MODULE_ID && (
        <InfiniteResearchSettings
          levels={researchLevels}
          synced={Boolean(syncedResearchLevels)}
        />
      )}
    </div>
  );
};
