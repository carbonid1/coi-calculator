import {
  type LayeredValue,
  resolveCurrentLayeredValue,
  resolveLayeredValue,
} from "../helpers/resolve-layered-value/resolve-layered-value";

export interface HousingType {
  id: "housing" | "housing-ii" | "housing-iii" | "housing-iv";
  name: string;
  populationCapacity: number;
  unityStorage: number;
  serviceDemandMultipliers: {
    electricity: number;
    water: number;
    wasteWater: number;
    householdGoods: number;
    householdAppliances: number;
    luxuryGoods: number;
  };
  unityBonusTiers: readonly {
    multiplier: number;
    requirements: readonly string[];
  }[];
}

/** Captain of Industry v0.8.7 housing capacities, service demand, and Unity tiers. */
export const housingTypes = {
  housing: {
    id: "housing",
    name: "Housing",
    populationCapacity: 80,
    unityStorage: 8,
    serviceDemandMultipliers: { electricity: 1, water: 1, wasteWater: 1, householdGoods: 1, householdAppliances: 1, luxuryGoods: 1 },
    unityBonusTiers: [],
  },
  housingII: {
    id: "housing-ii",
    name: "Housing II",
    populationCapacity: 140,
    unityStorage: 12,
    serviceDemandMultipliers: { electricity: 1.1, water: 1.05, wasteWater: 1.05, householdGoods: 1, householdAppliances: 1, luxuryGoods: 1 },
    unityBonusTiers: [{ multiplier: 1.5, requirements: ["Water", "Electricity"] }],
  },
  housingIII: {
    id: "housing-iii",
    name: "Housing III",
    populationCapacity: 240,
    unityStorage: 18,
    serviceDemandMultipliers: { electricity: 1.2, water: 1.1, wasteWater: 1.1, householdGoods: 1.05, householdAppliances: 1, luxuryGoods: 1 },
    unityBonusTiers: [
      { multiplier: 1.5, requirements: ["Water", "Electricity"] },
      { multiplier: 1.75, requirements: ["Water", "Electricity", "Household Goods"] },
      { multiplier: 2, requirements: ["Water", "Electricity", "Household Goods", "Household Appliances"] },
    ],
  },
  housingIV: {
    id: "housing-iv",
    name: "Housing IV",
    populationCapacity: 400,
    unityStorage: 26,
    serviceDemandMultipliers: { electricity: 1.4, water: 1.2, wasteWater: 1.2, householdGoods: 1.1, householdAppliances: 1.1, luxuryGoods: 1.1 },
    unityBonusTiers: [
      { multiplier: 1.5, requirements: ["Water", "Electricity"] },
      { multiplier: 1.75, requirements: ["Water", "Electricity", "Household Goods"] },
      { multiplier: 2, requirements: ["Water", "Electricity", "Household Goods", "Household Appliances"] },
      { multiplier: 2.25, requirements: ["Water", "Electricity", "Household Goods", "Household Appliances", "Consumer Electronics"] },
    ],
  },
} as const satisfies Record<string, HousingType>;

export const activeHousingType = housingTypes.housingIII;
export const defaultHousingCount = 11;
export const plannedHousingCount: number | undefined = 15;

const housingCountLayers: LayeredValue<number> = {
  default: defaultHousingCount,
  planned: plannedHousingCount,
};

export const resolvedCurrentHousingCount = resolveCurrentLayeredValue(housingCountLayers);
export const resolvedHousingCount = resolveLayeredValue(housingCountLayers);

export const activeHousingServices = {
  householdGoods: true,
  householdAppliances: false,
  consumerElectronics: false,
} as const;

export const calculatePopulationCapacity = (
  housing: HousingType,
  buildingCount: number,
  capacityMultiplier = 1,
) => Math.round(housing.populationCapacity * capacityMultiplier)
  * Math.max(0, Math.trunc(buildingCount));
