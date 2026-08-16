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
    edictLevels: defaultEdictLevels,
    contracts: contract
      ? [{
          id: contract.id,
          name: contract.name,
          importedPerCycle: contract.plan.importedPerProductionCycle,
          fixedUnityPerCycle: contract.unity.perProductionCycle,
          unityPer100Imported: contract.unity.per100Imported,
        }]
      : [],
  });

  const contractCost = budget.consumption.find(
    (item) => item.id === `contract-${contract?.id}`,
  );

  expect(contractCost?.name).toBe("Food Pack → Uranium Ore");
  expect(contractCost?.amount).toBeCloseTo(0.354, 10);
  expect(budget.housingMultiplier).toBe(1.75);
  expect(budget.netPerCycle).toBeCloseTo(2.321, 10);
});
