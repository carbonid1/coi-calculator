import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../../helpers/calculate/calculate";
import { mines } from "./mines";

it("leaves Bauxite and Titanium Ore extraction to their named mine modules", () => {
  const lines = buildModuleLines(mines, null).lines;

  expect(lines.find(({ recipe }) => recipe.id === "bauxite-map-mine"))
    .toBeUndefined();
  expect(lines.find(({ recipe }) => recipe.id === "titanium-map-mine"))
    .toBeUndefined();
});

it("demand-mines Coal when local Coal Makers are paused", () => {
  const lines = buildModuleLines(mines, null).lines;
  const result = calculateNet(lines, {}, 90, {}, { coal: 84 });
  const coalMine = result.sourceResults.find(({ recipe }) => (
    recipe.id === "coal-map-mine"
  ));

  expect(coalMine).toMatchObject({ activeBuildings: 1, builtBuildings: 1 });
  expect(coalMine?.actualOutputs).toEqual([{ resourceId: "coal", quantity: 84 }]);
});

it("does not own the Default factory water reserve", () => {
  const lines = buildModuleLines(mines, null).lines;
  const result = calculateNet(lines, {}, 90, {}, { water: 60 });
  const groundwater = result.sourceResults.find(({ recipe }) => (
    recipe.id === "groundwater-pump-factory-reserve"
  ));

  expect(groundwater).toBeUndefined();
  expect(result.allResourceFlows.find(({ resourceId }) => resourceId === "water")).toMatchObject({
    produced: 0,
    consumed: 60,
    net: -60,
  });
});
