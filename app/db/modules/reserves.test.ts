import { expect, it } from "vitest";

import { calculateNet } from "../../helpers/calculate/calculate";
import { buildModuleLines } from '../../test-fixtures/build-module-lines';
import { recipes } from "../recipes";
import {
  mapReserveResources,
  reserveResourceCatalog,
} from "../reserve-resources";
import { createReservesModule } from "./reserves";

it("wires every reserve catalog entry into its source recipe and module", () => {
  const reservesModule = createReservesModule(mapReserveResources(() => 1));
  const preset = reservesModule.presets[0];

  for (const reserve of reserveResourceCatalog) {
    expect(recipes).toContainEqual(expect.objectContaining({
      id: reserve.recipeId,
      outputs: [{ resourceId: reserve.resourceId, quantity: 0 }],
      sourceKind: "virtual-provision",
      sourceMode: "demand",
    }));
    expect(reservesModule.builtBuildings[reserve.recipeId]).toBe(1);
    expect(preset?.activeBuildings[reserve.recipeId]).toBe(1);
  }
});

const calculateReserve = (
  resourceId: (typeof reserveResourceCatalog)[number]["resourceId"],
  balance: number | null,
  imported: number,
  demand: number,
  production = 0,
) => {
  const reservesModule = createReservesModule(mapReserveResources(
    reserve => reserve.resourceId === resourceId ? balance : 0,
  ));
  const preset = reservesModule.presets[0] ?? null;
  const result = calculateNet(
    [...buildModuleLines(reservesModule, preset).lines, ...(production > 0 ? [{
      moduleId: 'production', activeBuildings: 1, builtBuildings: 1, speedLevel: 1,
      operatingMode: 'balanced' as const,
      recipe: {
        id: 'production', name: 'Production', building: 'Producer', group: 'production' as const,
        balanceBy: 'output' as const, inputs: [], outputs: [{ resourceId, quantity: production }],
      },
    }] : [])],
    { [resourceId]: imported },
    90,
    {},
    { [resourceId]: demand },
  );
  const recipeId = reserveResourceCatalog.find(
    (reserve) => reserve.resourceId === resourceId,
  )?.recipeId;

  return result.sourceResults.find(({ recipe }) => (
    recipe.id === recipeId
  ));
};

it("uses the synced Gold reserve only for demand left after current supply", () => {
  expect(calculateReserve("gold", 6_000, 2, 5)?.actualOutputs).toEqual([
    { resourceId: "gold", quantity: 3 },
  ]);
  expect(calculateReserve("gold", 6_000, 5, 5)?.actualOutputs).toEqual([
    { resourceId: "gold", quantity: 0 },
  ]);
});

it.each(["fuelGas", "sulfur", "rock", "dirt"] as const)("uses the synced %s reserve only for demand left after current supply", resourceId => {
  expect(calculateReserve(resourceId, 12_000, 8, 72)?.actualOutputs).toEqual([
    { resourceId, quantity: 64 },
  ]);
  expect(calculateReserve(resourceId, 12_000, 72, 72)?.actualOutputs).toEqual([
    { resourceId, quantity: 0 },
  ]);
  expect(calculateReserve(resourceId, 12_000, 8, 72, 24)?.actualOutputs).toEqual([
    { resourceId, quantity: 40 },
  ]);
  expect(calculateReserve(resourceId, 12_000, 8, 20, 24)?.actualOutputs).toEqual([
    { resourceId, quantity: 0 },
  ]);
});

it.each(reserveResourceCatalog)("does not supply $name when storage is empty or unavailable", ({ resourceId }) => {
  expect(calculateReserve(resourceId, 0, 0, 5)).toMatchObject({
    activeBuildings: 0,
    actualOutputs: [{ resourceId, quantity: 0 }],
  });
  expect(calculateReserve(resourceId, null, 0, 5)).toMatchObject({
    activeBuildings: 0,
    actualOutputs: [{ resourceId, quantity: 0 }],
  });
});
