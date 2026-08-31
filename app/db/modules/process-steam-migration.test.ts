import { describe, expect, it } from "vitest";

import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { baseConfig } from "../config";
import { activeContracts } from "../contracts";
import { type ResourceId } from "../resources";
import { DEFAULT_MODULE_ID, defaultArea } from "./default";
import { factoryModelModules, modules, type Module } from "./modules";

const processRecipeIds = [
  "chemical-plant-ii-paper",
  "sour-water-stripper",
  "incineration-plant-waste",
  "distillation-stage-iii-titanium-purification",
] as const;
const processRecipeIdSet = new Set<string>(processRecipeIds);
const depletedRecoveryRecipeId = "cooling-tower-large-depleted";

const withoutKeys = <T>(record: Record<string, T>, keys: readonly string[]) => (
  Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)))
);

const withoutRecipes = (mod: Module, recipeIds: readonly string[]): Module => ({
  ...mod,
  builtBuildings: withoutKeys(mod.builtBuildings, recipeIds),
  presets: mod.presets.map((preset) => ({
    ...preset,
    activeBuildings: withoutKeys(preset.activeBuildings, recipeIds),
    builtBuildings: preset.builtBuildings
      ? withoutKeys(preset.builtBuildings, recipeIds)
      : undefined,
    currentActiveBuildings: preset.currentActiveBuildings
      ? withoutKeys(preset.currentActiveBuildings, recipeIds)
      : undefined,
    dataSources: preset.dataSources
      ? withoutKeys(preset.dataSources, recipeIds)
      : undefined,
    capacityPools: preset.capacityPools
      ? withoutKeys(preset.capacityPools, ["cooling-tower-large-steam"])
      : undefined,
  })),
});

const legacyDefault = withoutRecipes(
  defaultArea,
  [...processRecipeIds, depletedRecoveryRecipeId],
);
const legacyProcessSteam: Module = {
  id: "process-steam",
  name: "Process Steam",
  description: "",
  builtBuildings: {
    "chemical-plant-ii-paper": 2,
    "sour-water-stripper": 1,
    "incineration-plant-waste": 1,
    "distillation-stage-iii-titanium-purification": 1,
  },
  presets: [{
    id: "current-and-planned-process-steam",
    name: "Current process steam",
    description: "",
    activeBuildings: {
      "distillation-stage-iii-titanium-purification": 1,
    },
    fixed: [],
  }],
  defaultPresetId: "current-and-planned-process-steam",
};

const replaceDefault = (replacement: Module) => factoryModelModules.map((mod) => (
  mod.id === DEFAULT_MODULE_ID ? replacement : mod
));
const legacyFactoryModules = [...replaceDefault(legacyDefault), legacyProcessSteam];
const migrationOnlyFactoryModules = replaceDefault(withoutRecipes(
  defaultArea,
  [depletedRecoveryRecipeId],
));

const calculate = (factoryModules: Module[]) => calculateFactoryTotal(factoryModules, {
  contracts: activeContracts,
  recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent,
});

const factorySnapshot = (factoryModules: Module[]) => {
  const result = calculate(factoryModules);
  const round = (quantity: number) => Number(quantity.toFixed(9));
  const stats = calculateBuildingStats(result.allLines, result.calculation);

  return {
    electricityDemandMw: round(result.electricityDemandMw),
    flows: result.flows.map((resourceFlow) => ({
      ...resourceFlow,
      consumed: round(resourceFlow.consumed),
      produced: round(resourceFlow.produced),
      net: round(resourceFlow.net),
    })).toSorted((left, right) => left.resourceId.localeCompare(right.resourceId)),
    stats: {
      workers: stats.workers,
      electricityKw: round(stats.electricityKw),
      computingTflops: round(stats.computingTflops),
    },
  };
};

const flow = (
  result: ReturnType<typeof calculate>,
  resourceId: ResourceId,
) => result.flows.find((candidate) => candidate.resourceId === resourceId);

const resultOutput = (
  result: ReturnType<typeof calculate>,
  recipeId: string,
  resourceId: ResourceId,
) => result.calculation.regularResults.find(
  ({ recipe }) => recipe.id === recipeId,
)?.actualOutputs.find((output) => output.resourceId === resourceId)?.quantity ?? 0;

describe("Process Steam migration", () => {
  it("moves the complete cluster into Default without changing Factory Total", () => {
    expect(factorySnapshot(migrationOnlyFactoryModules)).toEqual(
      factorySnapshot(legacyFactoryModules),
    );
    expect(modules.some(({ id }) => id === "process-steam")).toBe(false);

    const defaultPreset = defaultArea.presets.find(
      ({ id }) => id === defaultArea.defaultPresetId,
    );

    expect(defaultPreset?.dataSources).toMatchObject(Object.fromEntries(
      [...processRecipeIds, depletedRecoveryRecipeId].map((recipeId) => (
        [recipeId, "modeled"]
      )),
    ));
    expect(defaultArea.builtBuildings).toMatchObject({
      "cooling-tower-large-low": 1,
      "cooling-tower-large-depleted": 1,
    });
    expect(defaultPreset?.capacityPools?.["cooling-tower-large-steam"]).toBeUndefined();
  });

  it("balances waste-fired Steam (High) only against demand inside Default", () => {
    const baseline = calculate(factoryModelModules);
    const externalDemand: Module = {
      id: "external-high-steam-demand",
      name: "External",
      description: "",
      builtBuildings: { "external-high-steam-consumer": 1 },
      recipes: [{
        id: "external-high-steam-consumer",
        name: "External High Steam Consumer",
        building: "External High Steam Consumer",
        group: "production",
        inputs: [{ resourceId: "steamHigh", quantity: 5 }],
        outputs: [],
      }],
      presets: [{
        id: "active",
        name: "Active",
        description: "",
        activeBuildings: { "external-high-steam-consumer": 1 },
        fixed: ["external-high-steam-consumer"],
      }],
      defaultPresetId: "active",
    };
    const withExternalDemand = calculate([...factoryModelModules, externalDemand]);
    const internalDemand = baseline.calculation.regularResults
      .filter(({ moduleId, recipe }) => (
        moduleId === DEFAULT_MODULE_ID
        && processRecipeIdSet.has(recipe.id)
      ))
      .reduce((total, line) => total + line.actualInputs.reduce((inputTotal, input) => (
        input.resourceId === "steamHigh" ? inputTotal + input.quantity : inputTotal
      ), 0), 0);
    const baselineSteam = resultOutput(
      baseline,
      "incineration-plant-waste",
      "steamHigh",
    );

    expect(baselineSteam).toBeCloseTo(internalDemand, 6);
    expect(resultOutput(
      withExternalDemand,
      "incineration-plant-waste",
      "steamHigh",
    )).toBeCloseTo(baselineSteam, 6);
    expect(flow(withExternalDemand, "steamHigh")?.net).toBeCloseTo(-5, 6);
  });

  it("recovers Default's Steam (Depleted) through the existing Large Cooling Tower", () => {
    const beforeRecovery = calculate(migrationOnlyFactoryModules);
    const afterRecovery = calculate(factoryModelModules);
    const beforeDepleted = flow(beforeRecovery, "steamDepleted");
    const afterDepleted = flow(afterRecovery, "steamDepleted");
    const beforeWater = flow(beforeRecovery, "water");
    const afterWater = flow(afterRecovery, "water");
    const recoveredSteam = beforeDepleted?.net ?? 0;
    const recoveredWater = recoveredSteam * 72 / 96;
    const unchangedResourceIds = beforeRecovery.flows
      .map(({ resourceId }) => resourceId)
      .filter((resourceId) => !["steamDepleted", "water"].includes(resourceId));
    const tower = afterRecovery.calculation.sinkResults.find(
      ({ moduleId, recipe }) => (
        moduleId === DEFAULT_MODULE_ID && recipe.id === depletedRecoveryRecipeId
      ),
    );

    expect(unchangedResourceIds.map((resourceId) => flow(afterRecovery, resourceId)))
      .toEqual(unchangedResourceIds.map((resourceId) => flow(beforeRecovery, resourceId)));
    expect(afterDepleted?.produced).toBeCloseTo(beforeDepleted?.produced ?? 0, 6);
    expect(afterDepleted?.consumed).toBeCloseTo(recoveredSteam, 6);
    expect(afterDepleted?.net).toBeCloseTo(0, 6);
    expect(afterWater?.produced).toBeCloseTo(
      (beforeWater?.produced ?? 0) + recoveredWater,
      6,
    );
    expect(afterWater?.consumed).toBeCloseTo(beforeWater?.consumed ?? 0, 6);
    expect(tower?.actualInputs).toEqual([{
      resourceId: "steamDepleted",
      quantity: recoveredSteam,
    }]);
    expect(tower?.actualOutputs).toHaveLength(1);
    expect(tower?.actualOutputs[0]?.resourceId).toBe("water");
    expect(tower?.actualOutputs[0]?.quantity).toBeCloseTo(recoveredWater, 6);
    expect(afterRecovery.electricityDemandMw).toBe(beforeRecovery.electricityDemandMw);
    expect(calculateBuildingStats(afterRecovery.allLines, afterRecovery.calculation)).toEqual(
      calculateBuildingStats(beforeRecovery.allLines, beforeRecovery.calculation),
    );
  });
});
