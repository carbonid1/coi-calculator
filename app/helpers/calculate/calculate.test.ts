import { expect, it } from "vitest";
import { general } from "../../db/modules/general";
import { maintenance } from "../../db/modules/maintenance";
import { type Recipe, recipes } from "../../db/recipes";
import { buildModuleLines } from "../build-module-lines/build-module-lines";
import { calculateMaintenanceOutput } from "../modifiers/calculate-maintenance-output";
import { calculateNet } from "./calculate";

const fixedLine = (recipe: Recipe, moduleId: string, activeBuildings = 1) => ({
  recipe,
  moduleId,
  activeBuildings,
  builtBuildings: activeBuildings,
  speedLevel: 1,
  operatingMode: "fixed" as const,
});

it("installs two demand-balanced tanks with the verified per-building Yellowcake capacity", () => {
  const preset = general.presets.find((candidate) => candidate.id === general.defaultPresetId)!;
  const { lines } = buildModuleLines(general, preset);
  const settlingTank = lines.find((line) => line.recipe.id === "settling-tank")!;
  const uraniumOrePowder = settlingTank.recipe.inputs.find((input) => input.resourceId === "uraniumOrePowder")!;
  const yellowcakeCapacity = settlingTank.recipe.outputs.find(
    (output) => output.resourceId === "yellowcake",
  )!.quantity * settlingTank.activeBuildings * settlingTank.speedLevel;

  expect(settlingTank.operatingMode).toBe("balanced");
  expect(uraniumOrePowder.quantity * settlingTank.activeBuildings * settlingTank.speedLevel).toBe(72);
  expect(yellowcakeCapacity).toBe(12);

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
  }).toEqual({ produced: 19.92, sourceValue: 19.92 });
});

it("limits module-scoped Groundwater Pumps to their module's Water demand", () => {
  const groundwaterPump = recipes.find((recipe) => recipe.id === "groundwater-pump")!;
  const farmWaterConsumer: Recipe = {
    id: "test-farm-water-consumer",
    name: "Test Farm Water Consumer",
    building: "Test Farm",
    group: "production",
    inputs: [{ resourceId: "water", quantity: 100 }],
    outputs: [],
  };
  const remoteWaterConsumer: Recipe = {
    id: "test-remote-water-consumer",
    name: "Test Remote Water Consumer",
    building: "Test Remote",
    group: "production",
    inputs: [{ resourceId: "water", quantity: 500 }],
    outputs: [],
  };
  const withoutRemoteDemand = calculateNet([
    fixedLine(groundwaterPump, "farms", 5),
    fixedLine(farmWaterConsumer, "farms"),
  ]);
  const withRemoteDemand = calculateNet([
    fixedLine(groundwaterPump, "farms", 5),
    fixedLine(farmWaterConsumer, "farms"),
    fixedLine(remoteWaterConsumer, "general"),
  ]);
  const pumped = (result: ReturnType<typeof calculateNet>) => (
    result.sourceResults.find((candidate) => (
      candidate.moduleId === "farms"
      && candidate.recipe.id === "groundwater-pump"
    ))?.actualOutputs[0]?.quantity ?? 0
  );
  const waterNet = (result: ReturnType<typeof calculateNet>) => (
    result.allResourceFlows.find((flow) => flow.resourceId === "water")?.net ?? 0
  );
  const reportedWaterNet = (result: ReturnType<typeof calculateNet>) => (
    result.resourceFlows.find((flow) => flow.resourceId === "water")?.net ?? 0
  );

  expect(groundwaterPump.sourceMode).toBe("module-demand-capped");
  expect(pumped(withoutRemoteDemand)).toBe(100);
  expect(waterNet(withoutRemoteDemand)).toBe(0);
  expect(pumped(withRemoteDemand)).toBe(100);
  expect(waterNet(withRemoteDemand)).toBe(-500);
  expect(reportedWaterNet(withRemoteDemand)).toBe(-500);
});
