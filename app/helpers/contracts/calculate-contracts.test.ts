import { describe, expect, it } from "vitest";

import { activeContracts } from "../../db/contracts";
import { applyContracts, calculateContractWorkers } from "./calculate-contracts";

describe("fixed contract plans", () => {
  it("keeps the four-module Uranium contract at 54 per month", () => {
    const { contractResults, flows } = applyContracts([
      {
        resourceId: "uraniumOre",
        name: "Uranium Ore",
        consumed: 72,
        produced: 0,
        net: -72,
      },
    ], activeContracts);
    const uranium = flows.find((flow) => flow.resourceId === "uraniumOre");
    const foodPack = flows.find((flow) => flow.resourceId === "foodPack");

    expect(contractResults.at(0)).toMatchObject({
      exported: 36,
      imported: 54,
      requiredImported: 72,
      uncoveredImported: 18,
    });
    expect(uranium).toMatchObject({ consumed: 72, produced: 54, net: -18 });
    expect(foodPack).toMatchObject({ consumed: 36, produced: 0, net: -36 });
  });

  it("counts the planned ship and four cargo modules", () => {
    expect(calculateContractWorkers(activeContracts)).toBe(42);
    expect(activeContracts[0]?.plan.shipping.importedPerTrip).toBe(1_000);
  });
});
