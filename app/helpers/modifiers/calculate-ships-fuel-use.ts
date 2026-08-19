import { shipsFuelUseResearch } from "../../db/research";

export interface ShipsFuelUseResult {
  level: number;
  reductionPercent: number;
  multiplier: number;
}

export const calculateShipsFuelUse = (level: number): ShipsFuelUseResult => {
  const normalizedLevel = Math.min(
    shipsFuelUseResearch.maxLevel,
    Math.max(0, Math.trunc(level)),
  );
  const reductionPercent = -normalizedLevel * shipsFuelUseResearch.percentPerLevel;

  return {
    level: normalizedLevel,
    reductionPercent,
    multiplier: 1 - reductionPercent / 100,
  };
};
