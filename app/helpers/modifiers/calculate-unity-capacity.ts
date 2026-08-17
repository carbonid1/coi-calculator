import { unityCapacityResearch } from "../../db/research";

export interface UnityCapacityResult {
  level: number;
  bonusPercent: number;
  multiplier: number;
}

export const calculateUnityCapacity = (level: number): UnityCapacityResult => {
  const normalizedLevel = Math.min(
    unityCapacityResearch.maxLevel,
    Math.max(0, Math.trunc(level)),
  );
  const bonusPercent = normalizedLevel * unityCapacityResearch.percentPerLevel;

  return {
    level: normalizedLevel,
    bonusPercent,
    multiplier: 1 + bonusPercent / 100,
  };
};
