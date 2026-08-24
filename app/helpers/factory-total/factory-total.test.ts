import { describe, expect, it } from "vitest";

import { activeContracts } from "../../db/contracts";
import {
  createMaintenanceModule,
  MAINTENANCE_MODULE_ID,
} from "../../db/modules/maintenance";
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

const modulesWithSyncedHistory = modules.map(module => {
  if (module.id === NUCLEAR_MODULE_ID) {
    return createNuclearModule(defaultNuclearConfig, {
      averageGeneratorOutputMw: 77,
      hydrogenFuelDemandPerCycle: 46.5,
    });
  }

  if (module.id === MAINTENANCE_MODULE_ID) {
    return createMaintenanceModule({
      maintenanceI: 547.8,
      maintenanceII: 194.22,
      maintenanceIII: 236.55,
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

  it("keeps one Hydrogen Reformer paused while five cover full demand", () => {
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

    expect(reformer).toMatchObject({ activeBuildings: 5, builtBuildings: 6 });
    expect(hydrogenOutput).toBeGreaterThan(4 * 32);
    expect(hydrogenOutput).toBeLessThan(5 * 32);
    expect(hydrogen?.net).toBeCloseTo(0);
  });

  it("balances the Iron Ore contract against live factory demand", () => {
    const result = calculateFactoryTotal(modulesWithSyncedHistory, activeContracts);
    const contractResult = result.contractResults.find(
      ({ contract }) => contract.id === "iron-ore-for-vehicle-parts-ii",
    );
    const ironOre = result.flows.find((flow) => flow.resourceId === "ironOre");
    const ironMine = result.calculation.sourceResults.find(
      ({ recipe }) => recipe.id === "iron-map-mine",
    );

    expect(contractResult).toMatchObject({
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
    });
    expect(contractResult?.imported).toBeCloseTo(177.88709681, 5);
    expect(contractResult?.requiredImported).toBeCloseTo(177.88709681, 5);
    expect(contractResult?.uncoveredImported).toBeLessThan(0.00001);
    expect(contractResult?.fuelPerProductionCycle).toBeCloseTo(32.13085686, 8);
    expect(ironOre?.consumed).toBeCloseTo(177.88709681, 5);
    expect(ironOre?.produced).toBeCloseTo(177.88709681, 5);
    expect(ironOre?.net).toBeCloseTo(0, 5);
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
    expect(contractResult?.exported).toBeCloseTo(23.84079231, 8);
    expect(contractResult?.imported).toBeCloseTo(154.96515, 5);
    expect(contractResult?.requiredImported).toBeCloseTo(154.96515, 5);
    expect(contractResult?.uncoveredImported).toBeLessThan(0.00001);
    expect(contractResult?.fuelPerProductionCycle).toBeCloseTo(27.99058022, 8);
    expect(copperOre?.consumed).toBeCloseTo(154.96515, 5);
    expect(copperOre?.produced).toBeCloseTo(154.96515, 5);
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
    const researchLab = getLine("research-lab-iv");
    const wasteSorter = getLine("waste-sorting-recyclables");
    const recyclables = result.calculation.allResourceFlows.find(
      (flow) => flow.resourceId === "recyclables",
    );

    expect(maintenanceI).toMatchObject({ activeBuildings: 2, builtBuildings: 2 });
    expect(maintenanceI?.supplyRatio).toBeCloseTo(0.55);
    expect(maintenanceII?.supplyRatio).toBeCloseTo(0.39);
    expect(maintenanceIII?.supplyRatio).toBeCloseTo(0.95);
    expect(researchLab?.actualOutputs).toContainEqual({
      resourceId: "recyclables",
      quantity: 96,
    });
    expect(researchLab?.actualInputs).not.toContainEqual({
      resourceId: "spaceResearchPoints",
      quantity: 96,
    });
    expect(result.flows.find((flow) => flow.resourceId === "spaceResearchPoints"))
      .toBeUndefined();
    expect(wasteSorter).toMatchObject({ activeBuildings: 2 });
    expect(wasteSorter?.supplyRatio).toBeCloseTo(0.6042083333);
    expect(recyclables?.consumed).toBeCloseTo(174.012);
    expect(recyclables?.produced).toBeCloseTo(174.012);
    expect(recyclables?.net).toBeCloseTo(0);
  });
});
