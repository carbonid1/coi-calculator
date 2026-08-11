export type InfiniteResearchId = "maintenanceOutput" | "solarPower" | "cropYield";

export interface InfiniteResearchDefinition {
  id: InfiniteResearchId;
  name: string;
  percentPerLevel: number;
  waterDemandPercentPerLevel?: number;
  maxLevel: number;
  gameVersion: string;
}

export const maintenanceOutputResearch = {
  id: "maintenanceOutput",
  name: "Maintenance Output",
  percentPerLevel: 1,
  maxLevel: 50,
  gameVersion: "0.8.6",
} as const satisfies InfiniteResearchDefinition;

export const solarPowerResearch = {
  id: "solarPower",
  name: "Solar Power",
  percentPerLevel: 2,
  maxLevel: 200,
  gameVersion: "0.8.6",
} as const satisfies InfiniteResearchDefinition;

export const cropYieldResearch = {
  id: "cropYield",
  name: "Crop Yield",
  percentPerLevel: 1,
  waterDemandPercentPerLevel: 0.25,
  maxLevel: 250,
  gameVersion: "0.8.6",
} as const satisfies InfiniteResearchDefinition;

export const defaultInfiniteResearchLevels = {
  maintenanceOutput: 3,
  solarPower: 7,
  cropYield: 11,
} as const satisfies Record<InfiniteResearchId, number>;
