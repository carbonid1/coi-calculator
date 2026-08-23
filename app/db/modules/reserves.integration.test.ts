import { expect, it } from "vitest";

import { calculateFactoryTotal } from "../../helpers/factory-total/factory-total";
import { getReserveDrawPerProductionCycle } from "../../helpers/reserves/reserves";
import {
  type ActiveContract,
  contracts,
} from "../contracts";
import { type ResourceId } from "../resources";
import { type Module } from "./modules";
import {
  createReservesModule,
  GOLD_RESERVE_RECIPE_ID,
} from "./reserves";

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
    GOLD_RESERVE_RECIPE_ID,
    "gold",
  );
};

it("lets an active Gold import displace reserve draw", () => {
  expect(getGoldReserveDraw(
    [createDemandModule({ gold: 10 }), createReservesModule({ gold: 6_000 })],
    [activateContract("gold-for-diesel", 8)],
  )).toBeCloseTo(2);
});

it("counts Gold exported to an active contract as reserve draw", () => {
  expect(getGoldReserveDraw(
    [createDemandModule({}), createReservesModule({ gold: 6_000 })],
    [activateContract("bauxite-for-gold", 130)],
  )).toBeCloseTo(10);
});
