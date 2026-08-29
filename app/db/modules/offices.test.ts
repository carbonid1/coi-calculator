import { describe, expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { baseConfig } from "../config";
import { defaultOfficePlan } from "../offices";
import { createOfficesModule } from "./offices";

describe("Offices module", () => {
  it("balances one Office III against the planned Office Supplies assembler", () => {
    const plan = {
      ...defaultOfficePlan,
      officeSuppliesAssemblyVCount: 1,
      offices: {
        ...defaultOfficePlan.offices,
        officeIII: { count: 1, computingBoostStep: 2 as const },
      },
    };
    const result = calculateFactoryTotal(
      [createOfficesModule(plan)],
      { recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent },
    );
    const office = result.calculation.regularResults.find(
      (candidate) => candidate.recipe.id === "officeIII-boost-2",
    );
    const supplies = result.calculation.regularResults.find(
      (candidate) => candidate.recipe.id === "assembly-v-office-supplies",
    );
    const flow = (resourceId: "officeSupplies" | "paper" | "householdGoods" | "electronicsII") => (
      result.flows.find((candidate) => candidate.resourceId === resourceId)
    );

    expect(office).toMatchObject({ activeBuildings: 1, supplyRatio: 1 });
    expect(supplies?.supplyRatio).toBeCloseTo(1 / 6);
    expect(flow("officeSupplies")).toMatchObject({ consumed: 8, net: 0, produced: 8 });
    expect(flow("paper")?.net).toBeCloseTo(-4);
    expect(flow("householdGoods")?.net).toBeCloseTo(-8 / 3);
    expect(flow("electronicsII")?.net).toBeCloseTo(-4 / 3);
    expect(result.computingDemandTflops).toBe(198);
  });
});
