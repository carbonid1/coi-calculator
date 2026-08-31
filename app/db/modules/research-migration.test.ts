import { describe, expect, it } from "vitest";

import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { baseConfig } from "../config";
import { activeContracts } from "../contracts";
import {
  defaultResearchProductionConfig,
  defaultResearchRecipeId,
  DEFAULT_MODULE_ID,
  defaultArea,
  modeledDefaultResearchBuildings,
} from "./default";
import { factoryModelModules, modules, type Module } from "./modules";
import { RESEARCH_MODULE_ID } from "./research";

const researchRecipeIds = Object.keys(modeledDefaultResearchBuildings);

const withoutKeys = <T>(record: Record<string, T>, keys: readonly string[]) => (
  Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)))
);

const legacyDefault: Module = {
  ...defaultArea,
  builtBuildings: withoutKeys(defaultArea.builtBuildings, researchRecipeIds),
  presets: defaultArea.presets.map((preset) => ({
    ...preset,
    activeBuildings: withoutKeys(preset.activeBuildings, researchRecipeIds),
    builtBuildings: preset.builtBuildings
      ? withoutKeys(preset.builtBuildings, researchRecipeIds)
      : undefined,
    dataSources: preset.dataSources
      ? withoutKeys(preset.dataSources, researchRecipeIds)
      : undefined,
    fixed: preset.fixed.filter((recipeId) => recipeId !== defaultResearchRecipeId),
  })),
};

const legacyResearch: Module = {
  id: RESEARCH_MODULE_ID,
  name: "Research",
  description: "",
  builtBuildings: modeledDefaultResearchBuildings,
  presets: [{
    id: "planning-baseline",
    name: "Planning baseline",
    description: "",
    activeBuildings: modeledDefaultResearchBuildings,
    fixed: [defaultResearchRecipeId],
  }],
  defaultPresetId: "planning-baseline",
};

const legacyFactoryModules = [
  ...factoryModelModules.map((module) => (
    module.id === DEFAULT_MODULE_ID ? legacyDefault : module
  )),
  legacyResearch,
];

const factorySnapshot = (factoryModules: Module[]) => {
  const result = calculateFactoryTotal(factoryModules, {
    contracts: activeContracts,
    recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent,
  });
  const stats = calculateBuildingStats(result.allLines, result.calculation);
  const round = (value: number) => Number(value.toFixed(9));

  return {
    electricityDemandMw: round(result.electricityDemandMw),
    flows: result.flows.map((flow) => ({
      resourceId: flow.resourceId,
      consumed: round(flow.consumed),
      produced: round(flow.produced),
      net: round(flow.net),
    })).toSorted((left, right) => left.resourceId.localeCompare(right.resourceId)),
    stats: {
      workers: stats.workers,
      electricityKw: round(stats.electricityKw),
      computingTflops: round(stats.computingTflops),
    },
  };
};

describe("Research migration", () => {
  it("moves Research buildings into Default without changing Factory Total", () => {
    expect(factorySnapshot(factoryModelModules)).toEqual(factorySnapshot(legacyFactoryModules));
    expect(modules.some(({ id }) => id === RESEARCH_MODULE_ID)).toBe(false);
  });

  it("keeps the physical research plan in Default", () => {
    const preset = defaultArea.presets.find(({ id }) => id === defaultArea.defaultPresetId);

    expect(defaultResearchProductionConfig).toEqual({
      activeResearchLabIvCount: 2,
      mode: "space",
    });
    expect(defaultArea.builtBuildings).toMatchObject(modeledDefaultResearchBuildings);
    expect(preset?.activeBuildings).toMatchObject(modeledDefaultResearchBuildings);
    expect(preset?.dataSources).toMatchObject(Object.fromEntries(
      researchRecipeIds.map((recipeId) => [recipeId, "modeled"]),
    ));
    expect(preset?.fixed).toContain(defaultResearchRecipeId);
  });
});
