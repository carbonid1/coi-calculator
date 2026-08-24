import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { getReserveDrawPerProductionCycle } from "../../helpers/reserves/reserves";
import {
  type ActiveContract,
  contracts,
} from "../contracts";
import { reserveResourceCatalog } from "../reserve-resources";
import { type ResourceId } from "../resources";
import { type Module } from "./modules";
import { createReservesModule } from "./reserves";

const reserveRecipeId = (resourceId: "fuelGas" | "gold") => {
  const reserve = reserveResourceCatalog.find(
    (candidate) => candidate.resourceId === resourceId,
  );

  if (!reserve) throw new Error(`Missing reserve catalog entry for ${resourceId}`);

  return reserve.recipeId;
};

const createDemandModule = (
  fixedDemands: Partial<Record<ResourceId, number>>,
): Module => ({
  id: "reserve-test-demand",
  name: "Reserve test demand",
  description: "",
  builtBuildings: {},
  presets: [{
    id: "demand",
    name: "Demand",
    description: "",
    activeBuildings: {},
    fixed: [],
    fixedDemands,
  }],
  defaultPresetId: "demand",
});

const activateContract = (
  id: string,
  importedPerProductionCycle: number,
): ActiveContract => {
  const contract = contracts.find((candidate) => candidate.id === id);

  if (!contract) throw new Error(`Missing test contract ${id}`);

  return {
    ...contract,
    plan: {
      importedPerProductionCycle,
      infrastructure: {
        cargoDepotSize: 2,
        cargoShipWorkers: 0,
        cargoModules: [
          {
            buildingName: "Unit Module (L)",
            count: 1,
            direction: "export",
            resourceId: contract.exchange.exported.resourceId,
            workersPerModule: 0,
          },
          {
            buildingName: "Unit Module (L)",
            count: 1,
            direction: "import",
            resourceId: contract.exchange.imported.resourceId,
            workersPerModule: 0,
          },
        ],
      },
      shipping: {
        fuelResourceId: "hydrogen",
        saveFuel: true,
        roundTripDurationProductionCycles: null,
      },
    },
  };
};

const getGoldReserveDraw = (
  modules: Module[],
  activeContracts: ActiveContract[],
) => {
  const result = calculateFactoryTotal(modules, activeContracts);

  return getReserveDrawPerProductionCycle(
    result.calculation.sourceResults,
    reserveRecipeId("gold"),
    "gold",
  );
};

it("lets an active Gold import displace reserve draw", () => {
  expect(getGoldReserveDraw(
    [createDemandModule({ gold: 10 }), createReservesModule({ gold: 6_000, fuelGas: 0 })],
    [activateContract("gold-for-diesel", 8)],
  )).toBeCloseTo(2);
});

it("counts Gold exported to an active contract as reserve draw", () => {
  expect(getGoldReserveDraw(
    [createDemandModule({}), createReservesModule({ gold: 6_000, fuelGas: 0 })],
    [activateContract("bauxite-for-gold", 130)],
  )).toBeCloseTo(10);
});

it("runs two fixed Cracking Units and draws their uncovered Fuel Gas from reserves", () => {
  const crackingModule: Module = {
    id: "fixed-cracking",
    name: "Fixed cracking",
    description: "",
    builtBuildings: { "cracking-unit-fuel-gas-diesel": 2 },
    presets: [{
      id: "fixed",
      name: "Fixed",
      description: "",
      activeBuildings: { "cracking-unit-fuel-gas-diesel": 2 },
      fixed: ["cracking-unit-fuel-gas-diesel"],
    }],
    defaultPresetId: "fixed",
  };
  const result = calculateFactoryTotal([
    crackingModule,
    createReservesModule({ gold: 0, fuelGas: 12_000 }),
  ]);
  const reserveDraw = getReserveDrawPerProductionCycle(
    result.calculation.sourceResults,
    reserveRecipeId("fuelGas"),
    "fuelGas",
  );
  const diesel = result.calculation.allResourceFlows.find(
    (flow) => flow.resourceId === "diesel",
  );

  expect(reserveDraw).toBe(72);
  expect(diesel?.net).toBe(48);
});
