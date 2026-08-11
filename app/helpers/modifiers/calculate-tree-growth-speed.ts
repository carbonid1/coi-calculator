import {
  TREE_FULL_GROWTH_CYCLES,
  treeGrowthSpeedResearch,
} from "../../db/research";

export interface TreeGrowthSpeedResult {
  level: number;
  bonusPercent: number;
  multiplier: number;
  growthCycles: number;
  growthYears: number;
}

export const calculateTreeGrowthSpeed = (level: number): TreeGrowthSpeedResult => {
  const normalizedLevel = Math.min(
    treeGrowthSpeedResearch.maxLevel,
    Math.max(0, Math.trunc(level)),
  );
  const bonusPercent = normalizedLevel * treeGrowthSpeedResearch.percentPerLevel;
  const multiplier = 1 + bonusPercent / 100;
  const growthCycles = TREE_FULL_GROWTH_CYCLES / multiplier;

  return {
    level: normalizedLevel,
    bonusPercent,
    multiplier,
    growthCycles,
    growthYears: growthCycles / 12,
  };
};
