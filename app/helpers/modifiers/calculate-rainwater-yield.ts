import { rainwaterYieldResearch } from "../../db/research";

export interface RainwaterYieldResult {
  level: number;
  bonusPercent: number;
  multiplier: number;
}

export const calculateRainwaterYield = (level: number): RainwaterYieldResult => {
  const normalizedLevel = Math.min(
    rainwaterYieldResearch.maxLevel,
    Math.max(0, Math.trunc(level)),
  );
  const bonusPercent = normalizedLevel * rainwaterYieldResearch.percentPerLevel;

  return {
    level: normalizedLevel,
    bonusPercent,
    multiplier: 1 + bonusPercent / 100,
  };
};
