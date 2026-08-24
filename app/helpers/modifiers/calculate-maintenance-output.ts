import { maintenanceOutputResearch } from "../../db/research";

export interface MaintenanceOutputResult {
  level: number;
  researchBonusPercent: number;
  focusBonusPercent: number;
  bonusPercent: number;
  multiplier: number;
}

export const calculateMaintenanceOutput = (
  level: number,
  focusBonusPercent = 0,
): MaintenanceOutputResult => {
  const normalizedLevel = Math.min(
    maintenanceOutputResearch.maxLevel,
    Math.max(0, Math.trunc(level)),
  );
  const researchBonusPercent = normalizedLevel * maintenanceOutputResearch.percentPerLevel;
  const normalizedFocusBonusPercent = Math.max(0, focusBonusPercent);
  const bonusPercent = researchBonusPercent + normalizedFocusBonusPercent;

  return {
    level: normalizedLevel,
    researchBonusPercent,
    focusBonusPercent: normalizedFocusBonusPercent,
    bonusPercent,
    multiplier: 1 + bonusPercent / 100,
  };
};
