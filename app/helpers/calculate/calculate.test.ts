import { expect, it } from "vitest";
import { general } from "../../db/modules/general";
import { createMaintenanceModule } from "../../db/modules/maintenance";
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

const balancedLine = (recipe: Recipe, moduleId: string, activeBuildings = 1) => ({
  recipe,
  moduleId,
  activeBuildings,
  builtBuildings: activeBuildings,
  speedLevel: 1,
  operatingMode: "balanced" as const,
});

const maintenance = createMaintenanceModule({
  maintenanceI: 547.8,
  maintenanceII: 194.22,
  maintenanceIII: 236.55,
});

it("reserves Forestry saplings and keeps Biomass conversion inside each physical module", () => {
  const treeProducer: Recipe = {
    id: "test-tree-producer",
    name: "Test Tree Producer",
    building: "Test Farm",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "treeSapling", quantity: 5 }],
  };
  const generalBiomassProducer: Recipe = {
    id: "test-general-biomass-producer",
    name: "Test General Biomass Producer",
    building: "Test Food Processor",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "biomass", quantity: 6 }],
  };
  const housingBiomassProducer: Recipe = {
    id: "test-housing-biomass-producer",
    name: "Test Housing Biomass Producer",
    building: "Test Housing",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "biomass", quantity: 10 }],
  };
  const forestry: Recipe = {
    id: "test-forestry",
    name: "Test Forestry",
    building: "Test Forestry",
    group: "source",
    inputs: [{ resourceId: "treeSapling", quantity: 1 }],
    outputs: [{ resourceId: "wood", quantity: 20 }],
    sourceMode: "demand",
  };
  const shredder: Recipe = {
    id: "test-sapling-shredder",
    name: "Test Sapling Shredder",
    building: "Test Shredder",
    group: "production",
    balanceBy: "input",
    balanceInputIds: ["treeSapling"],
    allocation: "surplus",
    allocationPriority: 5,
    inputs: [{ resourceId: "treeSapling", quantity: 24 }],
    outputs: [{ resourceId: "biomass", quantity: 24 }],
  };
  const biomassMixer: Recipe = {
    id: "test-biomass-mixer",
    name: "Test Biomass Mixer",
    building: "Test Mixer",
    group: "production",
    balanceBy: "input",
    balanceInputIds: ["biomass"],
    balanceInputScope: "module",
    allocation: "surplus",
    allocationPriority: 10,
    inputs: [{ resourceId: "biomass", quantity: 24 }],
    outputs: [{ resourceId: "compost", quantity: 16 }],
  };
  const housingMixer: Recipe = {
    ...biomassMixer,
    id: "test-housing-biomass-mixer",
    allocation: undefined,
    allocationPriority: undefined,
  };
  const result = calculateNet([
    fixedLine(treeProducer, "greenhouses"),
    fixedLine(generalBiomassProducer, "general"),
    fixedLine(housingBiomassProducer, "housing"),
    fixedLine(forestry, "forestry"),
    balancedLine(housingMixer, "housing", 2),
    balancedLine(shredder, "general"),
    balancedLine(biomassMixer, "general"),
  ], {}, undefined, {}, { wood: 80 });
  const getResult = (recipeId: string) => [
    ...result.regularResults,
    ...result.sourceResults,
  ].find((candidate) => candidate.recipe.id === recipeId);
  const getQuantity = (
    recipeId: string,
    side: "actualInputs" | "actualOutputs",
    resourceId: string,
  ) => getResult(recipeId)?.[side].find((item) => item.resourceId === resourceId)?.quantity ?? 0;

  expect(getQuantity("test-forestry", "actualInputs", "treeSapling")).toBe(4);
  expect(getQuantity("test-sapling-shredder", "actualInputs", "treeSapling")).toBe(1);
  expect(getQuantity("test-housing-biomass-mixer", "actualInputs", "biomass")).toBe(10);
  expect(getQuantity("test-biomass-mixer", "actualInputs", "biomass")).toBe(7);
  expect(result.allResourceFlows.find((flow) => flow.resourceId === "treeSapling")?.net).toBe(0);
  expect(result.allResourceFlows.find((flow) => flow.resourceId === "biomass")?.net).toBe(0);
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
