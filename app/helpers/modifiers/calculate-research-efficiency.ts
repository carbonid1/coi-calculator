import { type EdictLevel, getEdict } from "../../db/edicts";

export interface ResearchEfficiencyBreakdown {
  bonusPercent: number;
  edictBonusPercent: number;
  focusBonusPercent: number;
  multiplier: number;
  population: number;
  populationBonusPercent: number;
  stationBonusPercent: number;
  totalOutputPercent: number;
}

/**
 * Installed v0.8.7 rounds the population contribution to the nearest percent:
 * `(population * 5 + 500) / 1000` using integer division.
 */
export const calculatePopulationResearchBonus = (population: number) => (
  Math.trunc((Math.max(0, Math.trunc(population)) * 5 + 500) / 1000)
);

export const calculateResearchEfficiency = ({
  edictLevel,
  population,
  stationBonusPercent,
  focusBonusPercent = 0,
}: {
  edictLevel: EdictLevel;
  population: number;
  stationBonusPercent: number;
  focusBonusPercent?: number;
}): ResearchEfficiencyBreakdown => {
  const edict = getEdict("researchEfficiency").levels.find(
    (level) => level.level === edictLevel,
  );
  const normalizedPopulation = Math.max(0, Math.trunc(population));
  const edictBonusPercent = edict?.modeledEffects
    ?.researchEfficiencyBonusPercent ?? 0;
  const normalizedStationBonus = Math.max(0, stationBonusPercent);
  const normalizedFocusBonus = Math.max(0, focusBonusPercent);
  const populationBonusPercent = calculatePopulationResearchBonus(
    normalizedPopulation,
  );
  const bonusPercent = edictBonusPercent
    + normalizedStationBonus
    + normalizedFocusBonus
    + populationBonusPercent;

  return {
    bonusPercent,
    edictBonusPercent,
    focusBonusPercent: normalizedFocusBonus,
    multiplier: 1 + bonusPercent / 100,
    population: normalizedPopulation,
    populationBonusPercent,
    stationBonusPercent: normalizedStationBonus,
    totalOutputPercent: 100 + bonusPercent,
  };
};
