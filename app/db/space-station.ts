import { defaultInfiniteResearchLevels, rocketsCapacityResearch } from "./research";

export type StationPartsKind = "basic" | "standard";

export interface SpaceStationConfig {
  /** Station level currently present in orbit. Zero means it is being rebuilt. */
  currentLevel: number;
  /** Highest level ever reached in this save; the game retains this progression. */
  highestLevelAchieved: number;
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

export interface RocketIiRecurringLogistics {
  aluminumPerCycle: number;
  assemblyDepotUtilization: number;
  cargoCapacity: number;
  cargoLaunchesPerCycle: number;
  compositePanelPerCycle: number;
  crewCapacity: number;
  crewLaunchesPerCycle: number;
  cyclesPerLaunch: number;
  electronicsIiiPerCycle: number;
  hydrogenPerCycle: number;
  launchesPerCycle: number;
  oxygenPerCycle: number;
  payloadCapacityBonusPercent: number;
  plasticPerCycle: number;
  researchLevel: number;
  steelPerCycle: number;
  titaniumAlloyPerCycle: number;
  waterPerCycle: number;
}

/** Installed Captain of Industry v0.8.7 Rocket II values. */
export const rocketIiGameData = {
  baseCargoCapacity: 120,
  baseCrewCapacity: 12,
  buildCycles: 6,
  buildCosts: {
    compositePanel: 480,
    electronicsIii: 16,
    steel: 80,
    titaniumAlloy: 120,
  },
  compositePanelRecipe: {
    aluminum: 8,
    output: 8,
    plastic: 2,
    steel: 1,
  },
  launchInputs: {
    hydrogen: 320,
    oxygen: 90,
    water: 160,
  },
} as const;

/** The station replaces its entire crew every two in-game years. */
const SPACE_STATION_CREW_ROTATION_CYCLES = 24;

/** Maximum Space Station level in Captain of Industry v0.8.7. */
const maximumSpaceStationLevel = 4;

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

export const getMinimumSpaceStationLevelForResearchPoints = (
  requiredPoints: number,
) => {
  if (requiredPoints <= 0) return 0;

  const maximumOutput = calculateSpaceStationLevel(
    maximumSpaceStationLevel,
  ).spaceResearchPointsPerCycle;
  const coveredTarget = Math.min(Math.max(0, requiredPoints), maximumOutput);

  for (let level = 1; level <= maximumSpaceStationLevel; level += 1) {
    if (calculateSpaceStationLevel(level).spaceResearchPointsPerCycle >= coveredTarget) {
      return level;
    }
  }

  return maximumSpaceStationLevel;
};

/**
 * Long-run Rocket II cost for keeping a station supplied. Cargo products
 * cannot share a rocket, but full loads make their combined asymptotic launch
 * rate equal to total cargo demand divided by payload capacity. Crew rotation
 * remains a separate launch stream.
 *
 * Composite Panels are expanded into Aluminum, Steel, and Plastic here so the
 * factory plan exposes the launcher's underlying recurring material pressure.
 */
export const calculateRocketIiRecurringLogistics = (
  station: SpaceStationLevelData,
  researchLevel: number,
): RocketIiRecurringLogistics => {
  const normalizedResearchLevel = Math.max(0, Math.trunc(researchLevel));
  const payloadCapacityBonusPercent = normalizedResearchLevel
    * (rocketsCapacityResearch.percentPerLevel ?? 0);
  const capacityMultiplier = 1 + payloadCapacityBonusPercent / 100;
  const cargoCapacity = Math.round(rocketIiGameData.baseCargoCapacity * capacityMultiplier);
  const crewCapacity = Math.round(rocketIiGameData.baseCrewCapacity * capacityMultiplier);
  const recurringCargoPerCycle = station.maintenancePartsPerCycle
    + station.crewSuppliesPerCycle
    + station.researchSuppliesPerCycle;
  const cargoLaunchesPerCycle = cargoCapacity > 0
    ? recurringCargoPerCycle / cargoCapacity
    : 0;
  const crewLaunchesPerCycle = station.crew > 0 && crewCapacity > 0
    ? Math.ceil(station.crew / crewCapacity) / SPACE_STATION_CREW_ROTATION_CYCLES
    : 0;
  const launchesPerCycle = cargoLaunchesPerCycle + crewLaunchesPerCycle;
  const panelBatchesPerRocket = rocketIiGameData.buildCosts.compositePanel
    / rocketIiGameData.compositePanelRecipe.output;
  const perRocket = {
    aluminum: panelBatchesPerRocket * rocketIiGameData.compositePanelRecipe.aluminum,
    electronicsIii: rocketIiGameData.buildCosts.electronicsIii,
    hydrogen: rocketIiGameData.launchInputs.hydrogen,
    oxygen: rocketIiGameData.launchInputs.oxygen,
    plastic: panelBatchesPerRocket * rocketIiGameData.compositePanelRecipe.plastic,
    steel: rocketIiGameData.buildCosts.steel
      + panelBatchesPerRocket * rocketIiGameData.compositePanelRecipe.steel,
    titaniumAlloy: rocketIiGameData.buildCosts.titaniumAlloy,
    water: rocketIiGameData.launchInputs.water,
  };

  return {
    aluminumPerCycle: perRocket.aluminum * launchesPerCycle,
    assemblyDepotUtilization: launchesPerCycle * rocketIiGameData.buildCycles,
    cargoCapacity,
    cargoLaunchesPerCycle,
    compositePanelPerCycle: rocketIiGameData.buildCosts.compositePanel * launchesPerCycle,
    crewCapacity,
    crewLaunchesPerCycle,
    cyclesPerLaunch: launchesPerCycle > 0 ? 1 / launchesPerCycle : 0,
    electronicsIiiPerCycle: perRocket.electronicsIii * launchesPerCycle,
    hydrogenPerCycle: perRocket.hydrogen * launchesPerCycle,
    launchesPerCycle,
    oxygenPerCycle: perRocket.oxygen * launchesPerCycle,
    payloadCapacityBonusPercent,
    plasticPerCycle: perRocket.plastic * launchesPerCycle,
    researchLevel: normalizedResearchLevel,
    steelPerCycle: perRocket.steel * launchesPerCycle,
    titaniumAlloyPerCycle: perRocket.titaniumAlloy * launchesPerCycle,
    waterPerCycle: perRocket.water * launchesPerCycle,
  };
};

export const defaultSpaceStationLevel = calculateSpaceStationLevel(
  maximumSpaceStationLevel,
  maximumSpaceStationLevel,
);

export const defaultRocketIiRecurringLogistics = calculateRocketIiRecurringLogistics(
  defaultSpaceStationLevel,
  defaultInfiniteResearchLevels.rocketsCapacity,
);
