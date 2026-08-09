export interface InfiniteResearchDefinition {
  id: "maintenanceOutput";
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

export const defaultInfiniteResearchLevels = {
  maintenanceOutput: 3,
} as const satisfies Record<InfiniteResearchDefinition["id"], number>;
