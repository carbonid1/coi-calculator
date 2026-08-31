import { baseConfig } from "../../db/config";
import { recyclingIncreaseEdict, type EdictLevel } from "../../db/edicts";

export interface RecyclingEfficiencyResult {
  effectivePercent: number;
}

export const calculateRecyclingEfficiency = (
  level: EdictLevel,
  focusBonusPercent = 0,
): RecyclingEfficiencyResult => {
  const activeLevel = recyclingIncreaseEdict.levels[level];

  return {
    effectivePercent: baseConfig.recyclingEfficiencyPercent
      + activeLevel.efficiencyIncreasePercent
      + Math.max(0, focusBonusPercent),
  };
};
