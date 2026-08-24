import {
  farmingBoostEdict,
  type FarmingBoostLevel,
} from "../../db/edicts";
import { cropYieldResearch } from "../../db/research";

export interface CropFarmingModifiers {
  researchLevel: number;
  researchYieldBonusPercent: number;
  researchWaterDemandBonusPercent: number;
  edictYieldBonusPercent: number;
  edictWaterDemandBonusPercent: number;
  focusYieldBonusPercent: number;
  yieldBonusPercent: number;
  waterDemandBonusPercent: number;
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
    researchLevel: normalizedResearchLevel,
    researchYieldBonusPercent,
    researchWaterDemandBonusPercent,
    edictYieldBonusPercent: activeEdict.yieldIncreasePercent,
    edictWaterDemandBonusPercent: activeEdict.waterDemandIncreasePercent,
    focusYieldBonusPercent: Math.max(0, focusYieldBonusPercent),
    yieldBonusPercent,
    waterDemandBonusPercent,
    yieldMultiplier: 1 + yieldBonusPercent / 100,
    waterDemandMultiplier: 1 + waterDemandBonusPercent / 100,
  };
};
