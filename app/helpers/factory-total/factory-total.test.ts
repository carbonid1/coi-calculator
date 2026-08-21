import { describe, expect, it } from "vitest";

import { activeContracts } from "../../db/contracts";
import { maintenanceDemandPerMonth } from "../../db/modules/maintenance";
import { modules } from "../../db/modules/modules";
import { defaultInfiniteResearchLevels } from "../../db/research";
import { calculateMaintenanceOutput } from "../modifiers/calculate-maintenance-output";
import { calculateShipsFuelUse } from "../modifiers/calculate-ships-fuel-use";
import { calculateFactoryTotal } from "./factory-total";

describe("Factory Total contracts", () => {
  it("uses the fixed active Uranium import plan", () => {
    const result = calculateFactoryTotal(modules, activeContracts);
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

  it("balances the Iron Ore contract against live factory demand", () => {
    const result = calculateFactoryTotal(modules, activeContracts);
    const contractResult = result.contractResults.find(
      ({ contract }) => contract.id === "iron-ore-for-vehicle-parts-ii",
    );
    const ironOre = result.flows.find((flow) => flow.resourceId === "ironOre");
    const ironMine = result.calculation.sourceResults.find(
      ({ recipe }) => recipe.id === "iron-map-mine",
    );

    expect(contractResult).toMatchObject({
      imported: 92.971225,
      requiredImported: 92.971225,
      uncoveredImported: 0,
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
      fuelPerProductionCycle: 16.792927515625,
    });
    expect(ironOre).toMatchObject({
      consumed: 92.971225,
      produced: 92.971225,
      net: 0,
    });
    expect(ironMine?.actualOutputs).toContainEqual({
      resourceId: "ironOre",
      quantity: 0,
    });
  });

  it("keeps uncovered Uranium demand visible instead of resizing the contract", () => {
    const contract = activeContracts[0];

    expect(contract).toBeDefined();

    const result = calculateFactoryTotal(
      modules,
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
      modules,
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
      modules,
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

  it("uses the measured maintenance demand and exposes the saturated recycler", () => {
    const maintenanceOutput = calculateMaintenanceOutput(
      defaultInfiniteResearchLevels.maintenanceOutput,
    );
    const result = calculateFactoryTotal(
      modules,
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

    expect(maintenanceDemandPerMonth).toEqual({
      maintenanceI: 547.8,
      maintenanceII: 194.22,
      maintenanceIII: 236.55,
    });
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
    expect(wasteSorter?.supplyRatio).toBeCloseTo(0.5964583333);
    expect(recyclables?.consumed).toBeCloseTo(171.78);
    expect(recyclables?.produced).toBeCloseTo(171.78);
    expect(recyclables?.net).toBeCloseTo(0);
  });
});
