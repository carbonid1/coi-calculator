import { expect, it } from "vitest";

import { activeContracts } from "./contracts";
import { defaultEdictLevels } from "./edicts";
import { activeHousingType } from "./housing";
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
