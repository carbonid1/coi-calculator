import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../../helpers/calculate/calculate";
import { mines } from "./mines";

it("uses the virtual Gold provision only for the unresolved deficit", () => {
  const lines = buildModuleLines(mines, null).lines;
  const result = calculateNet(lines, { gold: 2 }, 90, {}, { gold: 5 });
  const provision = result.sourceResults.find(({ recipe }) => (
    recipe.id === "gold-virtual-provision"
  ));

  expect(provision?.recipe.outputs).toEqual([{ resourceId: "gold", quantity: 0 }]);
  expect(provision?.actualOutputs).toEqual([{ resourceId: "gold", quantity: 3 }]);
});

it("stops the virtual Gold provision when there is no deficit", () => {
  const lines = buildModuleLines(mines, null).lines;
  const result = calculateNet(lines, { gold: 5 }, 90, {}, { gold: 5 });
  const provision = result.sourceResults.find(({ recipe }) => (
    recipe.id === "gold-virtual-provision"
  ));

  expect(provision?.actualOutputs).toEqual([{ resourceId: "gold", quantity: 0 }]);
});
