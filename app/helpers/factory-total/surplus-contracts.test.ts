import { describe, expect, it } from "vitest";

import { type ActiveContract, contracts } from "../../db/contracts";
import { type Module } from "../../db/modules/modules";
import { activeContracts } from "../../test-fixtures/active-contracts";
import { calculateFactoryTotal } from "./factory-total";

const uranium: ActiveContract = {
  ...activeContracts[0],
  exportSurplus: true,
  routes: activeContracts[0].routes.map(route => ({ ...route, importedPerProductionCycle: null })),
};
const options = { recyclingEfficiencyPercent: 90, contracts: [uranium] };

describe("surplus contract exports", () => {
  it.each([0, 30])("exports available packs above %s Uranium demand and accounts for shipping", uraniumOre => {
    const result = calculateFactoryTotal([], {
      ...options,
      externalSupplies: { foodPack: 50, hydrogen: 100 },
      externalDemands: { uraniumOre, foodPack: 2 },
      contractsProfitMultiplier: 1.13,
    });
    const contract = result.contractResults[0];

    expect(contract.exported).toBeCloseTo(48);
    expect(contract.imported).toBeCloseTo(48 * Math.round(60 * 1.13) / 40);
    expect(contract.requiredImported).toBeCloseTo(uraniumOre);
    expect(result.flows.find(flow => flow.resourceId === "uraniumOre")?.net)
      .toBeCloseTo(contract.imported - uraniumOre);
    expect(result.flows.find(flow => flow.resourceId === "foodPack")?.net).toBeCloseTo(0);
    expect(result.flows.find(flow => flow.resourceId === "hydrogen")?.consumed)
      .toBeCloseTo(contract.fuelPerProductionCycle);
    expect(contract.fuelPerProductionCycle).toBeGreaterThan(0);
    expect(result.contractFlows.find(flow => flow.kind === "import")?.quantity).toBeCloseTo(contract.imported);
  });

  it("reserves other contracts' required Food Packs before exporting the remainder", () => {
    const ammonia = activeContracts.find(contract => contract.id === "ammonia-for-food-pack")!;
    const run = (contracts: ActiveContract[]) => calculateFactoryTotal([], {
      ...options, contracts,
      externalSupplies: { foodPack: 50, hydrogen: 100 },
      externalDemands: { uraniumOre: 30, ammonia: 20 },
    });
    const first = run([uranium, ammonia]);
    const reversed = run([ammonia, uranium]);
    const ammoniaPayment = 20 * ammonia.exchange.exported.quantity / ammonia.exchange.imported.quantity;

    for (const result of [first, reversed]) {
      expect(result.contractResults.find(result => result.contract.id === uranium.id)?.exported)
        .toBeCloseTo(50 - ammoniaPayment);
      expect(result.flows.find(flow => flow.resourceId === "foodPack")?.net).toBeCloseTo(0);
      expect(result.flows.find(flow => flow.resourceId === "ammonia")?.net).toBeCloseTo(0);
    }
  });

  it.each([0, 10, 30])("recalculates surplus shipments when available packs fall to %s", foodPack => {
    const original = calculateFactoryTotal([], { ...options, externalSupplies: { foodPack: 50 } });
    const nextOptions = { ...options, externalSupplies: { foodPack } };
    const fresh = calculateFactoryTotal([], nextOptions);
    const reused = calculateFactoryTotal([], { ...nextOptions, initialContractResults: original.contractResults });

    expect(reused.contractResults[0].exported).toBeCloseTo(foodPack);
    expect(reused.flows).toEqual(fresh.flows);
    expect(reused.contractFlows).toEqual(fresh.contractFlows);
  });

  it("respects shipping capacity and leaves unshipped packs in surplus", () => {
    const result = calculateFactoryTotal([], { ...options, externalSupplies: { foodPack: 1000 } });
    const contract = result.contractResults[0];

    expect(contract.imported).toBeCloseTo(contract.maxImportedPerProductionCycle!);
    expect(result.flows.find(flow => flow.resourceId === "foodPack")?.net).toBeCloseTo(1000 - contract.exported);
    expect(result.contractFlows.find(flow => flow.kind === "import")?.importLimit).toBe("capacity");
  });

  it("keeps a fixed route allocation and leaves disabled routes idle", () => {
    const run = (contract: ActiveContract) => calculateFactoryTotal([], {
      ...options, contracts: [contract], externalSupplies: { foodPack: 50 },
    }).contractResults[0];

    expect(run({ ...activeContracts[0], exportSurplus: true }).imported).toBe(54);
    expect(run({ ...uranium, routes: uranium.routes.map(route => ({ ...route, enabled: false })) }).imported).toBe(0);
    expect(run({ ...uranium, exportSurplus: false }).imported).toBe(0);
  });

  it("does not double-spend surplus across two opted-in contracts", () => {
    const ammonia = { ...activeContracts.find(contract => contract.id === "ammonia-for-food-pack")!, exportSurplus: true };
    const result = calculateFactoryTotal([], {
      ...options, contracts: [uranium, ammonia], externalSupplies: { foodPack: 50 },
    });

    expect(result.contractResults.reduce((total, result) => total + result.exported, 0)).toBeCloseTo(50);
    expect(result.flows.find(flow => flow.resourceId === "foodPack")?.net).toBeCloseTo(0);
  });

  it.each([0, 30])("exports only feasible packs when carcass imports stop and %s Uranium is required", uraniumOre => {
    const carcass: ActiveContract = {
      ...contracts.find(contract => contract.id === "chicken-carcass-for-consumer-electronics")!,
      gameId: "test-carcass",
      routes: uranium.routes.map(route => ({
        ...route, id: "test-carcass", enabled: false,
        cargoModules: route.cargoModules.map(module => ({
          ...module, resourceId: module.direction === "export" ? "consumerElectronics" : "chickenCarcass",
        })),
      })),
    };
    const builtBuildings = { "food-processor-meat": 2, "assembly-v-food-pack-meat": 2 };
    const food: Module = {
      id: "food", name: "Food", description: "", builtBuildings,
      presets: [{ id: "food", name: "Food", description: "", activeBuildings: builtBuildings, fixed: [] }],
      defaultPresetId: "food",
    };
    const run = (enabled: boolean, initialContractResults?: ReturnType<typeof calculateFactoryTotal>["contractResults"], limited = false) => (
      calculateFactoryTotal([food], {
        ...options, initialContractResults,
        contracts: [uranium, { ...carcass, routes: carcass.routes.map(route => ({
          ...route, enabled,
          shipping: { ...route.shipping, ...(limited ? { roundTripDurationProductionCycles: 100 } : {}) },
        })) }],
        externalSupplies: { bread: 100, water: 100, salt: 100, hydrogen: 100, consumerElectronics: 100 },
        externalDemands: { uraniumOre },
      })
    );
    const supplied = run(true);

    expect(supplied.contractResults[0].imported).toBeCloseTo(60);
    for (const result of [run(false), run(false, supplied.contractResults)]) {
      expect(result.flows.find(flow => flow.resourceId === "foodPack")?.produced).toBe(0);
      // Required imports still expose their payment deficit; only invented
      // surplus shipments are removed when their inputs cannot arrive.
      expect(result.contractResults[0].imported).toBeCloseTo(uraniumOre);
      expect(result.flows.find(flow => flow.resourceId === "uraniumOre")?.net).toBeCloseTo(0);
    }
    const limited = run(true, supplied.contractResults, true);
    const packs = limited.flows.find(flow => flow.resourceId === "foodPack")?.produced ?? 0;

    expect(packs).toBeGreaterThan(0);
    expect(packs).toBeLessThan(40);
    expect(limited.contractResults[0].imported).toBeCloseTo(Math.max(uraniumOre, packs * 1.5));
    expect(run(true, limited.contractResults).contractResults[0].imported).toBeCloseTo(60);
  });
});

it("sends feasible food overproduction into Uranium surplus before digesting Trimmings", () => {
  const builtBuildings = {
    "food-processor-meat": 2,
    "food-processor-meat-trimmings": 1,
    "food-processor-sausage": 1,
    "assembly-v-food-pack-eggs": 2,
    "assembly-v-food-pack-meat": 2,
    "baking-unit-bread": 4,
    "mill-wheat": 6,
    "anaerobic-digester-meat-trimmings": 4,
    "anaerobic-digester-wheat": 4,
  };
  const foodModule: Module = {
    id: "food", name: "Food", description: "", builtBuildings,
    presets: [{ id: "food", name: "Food", description: "", activeBuildings: builtBuildings, fixed: [] }],
    defaultPresetId: "food",
  };
  const result = calculateFactoryTotal([foodModule], {
    ...options,
    externalSupplies: { chickenCarcass: 60, eggs: 24, wheat: 100, water: 1000, salt: 1000, hydrogen: 100 },
    externalDemands: { meat: 12, sausage: 15, uraniumOre: 30 },
  });
  const expectedPacks = 32 + ((54 - 15) / 0.7 / 2 - 12) * 32 / 24;

  expect(result.contractResults[0].exported).toBeCloseTo(expectedPacks);
  expect(result.flows.find(flow => flow.resourceId === "uraniumOre")?.net).toBeCloseTo(expectedPacks * 1.5 - 30);
  expect(result.flows.filter(flow => flow.net < -0.001)).toEqual([]);
  expect(result.calculation.regularResults.find(line => line.recipe.id === "anaerobic-digester-meat-trimmings")?.actualInputs[0].quantity).toBeCloseTo(0);
  expect(result.calculation.regularResults.find(line => line.recipe.id === "assembly-v-food-pack-meat")?.actualOutputs[0].quantity).toBeGreaterThan(20);
});
