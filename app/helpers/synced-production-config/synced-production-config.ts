import { type CurrentChickenFarmEntity } from "../../db/chicken-farm";
import { type ComputingConfig } from "../../db/computing";
import { type CurrentCropFarmEntity } from "../../db/crop-farming";
import {
  type CurrentChickenFarmConfiguration,
  type CurrentCropFarmConfiguration,
} from "../../db/modules/farms";
import {
  type SyncedChickenFarmState,
  type SyncedComputingState,
  type SyncedCropFarmState,
} from "../../game-state";

const gameCropIds: Record<string, string> = {
  Crop_NoCrop: "none",
  Crop_GreenManure: "greenManure",
  Crop_Potato: "potato",
  Crop_Corn: "corn",
  Crop_Wheat: "wheat",
  Crop_TreeSapling: "treeSapling",
  Crop_Soybeans: "soybean",
  Crop_SugarCane: "sugarCane",
  Crop_Vegetables: "vegetables",
  Crop_Fruits: "fruit",
  Crop_Canola: "canola",
  Crop_Poppy: "poppy",
  Crop_Flowers: "flowers",
};

export const getSyncedComputingConfigs = (
  state: SyncedComputingState,
): { built: ComputingConfig; running: ComputingConfig } => ({
  built: {
    dataCenterCount: state.dataCenters.built,
    rackCount: state.racks.built,
    waterChillers: state.waterChillers.built,
  },
  running: {
    dataCenterCount: state.dataCenters.running,
    rackCount: state.racks.running,
    waterChillers: state.waterChillers.running,
  },
});

export const getSyncedChickenFarmConfigurations = (
  state: SyncedChickenFarmState,
): CurrentChickenFarmConfiguration[] => state.configurations.map(configuration => ({
  ...configuration,
}));

export const getSyncedChickenFarmEntities = (
  state: SyncedChickenFarmState,
): CurrentChickenFarmEntity[] => (state.entities ?? []).map(entity => ({
  entityId: entity.entityId,
  running: entity.running,
  slaughtering: entity.slaughtering,
  chickens: entity.chickens,
  zones: entity.zones,
}));

export const getSyncedCropFarmConfigurations = (
  state: SyncedCropFarmState,
): CurrentCropFarmConfiguration[] => {
  const grouped = new Map<string, CurrentCropFarmConfiguration>();

  for (const configuration of state.configurations) {
    const tierId = configuration.prototypeId === "FarmT4" ? "greenhouseII" : "greenhouse";
    const schedule = configuration.schedule.map(cropId => (
      cropId === null ? "none" : (gameCropIds[cropId] ?? cropId)
    ));
    const key = [tierId, schedule.join("/"), configuration.fertilityTargetPercent].join("|");
    const existing = grouped.get(key);

    if (existing) {
      existing.built += configuration.built;
      existing.running += configuration.running;
      continue;
    }

    grouped.set(key, {
      tierId,
      schedule,
      fertilityTargetPercent: configuration.fertilityTargetPercent,
      built: configuration.built,
      running: configuration.running,
    });
  }

  return [...grouped.values()];
};

const mapCropSchedule = (schedule: readonly (string | null)[]) => schedule.map(cropId => (
  cropId === null ? "none" : (gameCropIds[cropId] ?? cropId)
));

export const getSyncedCropFarmEntities = (
  state: SyncedCropFarmState,
): CurrentCropFarmEntity[] => {
  if (state.entities?.length > 0) {
    return state.entities.map(entity => ({
      entityId: entity.entityId,
      tierId: entity.prototypeId === "FarmT4" ? "greenhouseII" : "greenhouse",
      schedule: mapCropSchedule(entity.schedule),
      fertilityTargetPercent: entity.fertilityTargetPercent,
      running: entity.running,
      zones: entity.zones ?? [],
    }));
  }

  let pseudoEntityId = -1;

  return state.configurations.flatMap(configuration => Array.from(
    { length: configuration.built },
    (_, index): CurrentCropFarmEntity => ({
      entityId: pseudoEntityId--,
      tierId: configuration.prototypeId === "FarmT4" ? "greenhouseII" : "greenhouse",
      schedule: mapCropSchedule(configuration.schedule),
      fertilityTargetPercent: configuration.fertilityTargetPercent,
      running: index < configuration.running,
    }),
  ));
};

export const getCropFarmConfigurationsFromEntities = (
  entities: readonly CurrentCropFarmEntity[],
): CurrentCropFarmConfiguration[] => {
  const grouped = new Map<string, CurrentCropFarmConfiguration>();

  for (const entity of entities) {
    const key = [
      entity.tierId,
      entity.schedule.join("/"),
      entity.fertilityTargetPercent,
    ].join("|");
    const existing = grouped.get(key);

    if (existing) {
      existing.built++;
      existing.running += Number(entity.running);
      continue;
    }

    grouped.set(key, {
      tierId: entity.tierId,
      schedule: [...entity.schedule],
      fertilityTargetPercent: entity.fertilityTargetPercent,
      built: 1,
      running: Number(entity.running),
    });
  }

  return [...grouped.values()];
};
