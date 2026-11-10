import { resolveSyncedResourceId } from '../helpers/synced-resources/synced-resources';
import { type RocketIiDefinition, type RocketProduct } from '../rocket-state';
import { type SpaceStationLevelDefinition } from '../space-station-state';
import { type Recipe } from './recipes';
import { type ResourceId } from './resources';

export interface SpaceStationConfig {
  /** Explicit crew setting from Bridge; older exports do not provide it. */
  crewDisabled?: boolean;
  /** Station level currently present in orbit. Zero means it is being rebuilt. */
  currentLevel: number;
  /** Highest level ever reached in this save; the game retains this progression. */
  highestLevelAchieved: number;
}

export interface SpaceStationLevelData {
  constructionParts: number;
  stationPartsResourceId: ResourceId;
  crewSuppliesResourceId: ResourceId;
  researchSuppliesResourceId: ResourceId;
  crew: number;
  crewSuppliesPerCycle: number;
  level: number;
  maintenancePartsPerCycle: number;
  researchEfficiencyBonusPercent: number;
  researchSuppliesPerCycle: number;
  spaceResearchPointsPerCycle: number;
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

const normalizeLevel = (level: number) => Math.max(0, Math.trunc(level));

export const calculateSpaceStationLevel = (
  level: number,
  definitions: readonly SpaceStationLevelDefinition[],
): SpaceStationLevelData => {
  const normalizedLevel = normalizeLevel(level);
  const definition = definitions.find(candidate => candidate.level === (normalizedLevel || 1));

  if (!definition) throw new Error(`Space Station tier ${normalizedLevel} is unavailable`);
  const resource = (product: { productId: string; name: string }) => {
    const id = resolveSyncedResourceId(product);

    if (!id) throw new Error(`Unsupported Space Station product ${product.productId}`);
    return id;
  };
  // Level zero represents an absent station. Native tier data starts at one.
  const current = (quantity: number) => normalizedLevel > 0 ? quantity : 0;

  return {
    constructionParts: current(definition.construction.quantity),
    stationPartsResourceId: resource(definition.maintenance),
    crewSuppliesResourceId: resource(definition.crewSupplies),
    researchSuppliesResourceId: resource(definition.researchSupplies),
    crew: current(definition.crew),
    crewSuppliesPerCycle: current(definition.crewSupplies.quantity),
    level: normalizedLevel,
    maintenancePartsPerCycle: current(definition.maintenance.quantity),
    researchEfficiencyBonusPercent: current(definition.researchEfficiencyBonusPercent),
    researchSuppliesPerCycle: current(definition.researchSupplies.quantity),
    spaceResearchPointsPerCycle: current(definition.spaceResearchPointsPerCycle),
    unityPerCycle: current(definition.unityPerCycle),
  };
};

export const getMinimumSpaceStationLevelForResearchPoints = (
  requiredPoints: number,
  definitions: readonly SpaceStationLevelDefinition[],
) => {
  if (requiredPoints <= 0) return 0;
  const maximumLevel = definitions.at(-1)?.level;

  if (maximumLevel === undefined) throw new Error('Space Station tiers are unavailable');
  return definitions.find(level => level.spaceResearchPointsPerCycle >= requiredPoints)?.level ?? maximumLevel;
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
