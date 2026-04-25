import { describe, expect, it } from "vitest";
import { fbrPowerPlant } from "../../db/modules/fbr-power-plant";
import { fuelReprocessing } from "../../db/modules/fuel-reprocessing";
import { nuclearStation } from "../../db/modules/nuclear-station";
import { recipes } from "../../db/recipes";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { calculateNet, type ProductionLine } from "./calculate";

const { buildingTotals, presets } = nuclearStation;

const buildLines = (presetId: string): ProductionLine[] => {
  const preset = presets.find((p) => p.id === presetId)!;

  return recipes
    .filter((r) => r.id in buildingTotals)
    .map((recipe) => {
      const total = buildingTotals[recipe.id] ?? 0;
      const active = recipe.id in preset.active ? (preset.active[recipe.id] ?? total) : total;

      return { recipe, buildingCount: active, totalBuildings: total };
    });
};

const getNet = (presetId: string) => {
  const preset = presets.find((p) => p.id === presetId)!;
  const lines = buildLines(presetId);
  const pinnedIds = new Set(preset.pinned);
  const { resourceFlows } = calculateNet(lines, pinnedIds);

  return Object.fromEntries(resourceFlows.map((f) => [f.resourceId, Math.round(f.net)]));
};

describe("hydrogen mode", () => {
  it("net summary matches expected values", () => {
    const net = getNet("hydrogen");

    expect(net).toEqual({
      water: 244,
      coreFuel: -4,
      blanketFuel: -4,
      coreFuelSpent: 4,
      blanketFuelEnriched: 4,
      hydrogen: 64,
      oxygen: 64,
      brine: 180,
      electricity: 30,
    });
  });
});

describe("hydrogen full", () => {
  it("net summary matches expected values", () => {
    const net = getNet("hydrogen-full");

    expect(net).toEqual({
      water: 410,
      coreFuel: -4,
      blanketFuel: -4,
      coreFuelSpent: 4,
      blanketFuelEnriched: 4,
      brine: 264,
      electricity: 30,
    });
  });
});

describe("max electricity", () => {
  it("net summary matches expected values", () => {
    const net = getNet("max-electricity");

    expect(net).toEqual({
      water: 6,
      coreFuel: -4,
      blanketFuel: -4,
      coreFuelSpent: 4,
      blanketFuelEnriched: 4,
      brine: 12,
      electricity: 60,
    });
  });
});

describe("edge cases", () => {
  it("buildings scale down when supply is constrained", () => {
    const overrides: Record<string, number> = {
      "seawater-pump": 1,
      "turbine-super": 1,
      "turbine-high": 1,
      "turbine-low": 1,
    };
    const lines: ProductionLine[] = recipes
      .filter((r) => r.id in buildingTotals)
      .map((recipe) => ({
        recipe,
        buildingCount: overrides[recipe.id] ?? (buildingTotals[recipe.id] ?? 0),
        totalBuildings: buildingTotals[recipe.id] ?? 0,
      }));

    const { regularResults } = calculateNet(lines, new Set(["fbr", "turbine-super", "turbine-high", "turbine-low"]));

    const superDesal = regularResults.find((r) => r.recipe.id === "thermal-desalinator-super");

    expect(superDesal?.supplyRatio).toBeLessThan(1);
    expect(superDesal?.supplyRatio).toBeGreaterThan(0);
  });

  it("source deficit shows in net when pumps are insufficient", () => {
    const overrides: Record<string, number> = {
      "seawater-pump": 1,
      "turbine-super": 1,
      "turbine-high": 1,
      "turbine-low": 1,
    };
    const lines: ProductionLine[] = recipes
      .filter((r) => r.id in buildingTotals)
      .map((recipe) => ({
        recipe,
        buildingCount: overrides[recipe.id] ?? (buildingTotals[recipe.id] ?? 0),
        totalBuildings: buildingTotals[recipe.id] ?? 0,
      }));

    const { resourceFlows } = calculateNet(lines, new Set(["fbr", "turbine-super", "turbine-high", "turbine-low"]));
    const seaWater = resourceFlows.find((f) => f.resourceId === "seaWater");

    expect(seaWater).toBeDefined();
    expect(Math.round(seaWater!.net)).toBeLessThan(0);
  });
});

describe("nuclear fuel module", () => {
  it("default preset: fractional capacity with external inputs", () => {
    const preset = fuelReprocessing.presets.find((p) => p.id === "default")!;
    const { lines, pinnedIds } = buildModuleLines(fuelReprocessing, preset);
    const { regularResults, resourceFlows } = calculateNet(lines, pinnedIds, fuelReprocessing.externalInputs);

    // Nuclear reprocessing: 1 building pinned at 0.25
    const reprocessing = regularResults.find((r) => r.recipe.id === "nuclear-reprocessing")!;

    expect(reprocessing.buildingCount).toBe(0.25);
    expect(reprocessing.pinned).toBe(true);
    expect(reprocessing.supplyRatio).toBe(1);

    // Spent fuel: 1 building at full capacity
    const spentFuel = regularResults.find((r) => r.recipe.id === "nuclear-reprocessing-spent-fuel")!;

    expect(spentFuel.buildingCount).toBe(1);
    expect(spentFuel.pinned).toBe(true);

    // Spent MOX: pinned to 0
    const spentMox = regularResults.find((r) => r.recipe.id === "nuclear-reprocessing-spent-mox")!;

    expect(spentMox.buildingCount).toBe(0);

    // External inputs (coreFuelSpent: 4, blanketFuelEnriched: 4) satisfied — not in net
    const net = Object.fromEntries(resourceFlows.map((f) => [f.resourceId, f.net]));

    expect(net.coreFuelSpent).toBeUndefined();
    expect(net.blanketFuelEnriched).toBeUndefined();

    // Outputs: core fuel from reprocessing (3) + enrichment (1) = 4
    // Blanket fuel from enrichment (3) + spent fuel reprocessing (2) = 5
    expect(net.coreFuel).toBe(4);
    expect(net.blanketFuel).toBe(5);
  });

  it("external inputs show deficit when demand exceeds declared supply", () => {
    // Without external inputs, coreFuelSpent and blanketFuelEnriched show as deficits
    const preset = fuelReprocessing.presets.find((p) => p.id === "default")!;
    const { lines, pinnedIds } = buildModuleLines(fuelReprocessing, preset);
    const { resourceFlows } = calculateNet(lines, pinnedIds);

    const net = Object.fromEntries(resourceFlows.map((f) => [f.resourceId, f.net]));

    expect(net.coreFuelSpent).toBe(-4);
    expect(net.blanketFuelEnriched).toBe(-4);
  });
});

describe("FBR power plant module", () => {
  const getPresetNet = (presetId: string) => {
    const preset = fbrPowerPlant.presets.find((p) => p.id === presetId)!;
    const { lines, pinnedIds } = buildModuleLines(fbrPowerPlant, preset);
    const externalInputs = preset.externalInputs ?? fbrPowerPlant.externalInputs;
    const { resourceFlows } = calculateNet(lines, pinnedIds, externalInputs);

    return Object.fromEntries(resourceFlows.map((f) => [f.resourceId, parseFloat(f.net.toFixed(2))]));
  };

  it("1+1: zero UO, burns DU, produces EU20", () => {
    const net = getPresetNet("1+1-burn-du");

    expect(net.coreFuel).toBeUndefined();
    expect(net.blanketFuel).toBeUndefined();
    expect(net.depletedUranium).toBeUndefined(); // external
    expect(net.yellowcake).toBeUndefined(); // not used
    expect(net.enrichedUranium20).toBeGreaterThan(0); // EU20 produced
  });

  it("1+4: no DU, YC only", () => {
    const net = getPresetNet("1+4-steady");

    expect(net.coreFuel).toBeUndefined();
    expect(net.blanketFuel).toBeUndefined();
    expect(net.depletedUranium).toBeUndefined(); // not consumed
    expect(net.yellowcake).toBeUndefined(); // external
  });

  it("1+1: starved buildings have supplyRatio 0", () => {
    const preset = fbrPowerPlant.presets.find((p) => p.id === "1+1-burn-du")!;
    const { lines, pinnedIds } = buildModuleLines(fbrPowerPlant, preset);
    const externalInputs = preset.externalInputs ?? fbrPowerPlant.externalInputs;
    const { regularResults } = calculateNet(lines, pinnedIds, externalInputs);

    // Super desalinator gets 0 super steam (hydrogen reformers consume all remaining)
    const superDesal = regularResults.find((r) => r.recipe.id === "thermal-desalinator-super");

    expect(superDesal).toBeDefined();
    expect(superDesal!.supplyRatio).toBe(0);
  });

  it("1+1: idle sinks have zero actual output", () => {
    const preset = fbrPowerPlant.presets.find((p) => p.id === "1+1-burn-du")!;
    const { lines, pinnedIds } = buildModuleLines(fbrPowerPlant, preset);
    const externalInputs = preset.externalInputs ?? fbrPowerPlant.externalInputs;
    const { sinkResults } = calculateNet(lines, pinnedIds, externalInputs);

    // Cooling towers get no excess steam in 1+1 — all consumed by turbines/reformers/desalinators
    const superCooling = sinkResults.find((r) => r.recipe.id === "cooling-tower-large-super");

    expect(superCooling).toBeDefined();
    expect(superCooling!.actualOutputs.length).toBe(0);
  });
});
