import { describe, expect, it } from "vitest";

import { activeContracts } from "../../test-fixtures/active-contracts";
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
      fuelPerProductionCycle: 9.75375,
    });
    expect(contractResults.at(0)?.maxImportedPerProductionCycle).toBeCloseTo(
      1_600 / (427 / 60),
    );
    expect(uranium).toMatchObject({ consumed: 72, produced: 54, net: -18 });
    expect(foodPack).toMatchObject({ consumed: 36, produced: 0, net: -36 });
    expect(flows.find((flow) => flow.resourceId === "hydrogen")).toBeUndefined();
  });

  it("balances the four-module Titanium Ore ship against current demand", () => {
    const { contractResults } = applyContracts([{
      resourceId: "titaniumOre",
      name: "Titanium Ore",
      consumed: 190,
      produced: 0,
      net: -190,
    }], activeContracts);
    const titanium = contractResults.find(
      (result) => result.contract.id === "titanium-ore-for-construction-parts-iv",
    );

    expect(titanium).toMatchObject({
      exported: 2.5,
      imported: 190,
      requiredImported: 190,
    });
    expect(titanium?.maxImportedPerProductionCycle).toBeCloseTo(
      1_600 / (426 / 60),
    );
    expect(titanium?.fuelPerProductionCycle).toBeCloseTo(34.31875);
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
          routes: uraniumContract.routes.map(route => ({
            ...route,
            importedPerProductionCycle: 300,
          })),
        }]
      : []);
    const result = contractResults[0];

    expect(result?.requestedImported).toBe(300);
    expect(result?.maxImportedPerProductionCycle).toBeCloseTo(1_600 / (427 / 60));
    expect(result?.imported).toBeCloseTo(1_600 / (427 / 60));
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
    });
    expect(ammonia?.maxImportedPerProductionCycle).toBeCloseTo(
      1_600 / (427 / 60),
    );
    expect(ammonia?.fuelPerProductionCycle).toBeCloseTo(21.675);
  });

  it("covers the current Sand replacement target with the focused four-module Quartz plan", () => {
    const quartzContract = activeContracts.find(
      (contract) => contract.id === "quartz-for-coal",
    );
    const { contractResults } = applyContracts(
      [{
        resourceId: "quartz",
        name: "Quartz",
        consumed: 137.62,
        produced: 0,
        net: -137.62,
      }],
      quartzContract ? [quartzContract] : [],
      1,
      new Map(),
      1.14,
    );
    const quartz = contractResults[0];

    expect(quartz).toMatchObject({
      imported: 137.62,
      requiredImported: 137.62,
    });
    expect(quartz?.exported).toBeCloseTo(137.62 * 10 / 23);
    expect(quartz?.maxImportedPerProductionCycle).toBeCloseTo(
      1_840 / (426 / 60),
    );
    expect(quartz?.fuelPerProductionCycle).toBeCloseTo(137.62 / 1_840 * 289);
  });

  it("counts all planned ships and their cargo modules", () => {
    expect(calculateContractWorkers(activeContracts)).toBe(210);
  });

  it("applies Ship Fuel Use research before the ship's Save Fuel mode", () => {
    const shipsFuelUse = calculateShipsFuelUse(5);
    const { contractResults, flows } = applyContracts(
      [],
      activeContracts,
      shipsFuelUse.multiplier,
    );

    expect(contractResults.at(0)).toMatchObject({
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

  it("shares one established contract across multiple Cargo Depots", () => {
    const contract = activeContracts[1];

    expect(contract).toBeDefined();
    if (!contract) return;

    const firstRoute = { ...contract.routes[0], importedPerProductionCycle: null };
    const secondRoute = {
      ...firstRoute,
      id: `${firstRoute.id}-second`,
      depotEntityId: 200,
    };
    const { contractResults } = applyContracts([{
      resourceId: "titaniumOre",
      name: "Titanium Ore",
      consumed: 300,
      produced: 0,
      net: -300,
    }], [{ ...contract, routes: [firstRoute, secondRoute] }]);

    expect(contractResults).toHaveLength(1);
    expect(contractResults[0]).toMatchObject({ imported: 300, requiredImported: 300 });
    expect(contractResults[0]?.routes).toHaveLength(2);
    expect(calculateContractWorkers([{ ...contract, routes: [firstRoute, secondRoute] }]))
      .toBe(84);
  });

  it("keeps fixed Unity state when an established contract has no route", () => {
    const contract = activeContracts[0];

    expect(contract).toBeDefined();
    if (!contract) return;

    const { contractResults } = applyContracts([], [{ ...contract, routes: [] }]);

    expect(contractResults).toMatchObject([{
      imported: 0,
      exported: 0,
      maxImportedPerProductionCycle: 0,
      routes: [],
    }]);
    expect(calculateContractWorkers([{ ...contract, routes: [] }])).toBe(0);
  });

  it("removes a paused ship from capacity and ship workers", () => {
    const contract = activeContracts[0];

    expect(contract).toBeDefined();
    if (!contract) return;

    const routes = contract.routes.map(route => ({
      ...route,
      importedPerProductionCycle: null,
      ship: route.ship ? { ...route.ship, running: false } : null,
    }));
    const { contractResults } = applyContracts([{
      resourceId: "uraniumOre",
      name: "Uranium Ore",
      consumed: 60,
      produced: 0,
      net: -60,
    }], [{ ...contract, routes }]);

    expect(contractResults[0]).toMatchObject({
      imported: 0,
      maxImportedPerProductionCycle: 0,
    });
    expect(calculateContractWorkers([{ ...contract, routes }])).toBe(20);
  });

  it("counts workers in attached modules that are not configured yet", () => {
    const contract = activeContracts[0];

    expect(contract).toBeDefined();
    if (!contract) return;

    const route = contract.routes[0];

    expect(route).toBeDefined();
    if (!route) return;

    const cargoModules = route.cargoModules.map((module, index) => index === 0
      ? { ...module, direction: null, resourceId: null }
      : module);

    expect(calculateContractWorkers([{
      ...contract,
      routes: [{ ...route, cargoModules }],
    }])).toBe(42);
  });
});
