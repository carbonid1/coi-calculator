import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { calculateRecyclingEfficiency } from "../../helpers/modifiers/calculate-recycling-efficiency";
import { activeContracts } from "../contracts";
import { defaultActiveEdicts } from "../edicts";
import { modules } from "./modules";

it("balances Yellowcake production to the FBR's 3 per-cycle demand", () => {
  const result = calculateFactoryTotal(
    modules,
    activeContracts,
    calculateRecyclingEfficiency(defaultActiveEdicts.recyclingIncrease).effectivePercent,
  );
  const yellowcake = result.flows.find((flow) => flow.resourceId === "yellowcake");

  expect(yellowcake?.consumed).toBe(3);
  expect(yellowcake?.produced).toBe(3);
  expect(yellowcake?.net).toBe(0);
});

it("caps demand-balanced Groundwater Pumps and leaves Water at equilibrium", () => {
  const result = calculateFactoryTotal(modules, activeContracts);
  const water = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "water",
  );
  const groundwater = result.calculation.sourceResults.find(
    (candidate) => candidate.recipe.id === "groundwater-pump",
  );
  const pumped = groundwater?.actualOutputs[0]?.quantity ?? 0;

  expect([
    groundwater?.buildingCount,
    pumped > 0,
    pumped <= 4 * 48,
    Number((water?.net ?? NaN).toFixed(10)),
  ]).toEqual([4, true, true, 0]);
});
