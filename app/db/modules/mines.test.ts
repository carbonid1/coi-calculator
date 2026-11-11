import { expect, it } from "vitest";

import { calculateNet } from "../../helpers/calculate/calculate";
import { buildModuleLines } from '../../test-fixtures/build-module-lines';
import { recipes } from "../recipes";
import { createMinesModule, mines } from "./mines";

it("contains terrain disposal without a fabricated world-mine source", () => {
  const lines = buildModuleLines(mines, null).lines;

  expect(lines.filter(({ recipe }) => recipe.group === "source").map(
    ({ recipe }) => recipe.id,
  )).toEqual([]);
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

it("leaves Waste as surplus when its terrain disposal is disabled", () => {
  const plannedMines = createMinesModule({ dumpWaste: false });
  const result = calculateNet(buildModuleLines(plannedMines, null).lines, { waste: 20, slag: 10, dirt: 5 });

  expect(result.allResourceFlows.find(flow => flow.resourceId === "waste")?.net).toBe(20);
  expect(result.sinkResults.map(sink => sink.actualInputs)).toEqual([
    [{ resourceId: "slag", quantity: 10 }],
    [{ resourceId: "dirt", quantity: 5 }],
  ]);
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
