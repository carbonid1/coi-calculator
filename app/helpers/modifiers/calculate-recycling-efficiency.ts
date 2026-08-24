import { baseConfig } from "../../db/config";
import { recyclingIncreaseEdict, type EdictLevel } from "../../db/edicts";

export interface CalculatedBonus {
  source: "edict" | "focus";
  sourceId: string;
  name: string;
  percent: number;
}

export interface RecyclingEfficiencyResult {
  basePercent: number;
  bonuses: CalculatedBonus[];
  effectivePercent: number;
}

export const calculateRecyclingEfficiency = (
  level: EdictLevel,
  focusBonusPercent = 0,
): RecyclingEfficiencyResult => {
  const activeLevel = recyclingIncreaseEdict.levels[level];
  const bonuses: CalculatedBonus[] = activeLevel.efficiencyIncreasePercent > 0
    ? [{
        source: "edict",
        sourceId: recyclingIncreaseEdict.id,
        name: recyclingIncreaseEdict.name,
        percent: activeLevel.efficiencyIncreasePercent,
    }]
    : [];

  if (focusBonusPercent > 0) {
    bonuses.push({
      source: "focus",
      sourceId: "recyclingEfficiency",
      name: "Recycling Efficiency Focus",
      percent: focusBonusPercent,
    });
  }

  return {
    basePercent: baseConfig.recyclingEfficiencyPercent,
    bonuses,
    effectivePercent: baseConfig.recyclingEfficiencyPercent
      + bonuses.reduce((total, bonus) => total + bonus.percent, 0),
  };
};
