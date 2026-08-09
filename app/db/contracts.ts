import { type ResourceId } from "./resources";

interface ContractResource {
  resourceId: ResourceId;
  quantity: number;
}

export interface Contract {
  id: string;
  name: string;
  exchange: {
    exported: ContractResource;
    imported: ContractResource;
  };
  shipment: {
    shipModules: 8;
    exported: number;
    imported: number;
  };
  unity: {
    perProductionCycle: number;
    perShip: number;
    establish: number;
  };
  minimumReputation: number;
  gameVersion: string;
}

export const contracts: Contract[] = [
  {
    id: "uranium-ore-for-food-pack",
    name: "Food Pack → Uranium Ore",
    exchange: {
      exported: { resourceId: "foodPack", quantity: 40 },
      imported: { resourceId: "uraniumOre", quantity: 60 },
    },
    shipment: { shipModules: 8, exported: 3600, imported: 5400 },
    unity: { perProductionCycle: 0.3, perShip: 5.4, establish: 18 },
    minimumReputation: 1,
    gameVersion: "0.8.0",
  },
  {
    id: "uranium-ore-for-gold",
    name: "Gold → Uranium Ore",
    exchange: {
      exported: { resourceId: "gold", quantity: 10 },
      imported: { resourceId: "uraniumOre", quantity: 35 },
    },
    shipment: { shipModules: 8, exported: 2057, imported: 7200 },
    unity: { perProductionCycle: 0.4, perShip: 8.6, establish: 24 },
    minimumReputation: 2,
    gameVersion: "0.8.0",
  },
  {
    id: "uranium-ore-for-iron-ore",
    name: "Iron Ore → Uranium Ore",
    exchange: {
      exported: { resourceId: "ironOre", quantity: 1 },
      imported: { resourceId: "uraniumOre", quantity: 1 },
    },
    shipment: { shipModules: 8, exported: 4800, imported: 4800 },
    unity: { perProductionCycle: 0.4, perShip: 5.8, establish: 24 },
    minimumReputation: 2,
    gameVersion: "0.8.0",
  },
  {
    id: "uranium-ore-for-lab-equipment-iv",
    name: "Lab Equipment IV → Uranium Ore",
    exchange: {
      exported: { resourceId: "labEquipmentIv", quantity: 10 },
      imported: { resourceId: "uraniumOre", quantity: 50 },
    },
    shipment: { shipModules: 8, exported: 1440, imported: 7200 },
    unity: { perProductionCycle: 0.4, perShip: 8.6, establish: 24 },
    minimumReputation: 3,
    gameVersion: "0.8.0",
  },
];

const activeContractIds = new Set(["uranium-ore-for-food-pack"]);

export const activeContracts = contracts.filter((contract) => activeContractIds.has(contract.id));
