import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { activeContracts } from "../contracts";
import { modules } from "./modules";

it("balances graphite production", () => {
  const result = calculateFactoryTotal(modules, activeContracts);
  const graphite = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "graphite",
  )!;
  const carbonDioxide = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "carbonDioxide",
  )!;
  const graphiteResults = result.calculation.regularResults.filter(
    (candidate) => candidate.recipe.id.startsWith("chemical-plant-ii-graphite"),
  );
  const carbonDioxideResult = graphiteResults.find(
    (candidate) => candidate.recipe.id === "chemical-plant-ii-graphite",
  )!;
  const coalResult = graphiteResults.find(
    (candidate) => candidate.recipe.id === "chemical-plant-ii-graphite-coal",
  )!;

  expect(carbonDioxideResult.totalBuildings).toBe(9);
  expect(coalResult.totalBuildings).toBe(9);
  expect(carbonDioxideResult.supplyRatio).toBeGreaterThan(0);
  expect(coalResult.supplyRatio).toBeGreaterThan(0);
  expect(carbonDioxideResult.recipe.sharedCapacity?.priority).toBe(1);
  expect(coalResult.recipe.sharedCapacity?.priority).toBe(2);
  expect(coalResult.recipe.electricityMultiplier).toBe(2);
  expect(carbonDioxide.net).toBeCloseTo(0);
  expect(graphite.produced).toBeCloseTo(graphite.consumed);
  expect(graphite.net).toBeCloseTo(0);
});
