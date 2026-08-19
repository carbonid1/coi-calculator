import { housingCapacityResearch } from "../../db/research";

export interface HousingCapacityResult {
  level: number;
  bonusPercent: number;
  multiplier: number;
}

export const calculateHousingCapacity = (level: number): HousingCapacityResult => {
  const normalizedLevel = Math.min(
    housingCapacityResearch.maxLevel,
    Math.max(0, Math.trunc(level)),
  );
  const bonusPercent = normalizedLevel * housingCapacityResearch.percentPerLevel;

  return {
    level: normalizedLevel,
    bonusPercent,
    multiplier: 1 + bonusPercent / 100,
  };
};
