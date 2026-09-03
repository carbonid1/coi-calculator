import { describe, expect, it } from "vitest";

import {
  calculateFocusPointsCost,
  calculateOfficeBoostBonusPercent,
  calculateOfficeComputingTflops,
  calculateOfficePlan,
  focusCatalog,
  defaultOfficePlan,
  officeCatalog,
  plannedOfficePlan,
} from "./offices";

describe("offices and focuses", () => {
  it("matches installed v0.8.7 Office tiers and computing boosts", () => {
    expect(officeCatalog.map((office) => [
      office.name,
      office.workers,
      office.electricityKw,
      office.officeSuppliesPerCycle,
      office.computingTflopsAtStepOne,
    ])).toEqual([
      ["Office I", 250, 250, 2, 12],
      ["Office II", 500, 400, 4, 24],
      ["Office III", 1_000, 600, 8, 48],
    ]);
    expect([0, 1, 2].map(calculateOfficeBoostBonusPercent)).toEqual([0, 20, 50]);
    expect(calculateOfficeComputingTflops(officeCatalog[2], 2)).toBe(192);
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
      recyclablesPerCycle: 0,
      workers: 0,
    });
  });

  it("plans one maximally boosted Office III around contracts", () => {
    const result = calculateOfficePlan(plannedOfficePlan, 5);

    expect(result).toMatchObject({
      computingTflops: 192,
      electricityKw: 600,
      focusPointsAvailable: 5,
      focusPointsCapacity: 1_700,
      focusPointsRequired: 1_695,
      isAffordable: true,
      officeSuppliesPerCycle: 8,
      recyclablesPerCycle: 8,
      workers: 1_000,
    });
    expect(result.bonuses.maintenanceProduction).toBe(5);
    expect(result.bonuses.recyclingEfficiency).toBe(2);
    expect(result.bonuses.contractsProfitability).toBe(14);
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
      recyclablesPerCycle: 8,
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
      recyclablesPerCycle: 16,
      workers: 2_000,
    });
  });
});
