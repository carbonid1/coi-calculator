import { describe, expect, it } from "vitest";

import { testBuildingDefinitions } from '../test-fixtures/building-requirements'

import {
  calculateFocusPointsCost,
  calculateOfficeBoostBonusPercent,
  calculateOfficeComputingTflops,
  calculateOfficePlan as calculateLiveOfficePlan,
  type OfficePlan,
  type OfficeConfigurationCount,
  focusCatalog,
  defaultOfficePlan,
  officeCatalog,
  plannedOfficePlan,
} from "./offices";

const calculateOfficePlan = (plan: OfficePlan, level: number, configurations?: readonly OfficeConfigurationCount[]) => (
  calculateLiveOfficePlan(plan, level, configurations, testBuildingDefinitions)
)

describe("offices and focuses", () => {
  it("keeps Office recipes and computing boost arithmetic consistent", () => {
    expect(officeCatalog.map((office) => [
      office.name,
      office.officeSuppliesPerCycle,
    ])).toEqual([
      ["Office I", 2],
      ["Office II", 4],
      ["Office III", 8],
    ]);
    expect([0, 1, 2].map(calculateOfficeBoostBonusPercent)).toEqual([0, 20, 50]);
    expect(calculateOfficeComputingTflops(48, 2)).toBe(192);
  });

  it('uses current building requirements for Office costs and Focus capacity', () => {
    const result = calculateLiveOfficePlan(plannedOfficePlan, 8, undefined, [{
      id: 'OfficeBuildingT3', name: 'Office III', workers: 10, electricityKw: 7, computingTflops: 2, unityPerCycle: 0,
    }]);

    expect(result).toMatchObject({ workers: 30, electricityKw: 21, computingTflops: 24, focusPointsCapacity: 54 });
    expect(() => calculateLiveOfficePlan(plannedOfficePlan, 8)).toThrow('Building requirements unavailable for Office III');
  });

  it("uses the game's cumulative arithmetic-series Focus cost", () => {
    const research = focusCatalog.find((focus) => focus.id === "researchEfficiency");

    expect(research).toBeDefined();
    expect(research && calculateFocusPointsCost(research, 1)).toBe(25);
    expect(research && calculateFocusPointsCost(research, 2)).toBe(60);
    expect(research && calculateFocusPointsCost(research, 10)).toBe(700);
  });

  it("marks effects without active calculator consumers as informational", () => {
    expect(focusCatalog.filter((focus) => !focus.modeledInCalculator).map(
      (focus) => focus.id,
    )).toEqual(["trucksCapacity", "trainsCapacity", "worldMinesEfficiency"]);
  });

  it("keeps the default empty when no plan or sync value exists", () => {
    const result = calculateOfficePlan(defaultOfficePlan, 5);

    expect(result).toMatchObject({
      computingTflops: 0,
      electricityKw: 0,
      focusPointsAvailable: 0,
      focusPointsCapacity: 0,
      focusPointsRequired: 0,
      focusResearchBonusPercent: 20,
      isAffordable: true,
      officeSuppliesPerCycle: 0,
      workers: 0,
    });
  });

  it("plans Office capacity without imposing completed Focus allocations", () => {
    const result = calculateOfficePlan(plannedOfficePlan, 8);

    expect(result).toMatchObject({
      computingTflops: 576,
      electricityKw: 1_800,
      focusPointsAvailable: 5_460,
      focusPointsCapacity: 5_460,
      focusPointsRequired: 0,
      isAffordable: true,
      officeSuppliesPerCycle: 24,
      workers: 3_000,
    });
    expect(result.bonuses.maintenanceProduction).toBe(0);
    expect(result.bonuses.recyclingEfficiency).toBe(0);
    expect(result.bonuses.contractsProfitability).toBe(0);
  });

  it("calculates a source-owned future plan", () => {
    const result = calculateOfficePlan({
      ...defaultOfficePlan,
      officeSuppliesAssemblyVCount: 1,
      offices: {
        ...defaultOfficePlan.offices,
        officeIII: { count: 1, computingBoostStep: 2 },
      },
      focusSteps: {
        ...defaultOfficePlan.focusSteps,
        researchEfficiency: 10,
        maintenanceProduction: 10,
      },
    }, 5);

    expect(result).toMatchObject({
      computingTflops: 192,
      electricityKw: 600,
      focusPointsAvailable: 300,
      focusPointsCapacity: 1_700,
      focusPointsRequired: 1_400,
      isAffordable: true,
      officeSuppliesPerCycle: 8,
      workers: 1_000,
    });
    expect(result.bonuses.researchEfficiency).toBe(20);
    expect(result.bonuses.maintenanceProduction).toBe(10);
  });

  it("calculates mixed synced computing boosts exactly", () => {
    const result = calculateOfficePlan(plannedOfficePlan, 5, [
      { tierId: "officeIII", computingBoostStep: 0, count: 1 },
      { tierId: "officeIII", computingBoostStep: 2, count: 1 },
    ]);

    expect(result).toMatchObject({
      computingTflops: 192,
      electricityKw: 1_200,
      focusPointsCapacity: 2_900,
      officeSuppliesPerCycle: 16,
      workers: 2_000,
    });
  });
});
