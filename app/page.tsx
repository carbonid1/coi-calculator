"use client";

import { z } from "zod";

import { ContractsView } from "./components/ContractsView";
import { ModifiersView } from "./components/ModifiersView";
import { ModuleSwitcher } from "./components/ModuleSwitcher";
import { NetSummary } from "./components/NetSummary";
import { RecipeCard } from "./components/RecipeCard";
import { SharedRecipeCard } from "./components/SharedRecipeCard";
import { SinkCard } from "./components/SinkCard";
import { SolarPowerSettings } from "./components/SolarPowerSettings";
import { StorageCard } from "./components/StorageCard";
import { activeContracts } from "./db/contracts";
import { defaultActiveEdicts } from "./db/edicts";
import { modules } from "./db/modules/modules";
import { createSolarPowerModule, SOLAR_POWER_MODULE_ID } from "./db/modules/solar-power";
import { type RecipeGroup } from "./db/recipes";
import {
  defaultInfiniteResearchLevels,
  maintenanceOutputResearch,
  solarPowerResearch,
} from "./db/research";
import { defaultSolarPanelCounts } from "./db/solar";
import { calculateBuildingStats } from "./helpers/building-stats/building-stats";
import { type ProductionLine } from "./helpers/calculate/calculate";
import { calculateFactoryTotal } from "./helpers/factory-total/factory-total";
import { calculateMaintenanceOutput } from "./helpers/modifiers/calculate-maintenance-output";
import { calculateRecyclingEfficiency } from "./helpers/modifiers/calculate-recycling-efficiency";
import { calculateSolarPower } from "./helpers/modifiers/calculate-solar-power";
import { extractModuleResult } from "./helpers/module-result/module-result";
import { useLocalStorage } from "./helpers/use-local-storage/use-local-storage";
import { useMounted } from "./helpers/use-mounted/use-mounted";

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

  return groups;
};

const activeModuleIdSchema = z.enum([MODIFIERS_ID, CONTRACTS_ID, FACTORY_TOTAL_ID, ...modules.map((m) => m.id)]);
const edictLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const cleanPanelsLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
const maintenanceOutputLevelSchema = z.number().int().min(0).max(maintenanceOutputResearch.maxLevel);
const solarPowerLevelSchema = z.number().int().min(0).max(solarPowerResearch.maxLevel);
const solarPanelCountsSchema = z.object({
  standard: z.number().int().min(0),
  mono: z.number().int().min(0),
});

const Page = () => {
  const mounted = useMounted();
  const [activeModuleId, setActiveModuleId] = useLocalStorage("coi-module", activeModuleIdSchema, modules[0].id);
  const [recyclingIncreaseLevel, setRecyclingIncreaseLevel] = useLocalStorage(
    "coi-recycling-increase-level",
    edictLevelSchema,
    defaultActiveEdicts.recyclingIncrease,
  );
  const [cleanPanelsLevel, setCleanPanelsLevel] = useLocalStorage(
    "coi-clean-panels-level",
    cleanPanelsLevelSchema,
    defaultActiveEdicts.cleanPanels,
  );
  const [maintenanceOutputLevel, setMaintenanceOutputLevel] = useLocalStorage(
    "coi-maintenance-output-level",
    maintenanceOutputLevelSchema,
    defaultInfiniteResearchLevels.maintenanceOutput,
  );
  const [solarPowerLevel, setSolarPowerLevel] = useLocalStorage(
    "coi-solar-power-level",
    solarPowerLevelSchema,
    defaultInfiniteResearchLevels.solarPower,
  );
  const [solarPanelCounts, setSolarPanelCounts] = useLocalStorage(
    "coi-solar-panel-counts",
    solarPanelCountsSchema,
    defaultSolarPanelCounts,
  );

  if (!mounted) return <div className="mx-auto max-w-7xl space-y-6 p-6" />;

  const configuredModules = modules.map((module) => (
    module.id === SOLAR_POWER_MODULE_ID
      ? createSolarPowerModule(solarPanelCounts)
      : module
  ));

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
  const recyclingEfficiencyPercent = calculateRecyclingEfficiency(recyclingIncreaseLevel).effectivePercent;
  const maintenanceOutput = calculateMaintenanceOutput(maintenanceOutputLevel);
  const solarPowerOutput = calculateSolarPower(solarPowerLevel, cleanPanelsLevel);
  const outputModifiers = {
    maintenanceOutput: maintenanceOutput.multiplier,
    solarPower: solarPowerOutput.multiplier,
  };
  const factoryResult = calculateFactoryTotal(
    configuredModules,
    activeContracts,
    recyclingEfficiencyPercent,
    outputModifiers,
  );

  const moduleResult = activeModule
    ? (() => {
        const lines = factoryResult.allLines.filter((line) => line.moduleId === activeModule.id);
        const calc = extractModuleResult(activeModule.id, factoryResult.calculation);

        return { lines, ...calc };
      })()
    : null;

  const buildingStats = activeModule && moduleResult
    ? calculateBuildingStats(moduleResult.lines)
    : { workers: 0, electricityKw: 0 };

  const factoryStats = calculateBuildingStats(factoryResult.allLines);

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
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Captain of Industry
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Production Chain Calculator
        </p>
      </div>

      <ModuleSwitcher modules={configuredModules} active={activeModuleId} modifiersId={MODIFIERS_ID} contractsId={CONTRACTS_ID} factoryTotalId={FACTORY_TOTAL_ID} onChange={setActiveModuleId} />

      {activeModule && (
        <p className="text-sm text-muted-foreground">
          {activeModule.description}
        </p>
      )}

      {isModifiers && (
        <ModifiersView
          recyclingIncreaseLevel={recyclingIncreaseLevel}
          onRecyclingIncreaseLevelChange={setRecyclingIncreaseLevel}
          cleanPanelsLevel={cleanPanelsLevel}
          onCleanPanelsLevelChange={setCleanPanelsLevel}
          maintenanceOutputLevel={maintenanceOutputLevel}
          onMaintenanceOutputLevelChange={setMaintenanceOutputLevel}
          solarPowerLevel={solarPowerLevel}
          onSolarPowerLevelChange={setSolarPowerLevel}
        />
      )}

      {isContracts && factoryResult && (
        <ContractsView results={factoryResult.contractResults} />
      )}

      {isFactoryTotal && factoryResult && (
        <NetSummary flows={factoryResult.flows} workers={factoryStats.workers} electricityConsumptionKw={factoryStats.electricityKw} groupByBalance />
      )}

      {activeModule?.id === SOLAR_POWER_MODULE_ID && (
        <SolarPowerSettings
          counts={solarPanelCounts}
          onChange={(panel, count) => {
            setSolarPanelCounts((current) => ({ ...current, [panel]: count }));
          }}
        />
      )}

      {moduleResult && activeModule && (
        <>
          <NetSummary flows={moduleResult.resourceFlows} externalInputs={resolvedExternalInputs} workers={buildingStats.workers} electricityConsumptionKw={buildingStats.electricityKw} />

          {grouped.map(({ group, label, items }) => (
            <div key={group} className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groupSharedProductionLines(items).map(({ key, lines }) => {
                  const line = lines[0];

                  if (!line) return null;

                  if (group === "source") {
                    const result = moduleResult.sourceResults.find((s) => s.recipe.id === line.recipe.id);

                    return result ? (
                      <SinkCard key={line.recipe.id} result={result} role="source" />
                    ) : null;
                  }
                  if (group === "sink") {
                    const result = moduleResult.sinkResults.find((s) => s.recipe.id === line.recipe.id);

                    return result ? (
                      <SinkCard key={line.recipe.id} result={result} role="sink" />
                    ) : null;
                  }

                  if (lines.length > 1) {
                    return (
                      <SharedRecipeCard
                        key={key}
                        lines={lines}
                        results={lines.map((sharedLine) => (
                          moduleResult.regularResults.find(
                            (result) => result.recipe.id === sharedLine.recipe.id,
                          )
                        ))}
                        outputModifiers={outputModifiers}
                      />
                    );
                  }

                  const result = moduleResult.regularResults.find((r) => r.recipe.id === line.recipe.id);

                  if (line.recipe.decayStorage) {
                    return (
                      <StorageCard
                        key={line.recipe.id}
                        recipe={line.recipe}
                        storage={line.recipe.decayStorage}
                        activeCount={line.buildingCount}
                        totalCount={line.totalBuildings}
                        operatingMode={result?.operatingMode ?? "balanced"}
                      />
                    );
                  }

                  return (
                    <RecipeCard
                      key={line.recipe.id}
                      recipe={line.recipe}
                      activeCount={line.buildingCount}
                      totalCount={line.totalBuildings}
                      supplyRatio={result?.supplyRatio ?? 1}
                      operatingMode={result?.operatingMode ?? "balanced"}
                      speedLevel={line.speedLevel}
                      outputModifiers={outputModifiers}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default Page;
