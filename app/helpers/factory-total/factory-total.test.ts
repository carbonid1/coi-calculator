import { describe, expect, it } from "vitest";

import { contracts } from "../../db/contracts";
import { modules } from "../../db/modules/modules";
import { calculateFactoryTotal } from "./factory-total";

describe("Factory Total contracts", () => {
  it("uses an enabled import contract before demand-balanced extraction", () => {
    const contract = contracts.find((candidate) => (
      candidate.id === "iron-ore-for-server"
    ));

    expect(contract).toBeDefined();

    const result = calculateFactoryTotal(modules, contract ? [contract] : []);
    const contractResult = result.contractResults.at(0);
    const ironMine = result.calculation.sourceResults.find((candidate) => (
      candidate.recipe.id === "iron-map-mine"
    ));

    expect(contractResult?.imported ?? 0).toBeGreaterThan(0);
    expect(contractResult?.exported ?? 0).toBeGreaterThan(0);
    expect(ironMine?.actualOutputs.at(0)?.quantity ?? -1).toBe(0);
  });
});
