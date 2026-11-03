import { gameCropIds, gameFertilizerIds } from '../../crop-farming-state';
import { type CurrentChickenFarmEntity } from "../../db/chicken-farm";
import {
  type CurrentCropFarmEntity,
} from "../../db/crop-farming";
import {
  type SyncedChickenFarmEntity,
  type SyncedCropFarmEntity,
} from "../../game-state";


const getSyncedFertilizerId = (
  fertilizerProductId: string | null | undefined,
) => fertilizerProductId == null
  ? null
  : gameFertilizerIds[fertilizerProductId] ?? null;

export const getSyncedChickenFarmEntities = (
  entities: readonly SyncedChickenFarmEntity[],
): CurrentChickenFarmEntity[] => entities.map(entity => ({
  entityId: entity.entityId,
  running: entity.running,
  slaughtering: entity.slaughtering,
  chickens: entity.chickens,
  zones: entity.zones,
}));

// Farm.onNewDay skips unassigned slots; Crop_NoCrop is an actual timed crop.
const mapCropSchedule = (schedule: readonly (string | null)[]) => schedule.flatMap(cropId => (
  cropId === null ? [] : [gameCropIds[cropId] ?? cropId]
));

export const getSyncedCropFarmEntities = (
  entities: readonly SyncedCropFarmEntity[],
): CurrentCropFarmEntity[] => entities.map(entity => ({
  entityId: entity.entityId,
  tierId: entity.prototypeId === "FarmT4" ? "greenhouseII" : "greenhouse",
  schedule: mapCropSchedule(entity.schedule),
  fertilityTargetPercent: entity.fertilityTargetPercent,
  fertilizerId: getSyncedFertilizerId(
    entity.fertilizerProductId,
  ),
  running: entity.running,
  zones: entity.zones ?? [],
}));
