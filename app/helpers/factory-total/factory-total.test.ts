import { describe, expect, it } from "vitest";

import { baseConfig } from "../../db/config";
import {
  attachMaintenanceDepotsToModule,
  resolveMaintenanceDepotModuleAssignments,
} from "../../db/modules/area-maintenance";
import { DEFAULT_MODULE_ID } from "../../db/modules/default";
import {
  modules,
  type Module,
} from "../../db/modules/modules";
import { recipes, type Recipe } from "../../db/recipes";
import { defaultInfiniteResearchLevels } from "../../db/research";
import { activeContracts } from "../../test-fixtures/active-contracts";
import { syncedMaintenanceDepotEntities } from "../../test-fixtures/synced-maintenance-depots";
import { syncedNuclearTestModule } from "../../test-fixtures/synced-nuclear-module";
import { calculateMaintenanceOutput } from "../modifiers/calculate-maintenance-output";
import { calculateShipsFuelUse } from "../modifiers/calculate-ships-fuel-use";
import { calculateFactoryTotal } from "./factory-total";

const baselineFactoryOptions = {
  recyclingEfficiencyPercent: baseConfig.recyclingEfficiencyPercent,
};

const maintenanceDemand = {
  maintenanceI: 547.8,
  maintenanceII: 194.22,
  maintenanceIII: 236.55,
};
const recipeById = (id: string): Recipe => {
  const recipe = recipes.find(candidate => candidate.id === id);

  if (!recipe) throw new Error(`Missing test recipe: ${id}`);

  return recipe;
};
const currentFactoryFixture: Module = {
  id: DEFAULT_MODULE_ID,
  name: "Default test fixture",
  description: "",
  builtBuildings: {
    "fixture-uranium-demand": 1,
    "fixture-hydrogen-demand": 1,
    "fixture-titanium-demand": 1,
    "fixture-coal-demand": 1,
    "hydrogen-reformer-super": 8,
    "crusher-large-titanium": 1,
    "coal-maker-wood": 3,
    "waste-sorting-recyclables": 2,
  },
  recipes: [
    {
      id: "fixture-uranium-demand",
      name: "Uranium demand",
      building: "Test",
      group: "production",
      inputs: [{ resourceId: "uraniumOre", quantity: 54 }],
      outputs: [],
    },
    {
      id: "fixture-hydrogen-demand",
      name: "Hydrogen demand",
      building: "Test",
      group: "production",
      inputs: [{ resourceId: "hydrogen", quantity: 130 }],
      outputs: [],
    },
    {
      id: "fixture-titanium-demand",
      name: "Titanium demand",
      building: "Test",
      group: "production",
      inputs: [{ resourceId: "titaniumOreCrushed", quantity: 100 }],
      outputs: [],
    },
    {
      id: "fixture-coal-demand",
      name: "Coal demand",
      building: "Test",
      group: "production",
      inputs: [{ resourceId: "coal", quantity: 10 }],
      outputs: [],
    },
    recipeById("hydrogen-reformer-super"),
    recipeById("crusher-large-titanium"),
    recipeById("coal-maker-wood"),
    recipeById("waste-sorting-recyclables"),
  ],
  presets: [{
    id: "fixture",
    name: "Fixture",
    description: "",
    activeBuildings: {
      "fixture-uranium-demand": 1,
      "fixture-hydrogen-demand": 1,
      "fixture-titanium-demand": 1,
      "fixture-coal-demand": 1,
      "hydrogen-reformer-super": 8,
      "crusher-large-titanium": 1,
      "coal-maker-wood": 0,
      "waste-sorting-recyclables": 2,
    },
    dataSources: {
      "hydrogen-reformer-super": "synced",
      "crusher-large-titanium": "synced",
      "coal-maker-wood": "synced",
      "waste-sorting-recyclables": "synced",
    },
    fixed: [
      "fixture-uranium-demand",
      "fixture-hydrogen-demand",
      "fixture-titanium-demand",
      "fixture-coal-demand",
    ],
  }],
  defaultPresetId: "fixture",
};
const modulesWithNuclear = [
  ...modules.filter(module => module.id !== DEFAULT_MODULE_ID),
  currentFactoryFixture,
  syncedNuclearTestModule,
];
const maintenanceAssignments = resolveMaintenanceDepotModuleAssignments({
  defaultModuleId: DEFAULT_MODULE_ID,
  demand: maintenanceDemand,
  modules: modulesWithNuclear,
  productionEntities: syncedMaintenanceDepotEntities,
});
const modulesWithSyncedHistory = modulesWithNuclear.map(module => {
  const maintenanceAssignment = maintenanceAssignments[module.id];

  if (maintenanceAssignment) {
    module = attachMaintenanceDepotsToModule(module, maintenanceAssignment);
  }

  return module;
});

describe("Factory Total contracts", () => {
  it("uses the fixed active Uranium import plan", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, {
      ...baselineFactoryOptions,
      contracts: activeContracts,
    });
    const contractResult = result.contractResults.at(0);

    expect(contractResult).toMatchObject({
      exported: 36,
      imported: 54,
      requiredImported: 54,
      fuelPerProductionCycle: 9.75375,
    });

  });

  it("uses all eight current Hydrogen Reformers to cover the expanded demand", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, {
      ...baselineFactoryOptions,
      contracts: activeContracts,
    });
    const reformer = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "hydrogen-reformer-super",
    );
    const hydrogenOutput = reformer?.actualOutputs.find(
      ({ resourceId }) => resourceId === "hydrogen",
    )?.quantity ?? 0;
    const hydrogen = result.calculation.allResourceFlows.find(
      ({ resourceId }) => resourceId === "hydrogen",
    );

    expect(reformer).toMatchObject({ activeBuildings: 8, builtBuildings: 8 });
    expect(hydrogenOutput).toBeGreaterThan(120);
    expect(hydrogen?.net).toBeCloseTo(0);
  });

  it("uses the Default Titanium Crusher to demand-balance the Titanium Ore contract", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, {
      ...baselineFactoryOptions,
      contracts: activeContracts,
    });
    const contractResult = result.contractResults.find(
      ({ contract }) => contract.id === "titanium-ore-for-construction-parts-iv",
    );
    const crusher = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "crusher-large-titanium",
    );
    const titaniumOre = result.flows.find(({ resourceId }) => resourceId === "titaniumOre");
    const crushedTitaniumOre = result.flows.find(
      ({ resourceId }) => resourceId === "titaniumOreCrushed",
    );

    expect(contractResult).toMatchObject({
      contract: {
        exchange: {
          exported: { resourceId: "constructionPartsIV", quantity: 5 },
          imported: { resourceId: "titaniumOre", quantity: 380 },
        },
      },
    });
    expect(contractResult?.imported ?? 0).toBeGreaterThan(0);
    expect(contractResult?.imported).toBeCloseTo(contractResult?.requestedImported ?? 0);
    expect(contractResult?.imported).toBeCloseTo(contractResult?.requiredImported ?? 0);
    expect(contractResult?.maxImportedPerProductionCycle ?? 0)
      .toBeGreaterThan(contractResult?.imported ?? 0);
    expect(contractResult?.exported ?? 0).toBeGreaterThan(0);
    expect(contractResult?.fuelPerProductionCycle ?? 0).toBeGreaterThan(0);
    expect(crusher).toMatchObject({
      activeBuildings: 1,
      builtBuildings: 1,
      dataSource: "synced",
    });
    expect(crusher?.actualInputs.find(({ resourceId }) => resourceId === "titaniumOre")?.quantity)
      .toBeCloseTo(contractResult?.imported ?? 0);
    expect(titaniumOre?.net).toBeCloseTo(0);
    expect(crushedTitaniumOre?.net).toBeLessThan(0);
    expect(result.contractResults.some(
      ({ contract }) => contract.id === "iron-ore-for-vehicle-parts-ii",
    )).toBe(false);
  });

  it("leaves the Copper Ore contract idle without a synced Copper-area boundary", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, {
      ...baselineFactoryOptions,
      contracts: activeContracts,
    });
    const contractResult = result.contractResults.find(
      ({ contract }) => contract.id === "copper-ore-for-medical-supplies-iii",
    );
    const copperOre = result.flows.find((flow) => flow.resourceId === "copperOre");

    expect(contractResult?.exported).toBe(0);
    expect(contractResult?.imported).toBe(0);
    expect(contractResult?.requiredImported).toBe(0);
    expect(contractResult?.fuelPerProductionCycle).toBe(0);
    expect(copperOre?.consumed).toBeCloseTo(0, 5);
    expect(copperOre?.produced).toBeCloseTo(0, 5);
    expect(copperOre?.net).toBeCloseTo(0, 5);
    expect(result.calculation.sourceResults.some(({ recipe }) => (
      recipe.outputs.some(({ resourceId }) => resourceId === "copperOre")
    ))).toBe(false);
  });

  it("leaves Coal demand uncovered while every local Coal Maker is paused", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, {
      ...baselineFactoryOptions,
      contracts: activeContracts,
    });
    const coalMaker = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "coal-maker-wood",
    );
    const coal = result.flows.find((flow) => flow.resourceId === "coal");

    expect(coalMaker).toMatchObject({ activeBuildings: 0, builtBuildings: 3 });
    expect(coal?.consumed ?? 0).toBeGreaterThan(0);
    expect(coal?.produced).toBe(0);
    expect(coal?.net).toBeCloseTo(-(coal?.consumed ?? 0), 5);
  });

  it("keeps uncovered Uranium demand visible instead of resizing the contract", () => {
    const contract = activeContracts[0];

    expect(contract).toBeDefined();

    const result = calculateFactoryTotal(
      modulesWithSyncedHistory,
      {
        ...baselineFactoryOptions,
        contracts: contract
          ? [{
              ...contract,
              routes: contract.routes.map(route => ({
                ...route,
                importedPerProductionCycle: 36,
              })),
            }]
          : [],
      },
    );
    const uranium = result.flows.find((flow) => flow.resourceId === "uraniumOre");

    expect(result.contractResults.at(0)).toMatchObject({
      imported: 36,
      requiredImported: 54,
    });
    expect(uranium).toMatchObject({ consumed: 54, produced: 36, net: -18 });
  });

  it("does not let demand balancing exceed observed contract throughput", () => {
    const contract = activeContracts[0];

    expect(contract).toBeDefined();

    const result = calculateFactoryTotal(
      modulesWithSyncedHistory,
      {
        ...baselineFactoryOptions,
        contracts: contract
          ? [{
              ...contract,
              routes: contract.routes.map(route => ({
                ...route,
                importedPerProductionCycle: null,
                shipping: {
                  ...route.shipping,
                  roundTripDurationProductionCycles: 40,
                },
              })),
            }]
          : [],
      },
    );
    const uranium = result.flows.find((flow) => flow.resourceId === "uraniumOre");

    expect(result.contractResults.at(0)).toMatchObject({
      imported: 40,
      requestedImported: 54,
      requiredImported: 54,
      maxImportedPerProductionCycle: 40,
    });
    expect(uranium).toMatchObject({ consumed: 54, produced: 40, net: -14 });
  });

  it("passes Ship Fuel Use research into recurring contract fuel", () => {
    const shipsFuelUse = calculateShipsFuelUse(5);
    const result = calculateFactoryTotal(
      modulesWithSyncedHistory,
      {
        ...baselineFactoryOptions,
        contracts: activeContracts,
        shipsFuelUseMultiplier: shipsFuelUse.multiplier,
      },
    );

    expect(result.contractResults.at(0)).toMatchObject({
      fuelPerProductionCycle: 9.2475,
    });
  });

  it("uses synced maintenance demand and balances available recycling capacity", () => {
    const maintenanceOutput = calculateMaintenanceOutput(
      defaultInfiniteResearchLevels.maintenanceOutput,
    );
    const result = calculateFactoryTotal(
      modulesWithSyncedHistory,
      {
        ...baselineFactoryOptions,
        contracts: activeContracts,
        outputModifiers: { maintenanceOutput: maintenanceOutput.multiplier },
      },
    );
    const getLine = (recipeId: string) => result.calculation.regularResults.find(
      (line) => line.recipe.id === recipeId,
    );
    const maintenanceI = getLine("maintenance-i-recycling");
    const maintenanceII = getLine("maintenance-ii-recycling");
    const maintenanceIII = getLine("maintenance-iii-recycling");
    const wasteSorter = getLine("waste-sorting-recyclables");
    const recyclables = result.calculation.allResourceFlows.find(
      (flow) => flow.resourceId === "recyclables",
    );

    expect(maintenanceI).toMatchObject({ activeBuildings: 2, builtBuildings: 2 });
    expect(maintenanceI?.supplyRatio).toBeCloseTo(0.55);
    expect(maintenanceII?.supplyRatio).toBeCloseTo(0.39);
    expect(maintenanceIII?.supplyRatio).toBeCloseTo(0.475);
    expect(wasteSorter).toMatchObject({ activeBuildings: 2 });
    expect(wasteSorter?.supplyRatio ?? 0).toBeGreaterThan(0);
    expect(recyclables?.consumed ?? 0).toBeGreaterThan(0);
    expect(recyclables?.produced).toBeCloseTo(recyclables?.consumed ?? 0);
    expect(recyclables?.net).toBeCloseTo(0);
  });
});

describe("Factory Total module boundaries", () => {
  it("reserves a planned import for its module and lets that input drive production", () => {
    const competingModule: Module = {
      id: "competing-iron-consumer",
      name: "Competing iron consumer",
      description: "",
      builtBuildings: { "competing-iron-recipe": 1 },
      recipes: [{
        id: "competing-iron-recipe",
        name: "Competing iron recipe",
        building: "Competing consumer",
        group: "production",
        balanceBy: "input",
        balanceInputIds: ["ironOreCrushed"],
        inputs: [{ resourceId: "ironOreCrushed", quantity: 10 }],
        outputs: [{ resourceId: "slag", quantity: 10 }],
      }],
      presets: [{
        id: "live",
        name: "Live",
        description: "",
        activeBuildings: { "competing-iron-recipe": 1 },
        fixed: [],
      }],
      defaultPresetId: "live",
    };
    const importingModule: Module = {
      id: "forced-iron-import",
      name: "Forced iron import",
      description: "",
      builtBuildings: { "import-driven-iron-recipe": 1 },
      recipes: [{
        id: "import-driven-iron-recipe",
        name: "Import-driven iron recipe",
        building: "Arc furnace II",
        group: "production",
        allocation: "fallback",
        balanceBy: "output",
        balanceOutputIds: ["moltenIron"],
        inputs: [
          { resourceId: "ironOreCrushed", quantity: 10 },
          { resourceId: "limestone", quantity: 5 },
        ],
        outputs: [{ resourceId: "moltenIron", quantity: 10 }],
      }],
      presets: [{
        id: "live",
        name: "Live",
        description: "",
        activeBuildings: { "import-driven-iron-recipe": 1 },
        fixed: [],
        requestedImports: { ironOreCrushed: 10 },
      }],
      defaultPresetId: "live",
    };
    const result = calculateFactoryTotal(
      [competingModule, importingModule],
      baselineFactoryOptions,
    );
    const competing = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "competing-iron-recipe",
    );
    const importing = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "import-driven-iron-recipe",
    );

    expect(competing?.supplyRatio).toBe(0);
    expect(importing).toMatchObject({
      supplyRatio: 1,
      actualInputs: [
        { resourceId: "ironOreCrushed", quantity: 10 },
        { resourceId: "limestone", quantity: 5 },
      ],
      actualOutputs: [{ resourceId: "moltenIron", quantity: 10 }],
    });
    expect(result.flows.find(flow => flow.resourceId === "ironOreCrushed"))
      .toMatchObject({ consumed: 10, produced: 10, net: 0 });
    expect(result.flows.find(flow => flow.resourceId === "limestone"))
      .toMatchObject({ consumed: 5, produced: 0, net: -5 });
  });

  it("routes a planned import through local intermediate consumers", () => {
    const importingModule: Module = {
      id: "forced-local-chain",
      name: "Forced local chain",
      description: "",
      builtBuildings: {
        "forced-local-smelting": 1,
        "forced-local-steel": 1,
        "forced-local-desalination": 1,
      },
      recipes: [{
        id: "forced-local-smelting",
        name: "Import-driven smelting",
        building: "Arc furnace II",
        group: "production",
        allocation: "fallback",
        balanceBy: "output",
        balanceOutputIds: ["moltenIron"],
        inputs: [
          { resourceId: "ironOreCrushed", quantity: 10 },
          { resourceId: "limestone", quantity: 5 },
        ],
        outputs: [
          { resourceId: "moltenIron", quantity: 10 },
          { resourceId: "steamLow", quantity: 10 },
        ],
      }, {
        id: "forced-local-steel",
        name: "Steel smelting",
        building: "Oxygen furnace II",
        group: "production",
        balanceBy: "output",
        consumeSurplusInputIds: ["moltenIron"],
        consumeSurplusInputScope: "module",
        inputs: [
          { resourceId: "moltenIron", quantity: 10 },
          { resourceId: "oxygen", quantity: 5 },
        ],
        outputs: [{ resourceId: "moltenSteel", quantity: 5 }],
      }, {
        id: "forced-local-desalination",
        name: "Low-steam desalination",
        building: "Thermal desalinator",
        group: "production",
        balanceBy: "output",
        consumeSurplusInputIds: ["steamLow"],
        consumeSurplusInputScope: "module",
        inputs: [
          { resourceId: "steamLow", quantity: 10 },
          { resourceId: "seaWater", quantity: 10 },
        ],
        outputs: [{ resourceId: "water", quantity: 10 }],
      }],
      presets: [{
        id: "live",
        name: "Live",
        description: "",
        activeBuildings: {
          "forced-local-smelting": 1,
          "forced-local-steel": 1,
          "forced-local-desalination": 1,
        },
        fixed: [],
        requestedImports: { ironOreCrushed: 10 },
      }],
      defaultPresetId: "live",
    };
    const result = calculateFactoryTotal([importingModule], baselineFactoryOptions);
    const recipeResult = (recipeId: string) => result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === recipeId,
    );

    expect(recipeResult("forced-local-smelting")?.supplyRatio).toBe(1);
    expect(recipeResult("forced-local-steel")).toMatchObject({
      supplyRatio: 1,
      actualInputs: [
        { resourceId: "moltenIron", quantity: 10 },
        { resourceId: "oxygen", quantity: 5 },
      ],
    });
    expect(recipeResult("forced-local-desalination")).toMatchObject({
      supplyRatio: 1,
      actualInputs: [
        { resourceId: "steamLow", quantity: 10 },
        { resourceId: "seaWater", quantity: 10 },
      ],
    });
    expect(result.flows.find(flow => flow.resourceId === "moltenIron")?.net).toBe(0);
    expect(result.flows.find(flow => flow.resourceId === "steamLow")?.net).toBe(0);
    expect(result.flows.find(flow => flow.resourceId === "oxygen")?.net).toBe(-5);
    expect(result.flows.find(flow => flow.resourceId === "seaWater")?.net).toBe(-10);
  });

  it("treats a pooled live export request as module supply, not factory demand", () => {
    const pooledLiveModule: Module = {
      id: "live-copper",
      name: "Copper #1",
      description: "",
      includedInFactoryTotals: true,
      builtBuildings: { "live-copper-output": 1 },
      recipes: [{
        id: "live-copper-output",
        name: "Live Copper output",
        building: "Copper electrolysis",
        group: "production",
        inputs: [],
        outputs: [{ resourceId: "copper", quantity: 384 }],
      }],
      presets: [{
        id: "live",
        name: "Live",
        description: "",
        activeBuildings: { "live-copper-output": 1 },
        fixed: [],
        outputTargets: { copper: 384 },
        requestedExports: { copper: 384 },
      }],
      defaultPresetId: "live",
      liveArea: {
        zoneId: 16,
        trackedBuildings: 1,
        constructedBuildings: 1,
        activeBuildings: 1,
        pausedBuildings: 0,
        constructionGhosts: 0,
        issues: [],
      },
    };
    const result = calculateFactoryTotal([pooledLiveModule], baselineFactoryOptions);

    expect(result.flows.find(flow => flow.resourceId === "copper")).toMatchObject({
      consumed: 0,
      produced: 384,
      net: 384,
    });
  });

  it("includes unlinked live-module supplies and demands in the global pool", () => {
    const result = calculateFactoryTotal([], {
      ...baselineFactoryOptions,
      boundaryDemands: { limestone: 2 },
      boundarySupplies: { sulfur: 1 },
    });

    expect(result.flows.find(flow => flow.resourceId === "limestone")?.net).toBe(-2);
    expect(result.flows.find(flow => flow.resourceId === "sulfur")?.net).toBe(1);
  });

  it("converges equivalent prioritized consumers before a surplus sink runs", () => {
    const brineModule: Module = {
      id: "prioritized-brine",
      name: "Prioritized Brine",
      description: "",
      includedInFactoryTotals: true,
      builtBuildings: {
        "brine-source": 1,
        "salt-demand": 1,
        "salt-pond-a": 1,
        "salt-pond-b": 2,
        "brine-dump": 1,
      },
      recipes: [{
        id: "brine-source",
        name: "Brine source",
        building: "Source",
        group: "production",
        inputs: [],
        outputs: [{ resourceId: "brine", quantity: 480 }],
      }, {
        id: "salt-demand",
        name: "Salt demand",
        building: "Consumer",
        group: "production",
        inputs: [{ resourceId: "salt", quantity: 24 }],
        outputs: [],
      }, ...["salt-pond-a", "salt-pond-b"].map((id): Recipe => ({
        id,
        name: id,
        building: "Evaporation Pond (Heated)",
        group: "production",
        balanceBy: "output",
        balanceInputIds: ["brine"],
        balanceOutputIds: ["salt"],
        inputPriorities: { brine: 3 },
        inputs: [{ resourceId: "brine", quantity: 96 }],
        outputs: [{ resourceId: "salt", quantity: 12 }],
      })), {
        id: "brine-dump",
        name: "Brine dump",
        building: "Liquid Dump",
        group: "sink",
        inputs: [{ resourceId: "brine", quantity: 200 }],
        outputs: [],
      }],
      presets: [{
        id: "live",
        name: "Live",
        description: "",
        activeBuildings: {
          "brine-source": 1,
          "salt-demand": 1,
          "salt-pond-a": 1,
          "salt-pond-b": 2,
          "brine-dump": 1,
        },
        fixed: ["brine-source", "salt-demand"],
      }],
      defaultPresetId: "live",
    };
    const result = calculateFactoryTotal([brineModule], baselineFactoryOptions);

    expect(result.flows.find(flow => flow.resourceId === "salt")?.net).toBeCloseTo(0, 5);
    expect(result.flows.find(flow => flow.resourceId === "brine")?.net).toBeCloseTo(88, 5);
    expect(result.calculation.sinkResults.find(result => (
      result.recipe.id === "brine-dump"
    ))?.actualInputs).toEqual([{ resourceId: "brine", quantity: 200 }]);
  });

  it("lets module-local recovered Steel displace ordinary Steel production", () => {
    const recoveryModule: Module = {
      id: "default-recovery",
      name: "Default recovery",
      description: "",
      includedInFactoryTotals: true,
      builtBuildings: {
        "local-molten-steel": 1,
        "local-steel-caster": 1,
        "steel-demand": 1,
      },
      recipes: [{
        id: "local-molten-steel",
        name: "Local Molten Steel",
        building: "Byproduct producer",
        group: "production",
        inputs: [],
        outputs: [{ resourceId: "moltenSteel", quantity: 6 }],
      }, {
        id: "local-steel-caster",
        name: "Local Steel Caster",
        building: "Cooled Caster",
        group: "production",
        allocation: "fallback",
        balanceBy: "input",
        balanceInputIds: ["moltenSteel"],
        balanceInputScope: "module",
        inputPriorities: { moltenSteel: 100 },
        inputs: [{ resourceId: "moltenSteel", quantity: 6 }],
        outputs: [{ resourceId: "steel", quantity: 6 }],
      }, {
        id: "steel-demand",
        name: "Steel demand",
        building: "Consumer",
        group: "production",
        inputs: [{ resourceId: "steel", quantity: 10 }],
        outputs: [],
      }],
      presets: [{
        id: "live",
        name: "Live",
        description: "",
        activeBuildings: {
          "local-molten-steel": 1,
          "local-steel-caster": 1,
          "steel-demand": 1,
        },
        fixed: ["local-molten-steel", "steel-demand"],
      }],
      defaultPresetId: "live",
    };
    const steelModule: Module = {
      id: "steel-production",
      name: "Steel production",
      description: "",
      includedInFactoryTotals: true,
      builtBuildings: { "ordinary-steel": 1 },
      recipes: [{
        id: "ordinary-steel",
        name: "Ordinary Steel",
        building: "Steel producer",
        group: "production",
        balanceBy: "output",
        balanceOutputIds: ["steel"],
        inputs: [],
        outputs: [{ resourceId: "steel", quantity: 10 }],
      }],
      presets: [{
        id: "live",
        name: "Live",
        description: "",
        activeBuildings: { "ordinary-steel": 1 },
        fixed: [],
      }],
      defaultPresetId: "live",
    };
    const result = calculateFactoryTotal(
      [recoveryModule, steelModule],
      baselineFactoryOptions,
    );
    const regularResult = (recipeId: string) => result.calculation.regularResults.find(
      candidate => candidate.recipe.id === recipeId,
    );

    expect(regularResult("local-steel-caster")?.supplyRatio).toBeCloseTo(1, 5);
    expect(regularResult("ordinary-steel")?.supplyRatio).toBeCloseTo(0.4, 5);
    expect(result.calculation.allResourceFlows.find(
      flow => flow.resourceId === "moltenSteel",
    )?.net).toBeCloseTo(0, 4);
    expect(result.calculation.allResourceFlows.find(
      flow => flow.resourceId === "steel",
    )?.net).toBeCloseTo(0, 4);
  });
});
