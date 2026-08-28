import { expect, it } from "vitest";

import { activeContracts } from "./contracts";
import { defaultEdictLevels } from "./edicts";
import { activeHousingType, housingTypes } from "./housing";
import { calculateUnityBudget } from "./unity";

it("includes recurring Unity for every active contract", () => {
  const contract = activeContracts[0];

  expect(contract).toBeDefined();

  const budget = calculateUnityBudget({
    housing: activeHousingType,
    housingCount: 1,
    housingCapacityMultiplier: 1,
    unityCapacityMultiplier: 1.25,
    edictLevels: defaultEdictLevels,
    contracts: contract
      ? [{
          id: contract.id,
          name: contract.name,
          importedPerCycle: contract.plan.importedPerProductionCycle ?? 0,
          fixedUnityPerCycle: contract.unity.perProductionCycle,
          unityPer100Imported: contract.unity.per100Imported,
        }]
      : [],
    buildingGeneration: [{
      id: "space-station",
      name: "Space Station level 4",
      amount: 0.3,
    }],
  });

  const contractCost = budget.consumption.find(
    (item) => item.id === `contract-${contract?.id}`,
  );

  expect(contractCost?.name).toBe("Food Pack → Uranium Ore");
  expect(contractCost?.amount).toBeCloseTo(0.354, 10);
  expect(budget.housingMultiplier).toBe(1.75);
  expect(budget.storageCapacity).toBe(47.5);
  expect(budget.generation).toContainEqual({
    id: "space-station",
    name: "Space Station level 4",
    amount: 0.3,
  });
  expect(budget.netPerCycle).toBeCloseTo(0.621, 10);
});

it("applies Office Focuses to settlement generation and contract cost", () => {
  const contract = activeContracts[0];
  const input = {
    housing: activeHousingType,
    housingCount: 1,
    housingCapacityMultiplier: 1,
    unityCapacityMultiplier: 1,
    edictLevels: defaultEdictLevels,
    contracts: contract
      ? [{
          id: contract.id,
          name: contract.name,
          importedPerCycle: contract.plan.importedPerProductionCycle ?? 0,
          fixedUnityPerCycle: contract.unity.perProductionCycle,
          unityPer100Imported: contract.unity.per100Imported,
        }]
      : [],
  };
  const baseline = calculateUnityBudget(input);
  const focused = calculateUnityBudget({
    ...input,
    contractsUnityCostPercent: -25,
    settlementUnityBonusPercent: 10,
  });

  const nonSettlementGeneration = baseline.generation
    .filter((item) => item.id === "production-edicts")
    .reduce((total, item) => total + item.amount, 0);
  const contractConsumption = baseline.consumption
    .filter((item) => item.id.startsWith("contract-"))
    .reduce((total, item) => total + item.amount, 0);

  expect(focused.generationPerCycle).toBeCloseTo(
    (baseline.generationPerCycle - nonSettlementGeneration) * 1.1
      + nonSettlementGeneration,
    10,
  );
  expect(focused.consumptionPerCycle).toBeCloseTo(
    baseline.consumptionPerCycle - contractConsumption
      + contractConsumption * 0.75,
    10,
  );
});

it("includes additional synced housing tiers in Unity storage", () => {
  const budget = calculateUnityBudget({
    housing: activeHousingType,
    housingCount: 1,
    additionalHousing: [{ housing: housingTypes.housingII, housingCount: 2 }],
    housingCapacityMultiplier: 1,
    unityCapacityMultiplier: 1,
    edictLevels: defaultEdictLevels,
    contracts: [],
  });

  expect(budget.storageCapacity).toBe(
    20 + activeHousingType.unityStorage + 2 * housingTypes.housingII.unityStorage,
  );
});
