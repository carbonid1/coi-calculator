import { describe, expect, it } from "vitest";

import {
  calculateFocusPointsCost,
  calculateOfficeBoostBonusPercent,
  calculateOfficeComputingTflops,
  calculateOfficePlan,
  focusCatalog,
  defaultOfficePlan,
  officeCatalog,
  resolvedOfficePlan,
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

  it("starts empty when no plan or sync value exists", () => {
    const result = calculateOfficePlan(resolvedOfficePlan.value, 5);

    expect(resolvedOfficePlan.source).toBe("default");
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
});
