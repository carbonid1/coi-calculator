import {
  farmingBoostEdict,
  type FarmingBoostLevel,
} from "../../db/edicts";
import { cropYieldResearch } from "../../db/research";

export interface CropFarmingModifiers {
  yieldBonusPercent: number;
  yieldMultiplier: number;
  waterDemandMultiplier: number;
}

export const calculateCropFarmingModifiers = (
  researchLevel: number,
  farmingBoostLevel: FarmingBoostLevel,
  focusYieldBonusPercent = 0,
): CropFarmingModifiers => {
  const normalizedResearchLevel = Math.min(
    cropYieldResearch.maxLevel,
    Math.max(0, Math.trunc(researchLevel)),
  );
  const activeEdict = farmingBoostEdict.levels[farmingBoostLevel];
  const researchYieldBonusPercent = normalizedResearchLevel
    * cropYieldResearch.percentPerLevel;
  const researchWaterDemandBonusPercent = normalizedResearchLevel
    * cropYieldResearch.waterDemandPercentPerLevel;
  const yieldBonusPercent = researchYieldBonusPercent
    + activeEdict.yieldIncreasePercent
    + Math.max(0, focusYieldBonusPercent);
  const waterDemandBonusPercent = researchWaterDemandBonusPercent
    + activeEdict.waterDemandIncreasePercent;

  return {
    yieldBonusPercent,
    yieldMultiplier: 1 + yieldBonusPercent / 100,
    waterDemandMultiplier: 1 + waterDemandBonusPercent / 100,
  };
};
