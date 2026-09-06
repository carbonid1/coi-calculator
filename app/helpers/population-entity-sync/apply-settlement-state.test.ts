import { expect, it } from "vitest";

import { type Module } from "../../db/modules/modules";
import { settlementRecipeIds } from "../../db/settlement";
import { type SyncedProductionEntity } from "../../game-state";
import { isSyncedSettlementState, type SyncedSettlementState } from "../../settlement-state";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { calculateNet } from "../calculate/calculate";
import { applySettlementState } from "./apply-settlement-state";

const residents = settlementRecipeIds.residents;
const householdGoodsModule = settlementRecipeIds.householdGoodsModule;
const populationModule: Module = {
  id: "population", name: "Population", description: "",
  builtBuildings: { [residents]: 2 }, defaultPresetId: "live",
  liveArea: { zoneId: 25, trackedBuildings: 2, constructedBuildings: 2, activeBuildings: 2,
    pausedBuildings: 0, constructionGhosts: 0, issues: [] },
  presets: [{ id: "live", name: "Live", description: "", activeBuildings: { [residents]: 2 },
    fixed: [residents], dataSources: { [residents]: "synced" }, speedLevels: { [residents]: 1 } }],
};
const entities: SyncedProductionEntity[] = [1, 2].map(entityId => ({
  entityId, prototypeId: "HousingT3", running: true, recipeIds: [],
  zones: [{ id: 25, name: "Population" }], nuclearReactor: null, dataCenterRacks: null,
}));
const state: SyncedSettlementState = {
  population: 120, unity: [{ id: "health", name: "Health", amount: -0.3 }],
  settlements: [{ housing: [{ entityId: 1, population: 120, capacity: 240 },
    { entityId: 2, population: 0, capacity: 240 }], population: 120, capacity: 480,
    foodProductIds: ["Potato"], serviceIds: [] }],
};
const calculate = (area = populationModule, snapshot = state) => {
  const result = applySettlementState(area, snapshot, entities);

  return calculateNet(buildModuleLines(result, result.presets[0] ?? null).lines)
    .regularResults.find(line => line.recipe.id === residents);
};

it("uses residents and configured food instead of full occupancy and every food", () => {
  const result = calculate();

  expect(result?.activeBuildings).toBe(2);
  expect(result?.actualInputs.find(item => item.resourceId === "potato")?.quantity).toBeCloseTo(5.04);
  expect(result?.actualInputs.some(item => item.resourceId === "cake")).toBe(false);
  expect(result?.actualInputs.some(item => item.resourceId === "householdGoods")).toBe(false);
});

it("includes goods and healthcare only when their services are configured", () => {
  const result = calculate(populationModule, { ...state, settlements: state.settlements.map(item => ({
    ...item, serviceIds: ["HouseholdGoodsNeed", "HealthCareNeed"],
  })) });

  expect(result?.actualInputs.find(item => item.resourceId === "householdGoods")?.quantity).toBeCloseTo(1.26);
  expect(result?.actualInputs.find(item => item.resourceId === "medicalSupplies")?.quantity).toBeCloseTo(0.6);
});

it("preserves full projected occupancy for an explicit housing expansion", () => {
  const result = calculate({ ...populationModule, presets: populationModule.presets.map(preset => ({ ...preset,
    dataSources: { [residents]: "planned" }, activeBuildings: { [residents]: 3 },
  })) });

  expect(result?.actualInputs.find(item => item.resourceId === "potato")?.quantity).toBeCloseTo(30.24);
});

it("validates signed Unity, unavailable records, and unique housing assignments", () => {
  expect(isSyncedSettlementState(state)).toBe(true);
  expect(isSyncedSettlementState({ ...state, unity: null })).toBe(true);
  expect(isSyncedSettlementState({ ...state, settlements: [...state.settlements, ...state.settlements] })).toBe(false);
  expect(isSyncedSettlementState({ ...state, population: 1 })).toBe(false);
  expect(isSyncedSettlementState({ ...state, unity: [{ id: "health", name: "Health", amount: NaN }] })).toBe(false);
});

it("keeps household goods demand while the module is planned back on", () => {
  const result = calculate({ ...populationModule, presets: populationModule.presets.map(preset => ({
    ...preset,
    activeBuildings: { ...preset.activeBuildings, [householdGoodsModule]: 1 },
    dataSources: { ...preset.dataSources, [householdGoodsModule]: "planned" },
  })) });

  expect(result?.actualInputs.find(item => item.resourceId === "householdGoods")?.quantity)
    .toBeCloseTo(1.26);
});
