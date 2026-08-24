import { describe, expect, it } from "vitest";

import { activeContracts } from "../../db/contracts";
import { calculateShipsFuelUse } from "../modifiers/calculate-ships-fuel-use";
import { applyContracts, calculateContractWorkers } from "./calculate-contracts";

describe("contract plans", () => {
  it("keeps the four-module Uranium contract at 54 per month", () => {
    const { contractResults, flows } = applyContracts([
      {
        resourceId: "uraniumOre",
        name: "Uranium Ore",
        consumed: 72,
        produced: 0,
        net: -72,
      },
    ], activeContracts);
    const uranium = flows.find((flow) => flow.resourceId === "uraniumOre");
    const foodPack = flows.find((flow) => flow.resourceId === "foodPack");

    expect(contractResults.at(0)).toMatchObject({
      exported: 36,
      imported: 54,
      requestedImported: 54,
      requiredImported: 72,
      uncoveredImported: 18,
      capacityLimitedImported: 0,
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
      fuelPerProductionCycle: 9.75375,
    });
    expect(contractResults.at(0)?.maxImportedPerProductionCycle).toBeCloseTo(
      1_600 / (427 / 60),
    );
    expect(uranium).toMatchObject({ consumed: 72, produced: 54, net: -18 });
    expect(foodPack).toMatchObject({ consumed: 36, produced: 0, net: -36 });
    expect(flows.find((flow) => flow.resourceId === "hydrogen")).toBeUndefined();
  });

  it("balances the four-module Iron Ore ship against current demand", () => {
    const { contractResults } = applyContracts([{
      resourceId: "ironOre",
      name: "Iron Ore",
      consumed: 70,
      produced: 0,
      net: -70,
    }], activeContracts);
    const iron = contractResults.find(
      (result) => result.contract.id === "iron-ore-for-vehicle-parts-ii",
    );

    expect(iron).toMatchObject({
      exported: 5,
      imported: 70,
      requiredImported: 70,
      uncoveredImported: 0,
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
    });
    expect(iron?.maxImportedPerProductionCycle).toBeCloseTo(
      1_600 / (426 / 60),
    );
    expect(iron?.fuelPerProductionCycle).toBeCloseTo(12.64375);
  });

  it("balances the four-module Copper Ore ship against current demand", () => {
    const { contractResults } = applyContracts([{
      resourceId: "copperOre",
      name: "Copper Ore",
      consumed: 65,
      produced: 0,
      net: -65,
    }], activeContracts);
    const copper = contractResults.find(
      (result) => result.contract.id === "copper-ore-for-medical-supplies-iii",
    );

    expect(copper).toMatchObject({
      exported: 10,
      imported: 65,
      requiredImported: 65,
      uncoveredImported: 0,
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
    });
    expect(copper?.maxImportedPerProductionCycle).toBeCloseTo(
      1_600 / (426 / 60),
    );
    expect(copper?.fuelPerProductionCycle).toBeCloseTo(11.740625);
  });

  it("caps imports at one shipload per observed round trip", () => {
    const uraniumContract = activeContracts[0];

    expect(uraniumContract).toBeDefined();

    const { contractResults, flows } = applyContracts([{
      resourceId: "uraniumOre",
      name: "Uranium Ore",
      consumed: 300,
      produced: 0,
      net: -300,
    }], uraniumContract
      ? [{
          ...uraniumContract,
          plan: {
            ...uraniumContract.plan,
            importedPerProductionCycle: 300,
          },
        }]
      : []);
    const result = contractResults[0];

    expect(result?.requestedImported).toBe(300);
    expect(result?.maxImportedPerProductionCycle).toBeCloseTo(1_600 / (427 / 60));
    expect(result?.imported).toBeCloseTo(1_600 / (427 / 60));
    expect(result?.capacityLimitedImported).toBeCloseTo(300 - 1_600 / (427 / 60));
    expect(result?.uncoveredImported).toBeCloseTo(300 - 1_600 / (427 / 60));
    expect(flows.find((flow) => flow.resourceId === "uraniumOre")?.net)
      .toBeCloseTo(-(300 - 1_600 / (427 / 60)));
  });

  it("balances the four-module Ammonia ship against current demand", () => {
    const { contractResults } = applyContracts([{
      resourceId: "ammonia",
      name: "Ammonia",
      consumed: 120,
      produced: 0,
      net: -120,
    }], activeContracts);
    const ammonia = contractResults.find(
      (result) => result.contract.id === "ammonia-for-food-pack",
    );

    expect(ammonia).toMatchObject({
      exported: 20,
      imported: 120,
      requiredImported: 120,
      uncoveredImported: 0,
      importedPerTrip: 1_600,
      fuelPerTrip: 289,
    });
    expect(ammonia?.maxImportedPerProductionCycle).toBeCloseTo(
      1_600 / (427 / 60),
    );
    expect(ammonia?.fuelPerProductionCycle).toBeCloseTo(21.675);
  });

  it("counts all planned ships and their cargo modules", () => {
    expect(calculateContractWorkers(activeContracts)).toBe(168);
  });

  it("applies Ship Fuel Use research before the ship's Save Fuel mode", () => {
    const shipsFuelUse = calculateShipsFuelUse(5);
    const { contractResults, flows } = applyContracts(
      [],
      activeContracts,
      shipsFuelUse.multiplier,
    );

    expect(contractResults.at(0)).toMatchObject({
      fuelPerTrip: 274,
      fuelPerProductionCycle: 9.2475,
    });
    expect(flows.find((flow) => flow.resourceId === "hydrogen")).toBeUndefined();
  });

  it("uses Contracts Profitability Focus to reduce the required export", () => {
    const uraniumContract = activeContracts[0];
    const { contractResults } = applyContracts(
      [{
        resourceId: "uraniumOre",
        name: "Uranium Ore",
        consumed: 60,
        produced: 0,
        net: -60,
      }],
      uraniumContract ? [uraniumContract] : [],
      1,
      new Map(),
      1.2,
    );

    // The fixed 54-unit plan costs 30 Food Packs at +20%, instead of 36.
    expect(contractResults[0]?.exported).toBeCloseTo(30);
  });
});
