import { expect, it } from "vitest";

import { buildModuleLines } from "../../helpers/build-module-lines/build-module-lines";
import { calculateNet } from "../../helpers/calculate/calculate";
import { recipes } from "../recipes";
import { mines } from "./mines";

it("contains only the Sulfur world mine and terrain disposal", () => {
  const lines = buildModuleLines(mines, null).lines;

  expect(lines.filter(({ recipe }) => recipe.group === "source").map(
    ({ recipe }) => recipe.id,
  )).toEqual(["sulfur-world-mine"]);
  expect(lines.filter(({ recipe }) => recipe.group === "sink").map(
    ({ recipe }) => recipe.id,
  )).toEqual([
    "slag-terrain-dump",
    "waste-terrain-dump",
    "dirt-terrain-dump",
  ]);
});

it("does not register legacy global terrain-extraction recipes", () => {
  expect(recipes.some(({ sourceKind }) => sourceKind === "terrain-mine")).toBe(false);
});

it("does not fabricate Coal, Copper Ore, or Sand supply", () => {
  const result = calculateNet(buildModuleLines(mines, null).lines, {}, 90, {}, {
    coal: 84,
    copperOre: 20,
    sand: 30,
  });

  expect(result.allResourceFlows.find(({ resourceId }) => resourceId === "coal"))
    .toMatchObject({ produced: 0, consumed: 84, net: -84 });
  expect(result.allResourceFlows.find(({ resourceId }) => resourceId === "copperOre"))
    .toMatchObject({ produced: 0, consumed: 20, net: -20 });
  expect(result.allResourceFlows.find(({ resourceId }) => resourceId === "sand"))
    .toMatchObject({ produced: 0, consumed: 30, net: -30 });
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
