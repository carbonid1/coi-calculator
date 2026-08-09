export type InfiniteResearchId = "maintenanceOutput" | "solarPower";

export interface InfiniteResearchDefinition {
  id: InfiniteResearchId;
  name: string;
  percentPerLevel: number;
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

export const defaultInfiniteResearchLevels = {
  maintenanceOutput: 3,
  solarPower: 7,
} as const satisfies Record<InfiniteResearchId, number>;
