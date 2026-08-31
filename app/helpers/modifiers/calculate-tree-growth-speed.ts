import { treeGrowthSpeedResearch } from "../../db/research";

export interface TreeGrowthSpeedResult {
  bonusPercent: number;
  multiplier: number;
}

export const calculateTreeGrowthSpeed = (level: number): TreeGrowthSpeedResult => {
  const normalizedLevel = Math.min(
    treeGrowthSpeedResearch.maxLevel,
    Math.max(0, Math.trunc(level)),
  );
  const bonusPercent = normalizedLevel * treeGrowthSpeedResearch.percentPerLevel;
  const multiplier = 1 + bonusPercent / 100;

  return {
    bonusPercent,
    multiplier,
  };
};
