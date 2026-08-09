import { expect, it } from "vitest";
import { general } from "../../db/modules/general";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { calculateNet } from "./calculate";

it("matches the verified yellowcake game rates", () => {
  const preset = general.presets.find((candidate) => candidate.id === general.defaultPresetId)!;
  const { lines, pinnedIds } = buildModuleLines(general, preset);
  const settlingTank = lines.find((line) => line.recipe.id === "settling-tank")!;
  const uraniumOrePowder = settlingTank.recipe.inputs.find((input) => input.resourceId === "uraniumOrePowder")!;
  const { resourceFlows } = calculateNet(lines, pinnedIds);
  const yellowcake = resourceFlows.find((flow) => flow.resourceId === "yellowcake")!;

  expect(uraniumOrePowder.quantity * settlingTank.buildingCount * settlingTank.speedLevel).toBe(72);
  expect(yellowcake.produced).toBe(12);
});
