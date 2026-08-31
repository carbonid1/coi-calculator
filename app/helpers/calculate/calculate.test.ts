import { expect, it } from "vitest";
import {
  attachMaintenanceDepotsToModule,
  resolveMaintenanceDepotModuleAssignments,
} from "../../db/modules/area-maintenance";
import { defaultArea as general } from "../../db/modules/default";
import { type Module } from "../../db/modules/modules";
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

const maintenanceFixture: Module = {
  id: "maintenance-fixture",
  name: "Maintenance fixture",
  description: "Test-only maintenance production",
  builtBuildings: {},
  presets: [{
    id: "current",
    name: "Current",
    description: "Current production",
    activeBuildings: {},
    fixed: [],
  }],
  defaultPresetId: "current",
};
const maintenanceAssignment = resolveMaintenanceDepotModuleAssignments({
  defaultModuleId: maintenanceFixture.id,
  demand: { maintenanceI: 547.8, maintenanceII: 194.22, maintenanceIII: 236.55 },
  modules: [maintenanceFixture],
})[maintenanceFixture.id]!;
const maintenance = attachMaintenanceDepotsToModule(
  maintenanceFixture,
  maintenanceAssignment,
  "modeled",
);

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
    name: "Test Default Biomass Producer",
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

it("uses remaining capacity to consume preferred module surplus and propagates support demand", () => {
  const steamProducer: Recipe = {
    id: "test-low-steam-producer",
    name: "Test Low Steam Producer",
    building: "Test Producer",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "steamLow", quantity: 20 }],
  };
  const waterDemand: Recipe = {
    id: "test-water-demand",
    name: "Test Water Demand",
    building: "Test Consumer",
    group: "production",
    inputs: [{ resourceId: "water", quantity: 5 }],
    outputs: [],
  };
  const seawaterPump: Recipe = {
    id: "test-seawater-pump",
    name: "Test Seawater Pump",
    building: "Test Pump",
    group: "production",
    balanceBy: "output",
    inputs: [],
    outputs: [{ resourceId: "seaWater", quantity: 30 }],
  };
  const desalinator: Recipe = {
    id: "test-surplus-desalinator",
    name: "Test Surplus Desalinator",
    building: "Test Desalinator",
    group: "production",
    balanceBy: "output",
    balanceOutputIds: ["water", "brine"],
    consumeSurplusInputIds: ["steamLow"],
    consumeSurplusInputScope: "module",
    surplusConsumptionPriority: 10,
    inputs: [
      { resourceId: "seaWater", quantity: 30 },
      { resourceId: "steamLow", quantity: 10 },
    ],
    outputs: [
      { resourceId: "water", quantity: 30 },
      { resourceId: "brine", quantity: 10 },
    ],
  };
  const result = calculateNet([
    fixedLine(steamProducer, "copper"),
    fixedLine(waterDemand, "copper"),
    balancedLine(seawaterPump, "copper", 2),
    balancedLine(desalinator, "copper", 2),
  ]);
  const recipeResult = (recipeId: string) => result.regularResults.find(
    candidate => candidate.recipe.id === recipeId,
  );
  const net = (resourceId: string) => result.allResourceFlows.find(
    flow => flow.resourceId === resourceId,
  )?.net ?? 0;

  expect(recipeResult(desalinator.id)?.supplyRatio).toBeCloseTo(1);
  expect(recipeResult(seawaterPump.id)?.actualOutputs[0]?.quantity).toBeCloseTo(60);
  expect(net("steamLow")).toBeCloseTo(0);
  expect(net("seaWater")).toBeCloseTo(0);
  expect(net("water")).toBeCloseTo(55);
  expect(net("brine")).toBeCloseTo(20);
});

it("never increases primary production to feed a surplus-only byproduct consumer", () => {
  const copperAndSteam: Recipe = {
    id: "test-copper-and-steam",
    name: "Test Copper And Steam",
    building: "Test Furnace",
    group: "production",
    balanceBy: "output",
    balanceOutputIds: ["copper", "steamLow"],
    inputs: [],
    outputs: [
      { resourceId: "copper", quantity: 10 },
      { resourceId: "steamLow", quantity: 10 },
    ],
  };
  const desalinator: Recipe = {
    id: "test-surplus-only-desalinator",
    name: "Test Surplus-only Desalinator",
    building: "Test Desalinator",
    group: "production",
    balanceBy: "output",
    balanceOutputIds: ["water"],
    consumeSurplusInputIds: ["steamLow"],
    consumeSurplusInputScope: "module",
    inputs: [{ resourceId: "steamLow", quantity: 20 }],
    outputs: [{ resourceId: "water", quantity: 10 }],
  };
  const result = calculateNet([
    balancedLine(copperAndSteam, "copper", 2),
    balancedLine(desalinator, "copper"),
  ], {}, undefined, {}, { copper: 10, water: 10 });
  const recipeResult = (recipeId: string) => result.regularResults.find(
    candidate => candidate.recipe.id === recipeId,
  );
  const net = (resourceId: string) => result.allResourceFlows.find(
    flow => flow.resourceId === resourceId,
  )?.net ?? 0;

  expect(recipeResult(copperAndSteam.id)?.supplyRatio).toBeCloseTo(0.5);
  expect(recipeResult(desalinator.id)?.supplyRatio).toBeCloseTo(1);
  expect(net("copper")).toBeCloseTo(0);
  expect(net("steamLow")).toBeCloseTo(-10);
  expect(net("water")).toBeCloseTo(0);
});

it("keeps a module export demand on the selected producer", () => {
  const selectedProducer: Recipe = {
    id: "test-selected-module-producer",
    name: "Selected module producer",
    building: "Selected producer",
    group: "production",
    balanceBy: "output",
    outputs: [{ resourceId: "copper", quantity: 10 }],
    inputs: [],
  };
  const otherProducer: Recipe = {
    ...selectedProducer,
    id: "test-other-module-producer",
    name: "Other module producer",
    building: "Other producer",
  };
  const result = calculateNet(
    [
      fixedLine(otherProducer, "other"),
      balancedLine(selectedProducer, "selected"),
    ],
    {},
    undefined,
    {},
    {},
    new Set(),
    new Map(),
    new Map([["selected", { copper: 10 }]]),
  );
  const selectedResult = result.regularResults.find(
    candidate => candidate.recipe.id === selectedProducer.id,
  );

  expect(selectedResult?.supplyRatio).toBe(1);
  expect(selectedResult?.actualOutputs).toContainEqual({
    resourceId: "copper",
    quantity: 10,
  });
  expect(result.allResourceFlows.find(flow => flow.resourceId === "copper")).toMatchObject({
    consumed: 10,
    produced: 20,
    net: 10,
  });
});

it("uses an unavoidable co-product before starting a fallback producer", () => {
  const titaniumSmelting: Recipe = {
    id: "test-titanium-with-molten-iron",
    name: "Test Titanium With Molten Iron",
    building: "Test Titanium Furnace",
    group: "production",
    inputs: [],
    outputs: [
      { resourceId: "titaniumSlag", quantity: 10 },
      { resourceId: "moltenIron", quantity: 10 },
    ],
  };
  const ironOreSmelting: Recipe = {
    id: "test-fallback-iron-ore-smelting",
    name: "Test Fallback Iron Ore Smelting",
    building: "Test Iron Furnace",
    group: "production",
    balanceBy: "output",
    balanceInputIds: [],
    balanceOutputIds: ["moltenIron"],
    allocation: "fallback",
    allocationPriority: 25,
    inputs: [{ resourceId: "ironOreCrushed", quantity: 10 }],
    outputs: [{ resourceId: "moltenIron", quantity: 10 }],
  };
  const steelmaking: Recipe = {
    id: "test-steelmaking",
    name: "Test Steelmaking",
    building: "Test Oxygen Furnace",
    group: "production",
    inputs: [{ resourceId: "moltenIron", quantity: 100 }],
    outputs: [{ resourceId: "steel", quantity: 50 }],
  };
  const ironCrusher: Recipe = {
    id: "test-fallback-iron-crusher",
    name: "Test Fallback Iron Crusher",
    building: "Test Iron Crusher",
    group: "production",
    balanceBy: "output",
    allocation: "fallback",
    allocationPriority: 40,
    inputs: [{ resourceId: "ironOre", quantity: 10 }],
    outputs: [{ resourceId: "ironOreCrushed", quantity: 10 }],
  };
  const ironMine: Recipe = {
    id: "test-iron-mine",
    name: "Test Iron Mine",
    building: "Test Iron Mine",
    group: "source",
    balanceBy: "output",
    sourceMode: "demand",
    inputs: [],
    outputs: [{ resourceId: "ironOre", quantity: 10 }],
  };
  const result = calculateNet([
    fixedLine(titaniumSmelting, "default"),
    fixedLine(steelmaking, "default"),
    balancedLine(ironOreSmelting, "default", 10),
    balancedLine(ironCrusher, "default", 10),
    balancedLine(ironMine, "mines", 10),
  ]);
  const fallback = result.regularResults.find(
    candidate => candidate.recipe.id === ironOreSmelting.id,
  );

  expect(fallback?.actualOutputs[0]?.quantity).toBeCloseTo(90);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "moltenIron")?.net)
    .toBeCloseTo(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "ironOreCrushed")?.net)
    .toBeCloseTo(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "ironOre")?.net)
    .toBeCloseTo(0);
});

it("lets an explicit private input start a consumer and exposes ordinary support demand", () => {
  const waterProducer: Recipe = {
    id: "test-linked-water-producer",
    name: "Linked water producer",
    building: "Test desalinator",
    group: "production",
    balanceBy: "output",
    inputs: [{ resourceId: "seaWater", quantity: 5 }],
    outputs: [{ resourceId: "water", quantity: 5 }],
  };
  const exhaustConsumer: Recipe = {
    id: "test-linked-exhaust-consumer",
    name: "Linked exhaust consumer",
    building: "Test scrubber",
    group: "production",
    balanceBy: "output",
    inputs: [
      { resourceId: "exhaust", quantity: 10 },
      { resourceId: "water", quantity: 5 },
      { resourceId: "limestone", quantity: 2 },
    ],
    outputs: [{ resourceId: "sulfur", quantity: 1 }],
  };
  const result = calculateNet([
    balancedLine(waterProducer, "target"),
    {
      ...balancedLine(exhaustConsumer, "target"),
      drivingInputIds: ["exhaust"],
    },
  ], { exhaust: 10 });
  const scrubber = result.regularResults.find(
    candidate => candidate.recipe.id === exhaustConsumer.id,
  );
  const desalinator = result.regularResults.find(
    candidate => candidate.recipe.id === waterProducer.id,
  );

  expect(scrubber?.supplyRatio).toBe(1);
  expect(desalinator?.supplyRatio).toBe(1);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "exhaust")?.net).toBe(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "water")?.net).toBe(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "limestone")?.net).toBe(-2);
});

it("lets a planned private producer expose support demand for surplus consumption", () => {
  const steamProducer: Recipe = {
    id: "test-planned-support-steam",
    name: "Steam producer",
    building: "Test producer",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "steamLow", quantity: 20 }],
  };
  const desalinator: Recipe = {
    id: "test-planned-support-desalinator",
    name: "Desalinator",
    building: "Test desalinator",
    group: "production",
    balanceBy: "output",
    consumeSurplusInputIds: ["steamLow"],
    inputs: [
      { resourceId: "steamLow", quantity: 10 },
      { resourceId: "seaWater", quantity: 10 },
    ],
    outputs: [{ resourceId: "water", quantity: 10 }],
  };
  const result = calculateNet(
    [
      fixedLine(steamProducer, "target"),
      balancedLine(desalinator, "target", 2),
    ],
    { seaWater: 0 },
    undefined,
    {},
    { water: 5 },
    new Set(["seaWater"]),
    new Map([["target", new Set(["seaWater"])]]),
  );

  expect(result.regularResults.find(
    candidate => candidate.recipe.id === desalinator.id,
  )?.supplyRatio).toBe(1);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "steamLow")?.net).toBe(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "seaWater")?.net).toBe(-20);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "water")?.net).toBe(15);
});

it("uses supplied support stock without treating its module ledger as a new deficit", () => {
  const steamProducer: Recipe = {
    id: "test-supplied-support-steam",
    name: "Steam producer",
    building: "Test producer",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "steamLow", quantity: 20 }],
  };
  const desalinator: Recipe = {
    id: "test-supplied-support-desalinator",
    name: "Desalinator",
    building: "Test desalinator",
    group: "production",
    balanceBy: "output",
    consumeSurplusInputIds: ["steamLow"],
    inputs: [
      { resourceId: "steamLow", quantity: 10 },
      { resourceId: "seaWater", quantity: 10 },
    ],
    outputs: [{ resourceId: "water", quantity: 10 }],
  };
  const result = calculateNet(
    [
      fixedLine(steamProducer, "target"),
      balancedLine(desalinator, "target", 2),
    ],
    { seaWater: 20 },
    undefined,
    {},
    { water: 5 },
  );

  expect(result.regularResults.find(
    candidate => candidate.recipe.id === desalinator.id,
  )?.supplyRatio).toBe(1);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "steamLow")?.net).toBe(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "seaWater")?.net).toBe(0);
});

it("keeps planned supporting inputs scoped to their own module", () => {
  const importedProcess: Recipe = {
    id: "test-module-scoped-import",
    name: "Imported process",
    building: "Imported process",
    group: "production",
    inputs: [
      { resourceId: "ironOreCrushed", quantity: 10 },
      { resourceId: "oxygen", quantity: 5 },
    ],
    outputs: [{ resourceId: "slag", quantity: 10 }],
  };
  const steamProducer: Recipe = {
    id: "test-unrelated-steam",
    name: "Unrelated steam producer",
    building: "Steam producer",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "steamLow", quantity: 10 }],
  };
  const unrelatedConsumer: Recipe = {
    id: "test-unrelated-surplus-consumer",
    name: "Unrelated surplus consumer",
    building: "Surplus consumer",
    group: "production",
    balanceBy: "output",
    consumeSurplusInputIds: ["steamLow"],
    consumeSurplusInputScope: "module",
    inputs: [
      { resourceId: "steamLow", quantity: 10 },
      { resourceId: "oxygen", quantity: 5 },
    ],
    outputs: [{ resourceId: "water", quantity: 10 }],
  };
  const result = calculateNet(
    [
      {
        ...balancedLine(importedProcess, "importing"),
        drivingInputIds: ["ironOreCrushed"],
      },
      fixedLine(steamProducer, "unrelated"),
      balancedLine(unrelatedConsumer, "unrelated"),
    ],
    { ironOreCrushed: 10 },
  );

  expect(result.regularResults.find(
    candidate => candidate.recipe.id === importedProcess.id,
  )?.supplyRatio).toBe(1);
  expect(result.regularResults.find(
    candidate => candidate.recipe.id === unrelatedConsumer.id,
  )?.supplyRatio).toBe(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "oxygen")?.net).toBe(-5);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "steamLow")?.net).toBe(10);
});

it("leaves preferred surplus when supporting production capacity is exhausted", () => {
  const steamProducer: Recipe = {
    id: "test-limited-low-steam-producer",
    name: "Test Limited Low Steam Producer",
    building: "Test Producer",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "steamLow", quantity: 20 }],
  };
  const waterDemand: Recipe = {
    id: "test-limited-water-demand",
    name: "Test Limited Water Demand",
    building: "Test Consumer",
    group: "production",
    inputs: [{ resourceId: "water", quantity: 5 }],
    outputs: [],
  };
  const seawaterPump: Recipe = {
    id: "test-limited-seawater-pump",
    name: "Test Limited Seawater Pump",
    building: "Test Pump",
    group: "production",
    balanceBy: "output",
    inputs: [],
    outputs: [{ resourceId: "seaWater", quantity: 30 }],
  };
  const desalinator: Recipe = {
    id: "test-limited-surplus-desalinator",
    name: "Test Limited Surplus Desalinator",
    building: "Test Desalinator",
    group: "production",
    balanceBy: "output",
    balanceOutputIds: ["water", "brine"],
    consumeSurplusInputIds: ["steamLow"],
    consumeSurplusInputScope: "module",
    inputs: [
      { resourceId: "seaWater", quantity: 30 },
      { resourceId: "steamLow", quantity: 10 },
    ],
    outputs: [
      { resourceId: "water", quantity: 30 },
      { resourceId: "brine", quantity: 10 },
    ],
  };
  const result = calculateNet([
    fixedLine(steamProducer, "copper"),
    fixedLine(waterDemand, "copper"),
    balancedLine(seawaterPump, "copper", 1),
    balancedLine(desalinator, "copper", 2),
  ]);
  const recipeResult = (recipeId: string) => result.regularResults.find(
    candidate => candidate.recipe.id === recipeId,
  );
  const net = (resourceId: string) => result.allResourceFlows.find(
    flow => flow.resourceId === resourceId,
  )?.net ?? 0;

  expect(recipeResult(desalinator.id)?.supplyRatio).toBeCloseTo(0.5);
  expect(recipeResult(seawaterPump.id)?.supplyRatio).toBeCloseTo(1);
  expect(net("seaWater")).toBeCloseTo(0);
  expect(net("steamLow")).toBeCloseTo(10);
});

it("does not import linked-only Steam (Low) from another live module", () => {
  const steamProducer: Recipe = {
    id: "test-remote-low-steam-producer",
    name: "Test Remote Low Steam Producer",
    building: "Test Producer",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "steamLow", quantity: 20 }],
  };
  const waterDemand: Recipe = {
    id: "test-remote-water-demand",
    name: "Test Remote Water Demand",
    building: "Test Consumer",
    group: "production",
    inputs: [{ resourceId: "water", quantity: 5 }],
    outputs: [],
  };
  const desalinator: Recipe = {
    id: "test-remote-surplus-desalinator",
    name: "Test Remote Surplus Desalinator",
    building: "Test Desalinator",
    group: "production",
    balanceBy: "output",
    balanceOutputIds: ["water"],
    balanceInputIds: ["steamLow"],
    balanceInputScope: "module",
    consumeSurplusInputIds: ["steamLow"],
    consumeSurplusInputScope: "module",
    inputs: [{ resourceId: "steamLow", quantity: 10 }],
    outputs: [{ resourceId: "water", quantity: 30 }],
  };
  const result = calculateNet([
    fixedLine(steamProducer, "remote"),
    fixedLine(waterDemand, "copper"),
    balancedLine(desalinator, "copper", 2),
  ]);
  const desalinatorResult = result.regularResults.find(
    candidate => candidate.recipe.id === desalinator.id,
  );

  expect(desalinatorResult?.supplyRatio).toBe(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "steamLow")?.net)
    .toBe(20);
});

it("does not invent external inputs merely to consume surplus", () => {
  const steamProducer: Recipe = {
    id: "test-guarded-low-steam-producer",
    name: "Test Guarded Low Steam Producer",
    building: "Test Producer",
    group: "production",
    inputs: [],
    outputs: [{ resourceId: "steamLow", quantity: 20 }],
  };
  const guardedConsumer: Recipe = {
    id: "test-guarded-surplus-consumer",
    name: "Test Guarded Surplus Consumer",
    building: "Test Consumer",
    group: "production",
    balanceBy: "output",
    consumeSurplusInputIds: ["steamLow"],
    consumeSurplusInputScope: "module",
    inputs: [
      { resourceId: "steamLow", quantity: 10 },
      { resourceId: "acid", quantity: 5 },
    ],
    outputs: [{ resourceId: "water", quantity: 30 }],
  };
  const result = calculateNet([
    fixedLine(steamProducer, "copper"),
    balancedLine(guardedConsumer, "copper", 2),
  ]);
  const consumerResult = result.regularResults.find(
    candidate => candidate.recipe.id === guardedConsumer.id,
  );

  expect(consumerResult?.supplyRatio).toBe(0);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "steamLow")?.net).toBe(20);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "acid"))
    .toMatchObject({ consumed: 0, produced: 0, net: 0 });
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

it("keeps module-scoped source capacity out of other modules", () => {
  const terrainSource: Recipe = {
    id: "test-module-terrain-source",
    name: "Test Module Terrain Source",
    building: "Terrain extraction",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "titaniumOre", quantity: 100 }],
    sourceMode: "module-demand",
    sourceKind: "terrain-mine",
  };
  const mineCrusher: Recipe = {
    id: "test-mine-crusher",
    name: "Test Mine Crusher",
    building: "Crusher (Large)",
    group: "production",
    balanceBy: "output",
    balanceInputIds: ["titaniumOre"],
    balanceInputScope: "module",
    inputs: [{ resourceId: "titaniumOre", quantity: 100 }],
    outputs: [{ resourceId: "titaniumOreCrushed", quantity: 100 }],
  };
  const remoteCrusher: Recipe = {
    id: "test-remote-crusher",
    name: "Test Remote Crusher",
    building: "Crusher (Large)",
    group: "production",
    balanceBy: "input",
    balanceInputIds: ["titaniumOre"],
    inputs: [{ resourceId: "titaniumOre", quantity: 100 }],
    outputs: [{ resourceId: "titaniumOreCrushed", quantity: 100 }],
  };
  const result = calculateNet([
    fixedLine(terrainSource, "mine"),
    balancedLine(remoteCrusher, "remote"),
    balancedLine(mineCrusher, "mine"),
  ], { titaniumOre: 40 }, undefined, {}, { titaniumOreCrushed: 140 });
  const regularResult = (recipeId: string) => result.regularResults.find(
    candidate => candidate.recipe.id === recipeId,
  );
  const sourceResult = result.sourceResults.find(
    candidate => candidate.recipe.id === terrainSource.id,
  );

  expect(regularResult(remoteCrusher.id)?.actualInputs[0]?.quantity).toBe(40);
  expect(regularResult(mineCrusher.id)?.actualInputs[0]?.quantity).toBe(100);
  expect(sourceResult?.actualOutputs[0]?.quantity).toBe(100);
  expect(result.allResourceFlows.find(flow => flow.resourceId === "titaniumOre")?.net)
    .toBe(0);
});

it("uses recovered Water before Groundwater Pumps or Liquid Dumps", () => {
  const groundwaterPump: Recipe = {
    id: "test-factory-groundwater-pump",
    name: "Test Groundwater Pump",
    building: "Groundwater Pump",
    group: "source",
    inputs: [],
    outputs: [{ resourceId: "water", quantity: 48 }],
    sourceMode: "demand-capped",
  };
  const waterConsumer: Recipe = {
    id: "test-water-consumer",
    name: "Test Water Consumer",
    building: "Test Consumer",
    group: "production",
    inputs: [{ resourceId: "water", quantity: 10 }],
    outputs: [],
  };
  const coolingTower: Recipe = {
    id: "test-water-recovery",
    name: "Test Water Recovery",
    building: "Cooling Tower",
    group: "sink",
    inputs: [{ resourceId: "steamLow", quantity: 20 }],
    outputs: [{ resourceId: "water", quantity: 20 }],
  };
  const liquidDump: Recipe = {
    id: "test-water-dump",
    name: "Test Water Dump",
    building: "Liquid Dump",
    group: "sink",
    inputs: [{ resourceId: "water", quantity: 100 }],
    outputs: [],
  };
  const result = calculateNet([
    fixedLine(groundwaterPump, "general"),
    fixedLine(waterConsumer, "general"),
    balancedLine(coolingTower, "nuclear"),
    balancedLine(liquidDump, "nuclear"),
  ], { steamLow: 20 });
  const groundwater = result.sourceResults.find(
    candidate => candidate.recipe.id === groundwaterPump.id,
  );
  const recovered = result.sinkResults.find(
    candidate => candidate.recipe.id === coolingTower.id,
  );
  const dumped = result.sinkResults.find(
    candidate => candidate.recipe.id === liquidDump.id,
  );

  expect(groundwater?.actualOutputs).toEqual([{ resourceId: "water", quantity: 0 }]);
  expect(groundwater?.supplyRatio).toBe(0);
  expect(recovered?.actualOutputs).toEqual([{ resourceId: "water", quantity: 20 }]);
  expect(dumped?.actualInputs).toEqual([{ resourceId: "water", quantity: 10 }]);
});
