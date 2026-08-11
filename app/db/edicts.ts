export const edictLevelOrder = [0, 1, 2, 3, 4, 5] as const;
export const cleanPanelsLevelOrder = [0, 1, 2, 3] as const;
export const farmingBoostLevelOrder = [0, 1, 2, 3] as const;

export type EdictLevel = typeof edictLevelOrder[number];
export type CleanPanelsLevel = typeof cleanPanelsLevelOrder[number];
export type FarmingBoostLevel = typeof farmingBoostLevelOrder[number];

export interface EdictLevelDefinition {
  level: EdictLevel;
  label: string;
  efficiencyIncreasePercent: number;
  unityCostPerCycle: number;
}

export interface RecyclingIncreaseEdict {
  id: "recyclingIncrease";
  name: string;
  levels: Record<EdictLevel, EdictLevelDefinition>;
}

export const recyclingIncreaseEdict = {
  id: "recyclingIncrease",
  name: "Recycling Increase",
  levels: {
    0: { level: 0, label: "0", efficiencyIncreasePercent: 0, unityCostPerCycle: 0 },
    1: { level: 1, label: "I", efficiencyIncreasePercent: 12, unityCostPerCycle: 1 },
    2: { level: 2, label: "II", efficiencyIncreasePercent: 22, unityCostPerCycle: 2 },
    3: { level: 3, label: "III", efficiencyIncreasePercent: 30, unityCostPerCycle: 3.5 },
    4: { level: 4, label: "IV", efficiencyIncreasePercent: 35, unityCostPerCycle: 5 },
    5: { level: 5, label: "V", efficiencyIncreasePercent: 40, unityCostPerCycle: 7 },
  },
} as const satisfies RecyclingIncreaseEdict;

interface CleanPanelsLevelDefinition {
  level: CleanPanelsLevel;
  label: string;
  powerIncreasePercent: number;
  unityCostPerCycle: number;
}

interface CleanPanelsEdict {
  id: "cleanPanels";
  name: string;
  levels: Record<CleanPanelsLevel, CleanPanelsLevelDefinition>;
}

export const cleanPanelsEdict = {
  id: "cleanPanels",
  name: "Clean Panels",
  levels: {
    0: { level: 0, label: "0", powerIncreasePercent: 0, unityCostPerCycle: 0 },
    1: { level: 1, label: "I", powerIncreasePercent: 5, unityCostPerCycle: 0.5 },
    2: { level: 2, label: "II", powerIncreasePercent: 15, unityCostPerCycle: 1.5 },
    3: { level: 3, label: "III", powerIncreasePercent: 30, unityCostPerCycle: 2.5 },
  },
} as const satisfies CleanPanelsEdict;

interface FarmingBoostLevelDefinition {
  level: FarmingBoostLevel;
  label: string;
  yieldIncreasePercent: number;
  waterDemandIncreasePercent: number;
  unityCostPerCycle: number;
}

interface FarmingBoostEdict {
  id: "farmingBoost";
  name: string;
  levels: Record<FarmingBoostLevel, FarmingBoostLevelDefinition>;
}

export const farmingBoostEdict = {
  id: "farmingBoost",
  name: "Farming Boost",
  // Edict tiers stack. Values here are the effective cumulative totals.
  levels: {
    0: { level: 0, label: "0", yieldIncreasePercent: 0, waterDemandIncreasePercent: 0, unityCostPerCycle: 0 },
    1: { level: 1, label: "I", yieldIncreasePercent: 15, waterDemandIncreasePercent: 15, unityCostPerCycle: 1 },
    2: { level: 2, label: "II", yieldIncreasePercent: 27, waterDemandIncreasePercent: 27, unityCostPerCycle: 2 },
    3: { level: 3, label: "III", yieldIncreasePercent: 35, waterDemandIncreasePercent: 35, unityCostPerCycle: 3 },
  },
} as const satisfies FarmingBoostEdict;

export const defaultActiveEdicts = {
  recyclingIncrease: 3,
  cleanPanels: 0,
  farmingBoost: 1,
} as const satisfies {
  recyclingIncrease: EdictLevel;
  cleanPanels: CleanPanelsLevel;
  farmingBoost: FarmingBoostLevel;
};
