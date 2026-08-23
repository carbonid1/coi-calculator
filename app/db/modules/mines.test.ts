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
