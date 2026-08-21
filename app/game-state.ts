export const syncedInfrastructureBuildingIds = [
  "electricLocomotiveII",
  "looseStationModuleElectrified",
  "fluidStationModuleElectrified",
  "unitStationModuleElectrified",
  "moltenStationModuleElectrified",
  "oreSortingPlant",
  "oreSortingPlantLarge",
  "stackerTower",
  "maintenanceStatue",
] as const;

export type SyncedInfrastructureBuildingId = (typeof syncedInfrastructureBuildingIds)[number];

export const syncedSolarBuildingIds = ["solarPanel", "solarPanelMono"] as const;

export type SyncedSolarBuildingId = (typeof syncedSolarBuildingIds)[number];

export const syncedBuildingIds = [
  ...syncedInfrastructureBuildingIds,
  ...syncedSolarBuildingIds,
] as const;

export type SyncedBuildingId = (typeof syncedBuildingIds)[number];

export interface SyncedBuildingCount {
  built: number;
  running: number;
}

export interface SyncedHistoryAverage {
  averagePerCycle: number;
  sampleMonths: number;
}

export const syncedHydrogenFuelUseIds = [
  "vehicles",
  "cargoShips",
  "battleShip",
  "powerGenerators",
  "trains",
] as const;

export type SyncedHydrogenFuelUseId = (typeof syncedHydrogenFuelUseIds)[number];

export interface SyncedGenerationHistory {
  prototypeId: string;
  name: string;
  averageMw: number;
  sampleMonths: number;
}

export type TrainTrafficSeverity = "clear" | "warning" | "critical";

export interface SyncedTrainDelay {
  id: number;
  name: string;
  state: "WaitingForFreeTrack" | "WaitingForSuperBlock" | "WaitingForBidirectionalSuperBlock";
  blockedForCycles: number;
  blockingTrainId: number | null;
}

export interface SyncedTrainTraffic {
  totalTrains: number;
  activeTrains: number;
  waitingForTrack: number;
  stuckTrains: number;
  criticalThreshold: number;
  severity: TrainTrafficSeverity;
  sustainedWaitCycles: 1;
  trains: SyncedTrainDelay[];
}

export const CURRENT_GAME_STATE_SCHEMA_VERSION = 8 as const;
export type SupportedGameStateSchemaVersion = 6 | 7 | typeof CURRENT_GAME_STATE_SCHEMA_VERSION;

export interface GameStateSnapshot {
  schemaVersion: SupportedGameStateSchemaVersion;
  exportedAtUtc: string;
  buildings: Record<SyncedBuildingId, SyncedBuildingCount>;
  vehicles: {
    total: number;
    workersAssigned: number;
    trucks: number;
    excavators: number;
    treeHarvesters: number;
    treePlanters: number;
    quotaUsed: number;
    quotaLimit: number;
    quotaRemaining: number;
  };
  trainTraffic: SyncedTrainTraffic | null;
  history: {
    windowMonths: 120;
    maintenance: Record<"maintenanceI" | "maintenanceII" | "maintenanceIII", SyncedHistoryAverage>;
    hydrogenFuel: {
      total: SyncedHistoryAverage;
      byUse: Record<SyncedHydrogenFuelUseId, SyncedHistoryAverage>;
    };
    electricityGeneration: {
      byType: SyncedGenerationHistory[];
    };
  };
}

export type GameStateConnectionStatus = "loading" | "available" | "missing" | "error";
export type GameStateDataSource = "live" | "cached" | "none";

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isBuildingCount = (value: unknown): value is SyncedBuildingCount =>
  isUnknownRecord(value) &&
  isNonNegativeInteger(value.built) &&
  isNonNegativeInteger(value.running) &&
  value.running <= value.built;

type LegacySyncedBuildingId = Exclude<SyncedBuildingId, "moltenStationModuleElectrified">;
type CompatibleBuildingCounts = Record<LegacySyncedBuildingId, SyncedBuildingCount> &
  Partial<Record<"moltenStationModuleElectrified", SyncedBuildingCount>>;

const isCompatibleBuildingCounts = (
  value: unknown,
  schemaVersion: SupportedGameStateSchemaVersion,
): value is CompatibleBuildingCounts => {
  if (!isUnknownRecord(value)) return false;

  return syncedBuildingIds.every(id => {
    const count = value[id];

    return schemaVersion === 6 && id === "moltenStationModuleElectrified"
      ? count === undefined || isBuildingCount(count)
      : isBuildingCount(count);
  });
};

const isHistoryAverage = (value: unknown, windowMonths: number): value is SyncedHistoryAverage => {
  if (!isUnknownRecord(value)) return false;

  return (
    isNonNegativeFiniteNumber(value.averagePerCycle) &&
    isNonNegativeInteger(value.sampleMonths) &&
    value.sampleMonths <= windowMonths &&
    (value.sampleMonths > 0 || value.averagePerCycle === 0)
  );
};

const isGenerationHistory = (
  value: unknown,
  windowMonths: number,
): value is SyncedGenerationHistory =>
  isUnknownRecord(value) &&
  typeof value.prototypeId === "string" &&
  value.prototypeId.length > 0 &&
  typeof value.name === "string" &&
  value.name.length > 0 &&
  isNonNegativeFiniteNumber(value.averageMw) &&
  isNonNegativeInteger(value.sampleMonths) &&
  value.sampleMonths <= windowMonths &&
  (value.sampleMonths > 0 || value.averageMw === 0);

const trainWaitStates = new Set([
  "WaitingForFreeTrack",
  "WaitingForSuperBlock",
  "WaitingForBidirectionalSuperBlock",
]);

const isTrainTraffic = (value: unknown): value is SyncedTrainTraffic => {
  if (
    !isUnknownRecord(value) ||
    !isNonNegativeInteger(value.totalTrains) ||
    !isNonNegativeInteger(value.activeTrains) ||
    value.activeTrains > value.totalTrains ||
    !isNonNegativeInteger(value.waitingForTrack) ||
    value.waitingForTrack > value.activeTrains ||
    !isNonNegativeInteger(value.stuckTrains) ||
    value.stuckTrains > value.waitingForTrack ||
    value.sustainedWaitCycles !== 1 ||
    !Array.isArray(value.trains)
  ) {
    return false;
  }

  const expectedThreshold = Math.max(3, Math.ceil(value.activeTrains * 0.1));
  let expectedSeverity: TrainTrafficSeverity = "clear";

  if (value.stuckTrains >= expectedThreshold) {
    expectedSeverity = "critical";
  } else if (value.stuckTrains > 0) {
    expectedSeverity = "warning";
  }

  const validTrains = value.trains.filter(
    (train): train is SyncedTrainDelay =>
      isUnknownRecord(train) &&
      isNonNegativeInteger(train.id) &&
      typeof train.name === "string" &&
      train.name.length > 0 &&
      typeof train.state === "string" &&
      trainWaitStates.has(train.state) &&
      isNonNegativeFiniteNumber(train.blockedForCycles) &&
      train.blockedForCycles >= 1 &&
      (train.blockingTrainId === null || isNonNegativeInteger(train.blockingTrainId)),
  );

  return (
    value.criticalThreshold === expectedThreshold &&
    value.severity === expectedSeverity &&
    validTrains.length === Math.min(value.stuckTrains, 8) &&
    validTrains.length === value.trains.length &&
    new Set(validTrains.map(train => train.id)).size === validTrains.length
  );
};

export const normalizeGameStateSnapshot = (value: unknown): GameStateSnapshot | null => {
  if (!isUnknownRecord(value)) return null;

  const snapshot = value;
  const schemaVersion = snapshot.schemaVersion;

  if (
    schemaVersion !== 6 &&
    schemaVersion !== 7 &&
    schemaVersion !== CURRENT_GAME_STATE_SCHEMA_VERSION
  ) {
    return null;
  }

  const syncedBuildings = snapshot.buildings;
  const vehicles = isUnknownRecord(snapshot.vehicles) ? snapshot.vehicles : null;
  const total = vehicles?.total;
  const trucks = vehicles?.trucks;
  const workersAssigned = vehicles?.workersAssigned;
  const excavators = vehicles?.excavators;
  const treeHarvesters = vehicles?.treeHarvesters;
  const treePlanters = vehicles?.treePlanters;
  const quotaUsed = vehicles?.quotaUsed;
  const quotaLimit = vehicles?.quotaLimit;
  const quotaRemaining = vehicles?.quotaRemaining;
  const trainTraffic = isTrainTraffic(snapshot.trainTraffic) ? snapshot.trainTraffic : null;
  const history = isUnknownRecord(snapshot.history) ? snapshot.history : null;

  if (
    typeof snapshot.exportedAtUtc !== "string" ||
    Number.isNaN(Date.parse(snapshot.exportedAtUtc)) ||
    !isCompatibleBuildingCounts(syncedBuildings, schemaVersion) ||
    !vehicles ||
    !isNonNegativeInteger(total) ||
    !isNonNegativeInteger(workersAssigned) ||
    workersAssigned > total ||
    !isNonNegativeInteger(trucks) ||
    !isNonNegativeInteger(excavators) ||
    !isNonNegativeInteger(treeHarvesters) ||
    !isNonNegativeInteger(treePlanters) ||
    trucks + excavators + treeHarvesters + treePlanters > total ||
    !isNonNegativeInteger(quotaUsed) ||
    !isNonNegativeInteger(quotaLimit) ||
    !isNonNegativeInteger(quotaRemaining) ||
    quotaUsed + quotaRemaining !== quotaLimit ||
    (schemaVersion === CURRENT_GAME_STATE_SCHEMA_VERSION && !trainTraffic) ||
    !history ||
    history.windowMonths !== 120
  ) {
    return null;
  }

  const maintenance = isUnknownRecord(history.maintenance) ? history.maintenance : null;
  const maintenanceI = maintenance?.maintenanceI;
  const maintenanceII = maintenance?.maintenanceII;
  const maintenanceIII = maintenance?.maintenanceIII;
  const hydrogenFuel = isUnknownRecord(history.hydrogenFuel) ? history.hydrogenFuel : null;
  const hydrogenFuelByUse = isUnknownRecord(hydrogenFuel?.byUse) ? hydrogenFuel.byUse : null;
  const hydrogenTotal = hydrogenFuel?.total;
  const hydrogenVehicles = hydrogenFuelByUse?.vehicles;
  const hydrogenCargoShips = hydrogenFuelByUse?.cargoShips;
  const hydrogenBattleShip = hydrogenFuelByUse?.battleShip;
  const hydrogenPowerGenerators = hydrogenFuelByUse?.powerGenerators;
  const hydrogenTrains = hydrogenFuelByUse?.trains;

  if (
    !isHistoryAverage(maintenanceI, 120) ||
    !isHistoryAverage(maintenanceII, 120) ||
    !isHistoryAverage(maintenanceIII, 120) ||
    !isHistoryAverage(hydrogenTotal, 120) ||
    !isHistoryAverage(hydrogenVehicles, 120) ||
    !isHistoryAverage(hydrogenCargoShips, 120) ||
    !isHistoryAverage(hydrogenBattleShip, 120) ||
    !isHistoryAverage(hydrogenPowerGenerators, 120) ||
    !isHistoryAverage(hydrogenTrains, 120)
  ) {
    return null;
  }

  const electricityGeneration = isUnknownRecord(history.electricityGeneration)
    ? history.electricityGeneration
    : null;
  const generationByType = Array.isArray(electricityGeneration?.byType)
    ? electricityGeneration.byType
    : null;

  if (!generationByType) return null;

  const validGenerationByType = generationByType.filter(
    (generation): generation is SyncedGenerationHistory => isGenerationHistory(generation, 120),
  );

  if (
    validGenerationByType.length !== generationByType.length ||
    new Set(validGenerationByType.map(generation => generation.prototypeId)).size !==
      validGenerationByType.length
  ) {
    return null;
  }

  return {
    schemaVersion,
    exportedAtUtc: snapshot.exportedAtUtc,
    buildings: {
      ...syncedBuildings,
      moltenStationModuleElectrified: syncedBuildings.moltenStationModuleElectrified ?? {
        built: 0,
        running: 0,
      },
    },
    vehicles: {
      total,
      workersAssigned,
      trucks,
      excavators,
      treeHarvesters,
      treePlanters,
      quotaUsed,
      quotaLimit,
      quotaRemaining,
    },
    trainTraffic,
    history: {
      windowMonths: 120,
      maintenance: { maintenanceI, maintenanceII, maintenanceIII },
      hydrogenFuel: {
        total: hydrogenTotal,
        byUse: {
          vehicles: hydrogenVehicles,
          cargoShips: hydrogenCargoShips,
          battleShip: hydrogenBattleShip,
          powerGenerators: hydrogenPowerGenerators,
          trains: hydrogenTrains,
        },
      },
      electricityGeneration: { byType: validGenerationByType },
    },
  };
};

export const isGameStateSnapshot = (value: unknown): value is GameStateSnapshot =>
  isUnknownRecord(value) &&
  isUnknownRecord(value.buildings) &&
  isBuildingCount(value.buildings.moltenStationModuleElectrified) &&
  normalizeGameStateSnapshot(value) !== null;
