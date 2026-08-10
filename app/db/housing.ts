export interface HousingType {
  id: "housing" | "housing-ii" | "housing-iii" | "housing-iv";
  name: string;
  populationCapacity: number;
}

/** Captain of Industry v0.8.6 SettlementsData housing capacities. */
export const housingTypes = {
  housing: {
    id: "housing",
    name: "Housing",
    populationCapacity: 80,
  },
  housingII: {
    id: "housing-ii",
    name: "Housing II",
    populationCapacity: 140,
  },
  housingIII: {
    id: "housing-iii",
    name: "Housing III",
    populationCapacity: 240,
  },
  housingIV: {
    id: "housing-iv",
    name: "Housing IV",
    populationCapacity: 400,
  },
} as const satisfies Record<string, HousingType>;

export const activeHousingType = housingTypes.housingII;
export const defaultHousingCount = 15;

export const calculatePopulationCapacity = (
  housing: HousingType,
  buildingCount: number,
) => housing.populationCapacity * Math.max(0, Math.trunc(buildingCount));
