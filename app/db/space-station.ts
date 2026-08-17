export type StationPartsKind = "basic" | "standard";

export interface SpaceStationConfig {
  /** Station level currently present in orbit. Zero means it is being rebuilt. */
  currentLevel: number;
  /** Highest level ever reached in this save; the game retains this progression. */
  highestLevelAchieved: number;
  /** Steady-state level represented by the factory plan. */
  targetLevel: number;
}

export interface SpaceStationLevelData {
  constructionParts: number;
  crew: number;
  crewSuppliesPerCycle: number;
  level: number;
  maintenancePartsPerCycle: number;
  researchEfficiencyBonusPercent: number;
  researchSuppliesPerCycle: number;
  spaceResearchPointsPerCycle: number;
  stationPartsKind: StationPartsKind;
  unityPerCycle: number;
}

/**
 * The current save previously reached orbital research, so even a level-one
 * rebuild uses standard Station Parts. The factory plan targets level four,
 * which exactly supports two Research Lab IV buildings running space research.
 */
export const defaultSpaceStationConfig: SpaceStationConfig = {
  currentLevel: 0,
  highestLevelAchieved: 4,
  targetLevel: 4,
};

const normalizeLevel = (level: number) => Math.max(0, Math.trunc(level));
const roundRate = (value: number) => parseFloat(value.toFixed(6));

/** Captain of Industry v0.8.7 retains the advanced-parts path once level 3 was reached. */
export const getStationPartsKind = (
  level: number,
  highestLevelAchieved: number,
): StationPartsKind => (
  normalizeLevel(level) < 3 && normalizeLevel(highestLevelAchieved) < 3
    ? "basic"
    : "standard"
);

export const calculateSpaceStationLevel = (
  level: number,
  highestLevelAchieved = level,
): SpaceStationLevelData => {
  const normalizedLevel = normalizeLevel(level);
  const researchLevels = Math.max(0, normalizedLevel - 2);
  const crew = Math.max(0, (normalizedLevel - 1) * 2);
  let constructionParts = 0;

  if (normalizedLevel === 1) constructionParts = 80;
  if (normalizedLevel > 1) constructionParts = 120;

  return {
    constructionParts,
    crew,
    crewSuppliesPerCycle: roundRate(crew * 0.2),
    level: normalizedLevel,
    maintenancePartsPerCycle: normalizedLevel * 0.25,
    researchEfficiencyBonusPercent: normalizedLevel === 0
      ? 0
      : 10 + (normalizedLevel - 1) * 5,
    researchSuppliesPerCycle: researchLevels * 2,
    spaceResearchPointsPerCycle: researchLevels * 48,
    stationPartsKind: getStationPartsKind(normalizedLevel, highestLevelAchieved),
    unityPerCycle: normalizedLevel === 0
      ? 0
      : roundRate(0.15 + (normalizedLevel - 1) * 0.05),
  };
};

export const calculateSpaceStationConstruction = (
  config: SpaceStationConfig,
) => {
  const currentLevel = normalizeLevel(config.currentLevel);
  const targetLevel = Math.max(currentLevel, normalizeLevel(config.targetLevel));
  const byKind: Record<StationPartsKind, number> = { basic: 0, standard: 0 };

  for (let level = currentLevel + 1; level <= targetLevel; level += 1) {
    const data = calculateSpaceStationLevel(level, config.highestLevelAchieved);

    byKind[data.stationPartsKind] += data.constructionParts;
  }

  return {
    byKind,
    currentLevel,
    targetLevel,
    totalParts: byKind.basic + byKind.standard,
  };
};

export const defaultSpaceStationLevel = calculateSpaceStationLevel(
  defaultSpaceStationConfig.targetLevel,
  defaultSpaceStationConfig.highestLevelAchieved,
);
