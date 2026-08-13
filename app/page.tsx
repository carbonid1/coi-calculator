"use client";

import { useEffect, useState } from "react";

import {
  BuildingCardTarget,
  getBuildingTargetId,
} from "./components/BuildingCardTarget";
import { ChickenFarmSettings } from "./components/ChickenFarmSettings";
import { ComputingSettings } from "./components/ComputingSettings";
import { ContractsView } from "./components/ContractsView";
import { HousingView } from "./components/HousingView";
import { MinesView } from "./components/MinesView";
import { ModifiersView } from "./components/ModifiersView";
import { ModuleSwitcher } from "./components/ModuleSwitcher";
import { NetSummary } from "./components/NetSummary";
import { NuclearModuleSections } from "./components/NuclearModuleSections";
import { NuclearPlanningSettings } from "./components/NuclearPlanningSettings";
import { RecipeCard } from "./components/RecipeCard";
import { ResearchSettings } from "./components/ResearchSettings";
import { SharedRecipeCard } from "./components/SharedRecipeCard";
import { SinkCard } from "./components/SinkCard";
import { SolarPowerSettings } from "./components/SolarPowerSettings";
import { StorageCard } from "./components/StorageCard";
import { buildings } from "./db/buildings";
import { defaultChickenFarmSettings } from "./db/chicken-farm";
import { defaultComputingConfig } from "./db/computing";
import {
  activeContracts,
  contracts,
  defaultActiveContractIds,
} from "./db/contracts";
import {
  defaultEdictLevels,
  getEdict,
  type EdictId,
  type EdictLevel,
  normalizeCleanPanelsLevel,
  normalizeFarmingBoostLevel,
} from "./db/edicts";
import {
  activeHousingType,
  defaultHousingCount,
} from "./db/housing";
import { COMPUTING_MODULE_ID } from "./db/modules/computing";
import { FARMS_MODULE_ID } from "./db/modules/farms";
import { HOUSING_MODULE_ID } from "./db/modules/housing";
import { MINES_MODULE_ID } from "./db/modules/mines";
import { modules } from "./db/modules/modules";
import { NUCLEAR_MODULE_ID } from "./db/modules/nuclear";
import { defaultResearchModuleConfig, RESEARCH_MODULE_ID } from "./db/modules/research";
import { SOLAR_POWER_MODULE_ID } from "./db/modules/solar-power";
import { defaultPlanningBaselines } from "./db/planning-baselines";
import { type RecipeGroup } from "./db/recipes";
import {
  defaultInfiniteResearchLevels,
} from "./db/research";
import { defaultSolarPanelCounts } from "./db/solar";
import { defaultStaticInfrastructureConfig } from "./db/static-infrastructure";
import { calculateUnityBudget } from "./db/unity";
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
import { calculateMaintenanceOutput } from "./helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "./helpers/modifiers/calculate-recycling-efficiency";
import { calculateSolarPower } from "./helpers/modifiers/calculate-solar-power";
import { calculateTreeGrowthSpeed } from "./helpers/modifiers/calculate-tree-growth-speed";
import { getRecipeOutputQuantity } from "./helpers/modifiers/recipe-output";
import { extractModuleResult } from "./helpers/module-result/module-result";

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

const Page = () => {
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

  const configuredModules = modules;
  const edictLevels: Record<EdictId, EdictLevel> = defaultEdictLevels;
  const activeContractIds = defaultActiveContractIds;
  const researchModuleConfig = defaultResearchModuleConfig;
  const maintenanceStatueCount = defaultStaticInfrastructureConfig.maintenanceStatue;
  const planningBaselines = defaultPlanningBaselines;
  const maintenanceOutputLevel = defaultInfiniteResearchLevels.maintenanceOutput;
  const solarPowerLevel = defaultInfiniteResearchLevels.solarPower;
  const cropYieldLevel = defaultInfiniteResearchLevels.cropYield;
  const treeGrowthSpeedLevel = defaultInfiniteResearchLevels.treeGrowthSpeed;
  const solarPanelCounts = defaultSolarPanelCounts;
  const computingConfig = defaultComputingConfig;
  const chickenFarmSettings = defaultChickenFarmSettings;
  const housingCount = defaultHousingCount;

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
  ).effectivePercent;
  const foodConsumption = calculateFoodConsumption(
    edictLevels.foodSaver,
    edictLevels.plentyOfFood,
  );
  const maintenanceOutput = calculateMaintenanceOutput(maintenanceOutputLevel);
  const solarPowerOutput = calculateSolarPower(
    solarPowerLevel,
    normalizeCleanPanelsLevel(edictLevels.cleanPanels),
  );
  const cropFarming = calculateCropFarmingModifiers(
    cropYieldLevel,
    normalizeFarmingBoostLevel(edictLevels.farmingBoost),
  );
  const waterSaverLevel = getEdict("waterSaver").levels.find(
    (level) => level.level === edictLevels.waterSaver,
  );
  const waterSaverMultiplier = 1 - (
    waterSaverLevel?.modeledEffects?.waterDemandReductionPercent ?? 0
  ) / 100;
  const treeGrowthSpeed = calculateTreeGrowthSpeed(treeGrowthSpeedLevel);
  const outputModifiers = {
    foodConsumption: foodConsumption.multiplier,
    maintenanceOutput: maintenanceOutput.multiplier,
    solarPower: solarPowerOutput.multiplier,
    cropYield: cropFarming.yieldMultiplier,
    cropWater: cropFarming.waterDemandMultiplier * waterSaverMultiplier,
    settlementWater: waterSaverMultiplier,
    treeGrowthSpeed: treeGrowthSpeed.multiplier,
  };
  const enabledContracts = activeContracts;
  const factoryResult = calculateFactoryTotal(
    configuredModules,
    enabledContracts,
    recyclingEfficiencyPercent,
    outputModifiers,
  );
  const unityBudget = calculateUnityBudget({
    housing: activeHousingType,
    housingCount,
    edictLevels,
    buildingConsumption: researchModuleConfig.activeResearchLabIvCount > 0
      ? [{
          id: "research-lab-iv",
          name: "Research Lab IV",
          amount: researchModuleConfig.activeResearchLabIvCount
            * (buildings["Research Lab IV"]?.unityPerCycle ?? 0),
        }]
      : [],
    contracts: factoryResult.contractResults.map((result) => ({
      id: result.contract.id,
      name: result.contract.name,
      importedPerCycle: result.imported,
      fixedUnityPerCycle: result.contract.unity.perProductionCycle,
      unityPer100Imported: result.contract.unity.per100Imported,
    })),
  });
  const moduleResult = activeModule
    ? (() => {
        const lines = factoryResult.allLines.filter((line) => line.moduleId === activeModule.id);
        const calc = extractModuleResult(
          activeModule.id,
          factoryResult.calculation,
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
  const populationCapacity = housingCount * activeHousingType.populationCapacity;

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Captain of Industry
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Production Chain Calculator
        </p>
      </div>

      <ModuleSwitcher modules={configuredModules} active={activeModuleId} modifiersId={MODIFIERS_ID} contractsId={CONTRACTS_ID} factoryTotalId={FACTORY_TOTAL_ID} onChange={setActiveModuleId} />

      {activeModule?.description && activeModule.id !== SOLAR_POWER_MODULE_ID && (
        <p className="text-sm text-muted-foreground">
          {activeModule.description}
        </p>
      )}

      {isModifiers && (
        <ModifiersView
          edictLevels={edictLevels}
          unityBudget={unityBudget}
          maintenanceStatueCount={maintenanceStatueCount}
          maintenanceOutputLevel={maintenanceOutputLevel}
          solarPowerLevel={solarPowerLevel}
          cropYieldLevel={cropYieldLevel}
          treeGrowthSpeedLevel={treeGrowthSpeedLevel}
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
          counts={solarPanelCounts}
          averageGenerationMw={solarGenerationCapacityMw}
        />
      )}

      {activeModule?.id === NUCLEAR_MODULE_ID && (
        <NuclearPlanningSettings values={planningBaselines} />
      )}

      {activeModule?.id === COMPUTING_MODULE_ID && (
        <ComputingSettings
          config={computingConfig}
          computingCapacityTflops={computingCapacityTflops}
        />
      )}

      {activeModule?.id === RESEARCH_MODULE_ID && (
        <ResearchSettings config={researchModuleConfig} />
      )}

      {activeModule?.id === FARMS_MODULE_ID && (
        <ChickenFarmSettings settings={chickenFarmSettings} />
      )}

      {activeModule?.id === HOUSING_MODULE_ID && (
        <HousingView
          housing={activeHousingType}
          buildingCount={housingCount}
        />
      )}

      {moduleResult
        && activeModule
        && activeModule.id !== SOLAR_POWER_MODULE_ID && (
        <>
          {activeModule.id === MINES_MODULE_ID ? (
            <MinesView
              focusedTargetKey={buildingTarget?.moduleId === activeModule.id
                ? buildingTarget.key
                : undefined}
              sourceResults={moduleResult.sourceResults}
              sinkResults={moduleResult.sinkResults}
            />
          ) : (
            <NetSummary
              flows={moduleResult.resourceFlows}
              externalInputs={resolvedExternalInputs}
              workers={buildingStats.workers}
              electricityConsumptionKw={buildingStats.electricityKw}
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
              diagnostics={factoryBuildingDiagnostics}
              outputModifiers={outputModifiers}
            />
          ) : activeModule.id !== MINES_MODULE_ID
            && grouped.map(({ group, label, items }) => {
              const groupTargetKey = activeModule.id === FARMS_MODULE_ID
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
                              diagnostic={factoryBuildingDiagnostics.find(
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
    </div>
  );
};

export default Page;
