import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateBuildingStats } from "../../helpers/building-stats/building-stats";
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

it("runs one Groundwater Pump as factory water reserve", () => {
  const lines = buildModuleLines(mines, null).lines;
  const result = calculateNet(lines, {}, 90, {}, { water: 60 });
  const groundwater = result.sourceResults.find(({ recipe }) => (
    recipe.id === "groundwater-pump-factory-reserve"
  ));

  expect(groundwater).toMatchObject({
    activeBuildings: 1,
    builtBuildings: 1,
    actualOutputs: [{ resourceId: "water", quantity: 48 }],
  });
  expect(result.allResourceFlows.find(({ resourceId }) => resourceId === "water")).toMatchObject({
    produced: 48,
    consumed: 60,
    net: -12,
  });

  const groundwaterLines = lines.filter(({ recipe }) => (
    recipe.id === "groundwater-pump-factory-reserve"
  ));
  const groundwaterResult = calculateNet(groundwaterLines, {}, 90, {}, { water: 60 });

  expect(calculateBuildingStats(groundwaterLines, groundwaterResult)).toEqual({
    workers: 2,
    electricityKw: 120,
    computingTflops: 0,
  });
});
