import { describe, expect, it } from "vitest";

import { activeContracts } from "../../db/contracts";
import {
  attachMaintenanceDepotsToModule,
  resolveMaintenanceDepotModuleAssignments,
} from "../../db/modules/area-maintenance";
import { DEFAULT_MODULE_ID } from "../../db/modules/default";
import { modules } from "../../db/modules/modules";
import {
  createNuclearModule,
  defaultNuclearConfig,
  NUCLEAR_MODULE_ID,
} from "../../db/modules/nuclear";
import { defaultInfiniteResearchLevels } from "../../db/research";
import { calculateMaintenanceOutput } from "../modifiers/calculate-maintenance-output";
import { calculateShipsFuelUse } from "../modifiers/calculate-ships-fuel-use";
import { calculateFactoryTotal } from "./factory-total";

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
    const result = calculateFactoryTotal(modulesWithSyncedHistory, activeContracts);
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
    const result = calculateFactoryTotal(modulesWithSyncedHistory, activeContracts);
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
    const result = calculateFactoryTotal(modulesWithSyncedHistory, activeContracts);
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
    expect(contractResult?.imported).toBeCloseTo(139.163133289, 5);
    expect(contractResult?.requiredImported).toBeCloseTo(139.163133289, 5);
    expect(contractResult?.uncoveredImported).toBeLessThan(0.00001);
    expect(contractResult?.fuelPerProductionCycle).toBeCloseTo(25.1363409504, 8);
    expect(ironOre?.consumed).toBeCloseTo(139.163133289, 5);
    expect(ironOre?.produced).toBeCloseTo(139.163133289, 5);
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

  it("balances the Copper Ore contract against live factory demand", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, activeContracts);
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
    expect(contractResult?.exported).toBeCloseTo(23.748484615384623, 8);
    expect(contractResult?.imported).toBeCloseTo(154.36515, 5);
    expect(contractResult?.requiredImported).toBeCloseTo(154.36515, 5);
    expect(contractResult?.uncoveredImported).toBeLessThan(0.00001);
    expect(contractResult?.fuelPerProductionCycle).toBeCloseTo(27.88220521875, 8);
    expect(copperOre?.consumed).toBeCloseTo(154.36515, 5);
    expect(copperOre?.produced).toBeCloseTo(154.36515, 5);
    expect(copperOre?.net).toBeCloseTo(0, 5);
    const copperMineOutput = copperMine?.actualOutputs.find(
      (output) => output.resourceId === "copperOre",
    );

    expect(copperMineOutput?.quantity).toBeCloseTo(0, 5);
  });

  it("replaces local Ammonia production with the demand-balanced contract", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, activeContracts);
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
    expect(ammoniaContract?.uncoveredImported).toBe(0);
    expect(localAmmonia).toMatchObject({ activeBuildings: 0, supplyRatio: 0 });
    expect(localNitrogen).toMatchObject({ activeBuildings: 0, supplyRatio: 0 });
  });

  it("mines Coal on demand while every local Coal Maker is paused", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, activeContracts);
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
      contract
        ? [{
            ...contract,
            plan: {
              ...contract.plan,
              importedPerProductionCycle: 36,
            },
          }]
        : [],
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
      contract
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
      activeContracts,
      undefined,
      {},
      shipsFuelUse.multiplier,
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
      activeContracts,
      undefined,
      { maintenanceOutput: maintenanceOutput.multiplier },
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
