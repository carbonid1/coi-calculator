import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../../helpers/calculate/calculate";
import {
  createReservesModule,
  GOLD_RESERVE_RECIPE_ID,
} from "./reserves";

const calculateGoldReserve = (
  balance: number | null,
  imported: number,
  demand: number,
) => {
  const reservesModule = createReservesModule(balance === null ? null : { gold: balance });
  const preset = reservesModule.presets[0] ?? null;
  const result = calculateNet(
    buildModuleLines(reservesModule, preset).lines,
    { gold: imported },
    90,
    {},
    { gold: demand },
  );

  return result.sourceResults.find(({ recipe }) => (
    recipe.id === GOLD_RESERVE_RECIPE_ID
  ));
};

it("uses the synced Gold reserve only for demand left after current supply", () => {
  expect(calculateGoldReserve(6_000, 2, 5)?.actualOutputs).toEqual([
    { resourceId: "gold", quantity: 3 },
  ]);
  expect(calculateGoldReserve(6_000, 5, 5)?.actualOutputs).toEqual([
    { resourceId: "gold", quantity: 0 },
  ]);
});

it("does not expose an unbounded reserve source when Gold is empty or unavailable", () => {
  expect(calculateGoldReserve(0, 0, 5)).toMatchObject({
    activeBuildings: 0,
    actualOutputs: [{ resourceId: "gold", quantity: 0 }],
  });
  expect(calculateGoldReserve(null, 0, 5)).toMatchObject({
    activeBuildings: 0,
    actualOutputs: [{ resourceId: "gold", quantity: 0 }],
  });
});
