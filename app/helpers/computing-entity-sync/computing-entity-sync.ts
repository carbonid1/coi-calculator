import { type ComputingConfig } from "../../db/computing";
import {
  type SyncedLogisticsZoneRef,
  type SyncedProductionEntity,
} from "../../game-state";

export const COMPUTING_ZONE_NAME = "Computing";

export interface ResolvedComputingEntityInventory {
  built: ComputingConfig;
  running: ComputingConfig;
  entities: SyncedProductionEntity[];
}

const emptyConfig = (): ComputingConfig => ({
  dataCenterCount: 0,
  rackCount: 0,
  waterChillers: 0,
});

export const resolveComputingEntityInventory = (
  productionEntities: readonly SyncedProductionEntity[],
  zoneId?: number,
): ResolvedComputingEntityInventory => {
  const entities = productionEntities.filter(entity => (
    entity.zones.some(zone => (
      zone.name === COMPUTING_ZONE_NAME && (zoneId === undefined || zone.id === zoneId)
    )) &&
    (entity.prototypeId === "DataCenter" || entity.prototypeId === "WaterChiller")
  ));
  const built = emptyConfig();
  const running = emptyConfig();

  for (const entity of entities) {
    if (entity.prototypeId === "DataCenter") {
      const racks = entity.dataCenterRacks ?? 0;

      built.dataCenterCount++;
      built.rackCount += racks;
      if (entity.running) {
        running.dataCenterCount++;
        running.rackCount += racks;
      }
      continue;
    }

    built.waterChillers++;
    running.waterChillers += Number(entity.running);
  }

  return { built, running, entities };
};

export const getComputingZones = (
  productionEntities: readonly SyncedProductionEntity[],
): SyncedLogisticsZoneRef[] => {
  const zones = new Map<number, SyncedLogisticsZoneRef>();

  for (const entity of productionEntities) {
    for (const zone of entity.zones) {
      if (zone.name === COMPUTING_ZONE_NAME) zones.set(zone.id, zone);
    }
  }

  return [...zones.values()];
};
