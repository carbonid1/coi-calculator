import { maintenanceOutputResearch } from "../../db/research";

export interface MaintenanceOutputResult {
  level: number;
  bonusPercent: number;
  multiplier: number;
}

export const calculateMaintenanceOutput = (level: number): MaintenanceOutputResult => {
  const normalizedLevel = Math.min(
    maintenanceOutputResearch.maxLevel,
    Math.max(0, Math.trunc(level)),
  );
  const bonusPercent = normalizedLevel * maintenanceOutputResearch.percentPerLevel;

  return {
    level: normalizedLevel,
    bonusPercent,
    multiplier: 1 + bonusPercent / 100,
  };
};
