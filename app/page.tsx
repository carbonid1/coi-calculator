"use client";

import { z } from "zod";

import { ContractsView } from "./components/ContractsView";
import { ModifiersView } from "./components/ModifiersView";
import { ModuleSwitcher } from "./components/ModuleSwitcher";
import { NetSummary } from "./components/NetSummary";
import { RecipeCard } from "./components/RecipeCard";
import { SinkCard } from "./components/SinkCard";
import { StorageCard } from "./components/StorageCard";
import { buildings } from "./db/buildings";
import { activeContracts } from "./db/contracts";
import { defaultActiveEdicts } from "./db/edicts";
import { modules } from "./db/modules/modules";
import { type RecipeGroup } from "./db/recipes";
import { buildModuleLines } from "./helpers/build-module-lines/build-module-lines";
import { calculateNet } from "./helpers/calculate/calculate";
import { calculateFactoryTotal } from "./helpers/factory-total/factory-total";
import { calculateRecyclingEfficiency } from "./helpers/modifiers/calculate-recycling-efficiency";
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

const activeModuleIdSchema = z.enum([MODIFIERS_ID, CONTRACTS_ID, FACTORY_TOTAL_ID, ...modules.map((m) => m.id)]);
const edictLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const Page = () => {
  const mounted = useMounted();
  const [activeModuleId, setActiveModuleId] = useLocalStorage("coi-module", activeModuleIdSchema, modules[0].id);
  const [recyclingIncreaseLevel, setRecyclingIncreaseLevel] = useLocalStorage(
    "coi-recycling-increase-level",
    edictLevelSchema,
    defaultActiveEdicts.recyclingIncrease,
  );

  if (!mounted) return <div className="mx-auto max-w-7xl space-y-6 p-6" />;

  const isModifiers = activeModuleId === MODIFIERS_ID;
  const isContracts = activeModuleId === CONTRACTS_ID;
  const isFactoryTotal = activeModuleId === FACTORY_TOTAL_ID;
  const activeModule = isModifiers || isContracts || isFactoryTotal
    ? null
    : (modules.find((m) => m.id === activeModuleId) ?? modules[0]);

  const preset = activeModule && activeModule.defaultPresetId
    ? activeModule.presets.find((p) => p.id === activeModule.defaultPresetId)
      ?? activeModule.presets[0]
      ?? null
    : null;

  const resolvedExternalInputs = preset?.externalInputs ?? activeModule?.externalInputs;
  const incomingFromModules = preset?.incomingFromModules ?? activeModule?.incomingFromModules;
  const incomingFromContracts = preset?.incomingFromContracts ?? activeModule?.incomingFromContracts;
  const recyclingEfficiencyPercent = calculateRecyclingEfficiency(recyclingIncreaseLevel).effectivePercent;

  const moduleResult = activeModule
    ? (() => {
        const { lines, pinnedIds } = buildModuleLines(activeModule, preset);
        const calc = calculateNet(lines, pinnedIds, resolvedExternalInputs, recyclingEfficiencyPercent);

        return { lines, ...calc };
      })()
    : null;

  const buildingStats = activeModule && moduleResult
    ? moduleResult.lines.reduce((acc, line) => {
        const data = buildings[line.recipe.building];

        if (!data || line.buildingCount <= 0) return acc;
        return {
          workers: acc.workers + data.workers * Math.ceil(line.buildingCount),
          electricityKw: acc.electricityKw + data.electricityKw * line.buildingCount,
        };
      }, { workers: 0, electricityKw: 0 })
    : { workers: 0, electricityKw: 0 };

  const factoryResult = isContracts || isFactoryTotal
    ? calculateFactoryTotal(modules, activeContracts, recyclingEfficiencyPercent)
    : null;

  const factoryStats = factoryResult
    ? factoryResult.allLines.reduce((acc, line) => {
        const data = buildings[line.recipe.building];

        if (!data || line.buildingCount <= 0) return acc;
        return {
          workers: acc.workers + data.workers * Math.ceil(line.buildingCount),
          electricityKw: acc.electricityKw + data.electricityKw * line.buildingCount,
        };
      }, { workers: 0, electricityKw: 0 })
    : { workers: 0, electricityKw: 0 };

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

      <ModuleSwitcher modules={modules} active={activeModuleId} modifiersId={MODIFIERS_ID} contractsId={CONTRACTS_ID} factoryTotalId={FACTORY_TOTAL_ID} onChange={setActiveModuleId} />

      {isModifiers && (
        <ModifiersView
          recyclingIncreaseLevel={recyclingIncreaseLevel}
          onRecyclingIncreaseLevelChange={setRecyclingIncreaseLevel}
        />
      )}

      {isContracts && factoryResult && (
        <ContractsView results={factoryResult.contractResults} />
      )}

      {isFactoryTotal && factoryResult && (
        <NetSummary flows={factoryResult.flows} workers={factoryStats.workers} electricityConsumptionKw={factoryStats.electricityKw} groupByBalance />
      )}

      {moduleResult && activeModule && (
        <>
          <NetSummary flows={moduleResult.resourceFlows} externalInputs={resolvedExternalInputs} incomingFromModules={incomingFromModules} incomingFromContracts={incomingFromContracts} workers={buildingStats.workers} electricityConsumptionKw={buildingStats.electricityKw} />

          {grouped.map(({ group, label, items }) => (
            <div key={group} className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((line) => {
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
                  const result = moduleResult.regularResults.find((r) => r.recipe.id === line.recipe.id);

                  if (line.recipe.decayStorage) {
                    return (
                      <StorageCard
                        key={line.recipe.id}
                        recipe={line.recipe}
                        storage={line.recipe.decayStorage}
                        activeCount={line.buildingCount}
                        totalCount={line.totalBuildings}
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
                      pinned={result?.pinned ?? false}
                      speedLevel={line.speedLevel}
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
