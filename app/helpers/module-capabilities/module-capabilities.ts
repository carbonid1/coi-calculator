import {
  type ModuleCapability,
} from "../../db/modules/modules";

interface CapabilityEntity {
  prototypeId: string;
  forestry?: unknown;
  nuclearReactor?: unknown;
}

const populationPrototypeIds = new Set([
  "HousingT2",
  "HousingT3",
  "SettlementBiomassModule",
  "SettlementComputingModule",
  "SettlementFoodModule",
  "SettlementFoodModuleT2",
  "SettlementHouseholdGoodsModule",
  "SettlementLandfillModule",
  "SettlementPowerModule",
  "SettlementRecyclablesModule",
  "SettlementWaterModule",
]);

const hasPrototype = (
  entities: readonly CapabilityEntity[],
  predicate: (prototypeId: string) => boolean,
) => entities.some(entity => predicate(entity.prototypeId));

/** Semantic module features derived exclusively from stable game data. */
export const inferModuleCapabilities = (
  entities: readonly CapabilityEntity[],
  { isDefault = false }: { isDefault?: boolean } = {},
): ModuleCapability[] => {
  const capabilities: ModuleCapability[] = [];

  if (isDefault) capabilities.push("default");
  if (hasPrototype(entities, id => id === "ChickenFarm")) {
    capabilities.push("chicken-farming");
  }
  if (hasPrototype(entities, id => id === "DataCenter" || id === "WaterChiller")) {
    capabilities.push("computing");
  }
  if (hasPrototype(entities, id => id === "FarmT3" || id === "FarmT4")) {
    capabilities.push("crop-farming");
  }
  if (entities.some(entity => entity.forestry != null || entity.prototypeId === "ForestryTower")) {
    capabilities.push("forestry");
  }
  if (entities.some(entity => (
    entity.nuclearReactor != null || entity.prototypeId === "FastBreederReactor"
  ))) {
    capabilities.push("nuclear");
  }
  if (hasPrototype(entities, id => id.startsWith("OfficeBuilding"))) {
    capabilities.push("offices");
  }
  if (hasPrototype(entities, id => populationPrototypeIds.has(id))) {
    capabilities.push("population");
  }
  if (hasPrototype(entities, id => (
    id === "RocketAssemblyDepot" || id === "RocketLaunchPad"
  ))) {
    capabilities.push("space-station");
  }

  return capabilities;
};
