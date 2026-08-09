export const edictLevelOrder = [0, 1, 2, 3, 4, 5] as const;

export type EdictLevel = typeof edictLevelOrder[number];

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

export const defaultActiveEdicts = {
  recyclingIncrease: 3,
} as const satisfies Record<RecyclingIncreaseEdict["id"], EdictLevel>;
