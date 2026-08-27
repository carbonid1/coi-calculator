import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../../helpers/calculate/calculate";
import { mines } from "./mines";

it("demand-mines Bauxite and Titanium Ore for the expansion chains", () => {
  const lines = buildModuleLines(mines, null).lines;
  const result = calculateNet(lines, {}, 90, {}, {
    bauxite: 142.5,
    titaniumOre: 38.8,
  });
  const source = (recipeId: string) => result.sourceResults.find(({ recipe }) => (
    recipe.id === recipeId
  ));

  expect(source("bauxite-map-mine")?.actualOutputs)
    .toEqual([{ resourceId: "bauxite", quantity: 142.5 }]);
  expect(source("titanium-map-mine")?.actualOutputs)
    .toEqual([{ resourceId: "titaniumOre", quantity: 38.8 }]);
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

it("does not own the General factory water reserve", () => {
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
