import { type EdictLevel } from "../../db/edicts";
import { getEdictEffects, type PlanningDefinitions } from '../../planning-state';

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

export const calculatePopulationResearchBonus = (definitions: PlanningDefinitions, population: number) => {
  const formula = definitions.factory.populationResearch;

  return Math.trunc((Math.max(0, Math.trunc(population)) * formula.numerator + formula.rounding) / formula.denominator);
};

export const calculateResearchEfficiency = ({
  definitions,
  edictLevel,
  population,
  stationBonusPercent,
  focusBonusPercent = 0,
}: {
  definitions: PlanningDefinitions;
  edictLevel: EdictLevel;
  population: number;
  stationBonusPercent: number;
  focusBonusPercent?: number;
}): ResearchEfficiencyBreakdown => {
  const normalizedPopulation = Math.max(0, Math.trunc(population));
  const edictBonusPercent = getEdictEffects(definitions, 'researchEfficiency', edictLevel).effects.ResearchEfficiencyMultiplier ?? 0;
  const normalizedStationBonus = Math.max(0, stationBonusPercent);
  const normalizedFocusBonus = Math.max(0, focusBonusPercent);
  const populationBonusPercent = calculatePopulationResearchBonus(
    definitions,
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
