import { describe, expect, it } from "vitest";

import { type Module } from "../../db/modules/modules";
import { createCropFarmRecipe, recipes } from "../../db/recipes";
import { type ResourceId, resources } from "../../db/resources";
import {
  type PassiveResult,
  type RegularResult,
  type ResourceFlow,
} from "../calculate/calculate";
import { calculateBuildingDiagnostics } from "./building-diagnostics";

const chickenRecipe = recipes.find((recipe) => recipe.id === "chicken-farm-slaughtering");

if (!chickenRecipe) throw new Error("Chicken Farm recipe is missing");

const farmsModule: Module = {
  id: "farms",
  name: "Farms",
  description: "",
  builtBuildings: { [chickenRecipe.id]: 3 },
  presets: [],
  defaultPresetId: null,
};

const createChickenResult = (chickens: number, farmCount = 3): RegularResult => ({
  recipe: chickenRecipe,
  moduleId: farmsModule.id,
  activeBuildings: farmCount,
  builtBuildings: farmCount,
  operatingMode: "fixed",
  supplyRatio: 1,
  speedLevel: chickens / (farmCount * 500),
  actualInputs: [],
  actualOutputs: [],
  recyclableSourceValueProduced: 0,
});

const flow = (resourceId: "eggs" | "chickenCarcass", name: string, net: number): ResourceFlow => ({
  resourceId,
  name,
  consumed: 0,
  produced: Math.max(0, net),
  net,
});

const resourceFlow = (resourceId: ResourceId, net: number): ResourceFlow => ({
  resourceId,
  name: resources[resourceId].name,
  consumed: net < 0 ? -net : 0,
  produced: net > 0 ? net : 0,
  net,
});

it.each([
  { running: 1, built: 1, shortage: 0, supplyRatio: 0, expected: null },
  { running: 2, built: 2, shortage: 0, supplyRatio: 0, expected: null },
  { running: 0, built: 1, shortage: 0, supplyRatio: 0, expected: "unpause" },
  { running: 0, built: 0, shortage: 0, supplyRatio: 0, expected: "build" },
  { running: 1, built: 1, shortage: -0.1, supplyRatio: 1, expected: "build" },
  { running: 1, built: 2, shortage: -0.1, supplyRatio: 1, expected: "unpause" },
])("keeps intermittent capacity ready without hiding shortages ($running running, $built built, $shortage net)", ({ running, built, shortage, supplyRatio, expected }) => {
  const result: RegularResult = {
    ...createChickenResult(0),
    recipe: { id: "rail", name: "Rail Parts", building: "Assembly V", group: "production",
      inputs: [], outputs: [{ resourceId: "railParts", quantity: 64 }],
      keepReady: true },
    activeBuildings: running, currentActiveBuildings: running, builtBuildings: built,
    supplyRatio, speedLevel: 1,
  };
  const [diagnostic] = calculateBuildingDiagnostics([farmsModule], [resourceFlow("railParts", shortage)], [result]);

  expect(diagnostic?.attention).toBe(expected);
  if (expected) expect(diagnostic?.attentionCount).toBe(1);
});

describe("user Keep ready preferences", () => {
  const result: RegularResult = {
    ...createChickenResult(0),
    recipe: {
      id: "assembly", name: "Rail Parts", building: "Assembly V", group: "production",
      inputs: [], outputs: [{ resourceId: "railParts", quantity: 64 }],
    },
    activeBuildings: 1, currentActiveBuildings: 1, builtBuildings: 1,
    supplyRatio: 0, speedLevel: 1,
  };
  const key = `${result.moduleId}:${result.recipe.id}`;

  it("dismisses pause advice for the selected line and can restore it", () => {
    const diagnostics = (enabled: boolean) => calculateBuildingDiagnostics(
      [farmsModule], [], [result], [], [], { [key]: enabled },
    );

    expect(diagnostics(true)[0]).toMatchObject({ keepReady: true, attention: null });
    expect(diagnostics(false)[0]).toMatchObject({ keepReady: false, attention: "can-pause" });
    expect(result.recipe.keepReady).toBeUndefined();
    expect(result.supplyRatio).toBe(0);
  });

  it("allows a saved off choice to override the default parts policy", () => {
    const [diagnostic] = calculateBuildingDiagnostics(
      [farmsModule], [], [{ ...result, recipe: { ...result.recipe, keepReady: true } }],
      [], [], { [key]: false },
    );

    expect(diagnostic).toMatchObject({ keepReady: false, attention: "can-pause" });
  });

  it("applies to a shared machine pool without hiding its shortages or other lines", () => {
    const poolId = "farms:assembly-pool";
    const pooled = { ...result, capacityPoolId: poolId };
    const other = { ...result, moduleId: "other" };
    const preferences = { [poolId]: true };
    const diagnostics = calculateBuildingDiagnostics(
      [farmsModule], [], [pooled, { ...pooled, recipe: { ...result.recipe, id: "second" } }, other],
      [], [], preferences,
    );

    expect(diagnostics.find(item => item.key === poolId)?.attention).toBeNull();
    expect(diagnostics.find(item => item.moduleId === "other")?.attention).toBe("can-pause");

    const [shortage] = calculateBuildingDiagnostics(
      [farmsModule], [resourceFlow("railParts", -1)], [{ ...pooled, supplyRatio: 1 }],
      [], [], preferences,
    );

    expect(shortage?.attention).toBe("build");
  });
});

describe("chicken farm building diagnostics", () => {
  it("recommends chickens in 50-animal steps when flock output is short", () => {
    const [diagnostic] = calculateBuildingDiagnostics(
      [farmsModule],
      [flow("eggs", "Eggs", -1.4), flow("chickenCarcass", "Chicken Carcass", 0)],
      [createChickenResult(1_100)],
    );

    expect(diagnostic).toMatchObject({
      attention: "add-animals",
      attentionCount: 100,
      affectedResources: ["Eggs"],
      animalPopulation: {
        current: 1_100,
        capacity: 1_500,
        label: "chickens",
        additionalBuildings: 0,
      },
    });
  });

  it("includes required farm capacity when the larger flock will not fit", () => {
    const [diagnostic] = calculateBuildingDiagnostics(
      [farmsModule],
      [flow("eggs", "Eggs", -7.6), flow("chickenCarcass", "Chicken Carcass", 0)],
      [createChickenResult(1_100)],
    );

    expect(diagnostic).toMatchObject({
      attention: "add-animals",
      attentionCount: 550,
      animalPopulation: { additionalBuildings: 1 },
    });
  });

  it("only recommends removing chickens when every direct output has surplus", () => {
    const conservative = calculateBuildingDiagnostics(
      [farmsModule],
      [flow("eggs", "Eggs", 3), flow("chickenCarcass", "Chicken Carcass", 0)],
      [createChickenResult(1_100)],
    )[0];
    const removable = calculateBuildingDiagnostics(
      [farmsModule],
      [flow("eggs", "Eggs", 3), flow("chickenCarcass", "Chicken Carcass", 2.4)],
      [createChickenResult(1_100)],
    )[0];

    expect(conservative?.attention).toBeNull();
    expect(removable).toMatchObject({
      attention: "remove-animals",
      attentionCount: 100,
    });
  });
});

describe("crop farm building diagnostics", () => {
  it("consolidates crop capacity warnings into one rebalance action", () => {
    const cropRecipes = [
      createCropFarmRecipe({
        id: "test-potato-farm",
        name: "Potato farm",
        farmCount: 1,
        tierId: "greenhouseII",
        schedule: ["potato", "wheat", "potato", "wheat"],
        fertilizer: { id: "fertilizerII", targetFertilityPercent: 110 },
      }),
      createCropFarmRecipe({
        id: "test-fruit-farm",
        name: "Fruit farm",
        farmCount: 1,
        tierId: "greenhouseII",
        schedule: ["fruit", "soybean", "fruit", "soybean"],
        fertilizer: { id: "fertilizerII", targetFertilityPercent: 110 },
      }),
    ];
    const cropModule: Module = {
      id: "farms",
      name: "Farms",
      description: "",
      builtBuildings: Object.fromEntries(cropRecipes.map((recipe) => [recipe.id, 1])),
      presets: [],
      defaultPresetId: null,
    };
    const results: RegularResult[] = cropRecipes.map((recipe) => ({
      recipe,
      moduleId: cropModule.id,
      activeBuildings: 1,
      builtBuildings: 1,
      operatingMode: "fixed",
      supplyRatio: 1,
      speedLevel: 1,
      actualInputs: [],
      actualOutputs: [],
      recyclableSourceValueProduced: 0,
    }));
    const affectedIds = [...new Set(cropRecipes.flatMap(
      (recipe) => recipe.outputs.map((output) => output.resourceId),
    ))];
    const diagnostics = calculateBuildingDiagnostics(
      [cropModule],
      affectedIds.map((resourceId) => resourceFlow(resourceId, -1)),
      results,
    );
    const cropDiagnostics = diagnostics.filter((diagnostic) => (
      diagnostic.key !== "farms:crop-rebalance"
    ));

    expect(cropDiagnostics.every((diagnostic) => diagnostic.attention == null)).toBe(true);
    expect(diagnostics.find((diagnostic) => (
      diagnostic.key === "farms:crop-rebalance"
    ))).toMatchObject({
      buildingName: "Crop farms",
      moduleName: "Farms",
      attention: "rebalance-farms",
      affectedResources: affectedIds.map((resourceId) => resources[resourceId].name),
    });
  });
});

describe("byproduct building diagnostics", () => {
  it("does not recommend Basic Racks to cover a Water deficit", () => {
    const basicRack = recipes.find((recipe) => recipe.id === "computing-basic-rack");

    expect(basicRack).toBeDefined();

    if (!basicRack) return;

    const computingModule: Module = {
      id: "computing",
      name: "Computing",
      description: "",
      builtBuildings: { [basicRack.id]: 1 },
      presets: [],
      defaultPresetId: null,
    };
    const result: RegularResult = {
      recipe: basicRack,
      moduleId: computingModule.id,
      activeBuildings: 1,
      builtBuildings: 1,
      operatingMode: "fixed",
      supplyRatio: 1,
      speedLevel: 1,
      actualInputs: [],
      actualOutputs: [],
      recyclableSourceValueProduced: 0,
    };
    const [diagnostic] = calculateBuildingDiagnostics(
      [computingModule],
      [resourceFlow("water", -1), resourceFlow("computing", 4)],
      [result],
    );

    expect(diagnostic?.affectedResources).toEqual([]);
    expect(diagnostic?.attention).toBeNull();
  });

  it("does not recommend Cracking Units to cover a Water deficit", () => {
    const crackingUnit = recipes.find(
      (recipe) => recipe.id === "cracking-unit-fuel-gas-diesel",
    );

    expect(crackingUnit).toBeDefined();

    if (!crackingUnit) return;

    const generalModule: Module = {
      id: "general",
      name: "Default",
      description: "",
      builtBuildings: { [crackingUnit.id]: 2 },
      presets: [],
      defaultPresetId: null,
    };
    const result: RegularResult = {
      recipe: crackingUnit,
      moduleId: generalModule.id,
      activeBuildings: 2,
      builtBuildings: 2,
      operatingMode: "fixed",
      supplyRatio: 1,
      speedLevel: 1,
      actualInputs: [],
      actualOutputs: [],
      recyclableSourceValueProduced: 0,
    };
    const [diagnostic] = calculateBuildingDiagnostics(
      [generalModule],
      [resourceFlow("water", -1), resourceFlow("diesel", 48)],
      [result],
    );

    expect(diagnostic?.affectedResources).toEqual([]);
    expect(diagnostic?.attention).toBeNull();
  });
});

describe("cost-free capacity diagnostics", () => {
  const coolingTowerRecipe = recipes.find(
    (recipe) => recipe.id === "cooling-tower-large-low",
  );

  if (!coolingTowerRecipe) throw new Error("Large Cooling Tower recipe is missing");

  const coolingModule: Module = {
    id: "cooling",
    name: "Cooling",
    description: "",
    builtBuildings: { [coolingTowerRecipe.id]: 1 },
    presets: [],
    defaultPresetId: null,
  };
  const coolingResult = (supplyRatio: number): PassiveResult => ({
    recipe: coolingTowerRecipe,
    moduleId: coolingModule.id,
    activeBuildings: 1,
    builtBuildings: 1,
    supplyRatio,
    actualInputs: [],
    actualOutputs: [],
  });

  it("does not recommend pausing an idle Large Cooling Tower", () => {
    const [diagnostic] = calculateBuildingDiagnostics(
      [coolingModule],
      [],
      [],
      [],
      [coolingResult(0)],
    );

    expect(diagnostic?.attention).toBeNull();
  });

  it("still warns when Large Cooling Tower capacity is insufficient", () => {
    const [diagnostic] = calculateBuildingDiagnostics(
      [coolingModule],
      [resourceFlow("steamLow", 1)],
      [],
      [],
      [coolingResult(1)],
    );

    expect(diagnostic).toMatchObject({ attention: "build", attentionCount: 1 });
  });
});

describe("Smoke stack (large) diagnostics", () => {
  const smokeStackRecipe = recipes.find(
    (recipe) => recipe.id === "nuclear-smoke-stack-large-oxygen",
  );

  if (!smokeStackRecipe) throw new Error("Large Smoke Stack recipe is missing");

  const disposalModule: Module = {
    id: "disposal",
    name: "Disposal",
    description: "",
    builtBuildings: { [smokeStackRecipe.id]: 2 },
    presets: [],
    defaultPresetId: null,
  };

  it.each([
    { active: 2, supplyRatio: 0, surplus: 0, expected: null },
    { active: 2, supplyRatio: 0.04, surplus: 0, expected: null },
    { active: 2, supplyRatio: 1, surplus: 1, expected: "build" },
    { active: 1, supplyRatio: 1, surplus: 1, expected: "unpause" },
  ])("omits pause advice but retains disposal capacity advice ($active active, $supplyRatio load, $surplus surplus)", ({ active, supplyRatio, surplus, expected }) => {
    const [diagnostic] = calculateBuildingDiagnostics(
      [disposalModule],
      [resourceFlow("oxygen", surplus)],
      [],
      [],
      [{
        recipe: smokeStackRecipe,
        moduleId: disposalModule.id,
        dataSource: "synced",
        activeBuildings: active,
        builtBuildings: 2,
        supplyRatio,
        actualInputs: [],
        actualOutputs: [],
      }],
      { [`${disposalModule.id}:${smokeStackRecipe.id}`]: false },
    );

    expect(diagnostic).toMatchObject({
      keepReady: false,
      attention: expected,
      attentionCount: expected == null ? 0 : 1,
    });
  });

  it("still recommends pausing an idle sink that uses workers", () => {
    const liquidDumpRecipe = recipes.find(
      (recipe) => recipe.id === "nuclear-liquid-dump-water",
    );

    if (!liquidDumpRecipe) throw new Error("Liquid Dump recipe is missing");

    const [diagnostic] = calculateBuildingDiagnostics(
      [disposalModule],
      [],
      [],
      [],
      [{
        recipe: liquidDumpRecipe,
        moduleId: disposalModule.id,
        dataSource: "synced",
        activeBuildings: 1,
        builtBuildings: 1,
        supplyRatio: 0,
        actualInputs: [],
        actualOutputs: [],
      }],
    );

    expect(diagnostic).toMatchObject({ attention: "can-pause", attentionCount: 1 });
  });
});

describe("synced fallback source diagnostics", () => {
  const groundwaterPump = recipes.find(
    (recipe) => recipe.id === "groundwater-pump-factory-reserve",
  );

  if (!groundwaterPump) throw new Error("Factory reserve Groundwater Pump recipe is missing");

  it("reports an unused synced Groundwater Pump as pauseable without making it planned", () => {
    const generalModule: Module = {
      id: "general",
      name: "Default",
      description: "",
      builtBuildings: { [groundwaterPump.id]: 3 },
      presets: [],
      defaultPresetId: null,
    };
    const result: PassiveResult = {
      recipe: groundwaterPump,
      moduleId: generalModule.id,
      dataSource: "synced",
      activeBuildings: 1,
      builtBuildings: 3,
      supplyRatio: 0,
      actualInputs: [],
      actualOutputs: [{ resourceId: "water", quantity: 0 }],
    };
    const [diagnostic] = calculateBuildingDiagnostics(
      [generalModule],
      [],
      [],
      [result],
    );

    expect(diagnostic).toMatchObject({
      plannedCapacity: false,
      attention: "can-pause",
      attentionCount: 1,
      load: 0,
      active: 1,
      built: 3,
    });
  });
});

describe("planned capacity diagnostics", () => {
  const diamondPaste = recipes.find(
    (recipe) => recipe.id === "chemical-plant-ii-diamond-paste-cooking-oil",
  );

  if (!diamondPaste) throw new Error("Diamond Paste recipe is missing");

  const plannedModule: Module = {
    id: "planned",
    name: "Planned",
    description: "",
    builtBuildings: { [diamondPaste.id]: 0 },
    presets: [],
    defaultPresetId: null,
  };
  const plannedResult = (supplyRatio: number): RegularResult => ({
    recipe: diamondPaste,
    moduleId: plannedModule.id,
    dataSource: "planned",
    activeBuildings: 1,
    builtBuildings: 0,
    operatingMode: "balanced",
    supplyRatio,
    speedLevel: 1,
    actualInputs: [],
    actualOutputs: [],
    recyclableSourceValueProduced: 0,
  });

  it("does not restate planned capacity as an attention warning", () => {
    const [diagnostic] = calculateBuildingDiagnostics(
      [plannedModule],
      [],
      [plannedResult(0)],
    );

    expect(diagnostic).toMatchObject({
      active: 1,
      built: 0,
      plannedCapacity: true,
      attention: null,
      attentionCount: 0,
    });
  });

  it("does not report synced construction ghosts as missing builds", () => {
    const ghostResult: RegularResult = {
      ...plannedResult(1),
      dataSource: "synced",
      constructionGhosts: 1,
    };
    const [diagnostic] = calculateBuildingDiagnostics(
      [plannedModule],
      [],
      [ghostResult],
    );

    expect(diagnostic).toMatchObject({
      plannedCapacity: true,
      attention: null,
      attentionCount: 0,
    });
  });

  it("treats planned capacity as acknowledged even when it remains constrained", () => {
    const [diagnostic] = calculateBuildingDiagnostics(
      [plannedModule],
      [resourceFlow("diamondPaste", -1)],
      [plannedResult(1)],
    );

    expect(diagnostic).toMatchObject({
      plannedCapacity: true,
      attention: null,
      attentionCount: 0,
    });
  });

  it("treats a mixed shared-capacity pool as acknowledged when one recipe is planned", () => {
    const currentResult = {
      ...plannedResult(0.5),
      dataSource: "synced" as const,
      activeBuildings: 1,
      builtBuildings: 1,
      capacityPoolId: "chemical-plant-ii",
    };
    const expansionResult = {
      ...plannedResult(0.5),
      activeBuildings: 2,
      builtBuildings: 1,
      capacityPoolId: "chemical-plant-ii",
    };
    const [diagnostic] = calculateBuildingDiagnostics(
      [plannedModule],
      [],
      [currentResult, expansionResult],
    );

    expect(diagnostic).toMatchObject({
      active: 2,
      built: 1,
      plannedCapacity: true,
      attention: null,
      attentionCount: 0,
    });
  });

  it("also suppresses animal-population attention for a planned farm", () => {
    const plannedChickenResult = {
      ...createChickenResult(1_100),
      dataSource: "planned" as const,
      builtBuildings: 0,
    };
    const [diagnostic] = calculateBuildingDiagnostics(
      [farmsModule],
      [flow("eggs", "Eggs", -7.6)],
      [plannedChickenResult],
    );

    expect(diagnostic).toMatchObject({
      plannedCapacity: true,
      attention: null,
      attentionCount: 0,
    });
  });
});

describe("required running capacity diagnostics", () => {
  const launchPad = recipes.find(recipe => recipe.id === "rocket-ii-launch-amortized");

  if (!launchPad) throw new Error("Rocket Launch Pad recipe is missing");

  const spaceStationModule: Module = {
    id: "space-station",
    name: "Space Station",
    description: "",
    builtBuildings: { [launchPad.id]: 1 },
    presets: [],
    defaultPresetId: null,
  };
  const result = (builtBuildings: number): RegularResult => ({
    recipe: launchPad,
    moduleId: spaceStationModule.id,
    dataSource: "synced",
    activeBuildings: 1,
    currentActiveBuildings: 0,
    builtBuildings,
    operatingMode: "fixed",
    supplyRatio: 1,
    speedLevel: 1,
    actualInputs: [],
    actualOutputs: [],
    recyclableSourceValueProduced: 0,
  });

  it("asks to unpause recurring rocket infrastructure that is already built", () => {
    expect(calculateBuildingDiagnostics(
      [spaceStationModule],
      [],
      [result(1)],
    )[0]).toMatchObject({ attention: "unpause", attentionCount: 1 });
  });

  it("asks to build recurring rocket infrastructure only when none is present", () => {
    expect(calculateBuildingDiagnostics(
      [spaceStationModule],
      [],
      [result(0)],
    )[0]).toMatchObject({ attention: "build", attentionCount: 1 });
  });
});
