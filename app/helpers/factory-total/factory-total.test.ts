import { describe, expect, it } from "vitest";

import { baseConfig } from "../../db/config";
import { activeContracts } from "../../db/contracts";
import {
  attachMaintenanceDepotsToModule,
  resolveMaintenanceDepotModuleAssignments,
} from "../../db/modules/area-maintenance";
import { DEFAULT_MODULE_ID } from "../../db/modules/default";
import {
  factoryModelModules as modules,
  type Module,
} from "../../db/modules/modules";
import {
  createNuclearModule,
  defaultNuclearConfig,
  NUCLEAR_MODULE_ID,
} from "../../db/modules/nuclear";
import { defaultInfiniteResearchLevels } from "../../db/research";
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
const maintenanceAssignments = resolveMaintenanceDepotModuleAssignments({
  defaultModuleId: DEFAULT_MODULE_ID,
  demand: maintenanceDemand,
  modules,
});
const modulesWithSyncedHistory = modules.map(module => {
  const maintenanceAssignment = maintenanceAssignments[module.id];

  if (maintenanceAssignment) {
    module = attachMaintenanceDepotsToModule(module, maintenanceAssignment, "modeled");
  }

  if (module.id === NUCLEAR_MODULE_ID) {
    return createNuclearModule(defaultNuclearConfig, {
      averageGeneratorOutputMw: 77,
      hydrogenFuelDemandPerCycle: 46.5,
    });
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
      uncoveredImported: 0,
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
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
    expect(hydrogenOutput).toBeGreaterThan(5 * 32);
    expect(hydrogen?.net).toBeCloseTo(0);
  });

  it("balances the Iron Ore contract against live factory demand", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, {
      ...baselineFactoryOptions,
      contracts: activeContracts,
    });
    const contractResult = result.contractResults.find(
      ({ contract }) => contract.id === "iron-ore-for-vehicle-parts-ii",
    );
    const ironOre = result.flows.find((flow) => flow.resourceId === "ironOre");
    const ironOreCrushed = result.flows.find(
      (flow) => flow.resourceId === "ironOreCrushed",
    );
    const ironMine = result.calculation.sourceResults.find(
      ({ recipe }) => recipe.id === "iron-map-mine",
    );
    const crusher = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "crusher-large-iron",
    );
    const redMudRecovery = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "settling-tank-red-mud-acid",
    );

    expect(contractResult).toMatchObject({
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
    });
    expect(contractResult?.imported).toBeCloseTo(134.895888232122, 5);
    expect(contractResult?.requiredImported).toBeCloseTo(134.895888232122, 5);
    expect(contractResult?.uncoveredImported).toBeLessThan(0.00001);
    expect(contractResult?.fuelPerProductionCycle).toBeCloseTo(24.365569811927, 8);
    expect(ironOre?.consumed).toBeCloseTo(134.895888232122, 5);
    expect(ironOre?.produced).toBeCloseTo(134.895888232122, 5);
    expect(ironOre?.net).toBeCloseTo(0, 5);
    expect(ironOreCrushed?.net).toBeCloseTo(0, 5);
    const recoveredCrushedOre = redMudRecovery?.actualOutputs.find(
      ({ resourceId }) => resourceId === "ironOreCrushed",
    )?.quantity ?? 0;
    const crushedOreFromCrusher = crusher?.actualOutputs.find(
      ({ resourceId }) => resourceId === "ironOreCrushed",
    )?.quantity ?? 0;

    expect(recoveredCrushedOre).toBeGreaterThan(0);
    expect(crushedOreFromCrusher + recoveredCrushedOre)
      .toBeCloseTo(ironOreCrushed?.consumed ?? 0, 5);
    const ironMineOutput = ironMine?.actualOutputs.find(
      (output) => output.resourceId === "ironOre",
    );

    expect(ironMineOutput?.quantity).toBeCloseTo(0, 5);
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
    const copperMine = result.calculation.sourceResults.find(
      ({ recipe }) => recipe.id === "copper-map-mine",
    );

    expect(contractResult).toMatchObject({
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
    });
    expect(contractResult?.exported).toBe(0);
    expect(contractResult?.imported).toBe(0);
    expect(contractResult?.requiredImported).toBe(0);
    expect(contractResult?.uncoveredImported).toBeLessThan(0.00001);
    expect(contractResult?.fuelPerProductionCycle).toBe(0);
    expect(copperOre?.consumed).toBeCloseTo(0, 5);
    expect(copperOre?.produced).toBeCloseTo(0, 5);
    expect(copperOre?.net).toBeCloseTo(0, 5);
    const copperMineOutput = copperMine?.actualOutputs.find(
      (output) => output.resourceId === "copperOre",
    );

    expect(copperMineOutput?.quantity).toBeCloseTo(0, 5);
  });

  it("replaces local Ammonia production with the demand-balanced contract", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, {
      ...baselineFactoryOptions,
      contracts: activeContracts,
    });
    const ammoniaContract = result.contractResults.find(
      ({ contract }) => contract.id === "ammonia-for-food-pack",
    );
    const localAmmonia = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "chemical-plant-ii-ammonia",
    );
    const localNitrogen = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "air-separator-nitrogen",
    );

    expect(ammoniaContract?.imported).toBeGreaterThan(0);
    expect(ammoniaContract?.uncoveredImported).toBeCloseTo(0, 10);
    expect(localAmmonia).toMatchObject({ activeBuildings: 0, supplyRatio: 0 });
    expect(localNitrogen).toMatchObject({ activeBuildings: 0, supplyRatio: 0 });
  });

  it("mines Coal on demand while every local Coal Maker is paused", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, {
      ...baselineFactoryOptions,
      contracts: activeContracts,
    });
    const coalMaker = result.calculation.regularResults.find(
      ({ recipe }) => recipe.id === "coal-maker-wood",
    );
    const coalMine = result.calculation.sourceResults.find(
      ({ recipe }) => recipe.id === "coal-map-mine",
    );
    const coal = result.flows.find((flow) => flow.resourceId === "coal");
    const minedCoal = coalMine?.actualOutputs.find(
      ({ resourceId }) => resourceId === "coal",
    )?.quantity ?? 0;

    expect(coalMaker).toMatchObject({ activeBuildings: 0, builtBuildings: 3 });
    expect(minedCoal).toBeGreaterThan(0);
    expect(coal).toMatchObject({ net: 0 });
    expect(minedCoal).toBeCloseTo(coal?.consumed ?? 0, 5);
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
              plan: {
                ...contract.plan,
                importedPerProductionCycle: 36,
              },
            }]
          : [],
      },
    );
    const uranium = result.flows.find((flow) => flow.resourceId === "uraniumOre");

    expect(result.contractResults.at(0)).toMatchObject({
      imported: 36,
      requiredImported: 54,
      uncoveredImported: 18,
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
              plan: {
                ...contract.plan,
                importedPerProductionCycle: null,
                shipping: {
                  ...contract.plan.shipping,
                  roundTripDurationProductionCycles: 40,
                },
              },
            }]
          : [],
      },
    );
    const uranium = result.flows.find((flow) => flow.resourceId === "uraniumOre");

    expect(result.contractResults.at(0)).toMatchObject({
      imported: 40,
      requestedImported: 54,
      requiredImported: 54,
      uncoveredImported: 14,
      capacityLimitedImported: 14,
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
      fuelPerTrip: 274,
      fuelPerProductionCycle: 9.2475,
    });
  });

  it("uses synced maintenance demand and exposes the saturated recycler", () => {
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
    const researchLab = getLine("research-lab-iv-space");
    const orbitalResearch = getLine("space-station-orbital-research");
    const wasteSorter = getLine("waste-sorting-recyclables");
    const recyclables = result.calculation.allResourceFlows.find(
      (flow) => flow.resourceId === "recyclables",
    );

    expect(maintenanceI).toMatchObject({ activeBuildings: 2, builtBuildings: 2 });
    expect(maintenanceI?.supplyRatio).toBeCloseTo(0.55);
    expect(maintenanceII?.supplyRatio).toBeCloseTo(0.39);
    expect(maintenanceIII?.supplyRatio).toBeCloseTo(0.475);
    expect(researchLab?.actualOutputs).toContainEqual({
      resourceId: "recyclables",
      quantity: 96,
    });
    expect(researchLab?.actualInputs).toContainEqual({
      resourceId: "spaceResearchPoints",
      quantity: 96,
    });
    expect(result.flows.find((flow) => flow.resourceId === "spaceResearchPoints"))
      .toMatchObject({ consumed: 96, produced: 96, net: 0 });
    expect(orbitalResearch).toMatchObject({ supplyRatio: 1 });
    expect(orbitalResearch?.actualInputs).toContainEqual({
      resourceId: "electronicsIv",
      quantity: 4,
    });
    expect(wasteSorter).toMatchObject({ activeBuildings: 2 });
    expect(wasteSorter?.supplyRatio).toBeCloseTo(0.6784861111);
    expect(recyclables?.consumed).toBeCloseTo(195.404);
    expect(recyclables?.produced).toBeCloseTo(195.404);
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
});
