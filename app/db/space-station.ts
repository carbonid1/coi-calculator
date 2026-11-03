import { resolveSyncedResourceId } from '../helpers/synced-resources/synced-resources';
import { type RocketIiDefinition, type RocketProduct } from '../rocket-state';
import { type Recipe } from './recipes';
import { type ResourceId } from './resources';

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
  const constructionParts = normalizedLevel > 1 ? 120 : normalizedLevel * 80;

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

  return Array.from({ length: maximumSpaceStationLevel }, (_, index) => index + 1)
    .find(level => calculateSpaceStationLevel(level).spaceResearchPointsPerCycle >= coveredTarget)
    ?? maximumSpaceStationLevel;
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
  definition: RocketIiDefinition,
  researchLevel: number,
): RocketIiRecurringLogistics => {
  const normalizedResearchLevel = Math.max(0, Math.trunc(researchLevel));
  const { cargoCapacity, crewCapacity } = definition;
  const recurringCargoPerCycle = station.maintenancePartsPerCycle
    + station.crewSuppliesPerCycle
    + station.researchSuppliesPerCycle;
  const cargoLaunchesPerCycle = cargoCapacity > 0
    ? recurringCargoPerCycle / cargoCapacity
    : 0;
  const crewLaunchesPerCycle = station.crew > 0 && crewCapacity > 0
    ? Math.ceil(station.crew / crewCapacity) / definition.crewRotationCycles
    : 0;
  const launchesPerCycle = cargoLaunchesPerCycle + crewLaunchesPerCycle;
  const buildInputs = rocketIngredients(definition.buildInputs);
  const panelsPerRocket = buildInputs.find(input => input.resourceId === 'compositePanel')?.quantity ?? 0;
  const panelBatchesPerRocket = panelsPerRocket / definition.compositePanelOutput;
  const expandedInputs = [
    ...buildInputs.filter(input => input.resourceId !== 'compositePanel'),
    ...rocketIngredients(definition.launchInputs),
    ...rocketIngredients(definition.compositePanelInputs).map(input => ({
      ...input, quantity: input.quantity * panelBatchesPerRocket,
    })),
  ];
  const perRocket = (id: ResourceId) => expandedInputs.reduce((sum, input) => (
    sum + (input.resourceId === id ? input.quantity : 0)
  ), 0);

  return {
    aluminumPerCycle: perRocket('aluminum') * launchesPerCycle,
    assemblyDepotUtilization: launchesPerCycle * definition.buildCycles,
    cargoCapacity,
    cargoLaunchesPerCycle,
    compositePanelPerCycle: panelsPerRocket * launchesPerCycle,
    crewCapacity,
    crewLaunchesPerCycle,
    cyclesPerLaunch: launchesPerCycle > 0 ? 1 / launchesPerCycle : 0,
    electronicsIiiPerCycle: perRocket('electronicsIII') * launchesPerCycle,
    hydrogenPerCycle: perRocket('hydrogen') * launchesPerCycle,
    launchesPerCycle,
    oxygenPerCycle: perRocket('oxygen') * launchesPerCycle,
    payloadCapacityBonusPercent: definition.capacityBonusPercent,
    plasticPerCycle: perRocket('plastic') * launchesPerCycle,
    researchLevel: normalizedResearchLevel,
    steelPerCycle: perRocket('steel') * launchesPerCycle,
    titaniumAlloyPerCycle: perRocket('titaniumAlloy') * launchesPerCycle,
    waterPerCycle: perRocket('water') * launchesPerCycle,
  };
};

export const defaultSpaceStationLevel = calculateSpaceStationLevel(
  maximumSpaceStationLevel,
  maximumSpaceStationLevel,
);

const rocketIngredients = (products: readonly RocketProduct[]) => products.map(product => {
  const resourceId = resolveSyncedResourceId(product);

  if (!resourceId) throw new Error(`Unsupported Rocket II product: ${product.productId}`);
  return { resourceId, quantity: product.quantity };
});

export const createRocketIiRecipes = (
  station: SpaceStationLevelData,
  definition: RocketIiDefinition,
): Recipe[] => {
  const logistics = calculateRocketIiRecurringLogistics(station, definition, 0);

  return [{
    id: 'rocket-ii-assembly',
    name: 'Rocket Assembly Depot (Rocket II)',
    building: 'Rocket Assembly Depot',
    gameBuildingId: 'RocketAssemblyDepot',
    group: 'production',
    cycleDurationSeconds: definition.buildCycles * 60,
    balanceBy: 'output',
    balanceOutputIds: ['rocketII'],
    inputs: rocketIngredients(definition.buildInputs).map(input => ({
      ...input, quantity: input.quantity / definition.buildCycles,
    })),
    outputs: [{ resourceId: 'rocketII', quantity: 1 / definition.buildCycles }],
  }, {
    id: 'rocket-ii-launch-amortized',
    name: 'Rocket Launch Pad (Rocket II average)',
    building: 'Rocket Launch Pad',
    gameBuildingId: 'RocketLaunchPad',
    group: 'production',
    fixedTotalOperation: true,
    inputs: [
      { resourceId: 'rocketII', quantity: logistics.launchesPerCycle },
      ...rocketIngredients(definition.launchInputs).map(input => ({
        ...input, quantity: input.quantity * logistics.launchesPerCycle,
      })),
    ],
    outputs: [],
  }];
};
