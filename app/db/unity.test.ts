import { expect, it } from "vitest";

import { defaultEdictLevels, edictCatalog } from "./edicts";
import { activeHousingType, housingTypes } from "./housing";
import { calculateUnityBudget } from "./unity";

const edictLevels = { ...defaultEdictLevels };

for (const edict of edictCatalog) edictLevels[edict.id] = 0;
const input = {
  housing: activeHousingType,
  housingCount: 1,
  unityCapacityMultiplier: 1.25,
  edictLevels,
  contracts: [],
  settlementUnity: [
    { id: "food", name: "Food", amount: 2.75 },
    { id: "quality", name: "Settlement quality", amount: 0.23 },
    { id: "health", name: "Health", amount: -0.4 },
  ],
};

it("uses signed settlement records without inventing quality or health income", () => {
  const budget = calculateUnityBudget(input);

  expect(budget.generationPerCycle).toBeCloseTo(2.98);
  expect(budget.consumptionPerCycle).toBeCloseTo(0.4);
  expect(budget.netPerCycle).toBeCloseTo(2.58);
  expect(budget.storageCapacity).toBe(47.5);
});

it("retains planned building and contract costs without multiplying synced income again", () => {
  const budget = calculateUnityBudget({
    ...input,
    contracts: [{ id: "uranium", name: "Uranium", importedPerCycle: 54,
      fixedUnityPerCycle: 0.3, unityPer100Imported: 0.1 }],
    contractsUnityCostPercent: -25,
    buildingGeneration: [{ id: "station", name: "Space Station", amount: 0.3 }],
    buildingConsumption: [{ id: "lab", name: "Research Lab", amount: 0.5 }],
  });

  expect(budget.generationPerCycle).toBeCloseTo(3.28);
  expect(budget.consumptionPerCycle).toBeCloseTo(0.4 + 0.354 * 0.75 + 0.5);
});

it("keeps missing monthly records unavailable rather than replacing them with defaults", () => {
  const budget = calculateUnityBudget({ ...input, settlementUnity: null });

  expect(budget.generationPerCycle).toBeNull();
  expect(budget.netPerCycle).toBeNull();
  expect(budget.generation).toEqual([]);
  expect(calculateUnityBudget({ ...input, settlementUnity: [] }).generationPerCycle).toBe(0);
});

it("includes additional synced housing tiers in Unity storage", () => {
  const budget = calculateUnityBudget({
    ...input, unityCapacityMultiplier: 1,
    additionalHousing: [{ housing: housingTypes.housingII, housingCount: 2 }],
  });

  expect(budget.storageCapacity).toBe(20 + activeHousingType.unityStorage + 2 * housingTypes.housingII.unityStorage);
});
