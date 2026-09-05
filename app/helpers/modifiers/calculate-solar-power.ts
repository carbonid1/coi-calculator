import { cleanPanelsEdict, type CleanPanelsLevel } from "../../db/edicts";
import { solarPowerResearch } from "../../db/research";

export interface SolarPowerResult {
  bonusPercent: number;
  multiplier: number;
}

export const calculateSolarPower = (
  researchLevel: number,
  cleanPanelsLevel: CleanPanelsLevel,
  averageSunIntensityPercent: number,
): SolarPowerResult => {
  const normalizedResearchLevel = Math.min(
    solarPowerResearch.maxLevel,
    Math.max(0, Math.trunc(researchLevel)),
  );
  const researchBonusPercent = normalizedResearchLevel * solarPowerResearch.percentPerLevel;
  const edictBonusPercent = cleanPanelsEdict.levels[cleanPanelsLevel].powerIncreasePercent;
  const bonusPercent = researchBonusPercent + edictBonusPercent;
  const peakMultiplier = 1 + bonusPercent / 100;
  const weatherPercent = averageSunIntensityPercent;
  const weatherMultiplier = weatherPercent / 100;

  return {
    bonusPercent,
    multiplier: peakMultiplier * weatherMultiplier,
  };
};
