import { type ResourceId, resources } from "./resources";

interface ContractResource {
  resourceId: ResourceId;
  quantity: number;
}

export type ContractLocationId =
  | "settlement-2"
  | "settlement-3"
  | "settlement-4"
  | "fuel-settlement"
  | "uranium-settlement"
  | "settlement-5"
  | "ship-settlement";

export interface Contract {
  id: string;
  name: string;
  locationId: ContractLocationId;
  exchange: {
    exported: ContractResource;
    imported: ContractResource;
  };
  unity: {
    perProductionCycle: number;
    per100Imported: number;
    establish: number;
  };
  minimumReputation: number;
  gameVersion: string;
}

export interface ContractCargoModulePlan {
  buildingName: "Loose Module (L)" | "Unit Module (L)";
  count: number;
  direction: "export" | "import";
  resourceId: ResourceId;
  workersPerModule: number;
}

export interface ActiveContractPlan {
  /** Fixed shipment allocation, or null to balance imports against live demand. */
  importedPerProductionCycle: number | null;
  infrastructure: {
    cargoDepotSize: 2 | 4 | 6 | 8;
    cargoModules: readonly ContractCargoModulePlan[];
    cargoShipWorkers: number;
  };
  /** Fuel selection and ship mode; rates are derived from installed game data. */
  shipping: {
    fuelResourceId: ResourceId;
    saveFuel: boolean;
    /** Observed full round trip for this route and fuel mode. Null until measured in-game. */
    roundTripDurationProductionCycles: number | null;
  };
}

export interface ActiveContract extends Contract {
  plan: ActiveContractPlan;
}

export const contractsGameVersion = "0.8.7";

/**
 * Installed v0.8.7 cargo-ship constants. Large onboard cargo modules carry
 * 800 units each; the shore-side Cargo Depot Module (L) capacity is 1,600 and
 * must not be confused with one shipload.
 */
export const cargoShipping = {
  fuelPerJourneyBase: 90,
  fuelPerJourneyPerModule: 60,
  onboardLargeModuleCapacity: 800,
  hydrogenDieselEnergyRatio: 1.25,
  saveFuelMultiplier: 0.7,
  capacityMultiplierByShipSize: {
    2: 1,
    4: 1,
    6: 1.5,
    8: 1.5,
  },
} as const;

const toSlug = (resourceId: ResourceId) => resourceId
  .replaceAll(/([a-z\d])([A-Z])/g, "$1-$2")
  .toLowerCase();

const defineContract = (
  locationId: ContractLocationId,
  exportedResourceId: ResourceId,
  exportedQuantity: number,
  importedResourceId: ResourceId,
  importedQuantity: number,
  per100Imported: number,
  perProductionCycle: number,
  minimumReputation: number,
): Contract => ({
  id: `${toSlug(importedResourceId)}-for-${toSlug(exportedResourceId)}`,
  name: `${resources[exportedResourceId].name} → ${resources[importedResourceId].name}`,
  locationId,
  exchange: {
    exported: { resourceId: exportedResourceId, quantity: exportedQuantity },
    imported: { resourceId: importedResourceId, quantity: importedQuantity },
  },
  unity: {
    perProductionCycle,
    per100Imported,
    establish: perProductionCycle * 60,
  },
  minimumReputation,
  gameVersion: contractsGameVersion,
});

/**
 * All contracts registered by WorldMapEntitiesData in the installed v0.8.7 game build.
 * Unity arguments match the game's `createContract`: per 100 imported, then per month.
 */
export const contracts: Contract[] = [
  defineContract("settlement-2", "cement", 10, "coal", 55, 0.11, 0.2, 2),
  defineContract("settlement-2", "householdGoods", 20, "coal", 80, 0.1, 0.2, 2),
  defineContract("settlement-2", "rubber", 10, "wood", 5, 0.11, 0.2, 2),
  defineContract("settlement-2", "householdAppliances", 10, "wood", 90, 0.11, 0.2, 3),
  defineContract("settlement-2", "labEquipmentII", 15, "copperOre", 40, 0.13, 0.2, 2),
  defineContract("settlement-2", "vehiclePartsII", 10, "importedGoods", 75, 0.08, 0.1, 2),
  defineContract("settlement-2", "diamond", 10, "importedGoods", 110, 0.08, 0.1, 2),
  defineContract("settlement-2", "fertilizerII", 30, "wheat", 10, 0.1, 0.3, 2),
  defineContract("settlement-2", "fertilizerII", 20, "sugarCane", 10, 0.1, 0.3, 2),
  defineContract("settlement-2", "wood", 1, "corn", 3, 0.1, 0.3, 2),
  defineContract("settlement-2", "snack", 25, "corn", 45, 0.1, 0.3, 2),
  defineContract("settlement-2", "sausage", 25, "wheat", 40, 0.1, 0.2, 2),
  defineContract("settlement-2", "meat", 1, "vegetables", 4, 0.1, 0.2, 2),
  defineContract("settlement-2", "consumerElectronics", 1, "chickenCarcass", 5, 0.1, 0.2, 3),

  defineContract("settlement-3", "constructionPartsII", 10, "limestone", 100, 0.12, 0.2, 2),
  defineContract("settlement-3", "vehiclePartsII", 5, "ironOre", 70, 0.11, 0.3, 2),
  defineContract("settlement-3", "householdAppliances", 10, "copperOre", 65, 0.13, 0.3, 2),
  defineContract("settlement-3", "slag", 60, "waste", 40, 0.2, 0.3, 2),
  defineContract("settlement-3", "slag", 50, "sourWater", 20, 0.2, 0.4, 3),
  defineContract("settlement-3", "slag", 50, "sludge", 20, 0.2, 0.4, 3),

  defineContract("settlement-4", "diesel", 100, "gold", 8, 0.15, 0.4, 3),
  defineContract("settlement-4", "coal", 10, "quartz", 20, 0.12, 0.3, 2),
  defineContract("settlement-4", "vehiclePartsII", 10, "quartz", 130, 0.12, 0.3, 2),
  defineContract("settlement-4", "gold", 10, "bauxite", 130, 0.1, 0.2, 2),
  defineContract("settlement-4", "householdAppliances", 10, "bauxite", 75, 0.1, 0.3, 2),
  defineContract("settlement-4", "constructionPartsIV", 10, "bauxite", 850, 0.1, 0.4, 2),
  defineContract("settlement-4", "compositeCore", 10, "bauxite", 550, 0.1, 0.4, 2),
  defineContract("settlement-4", "compositeCore", 5, "limestone", 230, 0.1, 0.3, 2),
  defineContract("settlement-4", "sulfur", 10, "sludge", 30, 0.1, 0.1, 2),
  defineContract("settlement-4", "sulfur", 10, "coal", 10, 0.1, 0.2, 2),
  defineContract("settlement-4", "manufacturedSand", 2, "dirt", 1, 0.1, 0.1, 2),

  defineContract("fuel-settlement", "foodPack", 40, "crudeOil", 220, 0.1, 0.2, 1),
  defineContract("fuel-settlement", "foodPack", 40, "ammonia", 240, 0.1, 0.2, 1),
  defineContract("fuel-settlement", "vehiclePartsII", 10, "crudeOil", 280, 0.1, 0.2, 2),
  defineContract("fuel-settlement", "gold", 10, "crudeOil", 190, 0.15, 0.3, 3),
  defineContract("fuel-settlement", "consumerElectronics", 10, "crudeOil", 370, 0.15, 0.3, 3),
  defineContract("fuel-settlement", "compositeCore", 10, "fuelGas", 1500, 0.08, 0.3, 3),
  defineContract("fuel-settlement", "dirt", 10, "fuelGas", 20, 0.1, 0.2, 2),
  defineContract("fuel-settlement", "rock", 80, "fuelGas", 20, 0.1, 0.2, 2),

  defineContract("uranium-settlement", "foodPack", 40, "uraniumOre", 60, 0.1, 0.3, 1),
  defineContract("uranium-settlement", "gold", 10, "uraniumOre", 35, 0.12, 0.4, 2),
  defineContract("uranium-settlement", "ironOre", 1, "uraniumOre", 1, 0.12, 0.4, 2),
  defineContract("uranium-settlement", "labEquipmentIv", 10, "uraniumOre", 50, 0.12, 0.4, 3),

  defineContract("settlement-5", "server", 5, "ironOre", 460, 0.12, 0.3, 1),
  defineContract("settlement-5", "medicalSuppliesIII", 10, "copperOre", 65, 0.12, 0.2, 2),
  defineContract("settlement-5", "labEquipmentIII", 10, "coal", 80, 0.12, 0.2, 2),
  defineContract("settlement-5", "vehiclePartsIII", 5, "coal", 270, 0.12, 0.2, 2),
  defineContract("settlement-5", "solarCell", 10, "quartz", 75, 0.12, 0.3, 2),
  defineContract("settlement-5", "consumerElectronics", 10, "quartz", 250, 0.12, 0.3, 3),
  defineContract("settlement-5", "server", 5, "goldOre", 450, 0.12, 0.3, 3),
  defineContract("settlement-5", "server", 5, "titaniumOre", 450, 0.15, 0.4, 3),
  defineContract("settlement-5", "constructionPartsIV", 5, "titaniumOre", 380, 0.15, 0.4, 2),

  defineContract("ship-settlement", "ironOre", 1, "limestone", 1, 0.08, 0.3, 1),
  defineContract("ship-settlement", "ironOre", 1, "bauxite", 1, 0.08, 0.3, 1),
  defineContract("ship-settlement", "ironOre", 1, "copperOre", 1, 0.08, 0.3, 1),
  defineContract("ship-settlement", "copperOre", 1, "ironOre", 1, 0.08, 0.3, 1),
];

const defineActiveContract = (
  contractId: string,
  plan: ActiveContractPlan,
): ActiveContract => {
  const contract = contracts.find((candidate) => candidate.id === contractId);

  if (!contract) throw new Error(`Unknown active contract: ${contractId}`);

  return { ...contract, plan };
};

/**
 * Physical contract plans. Each allocation can remain fixed or follow the
 * factory's live demand while its ship and cargo-module layout stays locked.
 */
export const activeContracts: ActiveContract[] = [
  defineActiveContract("uranium-ore-for-food-pack", {
    importedPerProductionCycle: 54,
    infrastructure: {
      cargoDepotSize: 4,
      cargoShipWorkers: 22,
      cargoModules: [
        {
          buildingName: "Unit Module (L)",
          count: 2,
          direction: "export",
          resourceId: "foodPack",
          workersPerModule: 5,
        },
        {
          buildingName: "Loose Module (L)",
          count: 2,
          direction: "import",
          resourceId: "uraniumOre",
          workersPerModule: 5,
        },
      ],
    },
    shipping: {
      fuelResourceId: "hydrogen",
      saveFuel: true,
      roundTripDurationProductionCycles: 427 / 60,
    },
  }),
  defineActiveContract("iron-ore-for-vehicle-parts-ii", {
    importedPerProductionCycle: null,
    infrastructure: {
      cargoDepotSize: 4,
      cargoShipWorkers: 22,
      cargoModules: [
        {
          buildingName: "Unit Module (L)",
          count: 2,
          direction: "export",
          resourceId: "vehiclePartsII",
          workersPerModule: 5,
        },
        {
          buildingName: "Loose Module (L)",
          count: 2,
          direction: "import",
          resourceId: "ironOre",
          workersPerModule: 5,
        },
      ],
    },
    shipping: {
      fuelResourceId: "hydrogen",
      saveFuel: true,
      roundTripDurationProductionCycles: 426 / 60,
    },
  }),
];

export const defaultActiveContractIds = activeContracts.map((contract) => contract.id);
