import { settlementWaterUseResearch } from "../../db/research";

export interface SettlementWaterUseResult {
  level: number;
  reductionPercent: number;
  multiplier: number;
}

export const calculateSettlementWaterUse = (
  level: number,
): SettlementWaterUseResult => {
  const normalizedLevel = Math.min(
    settlementWaterUseResearch.maxLevel,
    Math.max(0, Math.trunc(level)),
  );
  const reductionPercent = -normalizedLevel
    * settlementWaterUseResearch.percentPerLevel;

  return {
    level: normalizedLevel,
    reductionPercent,
    multiplier: 1 - reductionPercent / 100,
  };
};
