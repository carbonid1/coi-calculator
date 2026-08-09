import { expect, it } from "vitest";
import { general } from "../../db/modules/general";
import { maintenance } from "../../db/modules/maintenance";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { calculateMaintenanceOutput } from "../modifiers/calculate-maintenance-output";
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

  const maintenancePreset = maintenance.presets.find(
    (candidate) => candidate.id === maintenance.defaultPresetId,
  )!;
  const maintenanceOutput = calculateMaintenanceOutput(3);
  const outputModifiers = { maintenanceOutput: maintenanceOutput.multiplier };
  const maintenanceLine = buildModuleLines(maintenance, maintenancePreset, outputModifiers).lines.find(
    (line) => line.recipe.id === "maintenance-i-recycling",
  )!;
  const maintenanceResult = calculateNet(
    [maintenanceLine],
    new Set([maintenanceLine.recipe.id]),
    {},
    50,
    outputModifiers,
  );
  const recyclables = maintenanceResult.resourceFlows.find(
    (flow) => flow.resourceId === "recyclables",
  )!;

  expect({
    produced: Number(recyclables.produced.toFixed(5)),
    sourceValue: Number(recyclables.recyclableSourceValueProduced?.toFixed(5)),
  }).toEqual({ produced: 14.24242, sourceValue: 7.12121 });
});
