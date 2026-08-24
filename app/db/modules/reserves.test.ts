import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../../helpers/calculate/calculate";
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
  resourceId: "fuelGas" | "gold",
  balance: number | null,
  imported: number,
  demand: number,
) => {
  const reservesModule = createReservesModule({
    fuelGas: resourceId === "fuelGas" ? balance : null,
    gold: resourceId === "gold" ? balance ?? 0 : 0,
  });
  const preset = reservesModule.presets[0] ?? null;
  const result = calculateNet(
    buildModuleLines(reservesModule, preset).lines,
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

it("uses the synced Fuel Gas reserve only for demand left after current supply", () => {
  expect(calculateReserve("fuelGas", 12_000, 8, 72)?.actualOutputs).toEqual([
    { resourceId: "fuelGas", quantity: 64 },
  ]);
  expect(calculateReserve("fuelGas", 12_000, 72, 72)?.actualOutputs).toEqual([
    { resourceId: "fuelGas", quantity: 0 },
  ]);
});

it("does not expose an unbounded reserve source when Gold is empty or unavailable", () => {
  expect(calculateReserve("gold", 0, 0, 5)).toMatchObject({
    activeBuildings: 0,
    actualOutputs: [{ resourceId: "gold", quantity: 0 }],
  });
  expect(calculateReserve("gold", null, 0, 5)).toMatchObject({
    activeBuildings: 0,
    actualOutputs: [{ resourceId: "gold", quantity: 0 }],
  });
});
